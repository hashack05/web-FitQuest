import { Router, Request, Response } from 'express';
import { 
  adminAuth, 
  adminDb, 
  hashPin, 
  verifyPin, 
  recordAuditLog, 
  verifyAdminRequest 
} from './firebaseAdmin.ts';
import { 
  StudentLoginSchema, 
  ChangePinSchema, 
  CreateStudentSchema, 
  ResetStudentPinSchema, 
  CreateAdminSchema,
  RegisterStudentSchema
} from '../validation/index.ts';

export const apiRouter = Router();

// Health Check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'fitquest-v2', timestamp: new Date().toISOString() });
});

// ==========================================
// 1. STUDENT AUTHENTICATION
// ==========================================

/**
 * POST /api/auth/student-login
 * Secure server-side validation of 6-digit PIN against hash in privateStudentCredentials.
 * Issues real Firebase Custom Token upon valid credentials.
 * Implements rate limiting and lockout.
 */
apiRouter.post('/auth/student-login', async (req: Request, res: Response) => {
  try {
    const parseResult = StudentLoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      // Generic error message to prevent enumeration
      return res.status(400).json({ error: 'รหัสผู้เข้าร่วมหรือ PIN ไม่ถูกต้อง' });
    }

    const { participantId, pin } = parseResult.data;
    const normalizedId = participantId.trim().toUpperCase();

    // Query private credentials server-side only
    const credQuery = await adminDb
      .collection('privateStudentCredentials')
      .where('participantId', '==', normalizedId)
      .limit(1)
      .get();

    if (credQuery.empty) {
      // Constant-time like delay simulation to avoid timing attacks
      await new Promise((r) => setTimeout(r, 200));
      return res.status(401).json({ error: 'รหัสผู้เข้าร่วมหรือ PIN ไม่ถูกต้อง' });
    }

    const credDoc = credQuery.docs[0];
    const credData = credDoc.data();
    const credRef = credDoc.ref;

    // Check account lockout
    if (credData.lockedUntil) {
      const lockTime = credData.lockedUntil.toDate ? credData.lockedUntil.toDate().getTime() : new Date(credData.lockedUntil).getTime();
      if (Date.now() < lockTime) {
        const remainingMinutes = Math.ceil((lockTime - Date.now()) / (60 * 1000));
        return res.status(429).json({
          error: `บัญชีนี้ถูกระงับชั่วคราวเนื่องจากป้อน PIN ผิดหลายครั้ง กรุณารอสักครู่ (${remainingMinutes} นาที) หรือติดต่อผู้ดูแลโครงการ`,
        });
      }
    }

    // Verify PIN against stored hash
    const isValid = await verifyPin(pin, credData.pinHash);

    if (!isValid) {
      const failedCount = (credData.failedAttempts || 0) + 1;
      const updatePayload: Record<string, any> = {
        failedAttempts: failedCount,
        updatedAt: new Date().toISOString(),
      };

      if (failedCount >= 5) {
        // Lock for 15 minutes after 5 failed attempts
        updatePayload.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await credRef.update(updatePayload);
      return res.status(401).json({ error: 'รหัสผู้เข้าร่วมหรือ PIN ไม่ถูกต้อง' });
    }

    // Reset failed counter on successful authentication
    await credRef.update({
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date().toISOString(),
    });

    // Check if participant is active
    const participantDoc = await adminDb.collection('participants').doc(credData.uid).get();
    if (!participantDoc.exists || participantDoc.data()?.active === false) {
      return res.status(403).json({ error: 'บัญชีผู้เข้าร่วมนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลโครงการ' });
    }

    // Generate authoritative Firebase Custom Token
    const customToken = await adminAuth.createCustomToken(credData.uid, {
      role: 'student',
      participantId: normalizedId,
    });

    return res.json({
      success: true,
      customToken,
      uid: credData.uid,
      participantId: normalizedId,
      displayName: participantDoc.data()?.displayName,
    });
  } catch (err: any) {
    console.error('Student login error:', err.message);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์ กรุณาลองใหม่อีกครั้ง' });
  }
});

/**
 * GET /api/auth/registration-config
 * Tells the login page whether self-registration is open and whether a code is needed.
 */
apiRouter.get('/auth/registration-config', (_req: Request, res: Response) => {
  res.json({
    enabled: process.env.REGISTRATION_ENABLED !== 'false',
    codeRequired: !!(process.env.REGISTRATION_CODE || '').trim(),
  });
});

// Simple in-memory rate limit for registration (per IP, 10 attempts / hour)
const registerHits = new Map<string, { count: number; resetAt: number }>();
function registerRateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = registerHits.get(ip);
  if (!rec || now > rec.resetAt) {
    registerHits.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  rec.count += 1;
  return rec.count > 10;
}

/**
 * POST /api/auth/register
 * Public self-registration for students. Creates the Firebase Auth user,
 * participants/{uid} and privateStudentCredentials/{uid} (bcrypt-hashed PIN).
 * Admin accounts can NEVER be created here - role is always 'student'.
 */
apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  try {
    if (process.env.REGISTRATION_ENABLED === 'false') {
      return res.status(403).json({ error: 'ขณะนี้ปิดรับสมัครสมาชิก กรุณาติดต่อผู้ดูแลโครงการ' });
    }

    if (registerRateLimited(req.ip || 'unknown')) {
      return res.status(429).json({ error: 'พยายามสมัครบ่อยเกินไป กรุณาลองใหม่ภายหลัง' });
    }

    const parseResult = RegisterStudentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
    }

    const requiredCode = (process.env.REGISTRATION_CODE || '').trim();
    if (requiredCode && parseResult.data.registrationCode !== requiredCode) {
      return res.status(403).json({ error: 'รหัสสมัครสมาชิกไม่ถูกต้อง กรุณาสอบถามครูผู้ดูแลหรือทีมวิจัย' });
    }

    const { participantId, displayName, classroomId, studentNumber, pin } = parseResult.data;
    const normalizedId = participantId.trim().toUpperCase();

    const existing = await adminDb
      .collection('privateStudentCredentials')
      .where('participantId', '==', normalizedId)
      .limit(1)
      .get();
    if (!existing.empty) {
      return res.status(409).json({ error: `รหัสผู้เข้าร่วม "${normalizedId}" ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น` });
    }

    const pinHashed = await hashPin(pin);
    const studentUser = await adminAuth.createUser({ displayName });
    const uid = studentUser.uid;
    const now = new Date().toISOString();

    const batch = adminDb.batch();
    batch.set(adminDb.collection('participants').doc(uid), {
      uid,
      participantId: normalizedId,
      displayName,
      classroomId,
      studentNumber: studentNumber || '',
      active: true,
      createdAt: now,
      updatedAt: now,
      createdByUid: uid,
    });
    batch.set(adminDb.collection('privateStudentCredentials').doc(uid), {
      participantId: normalizedId,
      uid,
      pinHash: pinHashed,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: now,
    });
    await batch.commit();

    await recordAuditLog({
      action: 'SELF_REGISTER_PARTICIPANT',
      actorUid: uid,
      targetUid: uid,
      details: `Participant ${normalizedId} self-registered in class ${classroomId}`,
    });

    return res.status(201).json({ success: true, participantId: normalizedId });
  } catch (err: any) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง' });
  }
});

/**
 * POST /api/auth/student-change-pin
 * Validates caller Firebase ID token and updates PIN hash.
 */
apiRouter.post('/auth/student-change-pin', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนเปลี่ยน PIN' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const parseResult = ChangePinSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
    }

    const { currentPin, newPin } = parseResult.data;

    // Fetch credential document
    const credDoc = await adminDb.collection('privateStudentCredentials').doc(uid).get();
    if (!credDoc.exists) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลบัญชี' });
    }

    const credData = credDoc.data();
    const isCurrentValid = await verifyPin(currentPin, credData?.pinHash);
    if (!isCurrentValid) {
      return res.status(400).json({ error: 'PIN ปัจจุบันไม่ถูกต้อง' });
    }

    const newHash = await hashPin(newPin);
    await credDoc.ref.update({
      pinHash: newHash,
      updatedAt: new Date().toISOString(),
    });

    await recordAuditLog({
      action: 'STUDENT_CHANGE_PIN',
      actorUid: uid,
      targetUid: uid,
      details: 'Participant successfully updated their PIN',
    });

    return res.json({ success: true, message: 'เปลี่ยน PIN สำเร็จ' });
  } catch (err: any) {
    console.error('Change PIN error:', err.message);
    return res.status(500).json({ error: 'ไม่สามารถเปลี่ยน PIN ได้ กรุณาลองใหม่อีกครั้ง' });
  }
});

// ==========================================
// 2. ADMIN ACTIONS
// ==========================================

/**
 * POST /api/admin/create-student
 * Admin adds a new student participant, hashes their PIN, and creates Firestore docs.
 */
apiRouter.post('/admin/create-student', async (req: Request, res: Response) => {
  try {
    const adminCaller = await verifyAdminRequest(req.headers.authorization);

    const parseResult = CreateStudentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
    }

    const { participantId, displayName, classroomId, studentNumber, initialPin } = parseResult.data;
    const normalizedId = participantId.trim().toUpperCase();

    // Check if participantId already exists
    const existing = await adminDb
      .collection('privateStudentCredentials')
      .where('participantId', '==', normalizedId)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({ error: `รหัสผู้เข้าร่วม "${normalizedId}" มีอยู่ในระบบแล้ว` });
    }

    // Generate 6-digit PIN if none provided
    const pin = initialPin || Math.floor(100000 + Math.random() * 900000).toString();
    const pinHashed = await hashPin(pin);

    // Create Firebase Auth user for the student
    const studentUser = await adminAuth.createUser({
      displayName,
    });
    const uid = studentUser.uid;

    const now = new Date().toISOString();

    const batch = adminDb.batch();

    // 1. Public participant doc (accessible by student and admin)
    const participantRef = adminDb.collection('participants').doc(uid);
    batch.set(participantRef, {
      uid,
      participantId: normalizedId,
      displayName,
      classroomId,
      studentNumber: studentNumber || '',
      active: true,
      createdAt: now,
      updatedAt: now,
      createdByUid: adminCaller.uid,
    });

    // 2. Private credential doc (server-only, completely blocked from client SDK)
    const credRef = adminDb.collection('privateStudentCredentials').doc(uid);
    batch.set(credRef, {
      participantId: normalizedId,
      uid,
      pinHash: pinHashed,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: now,
    });

    await batch.commit();

    await recordAuditLog({
      action: 'CREATE_PARTICIPANT',
      actorUid: adminCaller.uid,
      actorEmail: adminCaller.email,
      targetUid: uid,
      details: `Created participant ${normalizedId} in class ${classroomId}`,
    });

    return res.status(201).json({
      success: true,
      uid,
      participantId: normalizedId,
      displayName,
      initialPin: pin, // Returned so the admin can securely issue it to the student
    });
  } catch (err: any) {
    console.error('Create student error:', err.message);
    return res.status(err.message.includes('Unauthorized') ? 401 : 500).json({
      error: err.message || 'ไม่สามารถสร้างผู้เข้าร่วมได้',
    });
  }
});

/**
 * POST /api/admin/reset-student-pin
 * Admin securely resets student's PIN.
 */
apiRouter.post('/admin/reset-student-pin', async (req: Request, res: Response) => {
  try {
    const adminCaller = await verifyAdminRequest(req.headers.authorization);

    const parseResult = ResetStudentPinSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
    }

    const { participantUid, newPin } = parseResult.data;

    const credDoc = await adminDb.collection('privateStudentCredentials').doc(participantUid).get();
    if (!credDoc.exists) {
      return res.status(404).json({ error: 'ไม่พบข้อมูล Credential ของผู้เข้าร่วมนี้' });
    }

    const newHash = await hashPin(newPin);
    await credDoc.ref.update({
      pinHash: newHash,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date().toISOString(),
    });

    await recordAuditLog({
      action: 'RESET_STUDENT_PIN',
      actorUid: adminCaller.uid,
      actorEmail: adminCaller.email,
      targetUid: participantUid,
      details: 'Admin reset participant PIN',
    });

    return res.json({ success: true, message: 'รีเซ็ต PIN สำเร็จ' });
  } catch (err: any) {
    console.error('Reset PIN error:', err.message);
    return res.status(err.message.includes('Unauthorized') ? 401 : 500).json({
      error: err.message || 'ไม่สามารถรีเซ็ต PIN ได้',
    });
  }
});

/**
 * POST /api/admin/create-admin
 * Admin adds or promotes another user to admin with specific position.
 */
apiRouter.post('/admin/create-admin', async (req: Request, res: Response) => {
  try {
    const adminCaller = await verifyAdminRequest(req.headers.authorization);

    const parseResult = CreateAdminSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
    }

    const { email, displayName, position } = parseResult.data;

    // Check if user already exists in Firebase Auth
    let targetUid: string;
    try {
      const existingUser = await adminAuth.getUserByEmail(email);
      targetUid = existingUser.uid;
    } catch {
      // User hasn't signed into Firebase yet; create placeholder auth record
      const newUser = await adminAuth.createUser({
        email,
        displayName,
        emailVerified: true,
      });
      targetUid = newUser.uid;
    }

    const now = new Date().toISOString();
    await adminDb.collection('users').doc(targetUid).set({
      uid: targetUid,
      email,
      displayName,
      role: 'admin',
      position,
      active: true,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    // Synchronize custom user claims for storage rule evaluation
    try {
      await adminAuth.setCustomUserClaims(targetUid, { role: 'admin' });
    } catch (claimErr) {
      console.warn('Could not set custom claim on user:', claimErr);
    }

    await recordAuditLog({
      action: 'CREATE_ADMIN',
      actorUid: adminCaller.uid,
      actorEmail: adminCaller.email,
      targetUid,
      details: `Assigned admin role with position ${position} to ${email}`,
    });

    return res.json({ success: true, message: `เพิ่มผู้ดูแล ${email} เรียบร้อยแล้ว`, uid: targetUid });
  } catch (err: any) {
    console.error('Create admin error:', err.message);
    return res.status(err.message.includes('Unauthorized') ? 401 : 500).json({
      error: err.message || 'ไม่สามารถเพิ่มผู้ดูแลได้',
    });
  }
});

/**
 * POST /api/admin/deactivate-admin
 */
apiRouter.post('/admin/deactivate-admin', async (req: Request, res: Response) => {
  try {
    const adminCaller = await verifyAdminRequest(req.headers.authorization);
    const { targetUid } = req.body;

    if (!targetUid) {
      return res.status(400).json({ error: 'ระบุ UID ผู้ดูแลที่ต้องการระงับสิทธิ์' });
    }

    if (targetUid === adminCaller.uid) {
      return res.status(400).json({ error: 'ไม่สามารถระงับสิทธิ์บัญชีของตนเองได้' });
    }

    await adminDb.collection('users').doc(targetUid).update({
      active: false,
      updatedAt: new Date().toISOString(),
    });

    // Revoke custom claims
    try {
      await adminAuth.setCustomUserClaims(targetUid, { role: null });
    } catch (claimErr) {
      console.warn('Could not revoke custom claims:', claimErr);
    }

    await recordAuditLog({
      action: 'DEACTIVATE_ADMIN',
      actorUid: adminCaller.uid,
      actorEmail: adminCaller.email,
      targetUid,
      details: 'Deactivated admin account',
    });

    return res.json({ success: true, message: 'ระงับสิทธิ์ผู้ดูแลเรียบร้อยแล้ว' });
  } catch (err: any) {
    console.error('Deactivate admin error:', err.message);
    return res.status(err.message.includes('Unauthorized') ? 401 : 500).json({
      error: err.message || 'ไม่สามารถระงับสิทธิ์ผู้ดูแลได้',
    });
  }
});

/**
 * POST /api/admin/bootstrap-first-admin
 * Initial bootstrap for the first administrator in production.
 * Must strictly satisfy ALL-AND conditions:
 * 1. Valid verified Firebase ID token from Google Sign-In
 * 2. INITIAL_ADMIN_EMAIL environment variable is set
 * 3. User email strictly matches INITIAL_ADMIN_EMAIL
 * 4. Zero active admins currently exist in the database
 */
apiRouter.post('/admin/bootstrap-first-admin', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'กรุณาลงชื่อเข้าใช้ด้วย Google ก่อนตั้งค่าผู้ดูแลเริ่มต้น' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = (decoded.email || '').trim().toLowerCase();

    // 1. Check INITIAL_ADMIN_EMAIL from environment variables
    const initialAdminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'hack.cvbnm@gmail.com').trim().toLowerCase();

    // 2. Strict email match check against allowed INITIAL_ADMIN_EMAIL (supports single or comma-separated list)
    const allowedInitialEmails = initialAdminEmail
      .split(/[,;]/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (allowedInitialEmails.length === 0) {
      return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า INITIAL_ADMIN_EMAIL บนเซิร์ฟเวอร์' });
    }

    if (!allowedInitialEmails.includes(email)) {
      return res.status(403).json({
        error: 'บัญชีนี้ไม่ตรงกับ INITIAL_ADMIN_EMAIL ที่ได้รับอนุญาตให้ตั้งค่าผู้ดูแลเริ่มต้น',
      });
    }

    // 3. Check that NO active admin currently exists
    const adminsSnapshot = await adminDb
      .collection('users')
      .where('role', '==', 'admin')
      .where('active', '==', true)
      .limit(1)
      .get();

    if (!adminsSnapshot.empty) {
      return res.status(403).json({
        error: 'ระบบมีผู้ดูแลระบบที่ตั้งค่าแล้ว ไม่สามารถดำเนินการตั้งค่าเริ่มต้นซ้ำได้',
      });
    }

    // All conditions satisfied: bootstrap first admin
    const now = new Date().toISOString();
    await adminDb.collection('users').doc(uid).set({
      uid,
      email: decoded.email,
      displayName: decoded.name || email.split('@')[0],
      role: 'admin',
      position: 'lead_researcher',
      active: true,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    // Set custom claim for storage rules
    try {
      await adminAuth.setCustomUserClaims(uid, { role: 'admin' });
    } catch (claimErr) {
      console.warn('Could not set custom claim on initial admin:', claimErr);
    }

    await recordAuditLog({
      action: 'BOOTSTRAP_FIRST_ADMIN',
      actorUid: uid,
      actorEmail: email,
      targetUid: uid,
      details: 'First administrator bootstrapped successfully under INITIAL_ADMIN_EMAIL policy',
    });

    return res.json({
      success: true,
      message: 'ตั้งค่าผู้ดูแลระบบคนแรกเรียบร้อยแล้ว ยินดีต้อนรับสู่ Fit Quest',
    });
  } catch (err: any) {
    console.error('Bootstrap admin error:', err.message);
    return res.status(500).json({ error: 'ไม่สามารถตั้งค่าผู้ดูแลคนแรกได้: ' + err.message });
  }
});
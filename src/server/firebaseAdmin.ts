import 'dotenv/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// Load config from firebase-applet-config.json
let projectId = 'webd-7be4c';
let databaseId: string | undefined;
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.projectId) {
      projectId = parsed.projectId;
    }
    if (parsed.firestoreDatabaseId && parsed.firestoreDatabaseId !== '(default)') {
      databaseId = parsed.firestoreDatabaseId;
    }
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json:', e);
}

// Initialize Admin App singleton
let adminApp: App;
if (getApps().length === 0) {
  const adminPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;
  const adminClientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

  if (adminPrivateKey && adminClientEmail) {
    adminApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || projectId,
        clientEmail: adminClientEmail,
        privateKey: adminPrivateKey,
      }),
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || projectId,
    });
  } else {
    // Uses Google Cloud Application Default Credentials (ADC) or project ID
    adminApp = initializeApp({
      projectId,
    });
  }
} else {
  adminApp = getApps()[0];
}

export const adminAuth: Auth = getAuth(adminApp);
export const adminDb: Firestore = databaseId ? getFirestore(adminApp, databaseId) : getFirestore(adminApp);

// Specific database if configured
export function getAdminFirestore() {
  return adminDb;
}

// PIN Hashing Utilities
export async function hashPin(pin: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pin, salt);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// Server Audit Logging Helper
export async function recordAuditLog(params: {
  action: string;
  actorUid: string;
  actorEmail?: string;
  targetUid?: string;
  recordId?: string;
  details?: string;
}) {
  try {
    await adminDb.collection('auditLogs').add({
      ...params,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
}

// Admin Token Verifier & ABAC Check
export async function verifyAdminRequest(authHeader?: string): Promise<{
  uid: string;
  email?: string;
}> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or malformed Authorization header');
  }

  const token = authHeader.split('Bearer ')[1];
  const decoded = await adminAuth.verifyIdToken(token);
  const uid = decoded.uid;

  // Query Firestore to verify active admin role - NEVER trust claims alone
  let userDoc = await adminDb.collection('users').doc(uid).get();

  // Designated admin email (hardcoded in client/rules too): materialise its users/{uid} doc
  // so it can manage other admins from the admin panel.
  const designated = ['hack.cvbnm@gmail.com'];
  const callerEmail = (decoded.email || '').toLowerCase();
  if (!userDoc.exists && callerEmail && decoded.email_verified !== false && designated.includes(callerEmail)) {
    const now = new Date().toISOString();
    await adminDb.collection('users').doc(uid).set({
      uid,
      email: decoded.email,
      displayName: decoded.name || callerEmail.split('@')[0],
      role: 'admin',
      position: 'lead_researcher',
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    try {
      await adminAuth.setCustomUserClaims(uid, { role: 'admin' });
    } catch {
      // non-fatal
    }
    userDoc = await adminDb.collection('users').doc(uid).get();
  }

  if (!userDoc.exists) {
    throw new Error('บัญชีนี้ไม่ได้รับอนุญาตให้เข้าใช้งาน Fit Quest (Admin role not found)');
  }

  const userData = userDoc.data();
  if (userData?.role !== 'admin' || userData?.active !== true) {
    throw new Error('บัญชีนี้ไม่ได้รับอนุญาตให้เข้าใช้งาน Fit Quest (Inactive or non-admin)');
  }

  return {
    uid,
    email: decoded.email,
  };
}

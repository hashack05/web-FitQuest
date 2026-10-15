import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithCustomToken, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, testConnection } from '../../lib/firebase/client.ts';
import { UserDoc, ParticipantDoc, UserRole } from '../../types/index.ts';

export interface RegisterInput {
  participantId: string;
  displayName: string;
  classroomId: string;
  studentNumber?: string;
  pin: string;
  confirmPin: string;
  registrationCode?: string;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  role: UserRole | null;
  adminProfile: UserDoc | null;
  studentProfile: ParticipantDoc | null;
  isLoading: boolean;
  loginStudent: (participantId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  registerStudent: (data: RegisterInput) => Promise<{ success: boolean; error?: string }>;
  loginAdminWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  bootstrapFirstAdmin: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  syncStatus: 'synced' | 'syncing' | 'error';
  setSyncStatus: (status: 'synced' | 'syncing' | 'error') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session Idle Policy: 12 Hours
const IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'fitquest_last_activity';

// Helper to get persistent last activity without resetting upon page refresh
const getStoredLastActivity = (): number => {
  if (typeof window === 'undefined') return Date.now();
  try {
    const val = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!val) {
      const now = Date.now();
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      return now;
    }
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? Date.now() : parsed;
  } catch {
    return Date.now();
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [adminProfile, setAdminProfile] = useState<UserDoc | null>(null);
  const [studentProfile, setStudentProfile] = useState<ParticipantDoc | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');

  const lastActivityRef = useRef<number>(getStoredLastActivity());

  // Throttled update of user activity timestamp to localStorage and ref
  const recordUserActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current > 10000) {
      lastActivityRef.current = now;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
        } catch {
          // ignore storage quota issues
        }
      }
    }
  }, []);

  // Set up activity event listeners
  useEffect(() => {
    window.addEventListener('mousemove', recordUserActivity);
    window.addEventListener('keydown', recordUserActivity);
    window.addEventListener('touchstart', recordUserActivity);
    window.addEventListener('click', recordUserActivity);

    // Idle timer check every 1 minute
    const interval = setInterval(() => {
      const lastActive = getStoredLastActivity();
      if (auth.currentUser && Date.now() - lastActive > IDLE_TIMEOUT_MS) {
        console.warn('Session expired due to 12-hour inactivity policy.');
        signOut(auth);
        setRole(null);
        setAdminProfile(null);
        setStudentProfile(null);
        setAuthError('เซสชันการใช้งานหมดอายุเนื่องจากไม่มีกิจกรรมเกิน 12 ชั่วโมง กรุณาเข้าสู่ระบบใหม่');
      }
    }, 60 * 1000);

    return () => {
      window.removeEventListener('mousemove', recordUserActivity);
      window.removeEventListener('keydown', recordUserActivity);
      window.removeEventListener('touchstart', recordUserActivity);
      window.removeEventListener('click', recordUserActivity);
      clearInterval(interval);
    };
  }, [recordUserActivity]);

  // Initial connection test
  useEffect(() => {
    testConnection();
  }, []);

  // Real-time listener for Active Admin Profile (Issue 5: Instant deactivation sync)
  useEffect(() => {
    if (!firebaseUser || role !== 'admin') return;

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubAdminSnapshot = onSnapshot(userDocRef, async (snap) => {
      if (!snap.exists()) {
        if (firebaseUser.email?.toLowerCase() === 'hack.cvbnm@gmail.com') {
          return;
        }
        // Admin document removed
        console.warn('Admin record no longer exists, revoking session.');
        await signOut(auth);
        setRole(null);
        setAdminProfile(null);
        setAuthError('บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานแล้ว');
        return;
      }

      const uData = snap.data() as UserDoc;
      if (uData.role !== 'admin' || uData.active === false) {
        // Admin deactivated in real-time by another admin
        console.warn('Admin account deactivated, terminating session immediately.');
        await signOut(auth);
        setRole(null);
        setAdminProfile(null);
        setAuthError('บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานแล้ว (สถานะถูกระงับ)');
      } else {
        // Sync any updated admin data (e.g. position change)
        setAdminProfile({
          ...uData,
          uid: uData.uid || firebaseUser.uid,
          email: uData.email || firebaseUser.email || '',
        });
      }
    }, (err) => {
      console.warn('Error in admin realtime listener:', err);
    });

    return () => unsubAdminSnapshot();
  }, [firebaseUser, role]);

  // Authoritative Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(true);

      if (!user) {
        setFirebaseUser(null);
        setRole(null);
        setAdminProfile(null);
        setStudentProfile(null);
        setIsLoading(false);
        return;
      }

      // Check if session has exceeded 12-hour idle timeout across reloads
      const lastActive = getStoredLastActivity();
      if (Date.now() - lastActive > IDLE_TIMEOUT_MS) {
        console.warn('Persisted session exceeded 12-hour idle window, logging out.');
        await signOut(auth);
        setFirebaseUser(null);
        setRole(null);
        setAdminProfile(null);
        setStudentProfile(null);
        setAuthError('เซสชันการใช้งานหมดอายุเนื่องจากไม่มีกิจกรรมเกิน 12 ชั่วโมง กรุณาเข้าสู่ระบบใหม่');
        setIsLoading(false);
        return;
      }

      setFirebaseUser(user);

      try {
        // 1. Check if user is an Administrator in users/{uid} or users/{email}
        let userSnap = await getDoc(doc(db, 'users', user.uid));
        if (!userSnap.exists() && user.email) {
          const emailSnap = await getDoc(doc(db, 'users', user.email.toLowerCase()));
          if (emailSnap.exists()) {
            userSnap = emailSnap;
          }
        }

        if (userSnap.exists()) {
          const uData = userSnap.data() as UserDoc;
          if (uData.role === 'admin' && uData.active !== false) {
            setRole('admin');
            setAdminProfile({
              ...uData,
              uid: uData.uid || user.uid,
              email: uData.email || user.email || '',
            });
            setStudentProfile(null);
            setIsLoading(false);
            return;
          } else {
            // Inactive or non-admin account
            await signOut(auth);
            setRole(null);
            setAuthError('บัญชีนี้ไม่ได้รับอนุญาตให้เข้าใช้งาน Fit Quest (สถานะถูกระงับหรือไม่ได้รับสิทธิ์)');
            setIsLoading(false);
            return;
          }
        }

        // Designated registered admin Google account
        if (user.email && user.email.toLowerCase() === 'hack.cvbnm@gmail.com') {
          setRole('admin');
          setAdminProfile({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'Administrator',
            role: 'admin',
            position: 'lead_researcher',
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          setStudentProfile(null);
          setIsLoading(false);
          return;
        }

        // 2. Check if user is a Student in participants/{uid}
        const participantDocRef = doc(db, 'participants', user.uid);
        const participantSnap = await getDoc(participantDocRef);

        if (participantSnap.exists()) {
          const pData = participantSnap.data() as ParticipantDoc;
          if (pData.active !== false) {
            setRole('student');
            setStudentProfile(pData);
            setAdminProfile(null);
            setIsLoading(false);
            return;
          } else {
            await signOut(auth);
            setRole(null);
            setAuthError('บัญชีผู้เข้าร่วมนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลโครงการ');
            setIsLoading(false);
            return;
          }
        }

        // User signed in but neither admin nor student profile exists
        // Clean sign out - NEVER auto-bootstrap
        await signOut(auth);
        setRole(null);
        setAdminProfile(null);
        setStudentProfile(null);
        setAuthError('บัญชีนี้ไม่ได้รับอนุญาตให้เข้าใช้งาน Fit Quest');
      } catch (err: any) {
        console.error('Error fetching user profile:', err);
        setAuthError('ไม่สามารถโหลดข้อมูลสิทธิ์ผู้ใช้งานได้: ' + (err.message || ''));
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Student login via server endpoint
  const loginStudent = async (participantId: string, pin: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, pin }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'รหัสผู้เข้าร่วมหรือ PIN ไม่ถูกต้อง');
        setIsLoading(false);
        return { success: false, error: data.error };
      }

      // Authenticate with Firebase using Custom Token
      await signInWithCustomToken(auth, data.customToken);
      recordUserActivity();
      return { success: true };
    } catch (err: any) {
      const msg = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง';
      setAuthError(msg);
      setIsLoading(false);
      return { success: false, error: msg };
    }
  };

  // Self-service student registration, then automatic sign-in
  const registerStudent = async (input: RegisterInput) => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || 'ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง';
        setAuthError(msg);
        return { success: false, error: msg };
      }
      // Auto-login with the credentials just created
      return await loginStudent(input.participantId.trim(), input.pin);
    } catch {
      const msg = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  // Admin login via Google Auth (STRICT: Never calls bootstrap automatically)
  const loginAdminWithGoogle = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;

      // Verify in Firestore users/{uid} or users/{email}
      let userSnap = await getDoc(doc(db, 'users', user.uid));
      if (!userSnap.exists() && user.email) {
        const emailSnap = await getDoc(doc(db, 'users', user.email.toLowerCase()));
        if (emailSnap.exists()) {
          userSnap = emailSnap;
        }
      }

      if (userSnap.exists()) {
        const uData = userSnap.data() as UserDoc;
        if (uData.role !== 'admin' || uData.active === false) {
          await signOut(auth);
          setRole(null);
          const errMsg = 'บัญชีนี้ไม่ได้รับอนุญาตให้เข้าใช้งาน Fit Quest (สถานะถูกระงับหรือไม่ได้รับสิทธิ์)';
          setAuthError(errMsg);
          setIsLoading(false);
          return { success: false, error: errMsg };
        }

        setRole('admin');
        setAdminProfile({
          ...uData,
          uid: uData.uid || user.uid,
          email: uData.email || user.email || '',
        });
        recordUserActivity();
        setIsLoading(false);
        return { success: true };
      }

      // Check if designated registered admin Google account
      if (user.email && user.email.toLowerCase() === 'hack.cvbnm@gmail.com') {
        setRole('admin');
        setAdminProfile({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Administrator',
          role: 'admin',
          position: 'lead_researcher',
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        recordUserActivity();
        setIsLoading(false);
        return { success: true };
      }

      // STRICT: Reject immediately, signOut, and NEVER auto-bootstrap unauthorized accounts
      await signOut(auth);
      setRole(null);
      const errMsg = 'บัญชีนี้ไม่ได้รับอนุญาตให้เข้าใช้งาน Fit Quest';
      setAuthError(errMsg);
      setIsLoading(false);
      return { success: false, error: errMsg };
    } catch (err: any) {
      console.error('Google login error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setIsLoading(false);
        return { success: false, error: 'ยกเลิกการเข้าสู่ระบบ' };
      }
      const errMsg = 'เกิดข้อผิดพลาดในการลงชื่อเข้าใช้ด้วย Google: ' + (err.message || '');
      setAuthError(errMsg);
      setIsLoading(false);
      return { success: false, error: errMsg };
    }
  };

  // Dedicated Bootstrap first admin flow (Requires explicit user trigger and server validation)
  const bootstrapFirstAdmin = async () => {
    try {
      // Must authenticate with Google first
      const cred = await signInWithPopup(auth, googleProvider);
      const idToken = await cred.user.getIdToken();

      const res = await fetch('/api/admin/bootstrap-first-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        await signOut(auth);
        return { success: false, error: data.error || 'ไม่สามารถตั้งค่าผู้ดูแลคนแรกได้' };
      }

      // Re-read user profile
      const userSnap = await getDoc(doc(db, 'users', cred.user.uid));
      if (userSnap.exists()) {
        const uData = userSnap.data() as UserDoc;
        setRole('admin');
        setAdminProfile({ ...uData, uid: uData.uid || cred.user.uid });
        recordUserActivity();
      }
      return { success: true };
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        return { success: false, error: 'ยกเลิกการเข้าสู่ระบบ' };
      }
      return { success: false, error: err.message || 'ไม่สามารถตั้งค่าผู้ดูแลคนแรกได้' };
    }
  };

  const logout = async () => {
    setIsLoading(true);
    await signOut(auth);
    setRole(null);
    setAdminProfile(null);
    setStudentProfile(null);
    setAuthError(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(LAST_ACTIVITY_KEY);
      } catch {
        // ignore
      }
    }
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        role,
        adminProfile,
        studentProfile,
        isLoading,
        loginStudent,
        registerStudent,
        loginAdminWithGoogle,
        bootstrapFirstAdmin,
        logout,
        authError,
        setAuthError,
        syncStatus,
        setSyncStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

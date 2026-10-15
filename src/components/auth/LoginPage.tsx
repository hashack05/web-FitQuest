import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  KeyRound, 
  User, 
  ShieldCheck, 
  Lock, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff,
  Sparkles,
  HelpCircle,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext.tsx';
import { TwoDeviceGuideModal } from '../common/TwoDeviceGuideModal.tsx';

export const LoginPage: React.FC = () => {
  const { loginStudent, registerStudent, loginAdminWithGoogle, authError, setAuthError, bootstrapFirstAdmin } = useAuth();
  
  // Tab toggle: 'student' | 'admin'
  const [activeTab, setActiveTab] = useState<'student' | 'register' | 'admin'>('student');

  // Input states strictly start empty (No hardcoded credentials, No prefill)
  const [participantId, setParticipantId] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showBootstrapModal, setShowBootstrapModal] = useState(false);

  // Registration form state
  const [regConfig, setRegConfig] = useState<{ enabled: boolean; codeRequired: boolean }>({ enabled: true, codeRequired: false });
  const [reg, setReg] = useState({
    participantId: '',
    displayName: '',
    classroomId: '',
    studentNumber: '',
    pin: '',
    confirmPin: '',
    registrationCode: '',
  });

  useEffect(() => {
    fetch('/api/auth/registration-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c && setRegConfig(c))
      .catch(() => {});
  }, []);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(reg.pin)) {
      setAuthError('PIN ต้องเป็นตัวเลข 6 หลัก');
      return;
    }
    if (reg.pin !== reg.confirmPin) {
      setAuthError('PIN และการยืนยัน PIN ไม่ตรงกัน');
      return;
    }
    setIsSubmitting(true);
    try {
      await registerStudent({
        ...reg,
        participantId: reg.participantId.trim(),
        studentNumber: reg.studentNumber.trim() || undefined,
        registrationCode: reg.registrationCode.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const regInputCls =
    'w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-hidden';

  // Student Login submit
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantId.trim() || !pin.trim()) {
      setAuthError('กรุณากรอกรหัสผู้เข้าร่วมและ PIN 6 หลักให้ครบถ้วน');
      return;
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setAuthError('PIN ต้องเป็นตัวเลข 6 หลัก');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginStudent(participantId.trim(), pin.trim());
      if (!res.success && res.error) {
        // generic or lockout error handled by context
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin Google Login submit
  const handleAdminGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
      await loginAdminWithGoogle();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
           <img
  src="/logo.png"
  alt="FitQuest"
  className="w-12 h-12 object-contain"
/>
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-['Poppins',sans-serif]">
            Fit <span className="text-blue-600">Quest</span>
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            “ขยับทุกวัน สนุกทุกภารกิจ” • Every Move is a Quest
          </p>
        </div>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          ระบบบันทึกการออกกำลังกายสำหรับโครงการวิจัยและกิจกรรมส่งเสริมสุขภาพในนักเรียน
        </p>
      </div>

      {/* Main Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/80 space-y-6">
          
          {/* Tab Selector: Student vs Admin */}
          <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('student');
                setAuthError(null);
              }}
              className={`py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'student'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>เข้าสู่ระบบ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setAuthError(null);
              }}
              className={`py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'register'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>สมัครสมาชิก</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setAuthError(null);
              }}
              className={`py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>แอดมิน</span>
            </button>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{authError}</div>
            </div>
          )}

          {/* TAB 1: Student Login Form */}
          {activeTab === 'student' && (
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  รหัสผู้เข้าร่วม (Participant ID)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={participantId}
                    onChange={(e) => setParticipantId(e.target.value.toUpperCase())}
                    placeholder="กรอกรหัสผู้เข้าร่วม (เช่น P001)"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono tracking-wide bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-hidden"
                    autoComplete="username"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  รหัสที่ได้รับจากครูผู้ดูแลหรือทีมวิจัยประจำโครงการ
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>PIN ประจำตัว (6 หลัก)</span>
                  <span className="text-[11px] text-slate-400 font-normal">ตัวเลข 6 หลัก</span>
                </label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full px-4 py-3 pr-12 rounded-2xl border border-slate-200 text-sm font-mono tracking-widest bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-hidden"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition"
                    aria-label={showPin ? 'ซ่อน PIN' : 'แสดง PIN'}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm sm:text-base transition shadow-md shadow-blue-500/20 active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>กำลังตรวจสอบสิทธิ์...</span>
                    </>
                  ) : (
                    <span>เข้าสู่ระบบ Fit Quest</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB: Student Registration */}
          {activeTab === 'register' && (
            regConfig.enabled ? (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">ชื่อที่แสดง (ชื่อ-นามสกุล หรือชื่อเล่น)</label>
                  <input type="text" className={regInputCls} value={reg.displayName} maxLength={100} required
                    onChange={(e) => setReg({ ...reg, displayName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">รหัสผู้เข้าร่วม (ตั้งเอง ใช้ล็อกอิน)</label>
                  <input type="text" className={regInputCls + ' font-mono tracking-wide'} value={reg.participantId}
                    placeholder="เช่น P001 (A-Z, 0-9, - , _)" maxLength={32} required autoComplete="username"
                    onChange={(e) => setReg({ ...reg, participantId: e.target.value.toUpperCase() })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">ห้อง/กลุ่ม</label>
                    <input type="text" className={regInputCls} value={reg.classroomId} placeholder="เช่น ม.3/1" maxLength={50} required
                      onChange={(e) => setReg({ ...reg, classroomId: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">เลขที่ (ถ้ามี)</label>
                    <input type="text" className={regInputCls} value={reg.studentNumber} maxLength={20}
                      onChange={(e) => setReg({ ...reg, studentNumber: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">PIN 6 หลัก</label>
                    <input type={showPin ? 'text' : 'password'} inputMode="numeric" maxLength={6}
                      className={regInputCls + ' font-mono tracking-widest'} value={reg.pin} required autoComplete="new-password"
                      onChange={(e) => setReg({ ...reg, pin: e.target.value.replace(/\D/g, '') })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">ยืนยัน PIN</label>
                    <input type={showPin ? 'text' : 'password'} inputMode="numeric" maxLength={6}
                      className={regInputCls + ' font-mono tracking-widest'} value={reg.confirmPin} required autoComplete="new-password"
                      onChange={(e) => setReg({ ...reg, confirmPin: e.target.value.replace(/\D/g, '') })} />
                  </div>
                </div>
                <button type="button" onClick={() => setShowPin(!showPin)}
                  className="text-[11px] text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPin ? 'ซ่อน PIN' : 'แสดง PIN'}</span>
                </button>
                {regConfig.codeRequired && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">รหัสสมัครสมาชิก (จากครู/ทีมวิจัย)</label>
                    <input type="text" className={regInputCls} value={reg.registrationCode} required
                      onChange={(e) => setReg({ ...reg, registrationCode: e.target.value })} />
                  </div>
                )}
                <p className="text-[11px] text-slate-400">จำรหัสผู้เข้าร่วมและ PIN ไว้ให้ดี ต้องใช้ทุกครั้งที่เข้าสู่ระบบ</p>
                <button type="submit" disabled={isSubmitting}
                  className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base transition shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSubmitting ? (<><Loader2 className="w-5 h-5 animate-spin" /><span>กำลังสมัคร...</span></>) : <span>สมัครสมาชิกและเข้าสู่ระบบ</span>}
                </button>
              </form>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                ขณะนี้ปิดรับสมัครสมาชิก กรุณาติดต่อครูผู้ดูแลหรือทีมวิจัย
              </div>
            )
          )}

          {/* TAB 2: Admin Google Login */}
          {activeTab === 'admin' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100 text-xs text-purple-900 leading-relaxed space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-purple-950">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>สำหรับคณะผู้วิจัยและผู้ดูแลระบบเท่านั้น</span>
                </div>
                <p>
                  กรุณาลงชื่อเข้าใช้ด้วย Google Account ที่ได้รับการลงทะเบียนสิทธิ์ <code>role="admin"</code> ในระบบ Cloud Firestore
                </p>
              </div>

              <button
                type="button"
                onClick={handleAdminGoogleLogin}
                disabled={isSubmitting}
                className="w-full min-h-[48px] py-3 px-4 rounded-2xl border-2 border-slate-200 hover:border-purple-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm transition shadow-2xs active:scale-98 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {/* Official Google 'G' icon SVG */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isSubmitting ? 'กำลังเข้าสู่ระบบ Google...' : 'เข้าสู่ระบบผู้ดูแลด้วย Google'}</span>
              </button>

              <div className="pt-2 text-center border-t border-purple-100 mt-2">
                <button
                  type="button"
                  onClick={() => setShowBootstrapModal(true)}
                  className="text-[11px] text-slate-400 hover:text-purple-600 transition underline underline-offset-2 cursor-pointer"
                >
                  ตั้งค่าผู้ดูแลคนแรก (Initial Admin Bootstrap)
                </button>
              </div>
            </div>
          )}

          {/* Test Guide Link */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold transition cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>วิธีทดสอบระบบ 2 อุปกรณ์ (Device A & B)</span>
            </button>
            <span className="text-[10px] text-slate-400 font-mono">Cloud Firestore</span>
          </div>
        </div>
      </div>

      {/* Initial Admin Bootstrap Modal */}
      {showBootstrapModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 bg-gradient-to-r from-purple-700 to-indigo-700 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold">ตั้งค่าผู้ดูแลระบบคนแรก (Initial Admin Bootstrap)</h3>
                  <p className="text-xs text-purple-200">Production Zero-Trust Safeguard</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-purple-900 space-y-2">
                <p className="font-bold">เงื่อนไขความปลอดภัยในการสร้าง Admin คนแรก:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  <li>ต้องยังไม่มีผู้ดูแลระบบ (Admin) ใดๆ ในฐานข้อมูล</li>
                  <li>บัญชี Google ที่ใช้ต้องตรงกับค่า <code>INITIAL_ADMIN_EMAIL</code> บนเซิร์ฟเวอร์ทุกตัวอักษร</li>
                  <li>เมื่อยืนยัน บัญชีนี้จะได้รับสิทธิ์ <code>lead_researcher</code> โดยอัตโนมัติ</li>
                </ul>
              </div>
              <p>
                หากระบบมี Admin อยู่แล้ว หรือใช้อีเมลอื่น เซิร์ฟเวอร์จะปฏิเสธคำขอทันที
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowBootstrapModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-white text-slate-600 text-xs font-medium transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowBootstrapModal(false);
                  setIsSubmitting(true);
                  try {
                    const res = await bootstrapFirstAdmin();
                    if (!res.success && res.error) {
                      setAuthError(res.error);
                    }
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md shadow-purple-500/20 flex items-center gap-2 cursor-pointer"
              >
                <span>ดำเนินการด้วย Google</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Two Device Guide Modal */}
      <TwoDeviceGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
};

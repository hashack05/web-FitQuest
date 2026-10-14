import React, { useState } from 'react';
import { 
  Activity, 
  LogOut, 
  User, 
  ShieldCheck, 
  Smartphone, 
  KeyRound,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext.tsx';
import { TwoDeviceGuideModal } from './TwoDeviceGuideModal.tsx';
import { StudentProfileModal } from '../../features/student/StudentProfileModal.tsx';

export const Navbar: React.FC = () => {
  const { role, adminProfile, studentProfile, logout, syncStatus } = useAuth();
  const [showGuide, setShowGuide] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getPositionLabel = (pos?: string) => {
    if (pos === 'lead_researcher') return 'หัวหน้าโครงการวิจัย';
    if (pos === 'website_admin') return 'ผู้ดูแลระบบเว็บไซต์';
    return 'ผู้ดูแลระบบ';
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo & Tagline */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Activity className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900 font-['Poppins',sans-serif]">
                  Fit <span className="text-blue-600">Quest</span>
                </span>
                <span className="hidden sm:inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  v2 Production
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 hidden md:block">
                ขยับทุกวัน สนุกทุกภารกิจ • Every Move is a Quest
              </p>
            </div>
          </div>

          {/* Right Header Navigation */}
          <div className="hidden md:flex items-center gap-3">


            {/* Two-Device Test Guide Button */}
            <button
              onClick={() => setShowGuide(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-blue-700 text-xs font-medium transition active:scale-98"
              title="คู่มือทดสอบ 2 เครื่อง"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>คู่มือทดสอบ 2 เครื่อง</span>
            </button>

            {/* User Profile Pill */}
            {role === 'student' && studentProfile && (
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-medium text-slate-800 transition"
              >
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  {studentProfile.participantId.slice(0, 2)}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-900">{studentProfile.participantId}</div>
                  <div className="text-[10px] text-slate-500">ห้อง {studentProfile.classroomId}</div>
                </div>
                <KeyRound className="w-3 h-3 text-slate-400 ml-1" />
              </button>
            )}

            {role === 'admin' && adminProfile && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-950">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <div className="text-left">
                  <div className="font-semibold leading-tight">{adminProfile.displayName || 'Admin'}</div>
                  <div className="text-[10px] text-purple-700">{getPositionLabel(adminProfile.position)}</div>
                </div>
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-600 text-xs font-medium transition active:scale-98"
              title="ออกจากระบบ"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ออกจากระบบ</span>
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setShowGuide(true)}
              className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200"
              title="คู่มือทดสอบ"
            >
              <Smartphone className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200"
              aria-label="เมนู"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3 animate-in slide-in-from-top-2">


            {role === 'student' && studentProfile && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900">{studentProfile.participantId}</div>
                  <div className="text-xs text-slate-500">{studentProfile.displayName} (ห้อง {studentProfile.classroomId})</div>
                </div>
                <button
                  onClick={() => {
                    setShowProfile(true);
                    setMobileMenuOpen(false);
                  }}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold"
                >
                  เปลี่ยน PIN
                </button>
              </div>
            )}

            {role === 'admin' && adminProfile && (
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                <div className="font-bold text-sm text-purple-950">{adminProfile.displayName}</div>
                <div className="text-xs text-purple-700">{getPositionLabel(adminProfile.position)}</div>
              </div>
            )}

            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-medium text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        )}
      </header>

      {/* Modals */}
      <TwoDeviceGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
      {role === 'student' && (
        <StudentProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
      )}
    </>
  );
};

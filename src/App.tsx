import React from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthContext.tsx';
import { Navbar } from './components/common/Navbar.tsx';
import { LoginPage } from './components/auth/LoginPage.tsx';
import { StudentDashboard } from './features/student/StudentDashboard.tsx';
import { AdminDashboard } from './features/admin/AdminDashboard.tsx';
import { LoadingSpinner } from './components/common/LoadingSpinner.tsx';

const AppContent: React.FC = () => {
  const { firebaseUser, role, isLoading } = useAuth();

  // Session check loading screen (Section 12: Never flash login screen before knowing session status)
  if (isLoading) {
    return <LoadingSpinner fullScreen message="กำลังตรวจสอบสถานะการเข้าสู่ระบบ Fit Quest..." />;
  }

  // If unauthenticated or no valid role assigned yet
  if (!firebaseUser || !role) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Prompt','Poppins',sans-serif] selection:bg-blue-100 selection:text-blue-900">
      <Navbar />
      <main className="flex-1 pb-16">
        {role === 'student' && <StudentDashboard />}
        {role === 'admin' && <AdminDashboard />}
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>Fit Quest • ระบบบันทึกการออกกำลังกายสำหรับโครงการวิจัยและกิจกรรมส่งเสริมสุขภาพในนักเรียน</p>
          <p className="text-[11px] text-slate-400">Single Source of Truth: Cloud Firestore • v2 Production</p>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

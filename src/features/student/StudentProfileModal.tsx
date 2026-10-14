import React, { useState } from 'react';
import { X, KeyRound, ShieldCheck, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.tsx';
import { auth } from '../../lib/firebase/client.ts';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({ isOpen, onClose }) => {
  const { studentProfile } = useAuth();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen || !studentProfile) return null;

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (currentPin.length !== 6 || !/^\d{6}$/.test(currentPin)) {
      setError('PIN เดิมต้องเป็นตัวเลข 6 หลัก');
      return;
    }
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setError('PIN ใหม่ต้องเป็นตัวเลข 6 หลัก');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PIN ใหม่และยืนยัน PIN ไม่ตรงกัน');
      return;
    }
    if (currentPin === newPin) {
      setError('PIN ใหม่ต้องไม่ซ้ำกับ PIN เดิม');
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');

      const res = await fetch('/api/auth/student-change-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ currentPin, newPin }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถเปลี่ยน PIN ได้');
      }

      setSuccess('เปลี่ยน PIN สำเร็จเรียบร้อยแล้ว กรุณาจำ PIN ใหม่นี้สำหรับการเข้าสู่ระบบครั้งถัดไป');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยน PIN');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">ข้อมูลส่วนตัวและเปลี่ยน PIN</h3>
              <p className="text-xs text-slate-500">Student Profile & Security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            aria-label="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Readonly info */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="text-slate-500 font-medium">รหัสผู้เข้าร่วม:</span>
              <span className="text-slate-900 font-bold text-sm tracking-wide">{studentProfile.participantId}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="text-slate-500 font-medium">ชื่อ-นามสกุล:</span>
              <span className="text-slate-900 font-semibold">{studentProfile.displayName}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="text-slate-500 font-medium">ห้องเรียน / กลุ่ม:</span>
              <span className="text-slate-900 font-semibold">{studentProfile.classroomId}</span>
            </div>
            {studentProfile.studentNumber && (
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">เลขที่:</span>
                <span className="text-slate-900 font-semibold">{studentProfile.studentNumber}</span>
              </div>
            )}
          </div>

          {/* Change PIN Form */}
          <form onSubmit={handleChangePin} className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <KeyRound className="w-4 h-4 text-blue-600" />
              <span>เปลี่ยน PIN 6 หลัก</span>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{success}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                PIN ปัจจุบัน (6 หลัก)
              </label>
              <input
                type="password"
                maxLength={6}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                PIN ใหม่ (6 หลัก)
              </label>
              <input
                type="password"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ยืนยัน PIN ใหม่
              </label>
              <input
                type="password"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-hidden"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <span>บันทึก PIN ใหม่</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

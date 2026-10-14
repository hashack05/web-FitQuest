import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  UserPlus, 
  Mail, 
  Check, 
  X, 
  AlertCircle, 
  Loader2, 
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase/client.ts';
import { UserDoc, AdminPosition } from '../../types/index.ts';

export const AdminManagement: React.FC = () => {
  const [admins, setAdmins] = useState<UserDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [position, setPosition] = useState<AdminPosition>('website_admin');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'admin'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: UserDoc[] = [];
        snap.forEach((d) => list.push(d.data() as UserDoc));
        setAdmins(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching admins:', err);
        handleFirestoreError(err, OperationType.GET, 'users');
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('กรุณาลงชื่อเข้าใช้ก่อนทำรายการ');

      const res = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: email.trim(), displayName: displayName.trim(), position }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถเพิ่มผู้ดูแลได้');
      }

      setSuccess(`เพิ่มผู้ดูแล ${email} เรียบร้อยแล้ว`);
      setEmail('');
      setDisplayName('');
      setIsAddOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [targetDeactivate, setTargetDeactivate] = useState<UserDoc | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const confirmDeactivate = async () => {
    if (!targetDeactivate) return;
    setIsDeactivating(true);
    setError(null);
    setSuccess(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('กรุณาลงชื่อเข้าใช้ก่อนทำรายการ');

      const res = await fetch('/api/admin/deactivate-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ targetUid: targetDeactivate.uid }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ไม่สามารถระงับสิทธิ์ได้');

      setSuccess(`ระงับสิทธิ์ผู้ดูแล ${targetDeactivate.email} เรียบร้อยแล้ว`);
      setTargetDeactivate(null);
    } catch (err: any) {
      setError(err.message);
      setTargetDeactivate(null);
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">ทีมผู้ดูแลระบบโครงการ (Admin Management)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ผู้ดูแลทุกคนต้องเข้าสู่ระบบด้วย Google และมีสิทธิ์ในระบบเท่ากันตามสิทธิ์ role="admin"
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>เพิ่มผู้ดูแลระบบ</span>
        </button>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Admin List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">ชื่อ-นามสกุล</th>
                <th className="py-3 px-4">อีเมล (Google Account)</th>
                <th className="py-3 px-4">ตำแหน่ง</th>
                <th className="py-3 px-4">สถานะ</th>
                <th className="py-3 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map((adm) => (
                <tr key={adm.uid} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    <span>{adm.displayName || 'Admin'}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-mono">{adm.email}</td>
                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium text-[11px] border border-purple-200">
                      {adm.position === 'lead_researcher' ? 'หัวหน้าโครงการวิจัย' : 'ผู้ดูแลระบบเว็บไซต์'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {adm.active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                        พร้อมใช้งาน
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-semibold border border-rose-200">
                        ระงับสิทธิ์
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {adm.uid !== auth.currentUser?.uid && adm.active && (
                      <button
                        onClick={() => setTargetDeactivate(adm)}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-medium text-[11px] transition cursor-pointer"
                      >
                        ระงับสิทธิ์
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Admin Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-purple-50/60">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-700" />
                <h3 className="font-bold text-slate-900 text-base">เพิ่มผู้ดูแลระบบ (Admin)</h3>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4 text-xs">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  อีเมล Google Account <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin.researcher@gmail.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-hidden"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  ผู้ดูแลต้องใช้ Google Account อีเมลนี้ในการเข้าสู่ระบบ
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ชื่อ-นามสกุล <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="ศ.ดร. นักวิจัย นามสกุล"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ตำแหน่ง (Position) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as AdminPosition)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-hidden"
                >
                  <option value="lead_researcher">หัวหน้าโครงการวิจัย (lead_researcher)</option>
                  <option value="website_admin">ผู้ดูแลระบบเว็บไซต์ (website_admin)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  ทั้งสองตำแหน่งมีสิทธิ์จัดการระบบเทียบเท่ากันตามข้อกำหนดความปลอดภัย
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'เพิ่มผู้ดูแล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {targetDeactivate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">ยืนยันการระงับสิทธิ์ผู้ดูแล</h3>
                <p className="text-xs text-slate-500 font-mono">{targetDeactivate.email}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              ผู้ดูแลรายนี้จะไม่สามารถเข้าถึงแผงควบคุมระบบวิจัยได้อีกต่อไป และเซสชันที่ใช้งานอยู่จะถูกออกจากระบบทันที
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTargetDeactivate(null)}
                disabled={isDeactivating}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDeactivate}
                disabled={isDeactivating}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeactivating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeactivating ? 'กำลังดำเนินการ...' : 'ยืนยันระงับสิทธิ์'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

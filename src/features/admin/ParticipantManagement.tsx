import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  KeyRound, 
  Copy, 
  Check, 
  AlertCircle, 
  X, 
  Loader2,
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase/client.ts';
import { ParticipantDoc } from '../../types/index.ts';
import { auth } from '../../lib/firebase/client.ts';
import { EmptyState } from '../../components/common/EmptyState.tsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.tsx';

export const ParticipantManagement: React.FC = () => {
  const [participants, setParticipants] = useState<ParticipantDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [targetParticipant, setTargetParticipant] = useState<ParticipantDoc | null>(null);

  // Add form fields
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [customPin, setCustomPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Success credential modal (displaying generated PIN once)
  const [createdResult, setCreatedResult] = useState<{
    participantId: string;
    pin: string;
    displayName: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset PIN field
  const [newResetPin, setNewResetPin] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  // Status toggle confirmation modal & toast
  const [toggleConfirmTarget, setToggleConfirmTarget] = useState<ParticipantDoc | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Real-time subscription to participants
  useEffect(() => {
    const q = query(collection(db, 'participants'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: ParticipantDoc[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as any);
        });
        setParticipants(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching participants:', err);
        handleFirestoreError(err, OperationType.GET, 'participants');
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Distinct classrooms list
  const classrooms = useMemo(() => {
    const set = new Set<string>();
    participants.forEach((p) => {
      if (p.classroomId) set.add(p.classroomId);
    });
    return Array.from(set).sort();
  }, [participants]);

  // Filtered participants
  const filtered = useMemo(() => {
    return participants.filter((p) => {
      const matchSearch =
        p.participantId.toLowerCase().includes(search.toLowerCase()) ||
        p.displayName.toLowerCase().includes(search.toLowerCase());
      const matchClass = selectedClass === 'all' || p.classroomId === selectedClass;
      return matchSearch && matchClass;
    });
  }, [participants, search, selectedClass]);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('กรุณาลงชื่อเข้าใช้ก่อนทำรายการ');

      const res = await fetch('/api/admin/create-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          participantId: newId.trim(),
          displayName: newName.trim(),
          classroomId: newClass.trim(),
          studentNumber: newNumber.trim() || undefined,
          initialPin: customPin.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถสร้างผู้เข้าร่วมได้');
      }

      setCreatedResult({
        participantId: data.participantId,
        displayName: data.displayName,
        pin: data.initialPin,
      });

      setIsAddOpen(false);
      setNewId('');
      setNewName('');
      setNewClass('');
      setNewNumber('');
      setCustomPin('');
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetParticipant) return;
    setResetError(null);
    setIsSubmitting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('กรุณาลงชื่อเข้าใช้ก่อนทำรายการ');

      const res = await fetch('/api/admin/reset-student-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          participantUid: targetParticipant.uid,
          newPin: newResetPin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถรีเซ็ต PIN ได้');
      }

      setToastMessage({ text: `รีเซ็ต PIN สำหรับ ${targetParticipant.participantId} สำเร็จ`, type: 'success' });
      setIsResetOpen(false);
      setTargetParticipant(null);
      setNewResetPin('');
    } catch (err: any) {
      setResetError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmToggleActive = async () => {
    if (!toggleConfirmTarget) return;
    const newStatus = toggleConfirmTarget.active === false ? true : false;
    try {
      await updateDoc(doc(db, 'participants', toggleConfirmTarget.uid), {
        active: newStatus,
        updatedAt: new Date().toISOString(),
      });
      setToastMessage({
        text: `อัปเดตสถานะของ ${toggleConfirmTarget.participantId} เป็น "${newStatus ? 'พร้อมใช้งาน' : 'ระงับการใช้งาน'}" เรียบร้อยแล้ว`,
        type: 'success',
      });
      setToggleConfirmTarget(null);
    } catch (err) {
      setToastMessage({ text: 'ไม่สามารถอัปเดตสถานะผู้เข้าร่วมได้', type: 'error' });
      setToggleConfirmTarget(null);
    }
  };

  if (isLoading && participants.length === 0) {
    return <LoadingSpinner message="กำลังโหลดข้อมูลผู้เข้าร่วมโครงการ..." />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">จัดการผู้เข้าร่วมโครงการ (Participants)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ลงทะเบียนผู้เข้าร่วม สร้างรหัส PIN 6 หลัก และจัดการสถานะบัญชี
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>เพิ่มผู้เข้าร่วมใหม่</span>
        </button>
      </div>

      {toastMessage && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-in fade-in ${
          toastMessage.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-black/5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาด้วยรหัสผู้เข้าร่วม หรือชื่อ-นามสกุล..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
          />
        </div>

        <div>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
          >
            <option value="all">ทุกห้องเรียน / กลุ่ม ({participants.length})</option>
            {classrooms.map((c) => (
              <option key={c} value={c}>
                ห้อง {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Participants Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="ไม่พบรายชื่อผู้เข้าร่วม"
          description="ยังไม่มีผู้เข้าร่วมในระบบ หรือไม่ตรงกับเงื่อนไขการค้นหา"
          actionLabel="+ เพิ่มผู้เข้าร่วมคนแรก"
          onAction={() => setIsAddOpen(true)}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">รหัสผู้เข้าร่วม</th>
                  <th className="py-3 px-4">ชื่อ-นามสกุล</th>
                  <th className="py-3 px-4">ห้องเรียน</th>
                  <th className="py-3 px-4">เลขที่</th>
                  <th className="py-3 px-4">สถานะ</th>
                  <th className="py-3 px-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.uid} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 tracking-wide font-mono">
                      {p.participantId}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{p.displayName}</td>
                    <td className="py-3.5 px-4 text-slate-600">{p.classroomId}</td>
                    <td className="py-3.5 px-4 text-slate-500">{p.studentNumber || '-'}</td>
                    <td className="py-3.5 px-4">
                      {p.active === false ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-semibold border border-rose-200">
                          ระงับสิทธิ์
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                          เปิดใช้งาน
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setTargetParticipant(p);
                          setNewResetPin('');
                          setResetError(null);
                          setIsResetOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-[11px] transition inline-flex items-center gap-1"
                      >
                        <KeyRound className="w-3 h-3 text-blue-600" />
                        <span>รีเซ็ต PIN</span>
                      </button>

                      <button
                        onClick={() => setToggleConfirmTarget(p)}
                        className={`px-2.5 py-1.5 rounded-lg border font-medium text-[11px] transition cursor-pointer ${
                          p.active === false
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            : 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
                        }`}
                      >
                        {p.active === false ? 'เปิดสิทธิ์' : 'ระงับสิทธิ์'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Participant Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base">เพิ่มผู้เข้าร่วมโครงการใหม่</h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  รหัสผู้เข้าร่วม (Participant ID) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value.toUpperCase())}
                  placeholder="เช่น P001, P102"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-blue-500 outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ชื่อ-นามสกุล <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ด.ช. สมชาย สุขภาพดี"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ห้องเรียน / กลุ่ม <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    placeholder="เช่น 1/1, กลุ่ม A"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">เลขที่ (ไม่บังคับ)</label>
                  <input
                    type="text"
                    value={newNumber}
                    onChange={(e) => setNewNumber(e.target.value)}
                    placeholder="เช่น 15"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  กำหนด PIN เริ่มต้น (ตัวเลข 6 หลัก, เว้นว่างไว้เพื่อสุ่มให้อัตโนมัติ)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={customPin}
                  onChange={(e) => setCustomPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="สุ่มให้อัตโนมัติ (แนะนำ)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono tracking-widest focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
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
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? 'กำลังสร้าง...' : 'บันทึกผู้เข้าร่วม'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Newly Created Credential Modal (One-time secure PIN disclosure to admin) */}
      {createdResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">สร้างบัญชีผู้เข้าร่วมสำเร็จ</h3>
              <p className="text-xs text-slate-500 mt-1">
                กรุณาคัดลอกรหัสเข้าสู่ระบบเพื่อส่งมอบให้นักเรียน
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">ชื่อ:</span>
                <span className="font-semibold text-slate-800">{createdResult.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">รหัสผู้เข้าร่วม:</span>
                <span className="font-bold font-mono text-blue-700 text-sm">{createdResult.participantId}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="text-slate-500">PIN 6 หลัก:</span>
                <span className="font-extrabold font-mono text-emerald-700 text-lg tracking-widest">
                  {createdResult.pin}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `รหัสผู้เข้าร่วม: ${createdResult.participantId}\nPIN: ${createdResult.pin}`
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-blue-100 transition"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกข้อมูล'}</span>
              </button>
              <button
                onClick={() => setCreatedResult(null)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset PIN Modal */}
      {isResetOpen && targetParticipant && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">รีเซ็ต PIN: {targetParticipant.participantId}</h3>
              <button
                onClick={() => setIsResetOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPin} className="p-6 space-y-4 text-xs">
              {resetError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <p className="text-slate-600">
                รีเซ็ต PIN สำหรับ <span className="font-semibold text-slate-900">{targetParticipant.displayName}</span>
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ระบุ PIN 6 หลักใหม่
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={newResetPin}
                  onChange={(e) => setNewResetPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="เช่น 654321"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono tracking-widest text-center text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResetOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || newResetPin.length !== 6}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันรีเซ็ต PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toggle Active Confirmation Modal */}
      {toggleConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${
                toggleConfirmTarget.active === false
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}>
                {toggleConfirmTarget.active === false ? <UserCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {toggleConfirmTarget.active === false ? 'เปิดใช้งานบัญชีผู้เข้าร่วม' : 'ระงับการใช้งานบัญชี'}
                </h3>
                <p className="text-xs text-slate-500 font-mono">{toggleConfirmTarget.participantId} ({toggleConfirmTarget.displayName})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {toggleConfirmTarget.active === false
                ? 'เมื่อเปิดใช้งาน ผู้เข้าร่วมจะสามารถลงชื่อเข้าใช้ด้วย PIN และส่งบันทึกการออกกำลังกายได้ตามปกติ'
                : 'เมื่อระงับสิทธิ์ ผู้เข้าร่วมจะไม่สามารถเข้าสู่ระบบเพื่อบันทึกกิจกรรมได้จนกว่าจะเปิดสิทธิ์อีกครั้ง'}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setToggleConfirmTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleActive}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition shadow-xs cursor-pointer ${
                  toggleConfirmTarget.active === false
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {toggleConfirmTarget.active === false ? 'ยืนยันเปิดใช้งาน' : 'ยืนยันระงับสิทธิ์'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

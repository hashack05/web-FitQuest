import React, { useState, useEffect } from 'react';
import { Settings, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase/client.ts';
import { useAuth } from '../auth/AuthContext.tsx';

export const ResearchSettings: React.FC = () => {
  const { adminProfile } = useAuth();
  const [consentContent, setConsentContent] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    let loadedConsent = false;
    let loadedNotice = false;

    const unsubConsent = onSnapshot(
      doc(db, 'appSettings', 'researchConsent'),
      (snap) => {
        if (snap.exists()) {
          setConsentContent(snap.data()?.content || '');
        }
        loadedConsent = true;
        if (loadedNotice) setIsLoading(false);
      },
      (err) => {
        console.error('Error listening to consent setting:', err);
        loadedConsent = true;
        if (loadedNotice) setIsLoading(false);
      }
    );

    const unsubNotice = onSnapshot(
      doc(db, 'appSettings', 'announcement'),
      (snap) => {
        if (snap.exists()) {
          setAnnouncement(snap.data()?.content || '');
        }
        loadedNotice = true;
        if (loadedConsent) setIsLoading(false);
      },
      (err) => {
        console.error('Error listening to announcement setting:', err);
        loadedNotice = true;
        if (loadedConsent) setIsLoading(false);
      }
    );

    return () => {
      unsubConsent();
      unsubNotice();
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminProfile) return;
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      await setDoc(doc(db, 'appSettings', 'researchConsent'), {
        settingKey: 'researchConsent',
        content: consentContent,
        updatedAt: serverTimestamp(),
        updatedByUid: adminProfile.uid,
      });

      await setDoc(doc(db, 'appSettings', 'announcement'), {
        settingKey: 'announcement',
        content: announcement,
        updatedAt: serverTimestamp(),
        updatedByUid: adminProfile.uid,
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'appSettings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="py-12 text-center text-xs text-slate-500">กำลังโหลดการตั้งค่า...</div>;
  }

  return (
    <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">การตั้งค่าโครงการวิจัย (Research Configuration)</h3>
          <p className="text-xs text-slate-500">
            ปรับปรุงข้อความชี้แจงความยินยอม (Consent/Assent) และประกาศสำคัญสำหรับนักเรียน
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>บันทึกการตั้งค่าโครงการเรียบร้อยแล้ว</span>
        </div>
      )}

      <div className="space-y-4 text-xs">
        <div>
          <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>ข้อความชี้แจงและขอความยินยอมเข้าร่วมโครงการ (Research Assent / Consent Text)</span>
          </label>
          <textarea
            rows={8}
            value={consentContent}
            onChange={(e) => setConsentContent(e.target.value)}
            placeholder="ระบุข้อความอธิบายวัตถุประสงค์งานวิจัย สิทธิประโยชน์ และนโยบายความเป็นส่วนตัว..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-hidden font-normal text-slate-800 leading-relaxed"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-800 mb-1.5">
            ประกาศหรือคำแนะนำกิจกรรมทั่วไป (Announcement)
          </label>
          <textarea
            rows={3}
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="ข้อความประชาสัมพันธ์กิจกรรมสำหรับแสดงแก่นักเรียน..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-hidden text-slate-800"
          />
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-xs disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>กำลังบันทึก...</span>
            </>
          ) : (
            <span>บันทึกการเปลี่ยนแปลง</span>
          )}
        </button>
      </div>
    </form>
  );
};

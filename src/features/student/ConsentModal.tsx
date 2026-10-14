import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase/client.ts';
import { useAuth } from '../auth/AuthContext.tsx';

interface ConsentModalProps {
  onConsentComplete: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({ onConsentComplete }) => {
  const { studentProfile } = useAuth();
  const [hasAgreed, setHasAgreed] = useState(false);
  const [guardianAgreed, setGuardianAgreed] = useState(false);
  const [consentContent, setConsentContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'appSettings', 'researchConsent'),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data()?.content) {
          setConsentContent(docSnap.data()?.content);
        } else {
          setConsentContent(
            `โครงการวิจัยและกิจกรรมส่งเสริมการออกกำลังกายในนักเรียน (Fit Quest)\n\nวัตถุประสงค์ของโครงการ:\n1. ส่งเสริมพฤติกรรมการมีกิจกรรมทางกายและการออกกำลังกายที่สม่ำเสมอในนักเรียน\n2. เก็บรวบรวมข้อมูลสถิติระยะเวลาและประเภทกิจกรรมทางกายเพื่อการศึกษาวิจัยเชิงประยุกต์\n\nการรักษาความปลอดภัยของข้อมูล:\n- ข้อมูลของท่านจะถูกจัดเก็บเป็นความลับและเข้าถึงได้เฉพาะทีมผู้วิจัยที่ได้รับอนุญาตเท่านั้น\n- รหัส PIN ของท่านจะถูกเข้ารหัสแบบทางเดียว (One-way Hash) บนเซิร์ฟเวอร์\n- ข้อมูลการออกกำลังกายจะถูกนำเสนอในภาพรวมทางสถิติโดยไม่ระบุตัวตนต่อสาธารณะ`
          );
        }
        setIsLoading(false);
      },
      (err) => {
        console.error('Consent onSnapshot error:', err);
        setConsentContent(
          `โครงการวิจัยส่งเสริมการออกกำลังกาย Fit Quest: ขอความร่วมมือในการบันทึกข้อมูลกิจกรรมทางกายตามความเป็นจริงเพื่อประโยชน์ในการวิเคราะห์ผลทางสุขภาพ ข้อมูลจะได้รับการคุ้มครองความเป็นส่วนตัวตามมาตรฐานจริยธรรมการวิจัย`
        );
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handleAccept = async () => {
    if (!studentProfile || !hasAgreed) return;
    setIsSubmitting(true);
    const path = `consents/${studentProfile.uid}`;
    try {
      await setDoc(doc(db, 'consents', studentProfile.uid), {
        participantUid: studentProfile.uid,
        participantId: studentProfile.participantId,
        consentVersion: '1.0',
        accepted: true,
        guardianConsentProvided: guardianAgreed,
        acceptedAt: serverTimestamp(),
      });
      onConsentComplete();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">เอกสารชี้แจงและการยินยอมเข้าร่วมโครงการ</h2>
              <p className="text-xs text-blue-100">Participant Assent & Research Information</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto text-slate-700 text-sm">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs leading-relaxed whitespace-pre-line text-slate-700 font-normal">
              {consentContent}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                checked={hasAgreed}
                onChange={(e) => setHasAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-800 font-medium">
                ข้าพเจ้าเข้าใจวัตถุประสงค์และยินยอมเข้าร่วมการบันทึกกิจกรรมทางกายในโครงการ Fit Quest โดยสมัครใจ
              </span>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                checked={guardianAgreed}
                onChange={(e) => setGuardianAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-800 font-medium">
                ผู้ปกครองได้รับทราบและให้ความยินยอมสำหรับการเข้าร่วมกิจกรรม (Guardian Assent)
              </span>
            </label>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleAccept}
            disabled={!hasAgreed || isSubmitting}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition shadow-sm disabled:opacity-40 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>ยอมรับและเริ่มใช้งาน</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

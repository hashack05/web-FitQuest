import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Clock, 
  Flame, 
  Calendar, 
  MessageSquare, 
  Send, 
  Loader2,
  ImageIcon,
  User,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext.tsx';
import { ExerciseRecordDoc, RecordCommentDoc, ExerciseStatus } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { 
  reviewExerciseRecord, 
  subscribeRecordComments, 
  addRecordComment,
  openEvidenceImage 
} from '../../services/exerciseService.ts';

interface AdminRecordReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: ExerciseRecordDoc | null;
  onReviewSubmitted: () => void;
}

export const AdminRecordReviewModal: React.FC<AdminRecordReviewModalProps> = ({
  isOpen,
  onClose,
  record,
  onReviewSubmitted,
}) => {
  const { adminProfile } = useAuth();
  const [reviewNotes, setReviewNotes] = useState('');
  const [comments, setComments] = useState<RecordCommentDoc[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setReviewNotes(record.reviewNotes || '');
    }
  }, [record]);

  useEffect(() => {
    if (!record?.id) return;
    const unsub = subscribeRecordComments(
      record.id,
      (data) => setComments(data),
      (err) => console.error(err)
    );
    return () => unsub();
  }, [record?.id]);

  if (!isOpen || !record || !adminProfile) return null;

  const handleReviewAction = async (status: 'approved' | 'needs_revision' | 'rejected') => {
    if (!record.id) return;
    setIsSubmitting(true);
    setReviewError(null);
    try {
      await reviewExerciseRecord(
        record.id,
        adminProfile.uid,
        status,
        reviewNotes.trim()
      );
      onReviewSubmitted();
      onClose();
    } catch (err: any) {
      setReviewError(err.message || 'เกิดข้อผิดพลาดในการบันทึกผลการตรวจ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !record.id) return;
    setIsSendingComment(true);
    try {
      await addRecordComment({
        recordId: record.id,
        participantUid: record.participantUid,
        authorUid: adminProfile.uid,
        authorName: adminProfile.displayName || 'ผู้ตรวจประเมิน',
        authorRole: 'admin',
        message: newComment.trim(),
      });
      setNewComment('');
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSendingComment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <StatusBadge status={record.status} size="lg" />
            <div className="text-xs text-slate-500 font-medium">
              ผู้เข้าร่วม: <span className="font-bold text-slate-900">{record.participantId}</span> (ห้อง {record.classroomId})
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition"
            aria-label="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Main Info */}
          <div>
            <span className="text-xs font-semibold text-blue-600">{record.activityType}</span>
            <h2 className="text-xl font-bold text-slate-900">{record.activityName}</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 block">วันที่ออกกำลังกาย</span>
              <span className="text-sm font-bold text-slate-900">{record.exerciseDate}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 block">ระยะเวลา</span>
              <span className="text-sm font-bold text-slate-900">{record.durationMinutes} นาที</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 block">ความเหนื่อย</span>
              <span className="text-sm font-bold text-slate-900">
                {record.intensity === 'light' ? 'เบา' : record.intensity === 'vigorous' ? 'หนัก' : 'ปานกลาง'}
              </span>
            </div>
          </div>

          {/* Notes */}
          {record.notes && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
              <span className="font-bold block mb-1 text-slate-900">บันทึกของนักเรียน:</span>
              <p className="whitespace-pre-line leading-relaxed">{record.notes}</p>
            </div>
          )}

          {/* Evidence Photos */}
          {record.evidenceImages && record.evidenceImages.length > 0 && (
            <div>
              <span className="text-xs font-bold text-slate-700 block mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <span>ภาพถ่ายหลักฐาน ({record.evidenceImages.length} ภาพ)</span>
              </span>
              <div className="grid grid-cols-2 gap-3">
                {record.evidenceImages.map((imgUrl, idx) => (
                  <a
                    key={idx}
                    href="#"
                    onClick={(e) => { e.preventDefault(); openEvidenceImage(imgUrl); }}
                    className="block rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100 group relative"
                  >
                    <img src={imgUrl} alt="หลักฐาน" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium">
                      เปิดดูภาพต้นฉบับ
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Review Notes Input */}
          <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-blue-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <span>ข้อคิดเห็น / คำแนะนำจากผู้ตรวจประเมินโครงการ</span>
            </label>
            <textarea
              rows={2}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="ระบุคำแนะนำ หรือเหตุผลหากต้องการให้นักเรียนแก้ไขข้อมูลเพิ่มเติม..."
              maxLength={1000}
              className="w-full px-3 py-2 text-xs rounded-xl border border-blue-200 bg-white focus:ring-2 focus:ring-blue-500 outline-hidden resize-none"
            />
          </div>

          {reviewError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{reviewError}</span>
            </div>
          )}

          {/* Review Decision Buttons */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 block">กำหนดสถานะการตรวจสอบ:</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleReviewAction('approved')}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>อนุมัติ (Approved)</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleReviewAction('needs_revision')}
                className="py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-50"
              >
                <AlertCircle className="w-4 h-4" />
                <span>ขอให้แก้ไข (Needs Revision)</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleReviewAction('rejected')}
                className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>ไม่อนุมัติ (Reject)</span>
              </button>
            </div>
          </div>

          {/* Comments Discussion Section */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <span className="text-xs font-bold text-slate-700 block flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              <span>การสนทนาในบันทึกนี้ ({comments.length})</span>
            </span>

            <div className="space-y-2 max-h-36 overflow-y-auto">
              {comments.map((c) => (
                <div
                  key={c.id || Math.random()}
                  className={`p-2.5 rounded-xl text-xs ${
                    c.authorRole === 'admin'
                      ? 'bg-purple-50 border border-purple-200 text-purple-950 ml-4'
                      : 'bg-slate-50 border border-slate-200 text-slate-800 mr-4'
                  }`}
                >
                  <div className="font-semibold text-[11px] mb-0.5 text-slate-600">
                    {c.authorName} ({c.authorRole === 'admin' ? 'ผู้วิจัย' : 'นักเรียน'})
                  </div>
                  <p>{c.message}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handlePostComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="พิมพ์ข้อความตอบกลับนักเรียน..."
                maxLength={500}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
              <button
                type="submit"
                disabled={isSendingComment || !newComment.trim()}
                className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-100 transition"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

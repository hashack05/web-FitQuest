import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Flame, 
  MessageSquare, 
  Send, 
  Edit3, 
  AlertCircle, 
  FileText,
  User,
  ShieldCheck,
  ImageIcon
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext.tsx';
import { ExerciseRecordDoc, RecordCommentDoc } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { 
  subscribeRecordComments, 
  addRecordComment,
  openEvidenceImage 
} from '../../services/exerciseService.ts';

interface ExerciseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: ExerciseRecordDoc | null;
  onEdit: (record: ExerciseRecordDoc) => void;
}

export const ExerciseDetailModal: React.FC<ExerciseDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  onEdit,
}) => {
  const { studentProfile, role } = useAuth();
  const [comments, setComments] = useState<RecordCommentDoc[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Subscribe to realtime comments
  useEffect(() => {
    if (!record?.id) return;
    const unsubscribe = subscribeRecordComments(
      record.id,
      (fetched) => setComments(fetched),
      (err) => console.error('Error loading comments:', err)
    );
    return () => unsubscribe();
  }, [record?.id]);

  if (!isOpen || !record) return null;

  const canEdit = record.status === 'draft' || record.status === 'needs_revision';

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !record.id || !studentProfile) return;

    setIsSending(true);
    try {
      await addRecordComment({
        recordId: record.id,
        participantUid: studentProfile.uid,
        authorUid: studentProfile.uid,
        authorName: studentProfile.displayName || studentProfile.participantId,
        authorRole: 'student',
        message: newComment.trim(),
      });
      setNewComment('');
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsSending(false);
    }
  };

  const getIntensityLabel = (i?: string) => {
    if (i === 'light') return 'เบา (หายใจปกติ)';
    if (i === 'vigorous') return 'หนัก (หายใจหอบ)';
    return 'ปานกลาง (หัวใจเต้นเร็ว)';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <StatusBadge status={record.status} size="lg" />
            <span className="text-xs text-slate-500 font-medium">
              วันที่ {record.exerciseDate}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition"
            aria-label="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Main Title & Type */}
          <div>
            <div className="text-xs font-semibold text-blue-600 mb-1">{record.activityType}</div>
            <h2 className="text-xl font-bold text-slate-900 leading-snug">{record.activityName}</h2>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-medium">ระยะเวลา</div>
                <div className="text-sm font-bold text-slate-900">{record.durationMinutes} นาที</div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-medium">ระดับความเหนื่อย</div>
                <div className="text-sm font-bold text-slate-900">{getIntensityLabel(record.intensity)}</div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3 col-span-2 sm:col-span-1">
              <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-medium">วันที่บันทึก</div>
                <div className="text-sm font-bold text-slate-900">{record.exerciseDate}</div>
              </div>
            </div>
          </div>

          {/* Student Notes */}
          {record.notes && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>บันทึกเพิ่มเติม</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                {record.notes}
              </p>
            </div>
          )}

          {/* Admin Review Notes (if any) */}
          {record.reviewNotes && (
            <div className={`p-4 rounded-2xl border ${
              record.status === 'approved' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : record.status === 'needs_revision'
                ? 'bg-orange-50 border-orange-200 text-orange-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}>
              <div className="text-xs font-bold mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>ข้อเสนอแนะจากผู้ตรวจประเมินโครงการ:</span>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed">{record.reviewNotes}</p>
            </div>
          )}

          {/* Evidence Photos */}
          {record.evidenceImages && record.evidenceImages.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <span>ภาพถ่ายหลักฐานการออกกำลังกาย ({record.evidenceImages.length} ภาพ)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {record.evidenceImages.map((imgUrl, i) => (
                  <a
                    key={i}
                    href="#"
                    onClick={(e) => { e.preventDefault(); openEvidenceImage(imgUrl); }}
                    className="block rounded-2xl overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 group relative"
                  >
                    <img
                      src={imgUrl}
                      alt={`หลักฐาน ${i + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium">
                      คลิกเพื่อดูภาพเต็ม
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Comments / Discussion Thread */}
          <div className="border-t border-slate-200 pt-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">
                ความคิดเห็นและการสื่อสาร ({comments.length})
              </h3>
            </div>

            {comments.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">ยังไม่มีความคิดเห็น</p>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {comments.map((c) => (
                  <div
                    key={c.id || Math.random()}
                    className={`p-3 rounded-2xl text-xs space-y-1 ${
                      c.authorRole === 'admin'
                        ? 'bg-purple-50 border border-purple-200 text-purple-950'
                        : 'bg-slate-50 border border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1">
                        {c.authorRole === 'admin' ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-purple-200 text-purple-800 text-[10px]">
                            ผู้ตรวจประเมิน
                          </span>
                        ) : (
                          <span className="text-blue-700">{c.authorName}</span>
                        )}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-line">{c.message}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add comment box */}
            <form onSubmit={handleSendComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="พิมพ์ข้อความสอบถามหรือชี้แจง..."
                maxLength={500}
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
              <button
                type="submit"
                disabled={isSending || !newComment.trim()}
                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div>
            {canEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(record);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs transition shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{record.status === 'needs_revision' ? 'แก้ไขและส่งตรวจใหม่' : 'แก้ไขบันทึกนี้'}</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs transition"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

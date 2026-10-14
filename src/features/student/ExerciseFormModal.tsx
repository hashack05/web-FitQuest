import React, { useState, useEffect } from 'react';
import { 
  X, 
  Dumbbell, 
  Calendar, 
  Clock, 
  Flame, 
  Upload, 
  Image as ImageIcon, 
  AlertCircle, 
  Check, 
  Loader2, 
  Trash2 
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext.tsx';
import { ExerciseRecordDoc, ExerciseIntensity } from '../../types/index.ts';
import { 
  createExerciseRecord, 
  updateExerciseRecord, 
  uploadEvidenceImage,
  MAX_EVIDENCE_IMAGES 
} from '../../services/exerciseService.ts';

interface ExerciseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordToEdit?: ExerciseRecordDoc | null;
  onSaved: () => void;
}

const COMMON_ACTIVITIES = [
  'วิ่ง / จ็อกกิ้ง',
  'เดินเร็ว',
  'ปั่นจักรยาน',
  'ว่ายน้ำ',
  'แบดมินตัน',
  'ฟุตบอล / ฟุตซอล',
  'บาสเกตบอล',
  'กระโดดเชือก',
  'เต้นแอโรบิก / ซุมบ้า',
  'บอดี้เวท / เวทเทรนนิ่ง',
  'โยคะ / ยืดเหยียด',
  'กิจกรรมทางกายอื่นๆ',
];

export const ExerciseFormModal: React.FC<ExerciseFormModalProps> = ({
  isOpen,
  onClose,
  recordToEdit,
  onSaved,
}) => {
  const { studentProfile } = useAuth();

  const todayStr = new Date().toISOString().split('T')[0];

  const [activityType, setActivityType] = useState('วิ่ง / จ็อกกิ้ง');
  const [activityName, setActivityName] = useState('');
  const [exerciseDate, setExerciseDate] = useState(todayStr);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [intensity, setIntensity] = useState<ExerciseIntensity>('moderate');
  const [notes, setNotes] = useState('');
  const [evidenceImages, setEvidenceImages] = useState<string[]>([]);
  const [submissionId, setSubmissionId] = useState<string>('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form when recordToEdit changes
  useEffect(() => {
    if (recordToEdit) {
      setActivityType(recordToEdit.activityType || 'วิ่ง / จ็อกกิ้ง');
      setActivityName(recordToEdit.activityName || '');
      setExerciseDate(recordToEdit.exerciseDate || todayStr);
      setDurationMinutes(recordToEdit.durationMinutes || 30);
      setIntensity(recordToEdit.intensity || 'moderate');
      setNotes(recordToEdit.notes || '');
      setEvidenceImages(recordToEdit.evidenceImages || []);
      setSelectedFile(null);
      setFilePreview(null);
      setSubmissionId(recordToEdit.id || '');
    } else {
      setActivityType('วิ่ง / จ็อกกิ้ง');
      setActivityName('');
      setExerciseDate(todayStr);
      setDurationMinutes(30);
      setIntensity('moderate');
      setNotes('');
      setEvidenceImages([]);
      setSelectedFile(null);
      setFilePreview(null);
      // Generate idempotent submission ID for this form session
      setSubmissionId(`rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
    }
    setError(null);
  }, [recordToEdit, isOpen, todayStr]);

  if (!isOpen || !studentProfile) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setError('ขนาดไฟล์รูปภาพต้องไม่เกิน 15MB');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('รองรับเฉพาะไฟล์รูปภาพ (JPEG, PNG, WebP)');
      return;
    }

    setError(null);
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setFilePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (submitStatus: 'draft' | 'pending') => {
    setError(null);

    // Validation
    if (!activityName.trim()) {
      setError('กรุณาระบุชื่อกิจกรรมหรือสถานที่ออกกำลังกาย');
      return;
    }
    if (durationMinutes <= 0 || durationMinutes > 1440) {
      setError('ระยะเวลาออกกำลังกายต้องอยู่ระหว่าง 1 ถึง 1,440 นาที');
      return;
    }
    if (!exerciseDate) {
      setError('กรุณาเลือกวันที่ออกกำลังกาย');
      return;
    }

    setIsSubmitting(true);

    try {
      let finalImages = [...evidenceImages];

      // If user chose a file, upload it to Firebase Storage first
      if (selectedFile) {
        if (finalImages.length >= MAX_EVIDENCE_IMAGES) {
          throw new Error(`แนบรูปได้สูงสุด ${MAX_EVIDENCE_IMAGES} รูป กรุณาลบรูปเดิมก่อนเพิ่มรูปใหม่`);
        }
        setIsUploadingImage(true);
        const tempRecordId = recordToEdit?.id || `rec_${Date.now()}`;
        const downloadUrl = await uploadEvidenceImage(studentProfile.uid, tempRecordId, selectedFile);
        finalImages.push(downloadUrl);
        setIsUploadingImage(false);
      }

      if (recordToEdit?.id) {
        // Multi-device conflict protected update
        await updateExerciseRecord(
          recordToEdit.id,
          {
            activityType,
            activityName: activityName.trim(),
            exerciseDate,
            durationMinutes: Number(durationMinutes),
            intensity,
            notes: notes.trim(),
            evidenceImages: finalImages,
            status: submitStatus,
          },
          recordToEdit.updatedAt
        );
      } else {
        // Create new record with idempotent submissionId
        await createExerciseRecord({
          participantUid: studentProfile.uid,
          participantId: studentProfile.participantId,
          classroomId: studentProfile.classroomId,
          activityType,
          activityName: activityName.trim(),
          exerciseDate,
          durationMinutes: Number(durationMinutes),
          intensity,
          notes: notes.trim(),
          evidenceImages: finalImages,
          status: submitStatus,
          submissionId: submissionId || undefined,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Submit exercise error:', err);
      setError(err.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
      setIsUploadingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {recordToEdit ? 'แก้ไขบันทึกการออกกำลังกาย' : 'บันทึกการออกกำลังกายวันนี้'}
              </h3>
              <p className="text-xs text-slate-500">กรอกข้อมูลตามความเป็นจริงเพื่อประโยชน์ในการวิจัย</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white transition"
            aria-label="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Activity Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ประเภทกิจกรรม <span className="text-rose-500">*</span>
            </label>
            <select
              value={activityType}
              onChange={(e) => {
                setActivityType(e.target.value);
                if (!activityName) setActivityName(e.target.value);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition outline-hidden"
            >
              {COMMON_ACTIVITIES.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Activity Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ชื่อกิจกรรม / รายละเอียดสั้นๆ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              placeholder="เช่น วิ่งรอบสนามโรงเรียน, ปั่นจักรยานในสวนสาธารณะ"
              maxLength={128}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition outline-hidden"
              required
            />
          </div>

          {/* Date & Duration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>วันที่ออกกำลังกาย</span> <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                max={todayStr}
                value={exerciseDate}
                onChange={(e) => setExerciseDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>ระยะเวลา (นาที)</span> <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={1440}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition outline-hidden"
                required
              />
            </div>
          </div>

          {/* Intensity Radio Cards */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span>ระดับความเหนื่อย (Intensity)</span> <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  key: 'light',
                  label: 'เบา',
                  desc: 'หายใจปกติ พูดคุยได้สบาย',
                  color: 'border-emerald-300 bg-emerald-50/50 text-emerald-900',
                  active: 'ring-2 ring-emerald-500 bg-emerald-100/70 border-emerald-500',
                },
                {
                  key: 'moderate',
                  label: 'ปานกลาง',
                  desc: 'หัวใจเต้นเร็ว พูดได้ต่อเนื่อง',
                  color: 'border-amber-300 bg-amber-50/50 text-amber-900',
                  active: 'ring-2 ring-amber-500 bg-amber-100/70 border-amber-500',
                },
                {
                  key: 'vigorous',
                  label: 'หนัก',
                  desc: 'หายใจหอบ พูดได้สั้นๆ',
                  color: 'border-rose-300 bg-rose-50/50 text-rose-900',
                  active: 'ring-2 ring-rose-500 bg-rose-100/70 border-rose-500',
                },
              ].map((lvl) => (
                <button
                  type="button"
                  key={lvl.key}
                  onClick={() => setIntensity(lvl.key as ExerciseIntensity)}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    intensity === lvl.key ? lvl.active : lvl.color
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">{lvl.label}</span>
                    {intensity === lvl.key && <Check className="w-4 h-4" />}
                  </div>
                  <span className="text-[11px] opacity-80 leading-snug">{lvl.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              บันทึกความรู้สึก / รายละเอียดเพิ่มเติม (ถ้ามี)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น วันนี้อากาศดี วิ่งครบ 3 กิโลเมตร รู้สึกสดชื่น"
              maxLength={1000}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition outline-hidden resize-none"
            />
          </div>

          {/* Evidence Image Attachment */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>แนบภาพถ่ายหลักฐาน (ไม่บังคับ)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">ระบบย่อรูปให้อัตโนมัติ</span>
            </label>

            {/* Existing images list */}
            {evidenceImages.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {evidenceImages.map((imgUrl, idx) => (
                  <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                    <img src={imgUrl} alt="หลักฐาน" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setEvidenceImages(evidenceImages.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 p-1 rounded-full bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition shadow-xs"
                      title="ลบภาพนี้"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* File upload input */}
            <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-50/70 hover:bg-blue-50/30 transition text-center">
              <Upload className="w-6 h-6 text-slate-400 mb-1" />
              <span className="text-xs font-semibold text-slate-700">คลิกเพื่อเลือกภาพจากมือถือหรือกล้อง</span>
              <span className="text-[10px] text-slate-400 mt-0.5">JPEG, PNG, WebP (ไฟล์ไม่เกิน 15MB)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {filePreview && (
              <div className="mt-3 flex items-center gap-3 p-2 bg-slate-100 rounded-xl">
                <img src={filePreview} alt="พรีวิว" className="w-12 h-12 object-cover rounded-lg" />
                <div className="text-xs text-slate-600 truncate flex-1">{selectedFile?.name}</div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setFilePreview(null);
                  }}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-white text-slate-600 text-sm font-medium transition"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={() => handleSubmit('draft')}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold transition shadow-2xs disabled:opacity-50"
          >
            บันทึกเป็นฉบับร่าง
          </button>

          <button
            type="button"
            onClick={() => handleSubmit('pending')}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isUploadingImage ? 'กำลังอัปโหลดรูป...' : 'กำลังบันทึก...'}</span>
              </>
            ) : (
              <span>ส่งข้อมูลเพื่อตรวจ</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

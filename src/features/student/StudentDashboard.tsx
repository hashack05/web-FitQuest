import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Dumbbell, 
  Clock, 
  Calendar, 
  Flame, 
  AlertCircle, 
  ChevronRight,
  Filter,
  CheckCircle2,
  FileEdit,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext.tsx';
import { ExerciseRecordDoc, ExerciseStatus } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { EmptyState } from '../../components/common/EmptyState.tsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.tsx';
import { subscribeStudentRecords } from '../../services/exerciseService.ts';
import { ExerciseFormModal } from './ExerciseFormModal.tsx';
import { ExerciseDetailModal } from './ExerciseDetailModal.tsx';
import { ConsentModal } from './ConsentModal.tsx';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client.ts';

export const StudentDashboard: React.FC = () => {
  const { studentProfile } = useAuth();
  const [records, setRecords] = useState<ExerciseRecordDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ExerciseStatus | 'all'>('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<ExerciseRecordDoc | null>(null);

  const [selectedRecord, setSelectedRecord] = useState<ExerciseRecordDoc | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [hasConsented, setHasConsented] = useState<boolean | null>(null);

  // Check consent status on initial load
  useEffect(() => {
    async function checkConsent() {
      if (!studentProfile) return;
      try {
        const cSnap = await getDoc(doc(db, 'consents', studentProfile.uid));
        setHasConsented(cSnap.exists() && cSnap.data()?.accepted === true);
      } catch (err) {
        console.warn('Error checking consent:', err);
        setHasConsented(true); // Don't block if rule issue
      }
    }
    checkConsent();
  }, [studentProfile]);

  // Real-time listener for student exercise records
  useEffect(() => {
    if (!studentProfile?.uid) return;

    setIsLoading(true);
    const unsubscribe = subscribeStudentRecords(
      studentProfile.uid,
      (fetched) => {
        setRecords(fetched);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error loading student records:', err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [studentProfile?.uid]);

  // Pure factual statistics (No XP, No score, No leaderboard)
  const stats = useMemo(() => {
    const totalCount = records.length;
    const totalMinutes = records.reduce((acc, r) => acc + (r.durationMinutes || 0), 0);
    const pendingCount = records.filter((r) => r.status === 'pending').length;
    const revisionCount = records.filter((r) => r.status === 'needs_revision').length;
    const approvedCount = records.filter((r) => r.status === 'approved').length;

    return { totalCount, totalMinutes, pendingCount, revisionCount, approvedCount };
  }, [records]);

  // Filter records by tab
  const filteredRecords = useMemo(() => {
    if (activeTab === 'all') return records;
    return records.filter((r) => r.status === activeTab);
  }, [records, activeTab]);

  if (isLoading && records.length === 0) {
    return <LoadingSpinner message="กำลังซิงก์บันทึกการออกกำลังกายของคุณ..." />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Consent Modal if not completed */}
      {hasConsented === false && (
        <ConsentModal onConsentComplete={() => setHasConsented(true)} />
      )}

      {/* Needs Revision Alert Banner if any */}
      {stats.revisionCount > 0 && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-start justify-between gap-3 shadow-2xs animate-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-orange-500 text-white rounded-xl shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-orange-900">
                มี {stats.revisionCount} บันทึกที่ต้องแก้ไขเพิ่มเติม
              </h4>
              <p className="text-xs text-orange-800 mt-0.5">
                กรุณาตรวจสอบข้อคิดเห็นจากทีมผู้วิจัยและกดแก้ไขเพื่อส่งข้อมูลใหม่อีกครั้ง
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('needs_revision')}
            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl shrink-0 transition"
          >
            ดูรายการ
          </button>
        </div>
      )}

      {/* Top Welcome & Quick Action Card */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-600/15 relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-blue-100 text-[11px] font-semibold backdrop-blur-xs">
              ห้อง {studentProfile?.classroomId}
            </span>
            <span className="text-xs text-blue-100">
              รหัส: {studentProfile?.participantId}
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              สวัสดี, {studentProfile?.displayName || 'นักเรียน'} 👋
            </h1>
            <p className="text-blue-100 text-sm mt-1 max-w-lg font-medium">
              “ขยับทุกวัน สนุกทุกภารกิจ” บันทึกกิจกรรมของคุณวันนี้เพื่อสุขภาพที่ดีและร่วมเป็นส่วนหนึ่งของงานวิจัย
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                setRecordToEdit(null);
                setIsFormOpen(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white text-blue-700 font-bold text-sm sm:text-base rounded-2xl hover:bg-blue-50 transition shadow-md active:scale-98"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span>เพิ่มบันทึกการออกกำลังกายวันนี้</span>
            </button>
          </div>
        </div>

        {/* Subtle Decorative Circles */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-24 -top-12 w-48 h-48 bg-blue-400/20 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* Factual Exercise Summary Cards (NO Gamification) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">จำนวนครั้ง</span>
            <Dumbbell className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{stats.totalCount}</div>
          <p className="text-[11px] text-slate-400">บันทึกทั้งหมด</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">เวลารวม</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{stats.totalMinutes}</div>
          <p className="text-[11px] text-slate-400">นาที</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">รอตรวจ</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600">{stats.pendingCount}</div>
          <p className="text-[11px] text-slate-400">รอทีมวิจัยตรวจ</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">ผ่านการตรวจ</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600">{stats.approvedCount}</div>
          <p className="text-[11px] text-slate-400">เรียบร้อยแล้ว</p>
        </div>
      </div>

      {/* Tabs / Filter Navigation */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">ประวัติการออกกำลังกาย</h2>
          <span className="text-xs text-slate-500 font-medium">
            แสดง {filteredRecords.length} จาก {records.length} รายการ
          </span>
        </div>

        {/* Scrollable Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'ทั้งหมด', count: records.length },
            { id: 'pending', label: 'รอตรวจ', count: stats.pendingCount },
            { id: 'needs_revision', label: 'ต้องแก้ไข', count: stats.revisionCount, badgeColor: 'bg-orange-500 text-white' },
            { id: 'approved', label: 'ผ่านการตรวจแล้ว', count: stats.approvedCount },
            { id: 'draft', label: 'ฉบับร่าง', count: records.filter((r) => r.status === 'draft').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  tab.badgeColor
                    ? tab.badgeColor
                    : activeTab === tab.id
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Record Cards List */}
      {filteredRecords.length === 0 ? (
        <EmptyState
          title="ไม่พบรายการในหมวดนี้"
          description={
            activeTab === 'all'
              ? 'คุณยังไม่มีบันทึกการออกกำลังกาย เริ่มบันทึกกิจกรรมวันนี้ได้เลย!'
              : `ไม่มีรายการที่มีสถานะ "${activeTab}"`
          }
          actionLabel={activeTab === 'all' ? '+ บันทึกการออกกำลังกายวันนี้' : undefined}
          onAction={
            activeTab === 'all'
              ? () => {
                  setRecordToEdit(null);
                  setIsFormOpen(true);
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => (
            <div
              key={record.id}
              onClick={() => {
                setSelectedRecord(record);
                setIsDetailOpen(true);
              }}
              className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 shadow-2xs hover:shadow-md transition cursor-pointer flex items-center justify-between gap-4 group"
            >
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <StatusBadge status={record.status} size="sm" />
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{record.exerciseDate}</span>
                  </span>
                  <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-md">
                    {record.activityType}
                  </span>
                </div>

                <h3 className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition truncate">
                  {record.activityName}
                </h3>

                <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1 text-slate-700 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>{record.durationMinutes} นาที</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span>
                      ระดับ: {record.intensity === 'light' ? 'เบา' : record.intensity === 'vigorous' ? 'หนัก' : 'ปานกลาง'}
                    </span>
                  </span>
                  {record.evidenceImages && record.evidenceImages.length > 0 && (
                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm text-[10px] font-medium">
                      มีหลักฐาน {record.evidenceImages.length} ภาพ
                    </span>
                  )}
                </div>

                {record.reviewNotes && (
                  <p className="text-xs text-orange-800 bg-orange-50/80 p-2 rounded-lg border border-orange-100 line-clamp-1">
                    💬 คำแนะนำ: {record.reviewNotes}
                  </p>
                )}
              </div>

              <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-blue-50 text-slate-400 group-hover:text-blue-600 transition shrink-0">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Exercise Form Modal */}
      <ExerciseFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        recordToEdit={recordToEdit}
        onSaved={() => {
          setIsFormOpen(false);
          setRecordToEdit(null);
        }}
      />

      {/* Exercise Detail Modal */}
      <ExerciseDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedRecord(null);
        }}
        record={selectedRecord}
        onEdit={(rec) => {
          setIsDetailOpen(false);
          setSelectedRecord(null);
          setRecordToEdit(rec);
          setIsFormOpen(true);
        }}
      />
    </div>
  );
};

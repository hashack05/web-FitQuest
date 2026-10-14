import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Users, 
  FileText, 
  ShieldCheck, 
  FileSpreadsheet, 
  Settings, 
  History, 
  Search, 
  ChevronRight, 
  Calendar,
  Filter
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext.tsx';
import { ExerciseRecordDoc, ExerciseStatus, ExerciseFilter } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { EmptyState } from '../../components/common/EmptyState.tsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.tsx';
import { 
  subscribeAdminRecordsPaginated, 
  fetchAggregateDashboardStats 
} from '../../services/exerciseService.ts';
import { AdminRecordReviewModal } from './AdminRecordReviewModal.tsx';
import { ParticipantManagement } from './ParticipantManagement.tsx';
import { AdminManagement } from './AdminManagement.tsx';
import { CsvExporter } from './CsvExporter.tsx';
import { AuditLogsViewer } from './AuditLogsViewer.tsx';
import { ResearchSettings } from './ResearchSettings.tsx';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase/client.ts';

type AdminTab = 'records' | 'participants' | 'admins' | 'export' | 'logs' | 'settings';

export const AdminDashboard: React.FC = () => {
  const { adminProfile } = useAuth();
  const [currentTab, setCurrentTab] = useState<AdminTab>('records');
  const [records, setRecords] = useState<ExerciseRecordDoc[]>([]);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pageSize, setPageSize] = useState(50);

  // Filter state for records
  const [statusFilter, setStatusFilter] = useState<ExerciseStatus | 'all'>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected record for review
  const [selectedRecord, setSelectedRecord] = useState<ExerciseRecordDoc | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // True unconstrained aggregate statistics (Issue 8)
  const [stats, setStats] = useState({
    totalRecords: 0,
    pending: 0,
    approved: 0,
    revision: 0,
    rejected: 0,
    totalParticipants: 0,
  });

  const loadAggregateStats = useCallback(async () => {
    const s = await fetchAggregateDashboardStats();
    setStats(s);
    setParticipantCount(s.totalParticipants);
  }, []);

  useEffect(() => {
    loadAggregateStats();
  }, [loadAggregateStats]);

  // Subscribe to paginated records for display purposes
  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeAdminRecordsPaginated(
      { status: statusFilter, classroomId: classFilter },
      pageSize,
      (fetched) => {
        setRecords(fetched);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching records:', err);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, [statusFilter, classFilter, pageSize]);

  // Distinct classrooms from loaded records
  const classrooms = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.classroomId) set.add(r.classroomId);
    });
    return Array.from(set).sort();
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchClass = classFilter === 'all' || r.classroomId === classFilter;
      const matchSearch =
        r.participantId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.activityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.activityType.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchClass && matchSearch;
    });
  }, [records, statusFilter, classFilter, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Banner & Research Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold">
              {adminProfile?.position === 'lead_researcher' ? 'หัวหน้าโครงการวิจัย' : 'ผู้ดูแลระบบเว็บไซต์'}
            </span>
            <span className="text-xs text-slate-500">
              ผู้ดูแล: <span className="font-semibold text-slate-800">{adminProfile?.displayName}</span>
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            แผงควบคุมระบบวิจัย Fit Quest (Admin Dashboard)
          </h1>
        </div>

        {stats.pending > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
            <Clock className="w-4 h-4 text-amber-600 animate-spin" />
            <span>มี <strong>{stats.pending} รายการ</strong> รอการตรวจประเมิน</span>
          </div>
        )}
      </div>

      {/* Aggregate Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>ผู้เข้าร่วมทั้งหมด</span>
            <Users className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">{participantCount}</div>
          <span className="text-[10px] text-slate-400">คน</span>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>บันทึกทั้งหมด</span>
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">{stats.totalRecords}</div>
          <span className="text-[10px] text-slate-400">รายการ</span>
        </div>

        <div 
          onClick={() => {
            setCurrentTab('records');
            setStatusFilter('pending');
          }}
          className="p-3.5 bg-amber-50/70 hover:bg-amber-100/70 transition cursor-pointer rounded-2xl border border-amber-200 shadow-2xs space-y-1"
        >
          <div className="text-[11px] font-semibold text-amber-800 flex items-center justify-between">
            <span>รอตรวจ (Pending)</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-amber-700">{stats.pending}</div>
          <span className="text-[10px] text-amber-600">คลิกเพื่อตรวจ</span>
        </div>

        <div 
          onClick={() => {
            setCurrentTab('records');
            setStatusFilter('approved');
          }}
          className="p-3.5 bg-white hover:bg-slate-50 transition cursor-pointer rounded-2xl border border-slate-200 shadow-2xs space-y-1"
        >
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>ผ่านการตรวจ</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-600">{stats.approved}</div>
          <span className="text-[10px] text-slate-400">อนุมัติแล้ว</span>
        </div>

        <div 
          onClick={() => {
            setCurrentTab('records');
            setStatusFilter('needs_revision');
          }}
          className="p-3.5 bg-white hover:bg-slate-50 transition cursor-pointer rounded-2xl border border-slate-200 shadow-2xs space-y-1"
        >
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>ต้องแก้ไข</span>
            <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
          </div>
          <div className="text-xl font-extrabold text-orange-600">{stats.revision}</div>
          <span className="text-[10px] text-slate-400">รอนักเรียนแก้</span>
        </div>

        <div 
          onClick={() => {
            setCurrentTab('records');
            setStatusFilter('rejected');
          }}
          className="p-3.5 bg-white hover:bg-slate-50 transition cursor-pointer rounded-2xl border border-slate-200 shadow-2xs space-y-1"
        >
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>ไม่ผ่าน</span>
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-extrabold text-rose-600">{stats.rejected}</div>
          <span className="text-[10px] text-slate-400">รายการ</span>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: 'records', label: 'ตรวจสอบบันทึก', icon: CheckCircle2, badge: stats.pending },
          { id: 'participants', label: 'จัดการผู้เข้าร่วม', icon: Users, badge: participantCount },
          { id: 'admins', label: 'ทีมผู้ดูแลระบบ', icon: ShieldCheck },
          { id: 'export', label: 'ส่งออกข้อมูล CSV', icon: FileSpreadsheet },
          { id: 'logs', label: 'Audit Trail', icon: History },
          { id: 'settings', label: 'ตั้งค่าโครงการ', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id as AdminTab)}
              className={`py-3 px-4 font-semibold text-xs rounded-t-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap border-b-2 -mb-px ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  tab.id === 'records' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Review Records */}
      {currentTab === 'records' && (
        <div className="space-y-4">
          {/* Filters & Page Size */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาด้วยรหัส หรือชื่อกิจกรรม..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
              >
                <option value="all">ทุกสถานะ ({stats.totalRecords})</option>
                <option value="pending">รอตรวจ ({stats.pending})</option>
                <option value="approved">ผ่านการตรวจ ({stats.approved})</option>
                <option value="needs_revision">ต้องแก้ไข ({stats.revision})</option>
                <option value="rejected">ไม่ผ่าน ({stats.rejected})</option>
                <option value="draft">ฉบับร่าง</option>
              </select>
            </div>

            <div>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
              >
                <option value="all">ทุกห้องเรียน</option>
                {classrooms.map((c) => (
                  <option key={c} value={c}>
                    ห้อง {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
              >
                <option value={50}>แสดง 50 รายการต่อหน้า</option>
                <option value={100}>แสดง 100 รายการต่อหน้า</option>
                <option value={200}>แสดง 200 รายการต่อหน้า</option>
              </select>
            </div>
          </div>

          {/* Records Table */}
          {isLoading && records.length === 0 ? (
            <LoadingSpinner message="กำลังซิงก์ข้อมูลบันทึกทั้งหมด..." />
          ) : filteredRecords.length === 0 ? (
            <EmptyState
              title="ไม่พบบันทึกการออกกำลังกาย"
              description="ไม่มีรายการที่ตรงกับตัวกรองที่เลือกในขณะนี้"
            />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-3 px-4">ผู้เข้าร่วม</th>
                      <th className="py-3 px-4">วันที่</th>
                      <th className="py-3 px-4">กิจกรรม</th>
                      <th className="py-3 px-4">ระยะเวลา</th>
                      <th className="py-3 px-4">ระดับ</th>
                      <th className="py-3 px-4">หลักฐาน</th>
                      <th className="py-3 px-4">สถานะ</th>
                      <th className="py-3 px-4 text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {r.participantId}
                          <span className="block font-sans font-normal text-[11px] text-slate-400">
                            ห้อง {r.classroomId}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{r.exerciseDate}</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 block">{r.activityName}</span>
                          <span className="text-[11px] text-blue-600">{r.activityType}</span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          {r.durationMinutes} นาที
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            r.intensity === 'vigorous'
                              ? 'bg-rose-50 text-rose-700'
                              : r.intensity === 'light'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {r.intensity === 'light' ? 'เบา' : r.intensity === 'vigorous' ? 'หนัก' : 'ปานกลาง'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {r.evidenceImages && r.evidenceImages.length > 0 ? (
                            <span className="text-emerald-700 font-medium">{r.evidenceImages.length} ภาพ</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={r.status} size="sm" />
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedRecord(r);
                              setIsReviewOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] transition shadow-2xs"
                          >
                            ตรวจบันทึก
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Participants */}
      {currentTab === 'participants' && <ParticipantManagement />}

      {/* Tab 3: Admins */}
      {currentTab === 'admins' && <AdminManagement />}

      {/* Tab 4: Export CSV */}
      {currentTab === 'export' && <CsvExporter />}

      {/* Tab 5: Audit Trail */}
      {currentTab === 'logs' && <AuditLogsViewer />}

      {/* Tab 6: Research Settings */}
      {currentTab === 'settings' && <ResearchSettings />}

      {/* Review Modal */}
      <AdminRecordReviewModal
        isOpen={isReviewOpen}
        onClose={() => {
          setIsReviewOpen(false);
          setSelectedRecord(null);
        }}
        record={selectedRecord}
        onReviewSubmitted={() => {
          setIsReviewOpen(false);
          setSelectedRecord(null);
          loadAggregateStats();
        }}
      />
    </div>
  );
};

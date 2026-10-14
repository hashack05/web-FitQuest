import React, { useState } from 'react';
import { Download, FileSpreadsheet, Calendar, Filter, Loader2 } from 'lucide-react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '../../lib/firebase/client.ts';
import { ExerciseRecordDoc } from '../../types/index.ts';

export const CsvExporter: React.FC = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classroomFilter, setClassroomFilter] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ type: 'warning' | 'error' | 'success'; text: string } | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportMessage(null);
    try {
      let q = query(collection(db, 'exerciseRecords'), orderBy('createdAt', 'desc'));

      const snapshot = await getDocs(q);
      const records: ExerciseRecordDoc[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as ExerciseRecordDoc;
        // Client-side filtering for complex compound filters
        let match = true;
        if (dateFrom && data.exerciseDate < dateFrom) match = false;
        if (dateTo && data.exerciseDate > dateTo) match = false;
        if (statusFilter !== 'all' && data.status !== statusFilter) match = false;
        if (classroomFilter && data.classroomId.toLowerCase() !== classroomFilter.toLowerCase()) match = false;

        if (match) records.push(data);
      });

      if (records.length === 0) {
        setExportMessage({ type: 'warning', text: 'ไม่พบข้อมูลบันทึกที่ตรงตามเงื่อนไขที่เลือก' });
        setIsExporting(false);
        return;
      }

      // Safe CSV Columns (Explicitly excluding any PINs, credentials or tokens)
      const headers = [
        'Participant ID',
        'Classroom',
        'Exercise Date',
        'Activity Type',
        'Activity Name',
        'Duration (Minutes)',
        'Intensity',
        'Status',
        'Notes',
        'Submitted At',
        'Reviewed At',
        'Review Notes',
      ];

      const csvRows = [headers.join(',')];

      for (const r of records) {
        const row = [
          `"${r.participantId || ''}"`,
          `"${r.classroomId || ''}"`,
          `"${r.exerciseDate || ''}"`,
          `"${(r.activityType || '').replace(/"/g, '""')}"`,
          `"${(r.activityName || '').replace(/"/g, '""')}"`,
          r.durationMinutes || 0,
          `"${r.intensity || ''}"`,
          `"${r.status || ''}"`,
          `"${(r.notes || '').replace(/"/g, '""')}"`,
          `"${r.submittedAt || ''}"`,
          `"${r.reviewedAt || ''}"`,
          `"${(r.reviewNotes || '').replace(/"/g, '""')}"`,
        ];
        csvRows.push(row.join(','));
      }

      // Add UTF-8 BOM so Excel opens Thai characters properly
      const csvString = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `fitquest_exercise_records_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExportMessage({ type: 'success', text: `ส่งออกข้อมูลสำเร็จ (${records.length} รายการ)` });
    } catch (err: any) {
      setExportMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการส่งออกข้อมูล: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">ส่งออกข้อมูลงานวิจัย (Export to CSV)</h3>
          <p className="text-xs text-slate-500">
            ดาวน์โหลดไฟล์ CSV สำหรับการวิเคราะห์ผลทางสถิติ (ไม่มีข้อมูลส่วนตัวที่มีความอ่อนไหว)
          </p>
        </div>
      </div>

      {exportMessage && (
        <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
          exportMessage.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : exportMessage.type === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <span>{exportMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">ตั้งแต่วันที่</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-hidden"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">ถึงวันที่</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-hidden"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">สถานะบันทึก</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-hidden"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="approved">ผ่านการตรวจแล้ว (Approved)</option>
            <option value="pending">รอตรวจ (Pending)</option>
            <option value="needs_revision">ต้องแก้ไข (Needs Revision)</option>
            <option value="rejected">ไม่ผ่าน (Rejected)</option>
            <option value="draft">ฉบับร่าง (Draft)</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">ห้องเรียน / กลุ่ม</label>
          <input
            type="text"
            value={classroomFilter}
            onChange={(e) => setClassroomFilter(e.target.value)}
            placeholder="เว้นว่าง = ทุกห้อง"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-hidden"
          />
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-xs disabled:opacity-50"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>กำลังสร้างไฟล์ CSV...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลด CSV สำหรับงานวิจัย</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

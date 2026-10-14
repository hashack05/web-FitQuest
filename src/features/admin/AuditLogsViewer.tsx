import React, { useState, useEffect } from 'react';
import { ShieldAlert, Clock, User, FileText, Loader2 } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase/client.ts';
import { AuditLogDoc } from '../../types/index.ts';

export const AuditLogsViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AuditLogDoc[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            action: data.action,
            actorUid: data.actorUid,
            actorEmail: data.actorEmail,
            targetUid: data.targetUid,
            recordId: data.recordId,
            details: data.details,
            timestamp: data.timestamp?.toDate
              ? data.timestamp.toDate().toLocaleString('th-TH')
              : data.timestamp || '-',
          });
        });
        setLogs(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('Audit log fetch error:', err);
        handleFirestoreError(err, OperationType.GET, 'auditLogs');
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">บันทึกประวัติการทำงานของระบบ (Audit Trail)</h3>
          <p className="text-xs text-slate-500">
            บันทึกการกระทำที่สำคัญของผู้ดูแล เช่น การเพิ่มนักเรียน การรีเซ็ต PIN และการจัดการสิทธิ์
          </p>
        </div>
      </div>

      {isLoading && logs.length === 0 ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">ยังไม่มีบันทึก Audit Log ในระบบ</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">เวลา</th>
                <th className="py-2.5 px-3">การกระทำ (Action)</th>
                <th className="py-2.5 px-3">ผู้ดำเนินการ (Actor)</th>
                <th className="py-2.5 px-3">รายละเอียด (Details)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-3 text-slate-500 font-mono whitespace-nowrap">{log.timestamp}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-mono text-[11px] font-bold">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700">{log.actorEmail || log.actorUid}</td>
                  <td className="py-3 px-3 text-slate-600">{log.details || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

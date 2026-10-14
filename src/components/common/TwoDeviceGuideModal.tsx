import React from 'react';
import { Smartphone, Monitor, RefreshCw, X, ShieldCheck, Check } from 'lucide-react';

interface TwoDeviceGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TwoDeviceGuideModal: React.FC<TwoDeviceGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/20 transition text-white"
            aria-label="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">คู่มือทดสอบระบบสองอุปกรณ์ (Real-Time Sync)</h2>
              <p className="text-blue-100 text-xs mt-0.5">Two-Device Production Test Protocol</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-slate-700 text-sm">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 items-start">
            <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <h4 className="font-semibold text-blue-900">หลักการทำงาน Real-Time Cloud Firestore</h4>
              <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                ระบบ Fit Quest ใช้ Cloud Firestore เป็น Single Source of Truth พร้อม realtime snapshot listeners 
                ทำให้ทุกการบันทึกหรือตรวจของ Admin จะปรากฏบนหน้าจอของนักเรียนทันทีโดยไม่ต้องกดรีเฟรชหน้าเว็บ
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center text-xs font-bold">1</span>
              ขั้นตอนทดสอบ 2 เครื่องหรือ 2 แท็บเบราว์เซอร์
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2 font-semibold text-slate-900 mb-2">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  <span>อุปกรณ์ A (มือถือ / นักเรียน)</span>
                </div>
                <ol className="text-xs space-y-1.5 list-decimal list-inside text-slate-600">
                  <li>เข้าสู่ระบบด้วยรหัสผู้เข้าร่วม + PIN 6 หลัก</li>
                  <li>กดปุ่ม <span className="font-medium text-slate-900">"+ บันทึกการออกกำลังกายวันนี้"</span></li>
                  <li>กรอกกิจกรรมและกด <span className="font-medium text-blue-600">"ส่งข้อมูลเพื่อตรวจ"</span></li>
                  <li>สังเกตสถานะเป็น <span className="font-medium text-amber-700">"รอตรวจ"</span></li>
                </ol>
              </div>

              <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2 font-semibold text-slate-900 mb-2">
                  <Monitor className="w-4 h-4 text-purple-600" />
                  <span>อุปกรณ์ B (คอมพิวเตอร์ / Admin)</span>
                </div>
                <ol className="text-xs space-y-1.5 list-decimal list-inside text-slate-600">
                  <li>เข้าสู่ระบบด้วย Google Account ของผู้ดูแล</li>
                  <li>จะเห็นบันทึกใหม่ของอุปกรณ์ A ทันทีแบบ Real-Time!</li>
                  <li>กดปุ่ม <span className="font-medium text-slate-900">"ตรวจบันทึก"</span></li>
                  <li>พิมพ์ข้อเสนอแนะ แล้วกด <span className="font-medium text-emerald-600">"อนุมัติ"</span> หรือ <span className="font-medium text-orange-600">"ขอให้แก้ไข"</span></li>
                </ol>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <h4 className="font-semibold text-emerald-900 flex items-center gap-2 mb-1">
                <Check className="w-4 h-4 text-emerald-600" />
                ผลลัพธ์ที่ต้องเกิดขึ้น (Verification)
              </h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                อุปกรณ์ A (นักเรียน) จะเห็นสถานะเปลี่ยนเป็น <span className="font-semibold">"ผ่านการตรวจแล้ว"</span> พร้อมข้อความแนะนำจาก Admin บนหน้าจอทันที <strong>โดยไม่ต้องกด Refresh หน้าเว็บ</strong>
              </p>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <h4 className="font-semibold text-amber-900 mb-1">การทดสอบ Multi-Device Conflict Protection</h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                หากเปิดบันทึกเดียวกันในสองแท็บ และแท็บหนึ่งกดแก้ไขแล้วบันทึก อีกแท็บหนึ่งที่กำลังแก้ไขข้อมูลเวอร์ชันเก่าอยู่ ระบบจะตรวจพบ <code>updatedAt</code> ขัดแย้ง และปฏิเสธการเซฟทับพร้อมแจ้งเตือน: <em>"ข้อมูลนี้มีการเปลี่ยนแปลงจากอีกอุปกรณ์ กรุณาตรวจสอบข้อมูลล่าสุดก่อนบันทึก"</em>
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition shadow-xs"
          >
            เข้าใจแล้ว เริ่มทดสอบ
          </button>
        </div>
      </div>
    </div>
  );
};

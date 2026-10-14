import { z } from 'zod';

export const StudentLoginSchema = z.object({
  participantId: z
    .string()
    .trim()
    .min(2, 'รหัสผู้เข้าร่วมต้องมีความยาวอย่างน้อย 2 ตัวอักษร')
    .max(32, 'รหัสผู้เข้าร่วมต้องไม่เกิน 32 ตัวอักษร')
    .regex(/^[A-Za-z0-9_-]+$/, 'รหัสผู้เข้าร่วมต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข ขีดกลาง หรืออันเดอร์สโกรเท่านั้น'),
  pin: z
    .string()
    .trim()
    .length(6, 'PIN ต้องเป็นตัวเลข 6 หลัก')
    .regex(/^\d{6}$/, 'PIN ต้องเป็นตัวเลข 6 หลักเท่านั้น'),
});

export const ChangePinSchema = z.object({
  currentPin: z
    .string()
    .trim()
    .length(6, 'PIN เดิมต้องเป็นตัวเลข 6 หลัก')
    .regex(/^\d{6}$/, 'PIN เดิมต้องเป็นตัวเลข 6 หลัก'),
  newPin: z
    .string()
    .trim()
    .length(6, 'PIN ใหม่ต้องเป็นตัวเลข 6 หลัก')
    .regex(/^\d{6}$/, 'PIN ใหม่ต้องเป็นตัวเลข 6 หลัก'),
});

export const CreateStudentSchema = z.object({
  participantId: z
    .string()
    .trim()
    .min(2, 'รหัสผู้เข้าร่วมต้องมีอย่างน้อย 2 ตัวอักษร')
    .max(32, 'รหัสผู้เข้าร่วมต้องไม่เกิน 32 ตัวอักษร')
    .regex(/^[A-Za-z0-9_-]+$/, 'รหัสผู้เข้าร่วมต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข ขีดกลาง หรืออันเดอร์สโกรเท่านั้น'),
  displayName: z.string().trim().min(2, 'ชื่อที่แสดงต้องมีอย่างน้อย 2 ตัวอักษร').max(100),
  classroomId: z.string().trim().min(1, 'กรุณาระบุห้องเรียน/กลุ่ม'),
  studentNumber: z.string().trim().max(20).optional(),
  initialPin: z
    .string()
    .trim()
    .length(6, 'PIN ต้องเป็นตัวเลข 6 หลัก')
    .regex(/^\d{6}$/, 'PIN ต้องเป็นตัวเลข 6 หลัก')
    .optional(),
});

export const ResetStudentPinSchema = z.object({
  participantUid: z.string().trim().min(1, 'ระบุ UID ผู้เข้าร่วม'),
  newPin: z
    .string()
    .trim()
    .length(6, 'PIN ใหม่ต้องเป็นตัวเลข 6 หลัก')
    .regex(/^\d{6}$/, 'PIN ใหม่ต้องเป็นตัวเลข 6 หลัก'),
});

export const CreateAdminSchema = z.object({
  email: z.string().trim().email('อีเมลไม่ถูกต้อง'),
  displayName: z.string().trim().min(2, 'กรุณากรอกชื่อ-นามสกุล').max(100),
  position: z.enum(['lead_researcher', 'website_admin']),
});

export const ExerciseRecordSchema = z.object({
  activityType: z.string().trim().min(2, 'กรุณาระบุประเภทกิจกรรม').max(64),
  activityName: z.string().trim().min(2, 'กรุณาระบุชื่อกิจกรรม').max(128),
  exerciseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD'),
  durationMinutes: z.number().int().min(1, 'ระยะเวลาต้องอย่างน้อย 1 นาที').max(1440, 'ระยะเวลาต้องไม่เกิน 1,440 นาที'),
  intensity: z.enum(['light', 'moderate', 'vigorous']),
  notes: z.string().max(1000, 'หมายเหตุต้องไม่เกิน 1,000 ตัวอักษร').optional().default(''),
  evidenceImages: z.array(z.string()).max(5, 'สามารถแนบรูปภาพได้สูงสุด 5 ภาพ').optional().default([]),
  status: z.enum(['draft', 'pending']),
});

export const ReviewRecordSchema = z.object({
  recordId: z.string().min(1),
  status: z.enum(['approved', 'needs_revision', 'rejected']),
  reviewNotes: z.string().max(1000).optional().default(''),
});

export const AddCommentSchema = z.object({
  recordId: z.string().min(1),
  participantUid: z.string().min(1),
  message: z.string().trim().min(1, 'กรุณากรอกข้อความ').max(1000, 'ข้อความต้องไม่เกิน 1,000 ตัวอักษร'),
});

export const RegisterStudentSchema = z
  .object({
    participantId: z
      .string()
      .trim()
      .min(2, 'รหัสผู้เข้าร่วมต้องมีอย่างน้อย 2 ตัวอักษร')
      .max(32, 'รหัสผู้เข้าร่วมต้องไม่เกิน 32 ตัวอักษร')
      .regex(/^[A-Za-z0-9_-]+$/, 'รหัสผู้เข้าร่วมต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข ขีดกลาง หรืออันเดอร์สโกรเท่านั้น'),
    displayName: z.string().trim().min(2, 'ชื่อที่แสดงต้องมีอย่างน้อย 2 ตัวอักษร').max(100),
    classroomId: z.string().trim().min(1, 'กรุณาระบุห้องเรียน/กลุ่ม').max(50),
    studentNumber: z.string().trim().max(20).optional(),
    pin: z.string().trim().regex(/^\d{6}$/, 'PIN ต้องเป็นตัวเลข 6 หลัก'),
    confirmPin: z.string().trim(),
    registrationCode: z.string().trim().max(100).optional(),
  })
  .refine((d) => d.pin === d.confirmPin, { message: 'PIN และการยืนยัน PIN ไม่ตรงกัน', path: ['confirmPin'] });

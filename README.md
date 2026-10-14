# Fit Quest (fitquest-v2) 🏃‍♂️💨
> **“ขยับทุกวัน สนุกทุกภารกิจ” (Every Move is a Quest)**  
> ระบบบันทึกการออกกำลังกายสำหรับโครงการวิจัยและกิจกรรมส่งเสริมสุขภาพในนักเรียน (Production Architecture)

---

## สารบัญ
1. [ภาพรวมและปรัชญาของระบบ](#ภาพรวมและปรัชญาของระบบ)
2. [สถาปัตยกรรมความปลอดภัยและระบบ (Architecture)](#สถาปัตยกรรมความปลอดภัยและระบบ)
3. [เทคโนโลยีที่ใช้ (Tech Stack)](#เทคโนโลยีที่ใช้)
4. [โครงสร้างข้อมูล Firestore Collections (Single Source of Truth)](#โครงสร้างข้อมูล-firestore-collections)
5. [ขั้นตอนการติดตั้งและตั้งค่าระบบ (Production Deployment Guide)](#ขั้นตอนการติดตั้งและตั้งค่าระบบ)
   - [ขั้นตอนที่ 1: ติดตั้ง Dependencies](#ขั้นตอนที่-1-ติดตั้ง-dependencies)
   - [ขั้นตอนที่ 2: ตั้งค่า Firebase Project](#ขั้นตอนที่-2-ตั้งค่า-firebase-project)
   - [ขั้นตอนที่ 3: เปิดใช้งาน Authentication & Google Provider](#ขั้นตอนที่-3-เปิดใช้งาน-authentication--google-provider)
   - [ขั้นตอนที่ 4: สร้าง Cloud Firestore & Firebase Storage](#ขั้นตอนที่-4-สร้าง-cloud-firestore--firebase-storage)
   - [ขั้นตอนที่ 5: Deploy Security Rules & Indexes](#ขั้นตอนที่-5-deploy-security-rules--indexes)
   - [ขั้นตอนที่ 6: กำหนดค่า Environment Variables (.env)](#ขั้นตอนที่-6-กำหนดค่า-environment-variables-env)
   - [ขั้นตอนที่ 7: ตั้งค่า Firebase Authorized Domains](#ขั้นตอนที่-7-ตั้งค่า-firebase-authorized-domains)
   - [ขั้นตอนที่ 8: Bootstrap ผู้ดูแลระบบคนแรก (Initial Admin)](#ขั้นตอนที่-8-bootstrap-ผู้ดูแลระบบคนแรก-initial-admin)
   - [ขั้นตอนที่ 9: ลงทะเบียนผู้เข้าร่วม (Participant) คนแรก](#ขั้นตอนที่-9-ลงทะเบียนผู้เข้าร่วม-participant-คนแรก)
6. [การทดสอบจริงสองอุปกรณ์ (Two-Device Production Test Protocol)](#การทดสอบจริงสองอุปกรณ์-two-device-production-test-protocol)
7. [การสำรองและกู้คืนข้อมูล (Backup & Restore)](#การสำรองและกู้คืนข้อมูล-backup--restore)
8. [สรุปการตรวจสอบระบบ (Production Audit Checklist)](#สรุปการตรวจสอบระบบ-production-audit-checklist)

---

## ภาพรวมและปรัชญาของระบบ
Fit Quest เป็นเว็บแอปพลิเคชันสำหรับงานวิจัยสุขภาพและการส่งเสริมพฤติกรรมกิจกรรมทางกายในนักเรียน โดยมีหลักการสำคัญดังนี้:
1. **ไม่ใช่เกม (Anti-Gamification)**: ไม่มีระบบ XP, Points, Levels, Badges, Streaks, Rewards หรือ Leaderboard ข้อมูลทั้งหมดเป็นบันทึกจริงเพื่อการวิเคราะห์ทางสถิติ
2. **ไม่มีข้อมูลตัวอย่างใน Production**: ฐานข้อมูลเริ่มต้นจากความว่างเปล่า (Empty State) ไม่มี Hardcoded Accounts, Default PIN หรือ Seed Data ปะปน
3. **Single Source of Truth**: Cloud Firestore เป็นแหล่งข้อมูลหลักเพียงหนึ่งเดียว ทุกอุปกรณ์เห็นข้อมูลชุดเดียวกันแบบเรียลไทม์
4. **ความปลอดภัยระดับองค์กร (Zero-Trust ABAC)**: สิทธิ์ผู้ใช้แบ่งเป็น `student` และ `admin` โดย Admin ทั้งสองตำแหน่ง (`lead_researcher` และ `website_admin`) มีสิทธิ์ในระบบเท่ากัน

---

## สถาปัตยกรรมความปลอดภัยและระบบ

### 1. Student Authentication (รหัสผู้เข้าร่วม + PIN 6 หลัก)
* นักเรียนกรอก **Participant ID** + **PIN 6 หลัก** (ช่องกรอกเริ่มต้นว่างเสมอ)
* ส่งไปยัง Server Endpoint: `POST /api/auth/student-login`
* เซิร์ฟเวอร์ตรวจสอบกับคอลเลกชันความลับ `privateStudentCredentials` ที่จัดเก็บ **bcrypt One-way Password Hash** (ห้ามเก็บ Plaintext และห้ามส่ง Hash ออกไปยัง Client)
* ป้องกัน Brute-force: หากใส่ PIN ผิดเกิน 5 ครั้ง ระบบจะ Lockout บัญชีชั่วคราว 15 นาที พร้อมแจ้งข้อความ Generic Error เพื่อป้องกัน Account Enumeration
* เมื่อถูกต้อง Firebase Admin SDK จะออก **Firebase Custom Token** เพื่อให้นักเรียนล็อกอินเข้าสู่ Firebase Auth และมี Firebase Auth UID จริง

### 2. Admin Authentication (Google Sign-In)
* ผู้ดูแลเข้าสู่ระบบด้วย **Google Account** (หน้าต่าง Account Chooser จะเปิดเฉพาะเมื่อผู้ใช้กดปุ่มเท่านั้น)
* ระบบตรวจสอบเอกสารใน `users/{uid}` โดยต้องมี `role == "admin"` และ `active == true`
* หากไม่ใช่ Admin หรือถูกระงับสิทธิ์ ระบบจะเรียก `signOut()` ทันทีและแสดงข้อความ *"บัญชีนี้ไม่ได้รับอนุญาตให้เข้าใช้งาน Fit Quest"*

### 3. Session Persistence & Idle Policy
* ใช้ `onAuthStateChanged` ร่วมกับ Firebase Auth Persistence ทำให้การ **Refresh หน้าเว็บ, เปลี่ยนหน้า หรือเปิดแท็บใหม่ ไม่หลุดออกจากระบบ**
* ระบบตั้งเวลา Idle Timeout 12 ชั่วโมง หากไม่มีกิจกรรมจะ Logout เพื่อความปลอดภัย

---

## โครงสร้างข้อมูล Firestore Collections

| Collection Path | รายละเอียด | สิทธิ์การเข้าถึง |
|---|---|---|
| `users/{uid}` | ข้อมูลผู้ดูแลระบบ (Admin) | Student อ่าน/เขียนไม่ได้, Admin อ่านได้, แก้ไขผ่าน Server API |
| `participants/{uid}` | ข้อมูลโปรไฟล์ผู้เข้าร่วมโครงการ | Student อ่านเฉพาะของตนเอง, Admin จัดการได้ทั้งหมด |
| `privateStudentCredentials/{uid}` | จัดเก็บ PIN Hash และ Lockout state | **Deny All** จาก Client (เข้าถึงผ่าน Firebase Admin SDK บน Server เท่านั้น) |
| `exerciseRecords/{recordId}` | บันทึกการออกกำลังกาย | Student CRUD เฉพาะของตนเองตามสถานะ, Admin ตรวจประเมิน |
| `recordComments/{commentId}` | ข้อความสนทนาและข้อเสนอแนะ | Student อ่าน/ตอบเฉพาะบันทึกของตนเอง, Admin อ่าน/ตอบได้ |
| `consents/{uid}` | บันทึกความยินยอมเข้าร่วมวิจัย | Student อ่าน/ยอมรับของตนเอง, Admin อ่านได้ |
| `auditLogs/{logId}` | ประวัติการทำงานสำคัญ (Audit Trail) | Admin อ่านได้อย่างเดียว, เซิร์ฟเวอร์บันทึกอัตโนมัติ |
| `appSettings/{settingKey}` | การตั้งค่าโครงการและข้อความยินยอม | Authenticated User อ่านได้, Admin แก้ไขได้ |

---

## ขั้นตอนการติดตั้งและตั้งค่าระบบ

### ขั้นตอนที่ 1: ติดตั้ง Dependencies
```bash
npm install
```

### ขั้นตอนที่ 2: ตั้งค่า Firebase Project
1. เข้าไปที่ [Firebase Console](https://console.firebase.google.com/)
2. สร้างโปรเจกต์ใหม่ (หรือเลือกโปรเจกต์ที่มีอยู่)
3. เพิ่ม Web App ในหน้า Project Overview และจดบันทึกค่า Firebase Configuration

### ขั้นตอนที่ 3: เปิดใช้งาน Authentication & Google Provider
1. ไปที่เมนู **Build** > **Authentication** > **Sign-in method**
2. เปิดใช้งาน Provider:
   - **Google** (เปิดใช้งานและบันทึก Support Email)
   - ไม่ต้องเปิด Email/Password หรือ Anonymous

### ขั้นตอนที่ 4: สร้าง Cloud Firestore & Firebase Storage
1. ไปที่ **Build** > **Firestore Database** > กด Create Database (เลือก Region ใกล้เคียง เช่น `asia-southeast1`)
2. ไปที่ **Build** > **Storage** > กด Get Started เพื่อเปิดใช้งาน Bucket สำหรับจัดเก็บภาพหลักฐาน

### ขั้นตอนที่ 5: Deploy Security Rules & Indexes
ติดตั้ง Firebase CLI และสั่ง Deploy:
```bash
npm install -g firebase-tools
firebase login
firebase use <YOUR_PROJECT_ID>
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### ขั้นตอนที่ 6: กำหนดค่า Environment Variables (.env)
คัดลอกไฟล์ `.env.example` เป็น `.env`:
```bash
cp .env.example .env
```
กำหนดค่าที่ได้รับจาก Firebase Console:
```env
# Client Configuration
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="1:123456789:web:abcdef"

# Server Admin SDK Configuration (ห้ามเปิดเผยฝั่ง Client)
FIREBASE_ADMIN_PROJECT_ID="your-project-id"
FIREBASE_ADMIN_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com"
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Initial Admin Email สำหรับการ Bootstrap ผู้ดูแลคนแรก (ต้องตั้งค่าก่อน Bootstrap และไม่มี fallback ในโค้ด)
INITIAL_ADMIN_EMAIL="อีเมล Google ของคุณ@gmail.com"

# ระบบสมัครสมาชิก (นักเรียนสมัครเอง)
REGISTRATION_ENABLED="true"   # "false" = ปิดรับสมัคร
REGISTRATION_CODE=""          # ใส่ค่าเพื่อบังคับให้ผู้สมัครกรอกรหัสนี้
```

### ขั้นตอนที่ 7: ตั้งค่า Firebase Authorized Domains
1. ไปที่ Firebase Console > **Authentication** > แท็บ **Settings** > **Authorized domains**
2. เพิ่ม Domain ที่ใช้งานจริง:
   - สำหรับทดสอบ: `localhost`
   - สำหรับใช้งานจริง: โดเมนของ Vercel หรือ Cloud Run (เช่น `fitquest.vercel.app`)

### ขั้นตอนที่ 8: Bootstrap ผู้ดูแลระบบคนแรก (Initial Admin)
1. กำหนด `INITIAL_ADMIN_EMAIL` ในไฟล์ `.env` บนเซิร์ฟเวอร์ หรือใน Vercel Environment Variables
2. เปิดหน้าเว็บ Fit Quest เลือกแท็บ **"สำหรับผู้ดูแล (Admin)"**
3. คลิกลิงก์ **"ตั้งค่าผู้ดูแลคนแรก (Initial Admin Bootstrap)"**
4. ลงชื่อเข้าใช้ด้วย Google Account ที่มีอีเมลตรงกับ `INITIAL_ADMIN_EMAIL` ทุกตัวอักษร
5. ระบบตรวจสอบฝั่งเซิร์ฟเวอร์ว่า:
   - Token ถูกต้อง
   - อีเมลตรงกับ `INITIAL_ADMIN_EMAIL`
   - ยังไม่มี Active Admin ในระบบ
6. เมื่อผ่านครบทุกข้อ เซิร์ฟเวอร์จะสร้างเอกสารใน `users/{uid}` เป็นตำแหน่ง `lead_researcher` และกำหนด Custom Claims โดยอัตโนมัติ

### ขั้นตอนที่ 9: การ Deploy บน Vercel (Production Serverless)
โปรเจกต์รองรับ Vercel Serverless โดยอัตโนมัติผ่าน `vercel.json` และ `/api/index.ts`:
1. เชื่อมต่อ Git Repository เข้ากับ [Vercel](https://vercel.com/)
2. ตั้งค่า Environment Variables ใน Vercel Dashboard ให้ครบถ้วน (ทั้ง `VITE_FIREBASE_*`, `FIREBASE_ADMIN_*`, และ `INITIAL_ADMIN_EMAIL`)
3. สั่ง Deploy โดย Vercel จะสร้าง Static Frontend จาก `dist` และรัน API ผ่าน Vercel Serverless Functions โดยไม่ต้องใช้ `app.listen()`

### ขั้นตอนที่ 9: ลงทะเบียนผู้เข้าร่วม (Participant) คนแรก
1. ผู้ดูแลเข้าไปที่แท็บ **"จัดการผู้เข้าร่วม"**
2. กดปุ่ม **"+ เพิ่มผู้เข้าร่วมใหม่"**
3. ระบุ:
   - รหัสผู้เข้าร่วม เช่น `P001`
   - ชื่อ-นามสกุล เช่น `ด.ช. กิตติภพ สุขภาพดี`
   - ห้องเรียน/กลุ่ม เช่น `1/2`
   - ปล่อยช่อง PIN ว่างไว้เพื่อให้ระบบสุ่ม PIN 6 หลักให้อัตโนมัติ
4. ระบบจะแสดงหน้าต่างยืนยันพร้อมปุ่มคัดลอก PIN 6 หลัก เพื่อส่งมอบให้นักเรียนใช้งานจริง

---

## การทดสอบจริงสองอุปกรณ์ (Two-Device Production Test Protocol)

เพื่อพิสูจน์ว่าระบบทำงานจริงแบบ Real-Time และเป็น Single Source of Truth:

1. **อุปกรณ์ A (มือถือ / นักเรียน)**:
   - เข้าสู่ระบบด้วยรหัส `P001` + PIN 6 หลักที่สร้างไว้
   - กดปุ่ม **"+ บันทึกการออกกำลังกายวันนี้"**
   - กรอกกิจกรรม: "วิ่งรอบสนาม 30 นาที ความเหนื่อยปานกลาง" แล้วกด **"ส่งข้อมูลเพื่อตรวจ"**
   - สถานะจะแสดงเป็นสีส้ม **"รอตรวจ (Pending)"**

2. **อุปกรณ์ B (คอมพิวเตอร์ / ผู้ดูแลระบบ)**:
   - เข้าสู่ระบบด้วย Google Account ของ Admin
   - **สังเกตหน้าจอทันที**: บันทึกของ `P001` จะปรากฏขึ้นในตารางแบบเรียลไทม์ **โดยไม่ต้องกดรีเฟรชหน้าเว็บ!**
   - ผู้ดูแลกดปุ่ม **"ตรวจบันทึก"** และเลือก **"อนุมัติ (Approved)"** พร้อมพิมพ์ข้อคิดเห็น

3. **กลับมาดูที่อุปกรณ์ A (นักเรียน)**:
   - บันทึกการออกกำลังกายจะเปลี่ยนเป็นสีเขียว **"ผ่านการตรวจแล้ว (Approved)"** ทันทีต่อหน้าผู้ใช้งาน

4. **การทดสอบ Multi-Device Conflict**:
   - หากนักเรียนเปิดบันทึกฉบับร่างใน 2 เครื่อง และเครื่องหนึ่งบันทึกข้อมูลไปแล้ว อีกเครื่องหนึ่งที่กำลังแก้ไขเวอร์ชันเก่าอยู่เมื่อกดบันทึก ระบบจะแจ้งเตือน:
   - *"ข้อมูลนี้มีการเปลี่ยนแปลงจากอีกอุปกรณ์ กรุณาตรวจสอบข้อมูลล่าสุดก่อนบันทึก"*

---

## การสำรองและกู้คืนข้อมูล (Backup & Restore)
1. **Firestore Managed Export**:
   ```bash
   gcloud firestore export gs://[YOUR_BACKUP_BUCKET]/fitquest-backups/$(date +%Y%m%d)
   ```
2. **Firestore Restore**:
   ```bash
   gcloud firestore import gs://[YOUR_BACKUP_BUCKET]/fitquest-backups/[BACKUP_TIMESTAMP]
   ```
3. **Audit Trail**: ทุกการเปลี่ยนแปลงที่สำคัญจะถูกเก็บใน `auditLogs` อย่างถาวร และไม่สามารถลบผ่าน Client ได้

---

## สรุปการตรวจสอบระบบ (Production Audit Checklist)
- [x] ไม่มี Hardcoded Password หรือ Default PIN
- [x] ไม่มี Mock Data หรือ Seed Account ปะปนในโค้ด
- [x] ไม่มีระบบเกม (XP, Badges, Level, Streak, Ranking, Leaderboard)
- [x] Firestore เป็น Single Source of Truth
- [x] PIN ถูกเข้ารหัส bcrypt บน Server และไม่ส่ง Hash กลับมาที่ Client
- [x] มี Failed Login Lockout ป้องกันการเดารหัส PIN
- [x] มี Real-time Sync ด้วย `onSnapshot` ทุกอุปกรณ์
- [x] มีการป้องกัน Multi-Device Data Overwrite ด้วย Conflict Detection
- [x] Admin Login ตรวจสอบสิทธิ์สองชั้น (Google Auth + Firestore Role)
- [x] Firestore Security Rules และ Storage Rules ตั้งค่า Deny-by-Default
- [x] Audit Logs ทำงานและเก็บบันทึกประวัติการบริหารจัดการ

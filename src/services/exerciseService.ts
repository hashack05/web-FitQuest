import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  serverTimestamp, 
  limit, 
  runTransaction,
  setDoc,
  getCountFromServer,
  Timestamp 
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase/client.ts';
import { ExerciseRecordDoc, RecordCommentDoc, ExerciseFilter, ExerciseStatus } from '../types/index.ts';

// In-flight submission guard for current tab
const inFlightOperations = new Set<string>();

/**
 * Realtime subscription to student's own exercise records
 */
export function subscribeStudentRecords(
  participantUid: string,
  onUpdate: (records: ExerciseRecordDoc[]) => void,
  onError: (err: Error) => void
) {
  const colPath = 'exerciseRecords';
  const q = query(
    collection(db, colPath),
    where('participantUid', '==', participantUid),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const records: ExerciseRecordDoc[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        records.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString(),
          submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate().toISOString() : data.submittedAt,
          reviewedAt: data.reviewedAt?.toDate ? data.reviewedAt.toDate().toISOString() : data.reviewedAt,
        } as ExerciseRecordDoc);
      });
      onUpdate(records);
    },
    (error) => {
      onError(error);
      handleFirestoreError(error, OperationType.GET, colPath);
    }
  );
}

/**
 * Realtime subscription to paginated records for Admin review (Display purposes)
 */
export function subscribeAdminRecordsPaginated(
  filter: ExerciseFilter,
  pageLimit: number = 50,
  onUpdate: (records: ExerciseRecordDoc[]) => void,
  onError: (err: Error) => void
) {
  const colPath = 'exerciseRecords';
  let constraints: any[] = [];

  if (filter.status && filter.status !== 'all') {
    constraints.push(where('status', '==', filter.status));
  }
  if (filter.classroomId && filter.classroomId !== 'all') {
    constraints.push(where('classroomId', '==', filter.classroomId));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(pageLimit));

  const q = query(collection(db, colPath), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const records: ExerciseRecordDoc[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        records.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString(),
          submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate().toISOString() : data.submittedAt,
          reviewedAt: data.reviewedAt?.toDate ? data.reviewedAt.toDate().toISOString() : data.reviewedAt,
        } as ExerciseRecordDoc);
      });
      onUpdate(records);
    },
    (error) => {
      onError(error);
      handleFirestoreError(error, OperationType.GET, colPath);
    }
  );
}

/**
 * Fetch total aggregate statistics using getCountFromServer() (Issue 8: Uncapped true totals)
 */
export async function fetchAggregateDashboardStats(): Promise<{
  totalRecords: number;
  pending: number;
  approved: number;
  revision: number;
  rejected: number;
  totalParticipants: number;
}> {
  const recordsCol = collection(db, 'exerciseRecords');
  const participantsCol = collection(db, 'participants');

  try {
    const [
      totalSnap,
      pendingSnap,
      approvedSnap,
      revisionSnap,
      rejectedSnap,
      participantsSnap,
    ] = await Promise.all([
      getCountFromServer(recordsCol),
      getCountFromServer(query(recordsCol, where('status', '==', 'pending'))),
      getCountFromServer(query(recordsCol, where('status', '==', 'approved'))),
      getCountFromServer(query(recordsCol, where('status', '==', 'needs_revision'))),
      getCountFromServer(query(recordsCol, where('status', '==', 'rejected'))),
      getCountFromServer(participantsCol),
    ]);

    return {
      totalRecords: totalSnap.data().count,
      pending: pendingSnap.data().count,
      approved: approvedSnap.data().count,
      revision: revisionSnap.data().count,
      rejected: rejectedSnap.data().count,
      totalParticipants: participantsSnap.data().count,
    };
  } catch (err) {
    console.warn('Error fetching aggregate counts via server:', err);
    return {
      totalRecords: 0,
      pending: 0,
      approved: 0,
      revision: 0,
      rejected: 0,
      totalParticipants: 0,
    };
  }
}

/**
 * Realtime subscription to comments on a specific record
 */
export function subscribeRecordComments(
  recordId: string,
  onUpdate: (comments: RecordCommentDoc[]) => void,
  onError: (err: Error) => void
) {
  const colPath = 'recordComments';
  const q = query(
    collection(db, colPath),
    where('recordId', '==', recordId),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const comments: RecordCommentDoc[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        comments.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
        } as RecordCommentDoc);
      });
      onUpdate(comments);
    },
    (error) => {
      onError(error);
      handleFirestoreError(error, OperationType.GET, colPath);
    }
  );
}

/**
 * Create new exercise record with transaction-backed duplicate prevention (Issue 7)
 */
export async function createExerciseRecord(record: {
  participantUid: string;
  participantId: string;
  classroomId: string;
  activityType: string;
  activityName: string;
  exerciseDate: string;
  durationMinutes: number;
  intensity: 'light' | 'moderate' | 'vigorous';
  notes?: string;
  evidenceImages?: string[];
  status: 'draft' | 'pending';
  submissionId?: string; // Idempotency key from client form instance
}): Promise<string> {
  const opKey = `create-${record.participantUid}-${record.exerciseDate}-${record.activityName}`;
  if (inFlightOperations.has(opKey)) {
    throw new Error('ระบบกำลังดำเนินการบันทึกข้อมูล กรุณาอย่ากดส่งซ้ำ');
  }

  inFlightOperations.add(opKey);
  const colPath = 'exerciseRecords';

  try {
    // ไม่ใช้ transaction.get() เพราะ rules บล็อกการอ่านเอกสารที่ยังไม่มีอยู่ (resource == null)
    // ใช้ submissionId เป็น doc ID เพื่อกันบันทึกซ้ำ (กดซ้ำ = เขียน ID เดิม)
    const targetDocRef = record.submissionId
      ? doc(db, colPath, record.submissionId)
      : doc(collection(db, colPath));

    await setDoc(targetDocRef, {
      participantUid: record.participantUid,
      participantId: record.participantId,
      classroomId: record.classroomId,
      activityType: record.activityType,
      activityName: record.activityName,
      exerciseDate: record.exerciseDate,
      durationMinutes: record.durationMinutes,
      intensity: record.intensity,
      notes: record.notes || '',
      evidenceImages: record.evidenceImages || [],
      status: record.status,
      submittedAt: record.status === 'pending' ? serverTimestamp() : null,
      reviewedAt: null,
      reviewedByUid: null,
      reviewNotes: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdByUid: record.participantUid,
    });

    const resultDocId = targetDocRef.id;
    return resultDocId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, colPath);
  } finally {
    inFlightOperations.delete(opKey);
  }
}

/**
 * Update exercise record with ATOMIC Firestore runTransaction (Issue 6)
 */
export async function updateExerciseRecord(
  recordId: string,
  updates: Partial<ExerciseRecordDoc>,
  expectedLastUpdated: string
): Promise<void> {
  const path = `exerciseRecords/${recordId}`;
  try {
    await runTransaction(db, async (transaction) => {
      const recordRef = doc(db, 'exerciseRecords', recordId);
      const sfDoc = await transaction.get(recordRef);

      if (!sfDoc.exists()) {
        throw new Error('ไม่พบข้อมูลบันทึกการออกกำลังกายนี้');
      }

      const currentData = sfDoc.data();
      const currentUpdatedAt = currentData.updatedAt?.toDate
        ? currentData.updatedAt.toDate().toISOString()
        : currentData.updatedAt;

      // Atomic conflict check: abort if another device updated the record
      if (expectedLastUpdated && currentUpdatedAt && currentUpdatedAt !== expectedLastUpdated) {
        throw new Error('ข้อมูลนี้มีการเปลี่ยนแปลงจากอีกอุปกรณ์ กรุณาตรวจสอบข้อมูลล่าสุดก่อนบันทึก');
      }

      const updatePayload: Record<string, any> = {
        ...updates,
        updatedAt: serverTimestamp(),
      };

      if (updates.status === 'pending') {
        updatePayload.submittedAt = serverTimestamp();
      }

      transaction.update(recordRef, updatePayload);
    });
  } catch (error: any) {
    if (error.message && error.message.includes('มีการเปลี่ยนแปลงจากอีกอุปกรณ์')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Admin review mutation
 */
export async function reviewExerciseRecord(
  recordId: string,
  reviewerUid: string,
  status: 'approved' | 'needs_revision' | 'rejected',
  reviewNotes: string
): Promise<void> {
  const path = `exerciseRecords/${recordId}`;
  try {
    await updateDoc(doc(db, 'exerciseRecords', recordId), {
      status,
      reviewNotes: reviewNotes || '',
      reviewedAt: serverTimestamp(),
      reviewedByUid: reviewerUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Add comment / feedback on a record
 */
export async function addRecordComment(comment: {
  recordId: string;
  participantUid: string;
  authorUid: string;
  authorName: string;
  authorRole: 'admin' | 'student';
  message: string;
}): Promise<string> {
  const colPath = 'recordComments';
  try {
    const docRef = await addDoc(collection(db, colPath), {
      ...comment,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, colPath);
  }
}

/**
 * Evidence image upload with Storage path storage (Issue 2)
 */
export const MAX_EVIDENCE_IMAGES = 2;
const MAX_EVIDENCE_INPUT_BYTES = 15 * 1024 * 1024; // ไฟล์ต้นฉบับ (ถูกย่อก่อนบันทึก)
const MAX_EVIDENCE_DATAURL_CHARS = 250 * 1024; // ขนาดหลังย่อ ~250KB (Firestore จำกัด 1MB/เอกสาร)

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้')); };
    img.src = url;
  });
}

/**
 * ย่อรูปในเบราว์เซอร์แล้วคืนค่าเป็น data URL (JPEG) เพื่อเก็บใน Firestore โดยไม่ใช้ Cloud Storage
 * (ชื่อฟังก์ชัน/พารามิเตอร์คงเดิมเพื่อไม่ให้ต้องแก้ส่วนอื่น)
 */
export async function uploadEvidenceImage(
  _participantUid: string,
  _recordId: string,
  file: File
): Promise<string> {
  if (file.size > MAX_EVIDENCE_INPUT_BYTES) {
    throw new Error('ขนาดไฟล์ต้องไม่เกิน 15MB');
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    throw new Error('รองรับเฉพาะไฟล์รูปภาพ (JPEG, PNG, WebP) เท่านั้น');
  }

  const img = await loadImage(file);
  let maxSide = 1280;
  let quality = 0.8;

  for (let attempt = 0; attempt < 12; attempt++) {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการย่อรูปภาพ');
    ctx.fillStyle = '#ffffff'; // กันพื้นหลังโปร่งใสกลายเป็นสีดำ
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_EVIDENCE_DATAURL_CHARS) return dataUrl;

    if (quality > 0.5) quality -= 0.1;
    else maxSide = Math.round(maxSide * 0.8);
  }

  throw new Error('ไม่สามารถย่อรูปให้เล็กพอได้ กรุณาเลือกรูปอื่น');
}

/** เปิดรูปในแท็บใหม่ (เบราว์เซอร์บล็อก data: URL ที่เปิดตรง ๆ จึงแปลงเป็น blob ก่อน) */
export async function openEvidenceImage(url: string): Promise<void> {
  if (!url) return;
  if (!url.startsWith('data:')) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const blob = await (await fetch(url)).blob();
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

/**
 * Resolve evidence image URL on demand (supports backward compatibility with URLs and paths)
 */
export async function resolveEvidenceUrl(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  try {
    const storageRef = ref(storage, pathOrUrl);
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.warn('Could not resolve evidence storage path:', pathOrUrl);
    return '';
  }
}

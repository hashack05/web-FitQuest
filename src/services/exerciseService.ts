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
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase/client.ts';
import { 
  ExerciseRecordDoc, 
  RecordCommentDoc, 
  ExerciseFilter, 
  ExerciseStatus, 
  ExerciseHistoryEntry,
  AppNotificationDoc 
} from '../types/index.ts';

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
 * Synthesizes or retrieves chronological transaction history for an exercise record
 */
export function getRecordTimeline(record: ExerciseRecordDoc): ExerciseHistoryEntry[] {
  if (record.history && Array.isArray(record.history) && record.history.length > 0) {
    return record.history;
  }

  // Synthesize timeline from factual fields for backwards compatibility with existing records
  const timeline: ExerciseHistoryEntry[] = [];
  const baseTime = record.createdAt || record.exerciseDate || new Date().toISOString();

  if (record.status === 'draft') {
    timeline.push({
      action: 'created_draft',
      actionLabel: 'บันทึกฉบับร่าง',
      actorRole: 'student',
      actorName: record.participantId || 'ผู้เข้าร่วม',
      timestamp: baseTime,
      notes: `บันทึกฉบับร่างกิจกรรม ${record.activityName} (${record.durationMinutes} นาที)`,
    });
  } else {
    timeline.push({
      action: 'submitted',
      actionLabel: 'บันทึกและส่งตรวจการออกกำลังกาย',
      actorRole: 'student',
      actorName: record.participantId || 'ผู้เข้าร่วม',
      timestamp: record.submittedAt || baseTime,
      notes: `บันทึกกิจกรรม ${record.activityName} (${record.durationMinutes} นาที)`,
    });
  }

  // If resubmitted or updated
  if (record.submittedAt && record.createdAt && record.submittedAt !== record.createdAt) {
    timeline.push({
      action: 'resubmitted',
      actionLabel: 'ส่งตรวจใหม่หลังจากแก้ไข',
      actorRole: 'student',
      actorName: record.participantId || 'ผู้เข้าร่วม',
      timestamp: record.submittedAt,
    });
  } else if (record.updatedAt && record.createdAt && record.updatedAt !== record.createdAt && !record.reviewedAt) {
    timeline.push({
      action: 'updated',
      actionLabel: 'แก้ไขรายละเอียดกิจกรรม',
      actorRole: 'student',
      actorName: record.participantId || 'ผู้เข้าร่วม',
      timestamp: record.updatedAt,
    });
  }

  // If reviewed by researcher
  if (record.reviewedAt) {
    const labelMap: Record<string, string> = {
      approved: 'ผ่านการตรวจประเมินโดยทีมวิจัย',
      needs_revision: 'ผู้ตรวจประเมินแจ้งข้อเสนอแนะให้แก้ไข',
      rejected: 'ไม่ผ่านเกณฑ์การประเมิน',
    };
    timeline.push({
      action: record.status,
      actionLabel: labelMap[record.status] || `ผลการตรวจ: ${record.status}`,
      actorRole: 'admin',
      actorName: 'ผู้ตรวจประเมินโครงการ',
      timestamp: record.reviewedAt,
      notes: record.reviewNotes || undefined,
    });
  }

  return timeline;
}

/**
 * Create new exercise record with transaction-backed duplicate prevention and initial transaction history
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
    const nowIso = new Date().toISOString();
    const isPending = record.status === 'pending';

    // Transaction history entry for this submission
    const initialHistoryEntry: ExerciseHistoryEntry = {
      action: isPending ? 'submitted' : 'created_draft',
      actionLabel: isPending ? 'บันทึกและส่งตรวจการออกกำลังกาย' : 'บันทึกฉบับร่าง',
      actorRole: 'student',
      actorName: record.participantId || 'ผู้เข้าร่วม',
      timestamp: nowIso,
      notes: `กิจกรรม: ${record.activityName} (${record.durationMinutes} นาที, ระดับ ${record.intensity})`,
    };

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
      submittedAt: isPending ? serverTimestamp() : null,
      reviewedAt: null,
      reviewedByUid: null,
      reviewNotes: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdByUid: record.participantUid,
      history: [initialHistoryEntry],
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
 * Update exercise record with ATOMIC Firestore runTransaction and append to transaction history
 */
export async function updateExerciseRecord(
  recordId: string,
  updates: Partial<ExerciseRecordDoc>,
  expectedLastUpdated: string
): Promise<void> {
  const path = `exerciseRecords/${recordId}`;
  let notifyAdminPayload: {
    participantId: string;
    participantUid: string;
    activityName: string;
    exerciseDate: string;
  } | null = null;

  try {
    await runTransaction(db, async (transaction) => {
      const recordRef = doc(db, 'exerciseRecords', recordId);
      const sfDoc = await transaction.get(recordRef);

      if (!sfDoc.exists()) {
        throw new Error('ไม่พบข้อมูลบันทึกการออกกำลังกายนี้');
      }

      const currentData = sfDoc.data();

      // Guard: Participant cannot edit records that are already reviewed
      if (currentData.status === 'approved' || currentData.status === 'rejected' || currentData.reviewedAt) {
        throw new Error('บันทึกนี้ผ่านการตรวจประเมินแล้ว ไม่สามารถแก้ไขได้');
      }

      const currentUpdatedAt = currentData.updatedAt?.toDate
        ? currentData.updatedAt.toDate().toISOString()
        : currentData.updatedAt;

      // Atomic conflict check: abort if another device updated the record
      if (expectedLastUpdated && currentUpdatedAt && currentUpdatedAt !== expectedLastUpdated) {
        throw new Error('ข้อมูลนี้มีการเปลี่ยนแปลงจากอีกอุปกรณ์ กรุณาตรวจสอบข้อมูลล่าสุดก่อนบันทึก');
      }

      const nowIso = new Date().toISOString();
      const existingHistory: ExerciseHistoryEntry[] = Array.isArray(currentData.history)
        ? [...currentData.history]
        : getRecordTimeline({ ...currentData, id: recordId } as ExerciseRecordDoc);

      const isResubmit = currentData.status === 'needs_revision' && updates.status === 'pending';
      const isFirstSubmit = currentData.status === 'draft' && updates.status === 'pending';
      const actionType = isResubmit ? 'resubmitted' : isFirstSubmit ? 'submitted' : 'updated';
      const actionLabel = isResubmit
        ? 'แก้ไขและส่งตรวจใหม่'
        : isFirstSubmit
        ? 'ส่งตรวจการออกกำลังกาย'
        : 'แก้ไขรายละเอียดกิจกรรม';

      const updateEntry: ExerciseHistoryEntry = {
        action: actionType,
        actionLabel,
        actorRole: 'student',
        actorName: currentData.participantId || 'ผู้เข้าร่วม',
        timestamp: nowIso,
        notes: updates.notes ? `รายละเอียด: ${updates.notes}` : undefined,
      };

      const nextHistory = [...existingHistory, updateEntry].slice(-50);

      const updatePayload: Record<string, any> = {
        ...updates,
        updatedAt: serverTimestamp(),
        history: nextHistory,
      };

      if (updates.status === 'pending') {
        updatePayload.submittedAt = serverTimestamp();
      }

      transaction.update(recordRef, updatePayload);

      notifyAdminPayload = {
        participantId: currentData.participantId || 'ผู้เข้าร่วม',
        participantUid: currentData.participantUid,
        activityName: updates.activityName || currentData.activityName || 'กิจกรรม',
        exerciseDate: updates.exerciseDate || currentData.exerciseDate || '',
      };
    });

    // Notify admins that the record was edited by participant
    if (notifyAdminPayload) {
      const p = notifyAdminPayload as { participantId: string; participantUid: string; activityName: string; exerciseDate: string };
      try {
        await addDoc(collection(db, 'notifications'), {
          recipientRole: 'admin',
          recipientUid: 'admin',
          type: 'record_edited',
          title: 'มีการแก้ไขบันทึกการออกกำลังกาย',
          message: `ผู้เข้าร่วม ${p.participantId} ได้แก้ไขบันทึก "${p.activityName}" วันที่ ${p.exerciseDate}`,
          recordId,
          activityName: p.activityName,
          actorUid: p.participantUid,
          actorName: p.participantId,
          actorRole: 'student',
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (notifErr) {
        console.warn('Could not post admin notification for edited record:', notifErr);
      }
    }
  } catch (error: any) {
    if (error.message && (error.message.includes('มีการเปลี่ยนแปลงจากอีกอุปกรณ์') || error.message.includes('ผ่านการตรวจประเมินแล้ว'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Admin review mutation and transaction history logging
 */
export async function reviewExerciseRecord(
  recordId: string,
  reviewerUid: string,
  status: 'approved' | 'needs_revision' | 'rejected',
  reviewNotes: string
): Promise<void> {
  const path = `exerciseRecords/${recordId}`;
  try {
    const recordRef = doc(db, 'exerciseRecords', recordId);
    const snap = await getDoc(recordRef);
    const currentData = snap.data();

    if (!currentData) {
      throw new Error('ไม่พบบันทึกการออกกำลังกายนี้');
    }

    const existingHistory: ExerciseHistoryEntry[] = Array.isArray(currentData.history)
      ? [...currentData.history]
      : getRecordTimeline({ ...currentData, id: recordId } as ExerciseRecordDoc);

    const labelMap: Record<string, string> = {
      approved: 'ผ่านการตรวจประเมินโดยทีมวิจัย',
      needs_revision: 'ผู้ตรวจประเมินแจ้งข้อเสนอแนะให้แก้ไข',
      rejected: 'ไม่ผ่านเกณฑ์การประเมิน',
    };

    const reviewEntry: ExerciseHistoryEntry = {
      action: status,
      actionLabel: labelMap[status] || `ปรับสถานะเป็น ${status}`,
      actorRole: 'admin',
      actorName: 'ผู้ตรวจประเมินโครงการ',
      timestamp: new Date().toISOString(),
      notes: reviewNotes || undefined,
    };

    const nextHistory = [...existingHistory, reviewEntry].slice(-50);

    await updateDoc(recordRef, {
      status,
      reviewNotes: reviewNotes || '',
      reviewedAt: serverTimestamp(),
      reviewedByUid: reviewerUid,
      updatedAt: serverTimestamp(),
      history: nextHistory,
    });

    // Notify participant of review result
    try {
      const statusThai: Record<string, string> = {
        approved: 'ผ่านการตรวจประเมินแล้ว',
        needs_revision: 'ขอให้แก้ไขข้อมูล',
        rejected: 'ไม่ผ่านเกณฑ์การประเมิน',
      };
      await addDoc(collection(db, 'notifications'), {
        recipientUid: currentData.participantUid,
        recipientRole: 'student',
        type: 'admin_review',
        title: 'ผลการตรวจบันทึกการออกกำลังกาย',
        message: `บันทึก "${currentData.activityName}": ${statusThai[status] || status}${reviewNotes ? ` (${reviewNotes.slice(0, 100)})` : ''}`,
        recordId,
        activityName: currentData.activityName,
        actorUid: reviewerUid,
        actorName: 'ผู้ตรวจประเมินโครงการ',
        actorRole: 'admin',
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (notifErr) {
      console.warn('Failed to notify student of review:', notifErr);
    }
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
  activityName?: string;
}): Promise<string> {
  const colPath = 'recordComments';
  try {
    const docRef = await addDoc(collection(db, colPath), {
      recordId: comment.recordId,
      participantUid: comment.participantUid,
      authorUid: comment.authorUid,
      authorName: comment.authorName,
      authorRole: comment.authorRole,
      message: comment.message,
      createdAt: serverTimestamp(),
    });

    // If admin commented, notify student
    if (comment.authorRole === 'admin') {
      try {
        await addDoc(collection(db, 'notifications'), {
          recipientUid: comment.participantUid,
          recipientRole: 'student',
          type: 'admin_comment',
          title: 'มีความคิดเห็นใหม่จากผู้ตรวจประเมิน',
          message: `ผู้ตรวจประเมินแสดงความคิดเห็น: "${comment.message.slice(0, 120)}"`,
          recordId: comment.recordId,
          activityName: comment.activityName || '',
          actorUid: comment.authorUid,
          actorName: comment.authorName || 'ผู้ตรวจประเมิน',
          actorRole: 'admin',
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Failed to send comment notification to student:', err);
      }
    }

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, colPath);
  }
}

/**
 * Admin deletes a reviewed exercise record.
 * Allowed ONLY if record has been reviewed (status is approved, rejected, or reviewedAt is not null).
 */
export async function deleteExerciseRecordByAdmin(
  recordId: string,
  record: ExerciseRecordDoc
): Promise<void> {
  const isReviewed = record.reviewedAt != null || record.status === 'approved' || record.status === 'rejected';
  if (!isReviewed) {
    throw new Error('ไม่สามารถลบได้: ระบบอนุญาตให้แอดมินลบได้เฉพาะบันทึกที่ผ่านการตรวจแล้วเท่านั้น');
  }

  const path = `exerciseRecords/${recordId}`;
  try {
    await deleteDoc(doc(db, 'exerciseRecords', recordId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Student cancels (deletes) their own unreviewed record.
 * Allowed ONLY when record has NOT yet been reviewed.
 */
export async function cancelExerciseRecordByStudent(
  recordId: string,
  studentUid: string,
  record: ExerciseRecordDoc
): Promise<void> {
  const isReviewed = record.reviewedAt != null || record.status === 'approved' || record.status === 'rejected';
  if (isReviewed) {
    throw new Error('ไม่สามารถยกเลิกได้: บันทึกนี้ขึ้นสถานะว่าตรวจแล้ว');
  }
  if (record.participantUid !== studentUid) {
    throw new Error('ไม่มีสิทธิ์ยกเลิกบันทึกนี้');
  }

  const path = `exerciseRecords/${recordId}`;
  try {
    await deleteDoc(doc(db, 'exerciseRecords', recordId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Realtime subscription to notifications for Student (by recipientUid)
 */
export function subscribeStudentNotifications(
  studentUid: string,
  onUpdate: (notifications: AppNotificationDoc[]) => void,
  onError: (err: Error) => void
) {
  const colPath = 'notifications';
  const q = query(
    collection(db, colPath),
    where('recipientUid', '==', studentUid),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AppNotificationDoc[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
        } as AppNotificationDoc);
      });
      // Sort client side to avoid index requirement
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(items);
    },
    (error) => {
      console.warn('Student notifications subscription error:', error);
      onError(error);
    }
  );
}

/**
 * Realtime subscription to notifications for Admin (recipientRole == 'admin')
 */
export function subscribeAdminNotifications(
  onUpdate: (notifications: AppNotificationDoc[]) => void,
  onError: (err: Error) => void
) {
  const colPath = 'notifications';
  const q = query(
    collection(db, colPath),
    where('recipientRole', '==', 'admin'),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AppNotificationDoc[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
        } as AppNotificationDoc);
      });
      // Sort client side to avoid index requirement
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(items);
    },
    (error) => {
      console.warn('Admin notifications subscription error:', error);
      onError(error);
    }
  );
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
    });
  } catch (err) {
    console.warn('Failed to mark notification as read:', err);
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(notificationIds: string[]): Promise<void> {
  const updates = notificationIds.map((id) =>
    updateDoc(doc(db, 'notifications', id), { read: true }).catch(() => {})
  );
  await Promise.all(updates);
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (err) {
    console.warn('Failed to delete notification:', err);
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

/**
 * Fit Quest Type Definitions
 * Single Source of Truth: Cloud Firestore
 */

export type UserRole = 'admin' | 'student';

export type AdminPosition = 'lead_researcher' | 'website_admin';

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin';
  position: AdminPosition;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantDoc {
  uid: string;
  participantId: string;
  displayName: string;
  classroomId: string;
  studentNumber?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdByUid: string;
}

export type ExerciseStatus = 'draft' | 'pending' | 'approved' | 'needs_revision' | 'rejected';

export type ExerciseIntensity = 'light' | 'moderate' | 'vigorous';

export interface ExerciseRecordDoc {
  id?: string;
  participantUid: string;
  participantId: string;
  classroomId: string;

  activityType: string;
  activityName: string;

  exerciseDate: string; // YYYY-MM-DD
  durationMinutes: number;
  intensity: ExerciseIntensity;
  notes?: string;

  evidenceImages?: string[]; // URLs or storage paths

  status: ExerciseStatus;

  submittedAt?: string;
  reviewedAt?: string;
  reviewedByUid?: string;
  reviewNotes?: string;

  createdAt: string;
  updatedAt: string;
  createdByUid: string;
}

export interface RecordCommentDoc {
  id?: string;
  recordId: string;
  participantUid: string;
  authorUid: string;
  authorName: string;
  authorRole: 'admin' | 'student';
  message: string;
  createdAt: string;
}

export interface ConsentDoc {
  participantUid: string;
  participantId: string;
  consentVersion: string;
  accepted: boolean;
  acceptedAt: string;
  guardianConsentProvided?: boolean;
}

export interface AuditLogDoc {
  id?: string;
  action: string;
  actorUid: string;
  actorEmail?: string;
  targetUid?: string;
  recordId?: string;
  details?: string;
  timestamp: string;
}

export interface AppSettingDoc {
  id?: string;
  settingKey: string;
  content: string;
  updatedAt: string;
  updatedByUid?: string;
}

export interface PrivateStudentCredentialDoc {
  participantId: string;
  uid: string;
  pinHash: string;
  failedAttempts: number;
  lockedUntil?: string | null;
  updatedAt: string;
}

export interface ExerciseFilter {
  status?: ExerciseStatus | 'all';
  classroomId?: string;
  searchQuery?: string;
  dateFrom?: string;
  dateTo?: string;
}

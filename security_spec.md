# Security Specification: Fit Quest (Zero-Trust ABAC)

## 1. Data Invariants
1. **Deny By Default**: All paths default to no access.
2. **Private Credentials Invariant**: `privateStudentCredentials` MUST NEVER be readable or writable by any client token.
3. **Student Isolation**: A student (`participantUid`) can ONLY read and create exercise records where `participantUid == request.auth.uid`. A student cannot read other students' records or consents.
4. **No Self-Approval**: A student CANNOT set `status = "approved"` or modify `reviewedByUid` / `reviewedAt`.
5. **No Role Escalation**: Clients cannot write or escalate their role to `admin` in `users/{uid}`.
6. **Immutable Fields**: `createdAt`, `participantUid`, and `createdByUid` cannot be tampered with on update.
7. **Strict Admin Verification**: Admin checks require checking `users/{request.auth.uid}.role == 'admin'` and `users/{request.auth.uid}.active == true`.
8. **Audit Trail Integrity**: Students cannot read or write `auditLogs`.

## 2. The Dirty Dozen Payloads (Designed to Fail)
1. **Self-Escalation**: Normal user attempts to write `{ role: "admin", active: true }` to `/users/{uid}`.
2. **Credential Exfiltration**: Client attempts to read `/privateStudentCredentials/{uid}`.
3. **Ghost Record Injection**: Student A attempts to create a record with `participantUid = "studentB"`.
4. **Self-Approval Exploit**: Student attempts to submit record with `status = "approved"`.
5. **Reviewer Impersonation**: Student attempts to populate `reviewedByUid` or `reviewNotes`.
6. **Cross-Tenant List Scraping**: Student A attempts `getDocs` on `/exerciseRecords` without filtering by own UID.
7. **Comment Forgery**: Student attempts to post a comment with `authorRole = "admin"`.
8. **Audit Log Erasure**: Attacker attempts to delete or alter `/auditLogs/{logId}`.
9. **Consent Spoofing**: Student A attempts to sign consent on behalf of Student B (`consents/studentB`).
10. **State Skipping on Approved Records**: Student attempts to edit an already approved record (`status == "approved"`).
11. **Huge Payload / Denial of Wallet**: Attacker sends a 1MB payload to `notes` in `exerciseRecords`.
12. **Tampering with Immutable Timestamps**: Attacker sends client time in `createdAt` instead of server timestamp.

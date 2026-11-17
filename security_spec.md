# Security Specification & Adversarial Verification: SDLR

## 1. System Invariants & Access Control Model

1. **Teacher Isolation & Cohort Guard**:
   - A teacher may only access and manipulate cohorts where they are the assigned teacher or an active school administrator (`role in ['admin', 'super_admin']`).
   - The verified administrator email `sangururschool10@gmail.com` is bootstrapped with root administrative privileges.

2. **Learner Record Isolation**:
   - Learners cannot query arbitrary cohorts, modify other learners' records, or write attendance records for other students.
   - Self-submitted daily registers must strictly originate from the logged-in learner (`learnerDocId == request.auth.uid`), within their enrolled cohort.

3. **Temporal & Idempotent Submission Guard**:
   - Only one register entry allowed per learner per cohort per calendar date (enforced deterministically via document ID `reg_{cohortId}_{learnerId}_{date}`).
   - Learners cannot backdate or postdate attendance or mark themselves 'absent' or 'excused' (only 'present' or 'late').

4. **Curriculum Snapshot Immutability**:
   - Once a curriculum snapshot is bound to a cohort, historical learning logs reference immutable snapshot versions to prevent curriculum rewrite vulnerabilities.

---

## 2. The "Dirty Dozen" Adversarial Payloads

Below are the 12 adversarial test cases designed to test the boundary rules:

1. **Payload 1: Identity Spoofing in Daily Register**
   - Learner `L001` attempts to submit attendance for learner `L002`.
   - *Result*: DENIED (`request.auth.uid != incoming().learnerDocId`).

2. **Payload 2: Role Escalation via Profile Creation**
   - New user signs up and attempts to create a `/teachers/{uid}` document with `role: "admin"`.
   - *Result*: DENIED (Only existing admin or system bootstrap can assign admin status).

3. **Payload 3: Arbitrary Status Hack**
   - Learner attempts to self-certify as `status: "excused"` or `verificationStatus: "verified"`.
   - *Result*: DENIED (Learners can only submit `present` or `late` with `pending_verification`).

4. **Payload 4: Future / Past Date Injection**
   - Malicious client submits attendance with an arbitrary date format or mismatched key.
   - *Result*: DENIED.

5. **Payload 5: Cross-Cohort Unauthorized Access**
   - Learner attempts to read registers or curriculum for a cohort they are not enrolled in.
   - *Result*: DENIED.

6. **Payload 6: Denial-of-Wallet Resource Attack (Payload Overflow)**
   - Attacker attempts to write a 1MB junk string into `reflectionLearned` or `learnerName`.
   - *Result*: DENIED (Max string length boundary validation).

7. **Payload 7: Shadow Field Injection**
   - Attacker writes valid DailyRegister fields plus `{ "bypassVerification": true, "teacherOverride": true }`.
   - *Result*: DENIED (`hasOnly()` keys guard).

8. **Payload 8: Unenrolled Cohort Member Injection**
   - Unenrolled user attempts to inject themselves into `/cohortMembers/` without teacher authorization.
   - *Result*: DENIED.

9. **Payload 9: Tampering with Historical Audit Logs**
   - Attacker attempts to update or delete a document in `/auditLogs/`.
   - *Result*: DENIED (`allow update, delete: if false`).

10. **Payload 10: Teacher Identity Impersonation on Feedback**
    - Student submits `/teacherFeedback/` claiming to be teacher `T001`.
    - *Result*: DENIED (`request.auth.uid != incoming().teacherId`).

11. **Payload 11: Modifying Immutable Timestamp Fields**
    - User tries to change `createdAt` on an existing cohort or curriculum document.
    - *Result*: DENIED (`incoming().createdAt == existing().createdAt`).

12. **Payload 12: Unauthenticated Public Scraping**
    - Unauthenticated request attempts `list` on `/learners` or `/teachers`.
    - *Result*: DENIED (`request.auth != null`).

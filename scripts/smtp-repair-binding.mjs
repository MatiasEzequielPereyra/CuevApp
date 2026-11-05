import {createHash} from 'node:crypto';
// Stable binding excludes the repair hash itself, avoiding a circular digest.
export function smtpRepairBinding(r) {
  return createHash('sha256').update(JSON.stringify({studentId:r.studentId,jobLease:r.jobLease,
    authUserId:r.authUserId,email:r.email,generation:r.generation,attemptId:r.attemptId,
    previousAttemptId:r.previousAttemptId,previousAuthorizationHash:r.previousAuthorizationHash,smtpLoginSha256:r.smtpLoginSha256,
    rejectionEvidenceSha256:r.priorRejection?.evidenceSha256})).digest('hex');
}

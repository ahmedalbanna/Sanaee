# Security Specification for Sanaee (صنايعي)

## 1. Data Invariants
- A **Worker** profile must belong to the authenticated user (`userId == auth.uid`).
- A **JobRequest** must have a `customerId` matching the creator's `auth.uid`.
- **Messages** can only be created within a Job by either the `customerId` or the `workerId` of that Job.
- **Ratings** and **Reviews** are immutable once submitted (except for admin correction).
- **Phone numbers** should only be visible after a worker is "assigned" or in transit (for the demo, we'll implement visibility logic).

## 2. The "Dirty Dozen" Payloads (Deny Cases)
1. **Identity Theft:** User A tries to update User B's worker profile.
2. **Rate Spying:** An unassigned worker tries to read the customer's phone number from a private subcollection.
3. **Status Hijacking:** A random user tries to mark a job as 'completed'.
4. **Price Manipulation:** A worker tries to update the `dailyRate` of another worker.
5. **Ghost Review:** A user tries to review a job they weren't part of.
6. **Shadow Field Injection:** Adding `isVerified: true` to a Worker profile during creation.
7. **Invalid Craft ID:** Creating a job with a `craftId` that doesn't exist in our constants (regex check).
8. **Resource Poisoning:** Injecting 1MB of text into the `name` field.
9. **Timestamp Spoken:** Providing a client-side `createdAt` timestamp.
10. **Orphaned Message:** Creating a message for a Job ID that doesn't exist.
11. **Double Response:** A worker trying to assign themselves to a job that is already 'assigned'.
12. **Self-Rating:** A worker trying to review themselves.

## 3. Test Runner (Draft)
```ts
// firestore.rules.test.ts will include tests for:
// - Forbidden field updates (userId, createdAt)
// - Unauthorized cross-user writes
// - Missing required fields
// - Invalid path IDs
```

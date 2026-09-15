# Security Specification & Threat Model

## 1. Data Invariants
- Users can ONLY read, create, update, or delete documents within their own subcollections under `/users/{userId}/`.
- All writes must verify that `request.auth != null` and `request.auth.uid == userId`.
- Incoming documents MUST include `userId` matching `request.auth.uid`.
- Document IDs must pass `isValidId()` checks (contain alphanumeric, hyphens, underscores, length <= 128).
- String and array sizes must be strictly bounded to prevent Denial-of-Wallet resource exhaustion.

## 2. Dirty Dozen Security Payloads
1. **Unauthenticated Read/Write**: Attempting to query `/users/otherUser/habits` without auth token. -> PERMISSION_DENIED
2. **Cross-User Data Impersonation**: Attempting to insert a habit into `/users/userA/habits/123` with `userId = "userB"`. -> PERMISSION_DENIED
3. **ID Poisoning**: Attempting to pass a 2KB junk character string as `{habitId}` document path variable. -> PERMISSION_DENIED
4. **Oversized Field Exhaustion**: Attempting to write a 1MB string into habit `name`. -> PERMISSION_DENIED
5. **Shadow Field Injection**: Attempting to append illegal key `isAdmin: true` on user document creation. -> PERMISSION_DENIED
6. **Array Overflow Attack**: Writing an array of 5,000 subtasks into a single habit document. -> PERMISSION_DENIED
7. **Type Spoofing**: Setting `isTask` to `"true"` (string) instead of `true` (boolean). -> PERMISSION_DENIED
8. **Enum Manipulation**: Setting `type` to `"super_admin"` instead of `"simple" | "numeric" | "timer"`. -> PERMISSION_DENIED
9. **Null Pointer Trigger**: Sending malformed empty request payload during `update`. -> PERMISSION_DENIED
10. **Immutable Field Tampering**: Modifying `createdAt` or `userId` after habit creation. -> PERMISSION_DENIED
11. **List Scraping Query**: Attempting a collectionGroup query across all users' habits. -> PERMISSION_DENIED
12. **Spoofed Email Claim**: Attempting write operation using unverified auth token. -> PERMISSION_DENIED

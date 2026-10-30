# Security Specification: Apex Ledger & Inventory

## 1. Data Invariants
1. **Authentication Requirement**: All write operations require an authenticated user (`request.auth != null`).
2. **Immutable Identifier Protection**: Document IDs, `createdBy`, and creation dates cannot be mutated once written.
3. **Data Integrity**: Vouchers must specify a valid transaction type (`SALE`, `PURCHASE`, `PAYMENT`, `RECEIPT`, `CONTRA`, `CREDIT_NOTE`, `DEBIT_NOTE`, `STOCK_TRANSFER`), valid non-negative grandTotal, and conform to string length bounds.
4. **Denial of Wallet Resistance**: String lengths capped (e.g. name <= 120 chars, descriptions <= 500 chars), IDs validated via `isValidId()`.
5. **No Blind Admin Claims**: System administrative checks rely on presence in an authenticated user record or owner ID.

## 2. The Dirty Dozen Payloads
1. **Unauthenticated Write**: Write to `/vouchers/v123` with `request.auth = null`. (Expected: PERMISSION_DENIED)
2. **Spoofed CreatedBy Field**: User `attacker_uid` submits voucher with `createdBy = "admin_uid"`. (Expected: PERMISSION_DENIED)
3. **Ghost / Unbounded Field Injection**: Attempt to write 2MB string in `metadata` on inventory item. (Expected: PERMISSION_DENIED)
4. **Oversized Document ID**: Write with ID length > 128 characters or special forbidden regex symbols. (Expected: PERMISSION_DENIED)
5. **Negative Grand Total on Sales**: Submitting a sale voucher with negative grand total. (Expected: PERMISSION_DENIED)
6. **Immutable Field Mutation**: Updating `vouchers/v123` changing `createdBy` from original creator. (Expected: PERMISSION_DENIED)
7. **Invalid Voucher Type**: Submitting `type: "HACK_BALANCE"`. (Expected: PERMISSION_DENIED)
8. **Invalid Ledger Group**: Submitting `group: "SuperUserAccounts"`. (Expected: PERMISSION_DENIED)
9. **Settings Overwrite by Unauthorized User**: Modifying business configuration without valid auth context. (Expected: PERMISSION_DENIED)
10. **Orphaned Branch Stock Update**: Injecting arbitrary non-object types into `stockByBranch`. (Expected: PERMISSION_DENIED)
11. **Malicious Script in Party Name**: Submitting party name exceeding 120 characters. (Expected: PERMISSION_DENIED)
12. **Blind Collection Delete**: Deleting master company profile without authorization. (Expected: PERMISSION_DENIED)

# Apex Ledger & Inventory — Enterprise GST Accounting & Multi-Branch Distribution Suite

A comprehensive, real-time business management and double-entry accounting platform tailored for wholesale and retail distributors in India. The application integrates daily Day Book operations, multi-ledger financial accounting, GST compliant purchase & sales workflows, multi-branch stock transfers, automated Profit & Loss statements, GSTR reports, and customizable A5/A4 printable tax invoices with Firebase Firestore cloud persistence.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and design decisions are confirmed based on your requirements and clarification inputs:

- **Business Workflow Preset**: Wholesale & retail distribution model with multi-branch/warehouse stock transfers, reorder levels, and low-stock alerts.
- **Tax & Currency Engine**: Native Indian Rupee (`₹` / INR) with dual GST model (Intra-state: CGST + SGST; Inter-state: IGST), item-level HSN/SAC codes, and reverse-charge support.
- **Print & Invoicing Engine**: Fully customizable tax invoice designer with **A5 paper dimensions** as primary default, supporting header customization, company logo, GSTIN, bank QR/UPI code, HSN tax summary table, terms, and authorized signatory.
- **Data Persistence & Synchronization**: Firebase Firestore with real-time listeners (`onSnapshot`), multi-device data sync, and optimistic UI updates for instant responsiveness.

---

## 1. Overview & Core Concept

**Apex Ledger & Inventory** delivers a robust, streamlined desktop & tablet accounting workstation for distributors, traders, and wholesalers. It replaces disparate spreadsheets and complex legacy desktop software with a fast, modern web experience that guarantees:

1. **Daily Day Book**: Chronological recording of every cash, bank, sales, purchase, receipt, payment, journal, credit note, and debit note entry with search, date range filtering, and day-wise balance reconciliation.
2. **Account & Party Ledgers**: Master ledger system for Customers (Sundry Debtors), Suppliers (Sundry Creditors), Bank/Cash accounts, Direct/Indirect Expenses, and Revenue accounts with running balances, opening balances, and exportable statements.
3. **Purchase & Sales Management**: Complete bill generation with dynamic GST tax calculations (0%, 5%, 12%, 18%, 28%), itemized discounts, transport/freight charges, and automatic party ledger posting.
4. **Multi-Branch Stock & Distribution**: Real-time warehouse inventory, stock-in/stock-out logging, branch-to-branch transfer gate passes, and low-stock alerts with reorder triggers.
5. **Payment & Receipt Vouchers**: Cash, Cheque, NEFT/RTGS, and UPI receipting linked directly to invoices or ledger accounts with reference/UTR tracking.
6. **Credit & Debit Notes**: Seamless sales returns, purchase returns, price adjustments, and tax recalculations.
7. **GST Bill & Statutory Reports**: Printable A5/A4 tax invoices conforming to Indian GST requirements, plus auto-generated GSTR-1 (Outward supplies) and GSTR-3B monthly tax computation.
8. **Automated Profit & Loss Statement**: Real-time calculation of Trading Account (Sales, Purchases, Direct Expenses, Closing Stock) and Net Profit/Loss with expense breakdowns.

---

## 2. User Experience & Visual Design

### Key User Flows
- **Daily Operations Flow**:
  - The accountant opens the **Day Book** to review opening cash & bank balances, enters a quick Sale or Payment voucher via keyboard shortcuts (`Alt+S` for Sale, `Alt+P` for Payment, `Alt+R` for Receipt), and sees ledger balances update instantly.
- **Sales & GST Invoicing Flow**:
  - Select customer from searchable ledger $\rightarrow$ auto-fill GSTIN & Billing/Shipping Address $\rightarrow$ select warehouse/branch $\rightarrow$ add line items with auto-computed HSN, taxable value, CGST/SGST or IGST based on place of supply $\rightarrow$ generate invoice $\rightarrow$ click "Print A5 Invoice" for an exact, razor-sharp printable invoice preview.
- **Stock Transfer Flow**:
  - Initiate stock transfer from Main Warehouse to City Retail Branch $\rightarrow$ verify source item stock $\rightarrow$ specify transfer quantity and driver/vehicle notes $\rightarrow$ commit transfer $\rightarrow$ inventory and stock ledger synchronize synchronously across both locations.
- **Financial Audit Flow**:
  - Navigate to **Ledger** $\rightarrow$ select party $\rightarrow$ inspect full debit/credit history $\rightarrow$ switch to **Profit & Loss** for real-time Gross Margin and Net Operating Income.

### Visual Identity & Theme
- **Aesthetic Direction**: Professional, high-density enterprise SaaS workstation. Clean borders, uncluttered layouts, purposeful typographic rhythm, and strict zero-pill discipline.
- **Color Palette**:
  - Dominant Canvas: Clean white `#FFFFFF` / dark slate `#0B0F19` in dark mode.
  - Structural Surfaces: Cool neutral `#F8FAFC` / `#111827`, hairline borders `#E2E8F0` / `#1F2937`.
  - Accent Budget: Deep Navy Blue (`#1E3A8A`) for institutional authority, with Emerald (`#059669`) for positive cashflow/credits, Crimson (`#DC2626`) for debits/outflows, and Amber (`#D97706`) for low-stock warnings.
- **Typography**:
  - Display & Headings: `Plus Jakarta Sans` for clean, modern legibility.
  - Interface & Body: `Plus Jakarta Sans` / `DM Sans`.
  - Financial Figures & Numerals: Monospace `tabular-nums` (`font-mono`) across all financial tables, debit/credit columns, and invoice calculations to align decimal places vertically without layout jitter.
- **Printable A5 Invoicing Layout**:
  - Specific CSS `@media print` rules configured for $148\text{mm} \times 210\text{mm}$ (A5 dimensions) with high-contrast monochrome/dark border styling, clear two-column header (Company details & GSTIN vs Invoice metadata & QR code), compact item table, HSN summary footer, and signature block.

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale | Alternatives Considered |
| :--- | :--- | :--- | :--- |
| **Double-Entry Engine** | Auto-posting transactional ledger engine | Every sales invoice, purchase bill, payment, or credit note automatically generates balanced debit and credit ledger entries, ensuring accounts are always in balance. | Manual journal entry requirement (too slow for retail/wholesale billing). |
| **Tax Computation** | Auto State-of-Supply IGST vs CGST/SGST | Compares business state code with customer GSTIN state code to automatically apply intra-state or inter-state GST rates without manual calculation. | Manual tax type selection (prone to costly compliance mistakes). |
| **Multi-Branch Inventory** | Real-time branch-isolated ledger with transfer vouchers | Each item records on-hand quantity per branch/location, and transfers require verified source inventory before deduction and addition. | Single central warehouse (insufficient for distribution business model). |
| **Persistence Layer** | Firebase Firestore with seamless offline cache & demo fallback | Stores live collections for `vouchers`, `ledgers`, `items`, `branches`, `invoices`, and `settings`, providing real-time multi-terminal sync. | Pure local storage (data lost across devices) or heavy self-hosted SQL (complex hosting setup). |

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Apex Ledger Web Workspace                       │
├────────────────────────────────┬───────────────────────────────────────┤
│ Top Bar: Branch Selector       │ Date Filter · User Auth · Quick Add   │
├────────────────────────────────┴───────────────────────────────────────┤
│                                                                        │
│ ┌──────────────────┐ ┌───────────────────────────────────────────────┐ │
│ │ Navigation       │ │ Active Module View                            │ │
│ │ ├─ Day Book      │ │                                               │ │
│ │ ├─ Party Ledgers │ │  ┌───────────────┐ ┌────────────────────────┐ │ │
│ │ ├─ Invoices (GST)│ │  │ Filter / Search│ │ Action Toolbar         │ │ │
│ │ ├─ Purchases     │ │  └───────────────┘ └────────────────────────┘ │ │
│ │ ├─ Inventory     │ │  ┌──────────────────────────────────────────┐ │ │
│ │ ├─ Distribution  │ │  │ High-Density Tabular Grid (tabular-nums) │ │ │
│ │ ├─ Payments      │ │  │ Auto-balanced Debits / Credits / GST     │ │ │
│ │ ├─ Credit/Debit  │ │  └──────────────────────────────────────────┘ │ │
│ │ ├─ Profit & Loss │ │  ┌──────────────────────────────────────────┐ │ │
│ │ └─ GSTR Reports  │ │  │ Summary Strip: Total In, Out, Net Balance│ │ │
│ └──────────────────┘ └─────────────────────────────────────────────┘ │ │
└────────────────────────────────────────────────────────────────────────┘
                                 │
           ┌─────────────────────┴───────────────────────┐
           ▼                                             ▼
  ┌─────────────────────────────────┐           ┌────────────────────────┐
  │ Local State & Calculation Store │           │ Firebase Cloud Service │
  │ ├─ Double-Entry Posting Rule    │ ◄───────► │ ├─ Firestore Realtime  │
  │ ├─ Stock Batch Ledger           │           │ ├─ Firebase Auth       │
  │ └─ A5 Print Stylizer            │           │ └─ Multi-device Sync   │
  └─────────────────────────────────┘           └────────────────────────┘
```

### Core Data Models (Entities)

1. **PartyLedger (Account)**:
   - `id`: string
   - `name`: string
   - `group`: `'Sundry Debtors' | 'Sundry Creditors' | 'Bank Accounts' | 'Cash-in-hand' | 'Direct Expenses' | 'Indirect Expenses' | 'Sales Accounts' | 'Purchase Accounts'`
   - `gstin`: string (optional)
   - `stateCode`: string (e.g. `'27'` for Maharashtra, `'07'` for Delhi)
   - `openingBalance`: number (Debit/Credit)
   - `phone`: string, `email`: string, `address`: string
   - `creditLimit`: number

2. **InventoryItem**:
   - `id`: string, `name`: string, `sku`: string, `hsnCode`: string
   - `unit`: `'Pcs' | 'Box' | 'Kg' | 'Mtr' | 'Ltr'`
   - `purchasePrice`: number, `sellingPrice`: number, `gstRate`: number (0, 5, 12, 18, 28)
   - `minStockAlert`: number
   - `stockByBranch`: `{ [branchId: string]: number }`

3. **TransactionVoucher (Day Book / Invoices / Payments)**:
   - `id`: string, `voucherNo`: string
   - `date`: string (ISO)
   - `type`: `'SALE' | 'PURCHASE' | 'PAYMENT' | 'RECEIPT' | 'CONTRA' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'STOCK_TRANSFER'`
   - `partyId`: string, `partyName`: string
   - `sourceBranchId`: string, `destinationBranchId`?: string
   - `items`: `Array<{ itemId: string, name: string, hsn: string, qty: number, unit: string, rate: number, discount: number, gstRate: number, cgst: number, sgst: number, igst: number, total: number }>`
   - `subtotal`: number, `cgstTotal`: number, `sgstTotal`: number, `igstTotal`: number, `grandTotal`: number
   - `paymentMode`: `'CASH' | 'BANK' | 'UPI' | 'CREDIT'`
   - `referenceNo`: string (Cheque / UTR / E-Way Bill)
   - `notes`: string

4. **Branch**:
   - `id`: string, `name`: string, `code`: string, `address`: string, `isHeadOffice`: boolean

5. **CompanySettings**:
   - `name`: string, `gstin`: string, `state`: string, `stateCode`: string, `phone`: string, `email`: string, `address`: string, `bankDetails`: `{ bankName: string, accountNo: string, ifsc: string, branch: string, upiId: string }`, `invoiceTerms`: string

---

## 5. Implementation Sequence & Execution Plan

1. **Firebase Integration & Provisioning**:
   - Call `show_aistudio_ui` with `firebase_setup` and handle the user confirmation flow.
   - Configure `firebase-blueprint.json` defining collections (`ledgers`, `inventory`, `vouchers`, `branches`, `settings`).
   - Setup hardened `firestore.rules` adhering to ABAC and anti-update gap principles, deploy with `DeployRules`.
2. **Core Accounting & Calculation Engines**:
   - Build pure TypeScript calculation utilities for GST splitting, HSN consolidation, automatic ledger balance updates, Day Book filtering, and P&L computation.
3. **Module View Implementations**:
   - **Day Book**: Real-time chronological transaction list, date picker, search by party or voucher type, day-end cash/bank tallies.
   - **Party Ledgers**: Account directory, party statement with running debit/credit balance, opening balance editor, statement export.
   - **Sales & Purchase Entry**: Intuitive multi-item invoice creator with automatic GST calculation, state-of-supply auto detection, stock validation.
   - **Customizable A5/A4 GST Invoicing & Print Engine**: Dedicated print modal with company header, QR code, HSN tax slab breakup, terms, signature block, and print CSS layout.
   - **Stock & Multi-Branch Distribution**: Warehouse-wise inventory table, low stock alerts, stock transfer voucher generator.
   - **Payment & Receipt**: Quick voucher entry modal with cash/bank/UPI reference tracking.
   - **Credit Note & Debit Note**: Return bill generator linked to original invoice.
   - **Profit & Loss and GSTR Reports**: Instant P&L statement (Revenue vs Cost of Goods Sold vs Expenses) and GSTR-1/GSTR-3B tax summaries.
4. **Sample Realistic Starter Data**:
   - Pre-populate realistic wholesale/retail inventory items (with real HSN codes, GST brackets), customer/supplier ledgers, sample branches, and vouchers for instant out-of-the-box utility.
5. **Compilation, Verification & Testing**:
   - Execute `compile_applet` and verify zero TypeScript or build errors.

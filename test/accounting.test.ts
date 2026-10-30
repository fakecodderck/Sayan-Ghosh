import {
  calculateLineItem,
  computeGSTR1Summary,
  computeProfitAndLoss,
  isInterStateTransaction
} from '../src/utils/gstCalculations';
import {
  computeInventoryDeltas,
  computeLedgerDeltas,
  ensureSystemLedgers,
  generateJournalEntries,
  SYSTEM_LEDGER_DEFINITIONS
} from '../src/utils/doubleEntryEngine';
import {
  InventoryItem,
  LedgerAccount,
  TransactionVoucher
} from '../src/types/accounting';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    console.error(`❌ Expected [${expected}] but got [${actual}]: ${message}`);
    throw new Error(`Expected [${expected}] but got [${actual}]: ${message}`);
  }
}

function assertClose(actual: number, expected: number, tolerance = 0.01, message: string) {
  if (Math.abs(actual - expected) > tolerance) {
    console.error(`❌ Expected [${expected}] (+-${tolerance}) but got [${actual}]: ${message}`);
    throw new Error(`Expected [${expected}] (+-${tolerance}) but got [${actual}]: ${message}`);
  }
}

console.log('--- STARTING ACCOUNTING & INVENTORY UNIT TEST SUITE ---\n');

let testsPassed = 0;

// TEST 1: Chart of Accounts & System Ledgers
(() => {
  const customLedgers: LedgerAccount[] = [
    {
      id: 'cust_01',
      name: 'Alpha Traders',
      group: 'Sundry Debtors',
      openingBalance: 1000,
      currentBalance: 1000,
    },
  ];

  const ensured = ensureSystemLedgers(customLedgers);
  assert(ensured.length >= 10, 'All system ledgers must be provisioned');
  assert(ensured.some(l => l.id === 'ledger_cash'), 'Cash-in-hand ledger must exist');
  assert(ensured.some(l => l.id === 'ledger_sys_sales'), 'Sales Account must exist');
  assert(ensured.some(l => l.id === 'ledger_sys_out_cgst'), 'Output CGST must exist');
  testsPassed++;
  console.log('✅ Test 1 Passed: Chart of Accounts and System Ledgers ensured');
})();

// TEST 2: Intra-State vs Inter-State GST & Auto State Code Parsing
(() => {
  // Same state (Maharashtra 27)
  const isInter1 = isInterStateTransaction('27', '27');
  assertEquals(isInter1, false, 'Same state code must be intra-state');

  // Different state (Maharashtra 27 vs Haryana 06)
  const isInter2 = isInterStateTransaction('27', '06');
  assertEquals(isInter2, true, 'Different state code must be inter-state');

  // Auto-parsed from party GSTIN prefix "06AAAAA0000A1Z5"
  const isInter3 = isInterStateTransaction('27', undefined, '06AAAAA0000A1Z5');
  assertEquals(isInter3, true, 'Auto-extract state code from GSTIN must identify inter-state');

  const isInter4 = isInterStateTransaction('27', undefined, '27ABCDE1234F1Z5');
  assertEquals(isInter4, false, 'Auto-extract state code 27 from GSTIN must identify intra-state');

  testsPassed++;
  console.log('✅ Test 2 Passed: GST State code detection & GSTIN prefix parsing verified');
})();

// TEST 3: Line Item Tax Calculations
(() => {
  // 10 units @ ₹100 with 18% GST (Intra-state: 9% CGST + 9% SGST)
  const lineIntra = calculateLineItem(10, 100, 0, 18, false, true);
  assertEquals(lineIntra.taxableAmount, 1000, 'Taxable amount should be 1000');
  assertEquals(lineIntra.cgst, 90, 'CGST should be 90 (9%)');
  assertEquals(lineIntra.sgst, 90, 'SGST should be 90 (9%)');
  assertEquals(lineIntra.igst, 0, 'IGST should be 0');
  assertEquals(lineIntra.total, 1180, 'Total should be 1180');

  // Inter-state: 18% IGST
  const lineInter = calculateLineItem(10, 100, 0, 18, true, true);
  assertEquals(lineInter.taxableAmount, 1000, 'Taxable amount should be 1000');
  assertEquals(lineInter.cgst, 0, 'CGST should be 0');
  assertEquals(lineInter.sgst, 0, 'SGST should be 0');
  assertEquals(lineInter.igst, 180, 'IGST should be 180 (18%)');
  assertEquals(lineInter.total, 1180, 'Total should be 1180');

  // Line item with discount (10% discount on ₹1000 = ₹900 taxable)
  const lineDisc = calculateLineItem(10, 100, 10, 18, false, true);
  assertEquals(lineDisc.taxableAmount, 900, 'Taxable after 10% discount should be 900');
  assertEquals(lineDisc.cgst, 81, 'CGST 9% on 900 should be 81');
  assertEquals(lineDisc.sgst, 81, 'SGST 9% on 900 should be 81');
  assertEquals(lineDisc.total, 1062, 'Total should be 1062');

  testsPassed++;
  console.log('✅ Test 3 Passed: Line item taxes, discounts, and split rates verified');
})();

// TEST 4: Double-Entry Journal Balancing for All Transaction Types
(() => {
  const chart = ensureSystemLedgers([
    { id: 'c_01', name: 'Customer A', group: 'Sundry Debtors', openingBalance: 0, currentBalance: 0 },
    { id: 'v_01', name: 'Vendor B', group: 'Sundry Creditors', openingBalance: 0, currentBalance: 0 },
  ]);

  // 4a. SALE Voucher
  const saleVoucher: TransactionVoucher = {
    id: 'v_sale',
    voucherNo: 'INV/2026/001',
    date: '2026-10-30',
    type: 'SALE',
    partyId: 'c_01',
    partyName: 'Customer A',
    isGstBill: true,
    paymentMode: 'CREDIT',
    subtotal: 10000,
    cgstTotal: 900,
    sgstTotal: 900,
    igstTotal: 0,
    grandTotal: 11800,
    items: [{ itemId: 'item_1', name: 'Cable', hsn: '8544', qty: 10, unit: 'Pcs', rate: 1000, discount: 0, taxableAmount: 10000, gstRate: 18, cgst: 900, sgst: 900, igst: 0, total: 11800 }],
  };

  const saleJournal = generateJournalEntries(saleVoucher, chart);
  const saleDebits = saleJournal.reduce((sum, j) => sum + j.debit, 0);
  const saleCredits = saleJournal.reduce((sum, j) => sum + j.credit, 0);
  assertClose(saleDebits, 11800, 0.01, 'Sale debits must be 11800');
  assertClose(saleCredits, 11800, 0.01, 'Sale credits must be 11800');
  assertEquals(saleDebits, saleCredits, 'Sale Total Debits must strictly equal Total Credits');

  // 4b. PURCHASE Voucher
  const purchaseVoucher: TransactionVoucher = {
    id: 'v_purch',
    voucherNo: 'BILL/2026/001',
    date: '2026-10-30',
    type: 'PURCHASE',
    partyId: 'v_01',
    partyName: 'Vendor B',
    isGstBill: true,
    paymentMode: 'CREDIT',
    subtotal: 5000,
    cgstTotal: 0,
    sgstTotal: 0,
    igstTotal: 900,
    grandTotal: 5900,
    items: [{ itemId: 'item_1', name: 'Cable', hsn: '8544', qty: 5, unit: 'Pcs', rate: 1000, discount: 0, taxableAmount: 5000, gstRate: 18, cgst: 0, sgst: 0, igst: 900, total: 5900 }],
  };

  const purchJournal = generateJournalEntries(purchaseVoucher, chart);
  const purchDebits = purchJournal.reduce((sum, j) => sum + j.debit, 0);
  const purchCredits = purchJournal.reduce((sum, j) => sum + j.credit, 0);
  assertEquals(purchDebits, purchCredits, 'Purchase Total Debits must equal Total Credits');

  // 4c. RECEIPT Voucher (Customer pays cash)
  const recVoucher: TransactionVoucher = {
    id: 'v_rec',
    voucherNo: 'REC/2026/001',
    date: '2026-10-30',
    type: 'RECEIPT',
    partyId: 'c_01',
    partyName: 'Customer A',
    isGstBill: false,
    paymentMode: 'CASH',
    subtotal: 11800,
    cgstTotal: 0,
    sgstTotal: 0,
    igstTotal: 0,
    grandTotal: 11800,
    items: [],
  };

  const recJournal = generateJournalEntries(recVoucher, chart);
  const recDebits = recJournal.reduce((sum, j) => sum + j.debit, 0);
  const recCredits = recJournal.reduce((sum, j) => sum + j.credit, 0);
  assertEquals(recDebits, 11800, 'Receipt Debits match');
  assertEquals(recCredits, 11800, 'Receipt Credits match');

  // 4d. PAYMENT Voucher (Pay vendor via Bank)
  const pmtVoucher: TransactionVoucher = {
    id: 'v_pmt',
    voucherNo: 'PMT/2026/001',
    date: '2026-10-30',
    type: 'PAYMENT',
    partyId: 'v_01',
    partyName: 'Vendor B',
    isGstBill: false,
    paymentMode: 'BANK',
    subtotal: 5900,
    cgstTotal: 0,
    sgstTotal: 0,
    igstTotal: 0,
    grandTotal: 5900,
    items: [],
  };

  const pmtJournal = generateJournalEntries(pmtVoucher, chart);
  const pmtDebits = pmtJournal.reduce((sum, j) => sum + j.debit, 0);
  const pmtCredits = pmtJournal.reduce((sum, j) => sum + j.credit, 0);
  assertEquals(pmtDebits, 5900, 'Payment Debits match');
  assertEquals(pmtCredits, 5900, 'Payment Credits match');

  testsPassed++;
  console.log('✅ Test 4 Passed: Double-entry balanced journal entries for Sale, Purchase, Receipt, and Payment');
})();

// TEST 5: Atomic Ledger & Inventory Deltas and Full Reversal
(() => {
  const chart = ensureSystemLedgers([
    { id: 'c_01', name: 'Customer A', group: 'Sundry Debtors', openingBalance: 0, currentBalance: 0 },
  ]);

  const saleVoucher: TransactionVoucher = {
    id: 'v_sale_rev',
    voucherNo: 'INV/2026/002',
    date: '2026-10-30',
    type: 'SALE',
    partyId: 'c_01',
    partyName: 'Customer A',
    isGstBill: true,
    paymentMode: 'CREDIT',
    subtotal: 1000,
    cgstTotal: 90,
    sgstTotal: 90,
    igstTotal: 0,
    grandTotal: 1180,
    items: [{ itemId: 'item_x', name: 'Item X', hsn: '8544', qty: 5, unit: 'Pcs', rate: 200, discount: 0, taxableAmount: 1000, gstRate: 18, cgst: 90, sgst: 90, igst: 0, total: 1180 }],
  };

  // 1. Initial creation
  const journal = generateJournalEntries(saleVoucher, chart);
  const applyDeltas = computeLedgerDeltas(journal, false);
  const applyStockDeltas = computeInventoryDeltas(saleVoucher, false);

  assertEquals(applyDeltas.get('c_01'), 1180, 'Customer balance should increase by 1180');
  assertEquals(applyStockDeltas.get('item_x'), -5, 'Inventory of Item X should decrease by 5');

  // 2. Reversal (on deletion)
  const reverseDeltas = computeLedgerDeltas(journal, true);
  const reverseStockDeltas = computeInventoryDeltas(saleVoucher, true);

  assertEquals(reverseDeltas.get('c_01'), -1180, 'Reversal customer delta should be -1180');
  assertEquals(reverseStockDeltas.get('item_x'), 5, 'Reversal stock delta should be +5');

  // 3. Net effect must be exactly zero
  assertEquals((applyDeltas.get('c_01') || 0) + (reverseDeltas.get('c_01') || 0), 0, 'Net ledger delta on reversal must be 0');
  assertEquals((applyStockDeltas.get('item_x') || 0) + (reverseStockDeltas.get('item_x') || 0), 0, 'Net stock delta on reversal must be 0');

  testsPassed++;
  console.log('✅ Test 5 Passed: Voucher deletion and complete ledger/stock reversal verified');
})();

// TEST 6: Profit & Loss Calculations
(() => {
  const inventory: InventoryItem[] = [
    {
      id: 'it_1',
      name: 'Item 1',
      sku: 'SKU-01',
      hsnCode: '8544',
      unit: 'Pcs',
      purchasePrice: 100,
      sellingPrice: 150,
      gstRate: 18,
      minStockAlert: 10,
      openingStock: 20, // Value = 20 * 100 = 2000
      currentStock: 25,  // Closing value = 25 * 100 = 2500
    },
  ];

  const vouchers: TransactionVoucher[] = [
    {
      id: 'v1',
      voucherNo: 'INV/01',
      date: '2026-10-30',
      type: 'SALE',
      isGstBill: true,
      paymentMode: 'CASH',
      subtotal: 3000,
      cgstTotal: 270,
      sgstTotal: 270,
      igstTotal: 0,
      grandTotal: 3540,
      items: [],
    },
    {
      id: 'v2',
      voucherNo: 'BILL/01',
      date: '2026-10-30',
      type: 'PURCHASE',
      isGstBill: true,
      paymentMode: 'CREDIT',
      subtotal: 1000,
      cgstTotal: 90,
      sgstTotal: 90,
      igstTotal: 0,
      grandTotal: 1180,
      items: [],
    },
  ];

  const ledgers: LedgerAccount[] = [];

  const pnl = computeProfitAndLoss(vouchers, inventory, ledgers);
  assertEquals(pnl.netSales, 3000, 'Net sales should be 3000');
  assertEquals(pnl.netPurchases, 1000, 'Net purchases should be 1000');
  assertEquals(pnl.openingStockValue, 2000, 'Opening stock value should be 2000');
  assertEquals(pnl.closingStockValue, 2500, 'Closing stock value should be 2500');

  // COGS = 2000 + 1000 + 0 - 2500 = 500
  assertEquals(pnl.costOfGoodsSold, 500, 'COGS should be 500');
  // Gross profit = 3000 - 500 = 2500
  assertEquals(pnl.grossProfit, 2500, 'Gross profit should be 2500');

  testsPassed++;
  console.log('✅ Test 6 Passed: Profit & Loss Statement and Stock Valuation verified');
})();

// TEST 7: GSTR-1 Summary Generation
(() => {
  const ledgers: LedgerAccount[] = [
    { id: 'b2b_party', name: 'B2B Corp', group: 'Sundry Debtors', gstin: '27AABCB1234F1Z1', openingBalance: 0, currentBalance: 0 },
    { id: 'b2c_party', name: 'Consumer Retail', group: 'Sundry Debtors', openingBalance: 0, currentBalance: 0 },
  ];

  const vouchers: TransactionVoucher[] = [
    {
      id: 'v_b2b',
      voucherNo: 'INV/B2B/1',
      date: '2026-10-30',
      type: 'SALE',
      partyId: 'b2b_party',
      isGstBill: true,
      paymentMode: 'CREDIT',
      subtotal: 50000,
      cgstTotal: 4500,
      sgstTotal: 4500,
      igstTotal: 0,
      grandTotal: 59000,
      items: [{ itemId: 'it1', name: 'Cable', hsn: '8544', qty: 50, unit: 'Pcs', rate: 1000, discount: 0, taxableAmount: 50000, gstRate: 18, cgst: 4500, sgst: 4500, igst: 0, total: 59000 }],
    },
    {
      id: 'v_b2c',
      voucherNo: 'INV/B2C/1',
      date: '2026-10-30',
      type: 'SALE',
      partyId: 'b2c_party',
      isGstBill: true,
      paymentMode: 'CASH',
      subtotal: 10000,
      cgstTotal: 900,
      sgstTotal: 900,
      igstTotal: 0,
      grandTotal: 11800,
      items: [{ itemId: 'it2', name: 'Switch', hsn: '8536', qty: 20, unit: 'Pcs', rate: 500, discount: 0, taxableAmount: 10000, gstRate: 18, cgst: 900, sgst: 900, igst: 0, total: 11800 }],
    },
  ];

  const gstr1 = computeGSTR1Summary(vouchers, ledgers);
  assertEquals(gstr1.b2bInvoicesCount, 1, '1 B2B invoice');
  assertEquals(gstr1.b2bTaxableValue, 50000, 'B2B taxable 50000');
  assertEquals(gstr1.b2bTaxAmount, 9000, 'B2B tax 9000');
  assertEquals(gstr1.b2cInvoicesCount, 1, '1 B2C invoice');
  assertEquals(gstr1.b2cTaxableValue, 10000, 'B2C taxable 10000');
  assertEquals(gstr1.totalTaxable, 60000, 'Total taxable 60000');
  assertEquals(gstr1.totalTax, 10800, 'Total tax 10800');
  assertEquals(gstr1.hsnSummary.length, 2, '2 HSN entries');

  testsPassed++;
  console.log('✅ Test 7 Passed: GSTR-1 statutory tax summary & B2B/B2C segregation verified');
})();

console.log(`\n🎉 ALL ${testsPassed} UNIT TESTS PASSED SUCCESSFULLY!`);

export type LedgerGroup =
  | 'Sundry Debtors' // Customers
  | 'Sundry Creditors' // Companies / Suppliers
  | 'Bank Accounts'
  | 'Cash-in-hand'
  | 'Direct Expenses'
  | 'Indirect Expenses'
  | 'Sales Accounts'
  | 'Purchase Accounts'
  | 'Duties & Taxes';

export interface LedgerAccount {
  id: string;
  companyId?: string;
  name: string;
  group: LedgerGroup;
  contactPerson?: string;
  gstin?: string;
  pan?: string;
  stateCode?: string;
  phone?: string;
  email?: string;
  address?: string;
  openingBalance: number; // positive = Debit (Customer owes us), negative = Credit (We owe Company)
  currentBalance: number;
  creditLimit?: number;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type UnitType = 'Pcs' | 'Box' | 'Kg' | 'Mtr' | 'Ltr' | 'Set' | 'Bag' | 'Roll';

export interface InventoryItem {
  id: string;
  companyId?: string;
  name: string;
  sku: string;
  hsnCode: string;
  unit: UnitType;
  purchasePrice: number;
  sellingPrice: number;
  gstRate: number; // 0, 5, 12, 18, 28
  minStockAlert: number;
  openingStock?: number;
  currentStock: number;
  description?: string;
  category?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type VoucherType =
  | 'SALE'
  | 'PURCHASE'
  | 'PAYMENT' // We pay a Company / Expense
  | 'RECEIPT' // Customer pays us
  | 'CONTRA'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE';

export type PaymentMode = 'CASH' | 'BANK' | 'UPI' | 'CREDIT';

export interface VoucherLineItem {
  itemId: string;
  name: string;
  hsn: string;
  qty: number;
  unit: UnitType;
  rate: number;
  discount: number; // percentage
  taxableAmount: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  isGstInclusive?: boolean;
}

export interface JournalLineItem {
  accountId: string;
  accountName: string;
  accountGroup: LedgerGroup;
  debit: number;
  credit: number;
  notes?: string;
}

export interface TransactionVoucher {
  id: string;
  companyId?: string;
  voucherNo: string;
  date: string; // YYYY-MM-DD
  type: VoucherType;
  partyId?: string; // Links to Customer or Company (LedgerAccount)
  partyName?: string;
  isGstBill: boolean; // true = with GST, false = without GST (Non-GST / Bill of Supply)
  isGstInclusive?: boolean; // true = entered unit rates are inclusive of GST
  paymentMode: PaymentMode;
  referenceNo?: string; // Cheque / UTR / Transaction ID
  subtotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
  items: VoucherLineItem[];
  journalEntries?: JournalLineItem[];
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ThemeColor = 'blue' | 'emerald' | 'indigo' | 'amber' | 'rose' | 'purple' | 'slate';

export interface CompanySettings {
  id: string;
  name: string;
  gstin: string;
  state: string;
  stateCode: string; // e.g. "27" for Maharashtra
  phone: string;
  email: string;
  address: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
  upiId: string;
  invoiceTerms: string;
  paperSize: 'A5' | 'A4';
  showQrCode: boolean;
  authorizedSignatoryTitle: string;
  themeColor?: ThemeColor;
  updatedAt?: string;
}

export interface StateInfo {
  code: string;
  name: string;
}

export const INDIAN_STATES: StateInfo[] = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
];

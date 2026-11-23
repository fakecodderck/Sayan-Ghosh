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

export type CustomerMode = 'existing' | 'new' | 'guest';

export interface GuestCustomerDetails {
  name?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  stateCode?: string;
}

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

export interface ReceiptCustomerEntry {
  partyId: string;
  partyName: string;
  amount: number;
  availableDue?: number;
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
  customerMode?: CustomerMode;
  guestDetails?: GuestCustomerDetails;
  isGstBill: boolean; // true = with GST, false = without GST (Non-GST / Bill of Supply)
  isGstInclusive?: boolean; // true = entered unit rates are inclusive of GST
  paymentMode: PaymentMode;
  referenceNo?: string; // Cheque / UTR / Transaction ID
  subtotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff?: number;
  grandTotal: number;
  items: VoucherLineItem[];
  receiptEntries?: ReceiptCustomerEntry[];
  journalEntries?: JournalLineItem[];
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ThemeColor = 'blue' | 'emerald' | 'indigo' | 'amber' | 'rose' | 'purple' | 'slate';

// Drag-and-Drop Custom Invoice Builder Schema
export type InvoiceBlockType =
  | 'company_header'
  | 'invoice_meta'
  | 'bill_to'
  | 'dispatch_info'
  | 'items_table'
  | 'totals_box'
  | 'amount_words'
  | 'hsn_summary'
  | 'bank_qr'
  | 'terms_signatory'
  | 'custom_text'
  | 'divider';

export interface InvoiceBlockConfig {
  id: string;
  type: InvoiceBlockType;
  label: string;
  visible: boolean;
  align?: 'left' | 'center' | 'right';
  customHeading?: string;
  customBody?: string;
  // Optional flags depending on block type
  showHsnColumn?: boolean;
  showDiscountColumn?: boolean;
  showTaxColumn?: boolean;
  showUnitColumn?: boolean;
  showQrCode?: boolean;
  showBankDetails?: boolean;
  compact?: boolean;
}

export interface InvoiceTemplateConfig {
  id: string;
  name: string;
  paperSize: 'A5' | 'A4';
  accentColor: string;
  fontFamily: 'sans' | 'mono' | 'serif';
  borderStyle: 'sharp' | 'rounded' | 'minimal';
  density: 'compact' | 'comfortable';
  blocks: InvoiceBlockConfig[];
  useAsDefault: boolean;
  updatedAt?: string;
}

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
  invoiceTemplate?: InvoiceTemplateConfig;
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
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Pre-2014)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
];

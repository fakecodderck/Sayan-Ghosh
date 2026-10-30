export type LedgerGroup =
  | 'Sundry Debtors'
  | 'Sundry Creditors'
  | 'Bank Accounts'
  | 'Cash-in-hand'
  | 'Direct Expenses'
  | 'Indirect Expenses'
  | 'Sales Accounts'
  | 'Purchase Accounts';

export interface LedgerAccount {
  id: string;
  name: string;
  group: LedgerGroup;
  gstin?: string;
  stateCode?: string;
  phone?: string;
  email?: string;
  address?: string;
  openingBalance: number; // positive = Debit (receivable), negative = Credit (payable)
  currentBalance: number;
  creditLimit?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type UnitType = 'Pcs' | 'Box' | 'Kg' | 'Mtr' | 'Ltr' | 'Set';

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  hsnCode: string;
  unit: UnitType;
  purchasePrice: number;
  sellingPrice: number;
  gstRate: number; // 0, 5, 12, 18, 28
  minStockAlert: number;
  currentStock: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type VoucherType =
  | 'SALE'
  | 'PURCHASE'
  | 'PAYMENT'
  | 'RECEIPT'
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
}

export interface TransactionVoucher {
  id: string;
  voucherNo: string;
  date: string; // YYYY-MM-DD
  type: VoucherType;
  partyId?: string;
  partyName?: string;
  paymentMode: PaymentMode;
  referenceNo?: string;
  subtotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
  items: VoucherLineItem[];
  notes?: string;
  createdBy?: string;
  createdAt?: string;
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

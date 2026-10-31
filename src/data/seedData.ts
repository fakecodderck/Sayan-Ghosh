import {
  CompanySettings,
  InventoryItem,
  LedgerAccount,
  TransactionVoucher
} from '../types/accounting';

export const initialCompanySettings: CompanySettings = {
  id: 'company_ghosh_01',
  name: 'Ghosh Agency',
  gstin: '19ABCDE1234F1Z5',
  state: 'West Bengal',
  stateCode: '19',
  phone: '+91 98765 43210',
  email: 'contact@ghoshagency.com',
  address: 'Kolkata, West Bengal, India',
  bankName: 'HDFC Bank Ltd',
  accountNo: '50200012345678',
  ifsc: 'HDFC0001234',
  branch: 'Kolkata Branch',
  upiId: 'ghoshagency@upi',
  invoiceTerms: '1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if payment is delayed.\n3. Subject to local jurisdiction only.',
  paperSize: 'A5',
  showQrCode: true,
  authorizedSignatoryTitle: 'For Ghosh Agency',
};

// Clean base ledger accounts (No mock customers or suppliers)
export const initialLedgers: LedgerAccount[] = [
  {
    id: 'ledger_cash',
    name: 'Cash-in-Hand',
    group: 'Cash-in-hand',
    openingBalance: 0,
    currentBalance: 0,
  },
  {
    id: 'ledger_bank_primary',
    name: 'Primary Bank Account',
    group: 'Bank Accounts',
    openingBalance: 0,
    currentBalance: 0,
  },
];

// Clean inventory (No demo stock)
export const initialInventory: InventoryItem[] = [];

// Clean voucher transaction register (No demo invoices/bills)
export const initialVouchers: TransactionVoucher[] = [];


import {
  CompanySettings,
  InventoryItem,
  LedgerAccount,
  TransactionVoucher
} from '../types/accounting';

export const initialCompanySettings: CompanySettings = {
  id: 'company_apex_01',
  name: 'Apex Traders & Distributors',
  gstin: '',
  state: 'Maharashtra',
  stateCode: '27',
  phone: '',
  email: '',
  address: '',
  bankName: 'HDFC Bank Ltd',
  accountNo: '',
  ifsc: '',
  branch: 'Main Branch',
  upiId: '',
  invoiceTerms: '1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if payment is delayed.\n3. Subject to local jurisdiction only.',
  paperSize: 'A5',
  showQrCode: true,
  authorizedSignatoryTitle: 'For Apex Traders & Distributors',
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


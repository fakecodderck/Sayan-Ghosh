import {
  InventoryItem,
  JournalLineItem,
  LedgerAccount,
  LedgerGroup,
  TransactionVoucher,
  VoucherType
} from '../types/accounting';

export const SYSTEM_LEDGER_DEFINITIONS: {
  id: string;
  name: string;
  group: LedgerGroup;
}[] = [
  { id: 'ledger_cash', name: 'Cash-in-Hand', group: 'Cash-in-hand' },
  { id: 'ledger_bank_primary', name: 'Primary Bank Account', group: 'Bank Accounts' },
  { id: 'ledger_sys_sales', name: 'Sales Account', group: 'Sales Accounts' },
  { id: 'ledger_sys_purchases', name: 'Purchase Account', group: 'Purchase Accounts' },
  { id: 'ledger_sys_out_cgst', name: 'Output CGST Account', group: 'Duties & Taxes' },
  { id: 'ledger_sys_out_sgst', name: 'Output SGST Account', group: 'Duties & Taxes' },
  { id: 'ledger_sys_out_igst', name: 'Output IGST Account', group: 'Duties & Taxes' },
  { id: 'ledger_sys_in_cgst', name: 'Input CGST Account', group: 'Duties & Taxes' },
  { id: 'ledger_sys_in_sgst', name: 'Input SGST Account', group: 'Duties & Taxes' },
  { id: 'ledger_sys_in_igst', name: 'Input IGST Account', group: 'Duties & Taxes' },
];

/**
 * Ensures system chart of accounts are present in the ledgers list.
 */
export function ensureSystemLedgers(
  currentLedgers: LedgerAccount[],
  companyId?: string
): LedgerAccount[] {
  const existingMap = new Map(currentLedgers.map(l => [l.id, l]));
  const result = [...currentLedgers];

  for (const def of SYSTEM_LEDGER_DEFINITIONS) {
    if (!existingMap.has(def.id)) {
      result.push({
        id: def.id,
        name: def.name,
        group: def.group,
        openingBalance: 0,
        currentBalance: 0,
        companyId,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return result;
}

/**
 * Generates balanced double-entry journal entries for a given voucher.
 * Strict Invariant: Total Debits === Total Credits.
 */
export function generateJournalEntries(
  voucher: Omit<TransactionVoucher, 'id'> | TransactionVoucher,
  ledgers: LedgerAccount[]
): JournalLineItem[] {
  const entries: JournalLineItem[] = [];
  const ledgerMap = new Map(ledgers.map(l => [l.id, l]));

  const partyAccount = voucher.partyId ? ledgerMap.get(voucher.partyId) : undefined;
  const cashAccount = ledgerMap.get('ledger_cash') || {
    id: 'ledger_cash',
    name: 'Cash-in-Hand',
    group: 'Cash-in-hand' as const,
  };
  const bankAccount = ledgerMap.get('ledger_bank_primary') || {
    id: 'ledger_bank_primary',
    name: 'Primary Bank Account',
    group: 'Bank Accounts' as const,
  };
  const salesAccount = ledgerMap.get('ledger_sys_sales') || {
    id: 'ledger_sys_sales',
    name: 'Sales Account',
    group: 'Sales Accounts' as const,
  };
  const purchaseAccount = ledgerMap.get('ledger_sys_purchases') || {
    id: 'ledger_sys_purchases',
    name: 'Purchase Account',
    group: 'Purchase Accounts' as const,
  };
  const outCgstAccount = ledgerMap.get('ledger_sys_out_cgst') || {
    id: 'ledger_sys_out_cgst',
    name: 'Output CGST Account',
    group: 'Duties & Taxes' as const,
  };
  const outSgstAccount = ledgerMap.get('ledger_sys_out_sgst') || {
    id: 'ledger_sys_out_sgst',
    name: 'Output SGST Account',
    group: 'Duties & Taxes' as const,
  };
  const outIgstAccount = ledgerMap.get('ledger_sys_out_igst') || {
    id: 'ledger_sys_out_igst',
    name: 'Output IGST Account',
    group: 'Duties & Taxes' as const,
  };
  const inCgstAccount = ledgerMap.get('ledger_sys_in_cgst') || {
    id: 'ledger_sys_in_cgst',
    name: 'Input CGST Account',
    group: 'Duties & Taxes' as const,
  };
  const inSgstAccount = ledgerMap.get('ledger_sys_in_sgst') || {
    id: 'ledger_sys_in_sgst',
    name: 'Input SGST Account',
    group: 'Duties & Taxes' as const,
  };
  const inIgstAccount = ledgerMap.get('ledger_sys_in_igst') || {
    id: 'ledger_sys_in_igst',
    name: 'Input IGST Account',
    group: 'Duties & Taxes' as const,
  };

  const grandTotal = Number((voucher.grandTotal || 0).toFixed(2));
  const subtotal = Number((voucher.subtotal || 0).toFixed(2));
  const cgstTotal = Number((voucher.cgstTotal || 0).toFixed(2));
  const sgstTotal = Number((voucher.sgstTotal || 0).toFixed(2));
  const igstTotal = Number((voucher.igstTotal || 0).toFixed(2));

  switch (voucher.type) {
    case 'SALE': {
      // 1. Debit Receiving Account (Party if credit, or Cash/Bank)
      if (voucher.paymentMode === 'CREDIT' && partyAccount) {
        entries.push({
          accountId: partyAccount.id,
          accountName: partyAccount.name,
          accountGroup: partyAccount.group,
          debit: grandTotal,
          credit: 0,
          notes: `Sales Invoice ${voucher.voucherNo}`,
        });
      } else if (voucher.paymentMode === 'CASH') {
        entries.push({
          accountId: cashAccount.id,
          accountName: cashAccount.name,
          accountGroup: 'Cash-in-hand',
          debit: grandTotal,
          credit: 0,
          notes: `Cash Sale ${voucher.voucherNo}`,
        });
      } else {
        // BANK or UPI
        entries.push({
          accountId: bankAccount.id,
          accountName: bankAccount.name,
          accountGroup: 'Bank Accounts',
          debit: grandTotal,
          credit: 0,
          notes: `Bank Sale ${voucher.voucherNo}`,
        });
      }

      // 2. Credit Sales Account
      entries.push({
        accountId: salesAccount.id,
        accountName: salesAccount.name,
        accountGroup: 'Sales Accounts',
        debit: 0,
        credit: subtotal,
        notes: `Revenue from Sales ${voucher.voucherNo}`,
      });

      // 3. Credit Output Tax Liabilities if applicable
      if (cgstTotal > 0) {
        entries.push({
          accountId: outCgstAccount.id,
          accountName: outCgstAccount.name,
          accountGroup: 'Duties & Taxes',
          debit: 0,
          credit: cgstTotal,
          notes: 'Output CGST Liability',
        });
      }
      if (sgstTotal > 0) {
        entries.push({
          accountId: outSgstAccount.id,
          accountName: outSgstAccount.name,
          accountGroup: 'Duties & Taxes',
          debit: 0,
          credit: sgstTotal,
          notes: 'Output SGST Liability',
        });
      }
      if (igstTotal > 0) {
        entries.push({
          accountId: outIgstAccount.id,
          accountName: outIgstAccount.name,
          accountGroup: 'Duties & Taxes',
          debit: 0,
          credit: igstTotal,
          notes: 'Output IGST Liability',
        });
      }
      break;
    }

    case 'PURCHASE': {
      // 1. Debit Purchase Account
      entries.push({
        accountId: purchaseAccount.id,
        accountName: purchaseAccount.name,
        accountGroup: 'Purchase Accounts',
        debit: subtotal,
        credit: 0,
        notes: `Inventory Purchase ${voucher.voucherNo}`,
      });

      // 2. Debit Input Tax Credits
      if (cgstTotal > 0) {
        entries.push({
          accountId: inCgstAccount.id,
          accountName: inCgstAccount.name,
          accountGroup: 'Duties & Taxes',
          debit: cgstTotal,
          credit: 0,
          notes: 'Input CGST Credit',
        });
      }
      if (sgstTotal > 0) {
        entries.push({
          accountId: inSgstAccount.id,
          accountName: inSgstAccount.name,
          accountGroup: 'Duties & Taxes',
          debit: sgstTotal,
          credit: 0,
          notes: 'Input SGST Credit',
        });
      }
      if (igstTotal > 0) {
        entries.push({
          accountId: inIgstAccount.id,
          accountName: inIgstAccount.name,
          accountGroup: 'Duties & Taxes',
          debit: igstTotal,
          credit: 0,
          notes: 'Input IGST Credit',
        });
      }

      // 3. Credit Payable / Source Account
      if (voucher.paymentMode === 'CREDIT' && partyAccount) {
        entries.push({
          accountId: partyAccount.id,
          accountName: partyAccount.name,
          accountGroup: partyAccount.group,
          debit: 0,
          credit: grandTotal,
          notes: `Purchase Bill ${voucher.voucherNo}`,
        });
      } else if (voucher.paymentMode === 'CASH') {
        entries.push({
          accountId: cashAccount.id,
          accountName: cashAccount.name,
          accountGroup: 'Cash-in-hand',
          debit: 0,
          credit: grandTotal,
          notes: `Cash Purchase ${voucher.voucherNo}`,
        });
      } else {
        entries.push({
          accountId: bankAccount.id,
          accountName: bankAccount.name,
          accountGroup: 'Bank Accounts',
          debit: 0,
          credit: grandTotal,
          notes: `Bank Purchase ${voucher.voucherNo}`,
        });
      }
      break;
    }

    case 'PAYMENT': {
      // Debit: Supplier (reduces payable) or Expense Account
      const debitTarget = partyAccount || {
        id: 'party_misc_expense',
        name: voucher.partyName || 'Expenses',
        group: 'Direct Expenses' as const,
      };
      entries.push({
        accountId: debitTarget.id,
        accountName: debitTarget.name,
        accountGroup: debitTarget.group,
        debit: grandTotal,
        credit: 0,
        notes: `Payment Disbursal ${voucher.voucherNo}`,
      });

      // Credit: Cash or Bank
      if (voucher.paymentMode === 'CASH') {
        entries.push({
          accountId: cashAccount.id,
          accountName: cashAccount.name,
          accountGroup: 'Cash-in-hand',
          debit: 0,
          credit: grandTotal,
          notes: `Cash Disbursal ${voucher.voucherNo}`,
        });
      } else {
        entries.push({
          accountId: bankAccount.id,
          accountName: bankAccount.name,
          accountGroup: 'Bank Accounts',
          debit: 0,
          credit: grandTotal,
          notes: `Bank Payment ${voucher.voucherNo}`,
        });
      }
      break;
    }

    case 'RECEIPT': {
      // Debit: Cash or Bank
      if (voucher.paymentMode === 'CASH') {
        entries.push({
          accountId: cashAccount.id,
          accountName: cashAccount.name,
          accountGroup: 'Cash-in-hand',
          debit: grandTotal,
          credit: 0,
          notes: `Cash Inward ${voucher.voucherNo}`,
        });
      } else {
        entries.push({
          accountId: bankAccount.id,
          accountName: bankAccount.name,
          accountGroup: 'Bank Accounts',
          debit: grandTotal,
          credit: 0,
          notes: `Bank Deposit ${voucher.voucherNo}`,
        });
      }

      // Credit: Customer (reduces debtor receivable)
      const creditTarget = partyAccount || {
        id: 'party_misc_income',
        name: voucher.partyName || 'Customer Receipt',
        group: 'Sundry Debtors' as const,
      };
      entries.push({
        accountId: creditTarget.id,
        accountName: creditTarget.name,
        accountGroup: creditTarget.group,
        debit: 0,
        credit: grandTotal,
        notes: `Receipt Settlement ${voucher.voucherNo}`,
      });
      break;
    }

    case 'CREDIT_NOTE': {
      // Debit: Sales return / Sales Account + Output Tax reversal
      entries.push({
        accountId: salesAccount.id,
        accountName: salesAccount.name,
        accountGroup: 'Sales Accounts',
        debit: subtotal,
        credit: 0,
        notes: `Sales Return Adjustment ${voucher.voucherNo}`,
      });

      if (cgstTotal > 0) {
        entries.push({
          accountId: outCgstAccount.id,
          accountName: outCgstAccount.name,
          accountGroup: 'Duties & Taxes',
          debit: cgstTotal,
          credit: 0,
          notes: 'Output CGST Reversal',
        });
      }
      if (sgstTotal > 0) {
        entries.push({
          accountId: outSgstAccount.id,
          accountName: outSgstAccount.name,
          accountGroup: 'Duties & Taxes',
          debit: sgstTotal,
          credit: 0,
          notes: 'Output SGST Reversal',
        });
      }
      if (igstTotal > 0) {
        entries.push({
          accountId: outIgstAccount.id,
          accountName: outIgstAccount.name,
          accountGroup: 'Duties & Taxes',
          debit: igstTotal,
          credit: 0,
          notes: 'Output IGST Reversal',
        });
      }

      // Credit: Customer
      const creditParty = partyAccount || {
        id: 'party_customer_credit',
        name: voucher.partyName || 'Customer',
        group: 'Sundry Debtors' as const,
      };
      entries.push({
        accountId: creditParty.id,
        accountName: creditParty.name,
        accountGroup: creditParty.group,
        debit: 0,
        credit: grandTotal,
        notes: `Credit Note ${voucher.voucherNo}`,
      });
      break;
    }

    case 'DEBIT_NOTE': {
      // Debit: Supplier (reduces payable to supplier)
      const debitParty = partyAccount || {
        id: 'party_supplier_debit',
        name: voucher.partyName || 'Supplier',
        group: 'Sundry Creditors' as const,
      };
      entries.push({
        accountId: debitParty.id,
        accountName: debitParty.name,
        accountGroup: debitParty.group,
        debit: grandTotal,
        credit: 0,
        notes: `Debit Note ${voucher.voucherNo}`,
      });

      // Credit: Purchases + Input Tax reversal
      entries.push({
        accountId: purchaseAccount.id,
        accountName: purchaseAccount.name,
        accountGroup: 'Purchase Accounts',
        debit: 0,
        credit: subtotal,
        notes: `Purchase Return ${voucher.voucherNo}`,
      });

      if (cgstTotal > 0) {
        entries.push({
          accountId: inCgstAccount.id,
          accountName: inCgstAccount.name,
          accountGroup: 'Duties & Taxes',
          debit: 0,
          credit: cgstTotal,
          notes: 'Input CGST Reversal',
        });
      }
      if (sgstTotal > 0) {
        entries.push({
          accountId: inSgstAccount.id,
          accountName: inSgstAccount.name,
          accountGroup: 'Duties & Taxes',
          debit: 0,
          credit: sgstTotal,
          notes: 'Input SGST Reversal',
        });
      }
      if (igstTotal > 0) {
        entries.push({
          accountId: inIgstAccount.id,
          accountName: inIgstAccount.name,
          accountGroup: 'Duties & Taxes',
          debit: 0,
          credit: igstTotal,
          notes: 'Input IGST Reversal',
        });
      }
      break;
    }

    case 'CONTRA': {
      // Transfer between Cash and Bank
      if (voucher.paymentMode === 'CASH') {
        // Cash deposited into Bank
        entries.push({
          accountId: bankAccount.id,
          accountName: bankAccount.name,
          accountGroup: 'Bank Accounts',
          debit: grandTotal,
          credit: 0,
          notes: 'Cash Deposited into Bank',
        });
        entries.push({
          accountId: cashAccount.id,
          accountName: cashAccount.name,
          accountGroup: 'Cash-in-hand',
          debit: 0,
          credit: grandTotal,
          notes: 'Cash Outflow to Bank',
        });
      } else {
        // Cash withdrawn from Bank
        entries.push({
          accountId: cashAccount.id,
          accountName: cashAccount.name,
          accountGroup: 'Cash-in-hand',
          debit: grandTotal,
          credit: 0,
          notes: 'Cash Withdrawn from Bank',
        });
        entries.push({
          accountId: bankAccount.id,
          accountName: bankAccount.name,
          accountGroup: 'Bank Accounts',
          debit: 0,
          credit: grandTotal,
          notes: 'Bank Outflow to Cash',
        });
      }
      break;
    }
  }

  // Exact balance verification and rounding adjustment
  const totalDebits = Number(entries.reduce((acc, e) => acc + e.debit, 0).toFixed(2));
  const totalCredits = Number(entries.reduce((acc, e) => acc + e.credit, 0).toFixed(2));
  const diff = Number((totalDebits - totalCredits).toFixed(2));

  if (Math.abs(diff) > 0 && Math.abs(diff) <= 0.05 && entries.length > 0) {
    // Reconcile minor 1 or 2 paise rounding difference on primary revenue/expense line
    const adjustEntry =
      entries.find(e => e.accountGroup === 'Sales Accounts' || e.accountGroup === 'Purchase Accounts') ||
      entries[0];
    if (adjustEntry) {
      if (adjustEntry.credit > 0) {
        adjustEntry.credit = Number((adjustEntry.credit + diff).toFixed(2));
      } else {
        adjustEntry.debit = Number((adjustEntry.debit - diff).toFixed(2));
      }
    }
  }

  return entries;
}

/**
 * Computes the net balance change (+ or -) for each ledger account.
 * Follows standard accounting conventions:
 * - Sundry Debtors: Debit increases receivable (+), Credit decreases receivable (-).
 * - Sundry Creditors: Credit increases payable (- debt), Debit decreases payable (+ settlement).
 * - Cash / Bank: Debit increases balance (+), Credit decreases balance (-).
 * - Direct / Indirect Expenses: Debit increases expense (+), Credit decreases (-).
 * - Sales Accounts: Credit increases sales revenue (+), Debit decreases (-).
 * - Purchase Accounts: Debit increases purchases (+), Credit decreases (-).
 * - Duties & Taxes (Output): Credit increases liability (-), Debit decreases (+).
 * - Duties & Taxes (Input): Debit increases credit (+), Credit decreases (-).
 *
 * If reverse is true, all deltas are inverted.
 */
export function computeLedgerDeltas(
  journalEntries: JournalLineItem[],
  reverse: boolean = false
): Map<string, number> {
  const deltas = new Map<string, number>();
  const multiplier = reverse ? -1 : 1;

  for (const entry of journalEntries) {
    const prevDelta = deltas.get(entry.accountId) || 0;
    let netChange = 0;

    switch (entry.accountGroup) {
      case 'Sundry Debtors':
      case 'Cash-in-hand':
      case 'Bank Accounts':
      case 'Direct Expenses':
      case 'Indirect Expenses':
      case 'Purchase Accounts': {
        // Asset & Expense rule: Debit increases (+), Credit decreases (-)
        netChange = entry.debit - entry.credit;
        break;
      }

      case 'Sundry Creditors': {
        // Creditor rule: Credit increases what we owe (-), Debit settles what we owe (+)
        netChange = entry.debit - entry.credit;
        break;
      }

      case 'Sales Accounts': {
        // Revenue rule: Credit increases sales (+), Debit reduces sales (-)
        netChange = entry.credit - entry.debit;
        break;
      }

      case 'Duties & Taxes': {
        // If Output liability: Credit increases liability (+), Debit reduces (-)
        // If Input asset credit: Debit increases (+), Credit decreases (-)
        if (entry.accountName.toLowerCase().includes('input')) {
          netChange = entry.debit - entry.credit;
        } else {
          netChange = entry.credit - entry.debit;
        }
        break;
      }

      default: {
        netChange = entry.debit - entry.credit;
      }
    }

    deltas.set(entry.accountId, prevDelta + netChange * multiplier);
  }

  return deltas;
}

/**
 * Computes inventory stock change for every line item in the voucher.
 * If reverse is true, all inventory adjustments are inverted (for cancellations/deletions).
 */
export function computeInventoryDeltas(
  voucher: TransactionVoucher | Omit<TransactionVoucher, 'id'>,
  reverse: boolean = false
): Map<string, number> {
  const deltas = new Map<string, number>();
  const multiplier = reverse ? -1 : 1;

  if (!voucher.items || voucher.items.length === 0) {
    return deltas;
  }

  for (const item of voucher.items) {
    if (!item.itemId || !item.qty) continue;
    const currentDelta = deltas.get(item.itemId) || 0;

    let qtyDelta = 0;
    if (voucher.type === 'SALE' || voucher.type === 'DEBIT_NOTE') {
      // Sale or Return to Supplier (Debit Note): reduces our inventory
      qtyDelta = -item.qty;
    } else if (voucher.type === 'PURCHASE' || voucher.type === 'CREDIT_NOTE') {
      // Purchase inward or Return from Customer (Credit Note): increases our inventory
      qtyDelta = item.qty;
    }

    deltas.set(item.itemId, currentDelta + qtyDelta * multiplier);
  }

  return deltas;
}

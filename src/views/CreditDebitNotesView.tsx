import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Printer,
  Download,
  HelpCircle,
  Trash2,
  X,
  Edit2
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { TransactionVoucher } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';
import { downloadInvoicePdf } from '../utils/invoicePdf';

interface CreditDebitNotesViewProps {
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
  onEditVoucher?: (voucher: TransactionVoucher) => void;
  onOpenNewVoucher: (type: 'CREDIT_NOTE' | 'DEBIT_NOTE') => void;
}

export const CreditDebitNotesView: React.FC<CreditDebitNotesViewProps> = ({
  onSelectVoucherForPrint,
  onEditVoucher,
  onOpenNewVoucher,
}) => {
  const { vouchers, settings, getLedgerById, deleteVoucher } = useAccounting();

  const [activeTab, setActiveTab] = useState<'CREDIT_NOTE' | 'DEBIT_NOTE'>('CREDIT_NOTE');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const notesList = useMemo(() => {
    return vouchers.filter(v => {
      if (v.type !== activeTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          v.voucherNo.toLowerCase().includes(q) ||
          v.partyName?.toLowerCase().includes(q) ||
          v.notes?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vouchers, activeTab, searchQuery]);

  const totalTaxable = notesList.reduce((acc, v) => acc + v.subtotal, 0);
  const totalTax = notesList.reduce((acc, v) => acc + (v.cgstTotal + v.sgstTotal + v.igstTotal), 0);
  const totalGrand = notesList.reduce((acc, v) => acc + v.grandTotal, 0);

  return (
    <div className="space-y-5">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {activeTab === 'CREDIT_NOTE' ? 'Credit Notes (Sales Returns)' : 'Debit Notes (Purchase Returns)'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Statutory GST adjustment notes with auto-reversal of tax liability and stock adjustments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Credit vs Debit Note Toggle */}
          <div className="h-9 inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('CREDIT_NOTE')}
              className={`h-7 px-3 text-xs font-semibold rounded-md transition-colors inline-flex items-center justify-center whitespace-nowrap ${
                activeTab === 'CREDIT_NOTE'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Credit Notes (Customer)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DEBIT_NOTE')}
              className={`h-7 px-3 text-xs font-semibold rounded-md transition-colors inline-flex items-center justify-center whitespace-nowrap ${
                activeTab === 'DEBIT_NOTE'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Debit Notes (Vendor)
            </button>
          </div>

          <button
            type="button"
            onClick={() => onOpenNewVoucher(activeTab)}
            className="h-9 theme-bg theme-bg-hover inline-flex items-center justify-center gap-1.5 px-3.5 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Issue {activeTab === 'CREDIT_NOTE' ? 'Credit Note' : 'Debit Note'}</span>
          </button>
        </div>
      </div>

      {/* Statutory Guidance Box */}
      <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
        <HelpCircle className="w-4 h-4 theme-text shrink-0 mt-0.5" />
        <div>
          {activeTab === 'CREDIT_NOTE' ? (
            <p>
              <strong>Credit Note Mechanism:</strong> Issued to a customer when goods are returned, damaged in transit, or an overcharge discount is credited. This reduces the customer&apos;s outstanding balance, restores inventory counts to stock, and reverses output GST liability in Table 9B of GSTR-1.
            </p>
          ) : (
            <p>
              <strong>Debit Note Mechanism:</strong> Issued to a vendor/supplier when returning defective goods, incorrect specifications, or claiming purchase price allowances. This reduces your payable amount to the vendor, decreases your stock count, and adjusts Input Tax Credit (ITC) under GSTR-3B.
            </p>
          )}
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Taxable Returned
          </p>
          <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {formatINR(totalTaxable)}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total GST Reversal Amount
          </p>
          <p className="text-xl font-bold font-mono tabular-nums theme-text mt-1">
            {formatINR(totalTax)}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Net Adjustment Value
          </p>
          <p className="text-xl font-bold font-mono tabular-nums text-purple-600 dark:text-purple-400 mt-1">
            {formatINR(totalGrand)}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 sm:p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search note #, party name, or return reason..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-8 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 theme-ring focus:outline-hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="w-6 h-6 rounded-md inline-flex items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap shrink-0">
          Showing {notesList.length} note{notesList.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-4 w-28">Date</th>
                <th className="py-2.5 px-3 w-32">Note Number</th>
                <th className="py-2.5 px-3">Party Name &amp; Reason</th>
                <th className="py-2.5 px-3 w-28 text-right">Taxable</th>
                <th className="py-2.5 px-3 w-24 text-right">GST Total</th>
                <th className="py-2.5 px-4 w-32 text-right font-bold text-slate-900 dark:text-slate-100">
                  Total Adjusted (₹)
                </th>
                <th className="py-2.5 px-3 w-32 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {notesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No {activeTab.replace('_', ' ').toLowerCase()}s match your filter.
                  </td>
                </tr>
              ) : (
                notesList.map(n => (
                  <tr
                    key={n.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {n.date}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {n.voucherNo}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {n.partyName || 'Walk-in / Counter Party'}
                      </p>
                      {n.notes && (
                        <p className="text-[11px] text-slate-500 italic truncate max-w-md">
                          Reason: {n.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {formatINR(n.subtotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                      {formatINR(n.cgstTotal + n.sgstTotal + n.igstTotal)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-purple-600 dark:text-purple-400">
                      {formatINR(n.grandTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {onEditVoucher && (
                          <button
                            type="button"
                            onClick={() => onEditVoucher(n)}
                            title="Edit Note"
                            className="w-7 h-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 rounded-md inline-flex items-center justify-center transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            downloadInvoicePdf({
                              voucher: n,
                              settings,
                              party: n.partyId ? getLedgerById(n.partyId) : undefined,
                              useCustomTemplate: Boolean(settings.invoiceTemplate?.useAsDefault && settings.invoiceTemplate?.blocks.length),
                            })
                          }
                          title="Download PDF Note"
                          className="w-7 h-7 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md inline-flex items-center justify-center transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectVoucherForPrint(n)}
                          title="Print / View Note"
                          className="w-7 h-7 theme-text hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md inline-flex items-center justify-center transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteId === n.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                deleteVoucher(n.id);
                                setConfirmDeleteId(null);
                              }}
                              className="h-7 px-2 text-[10px] font-bold bg-rose-600 text-white rounded-md inline-flex items-center justify-center"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-7 px-2 text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-md inline-flex items-center justify-center"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(n.id)}
                            title="Delete Note"
                            className="w-7 h-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors inline-flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Search,
  Plus,
  Printer,
  FileText,
  Building,
  HelpCircle
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { TransactionVoucher } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';

interface CreditDebitNotesViewProps {
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
  onOpenNewVoucher: () => void;
}

export const CreditDebitNotesView: React.FC<CreditDebitNotesViewProps> = ({
  onSelectVoucherForPrint,
  onOpenNewVoucher,
}) => {
  const { vouchers } = useAccounting();

  const [activeTab, setActiveTab] = useState<'CREDIT_NOTE' | 'DEBIT_NOTE'>('CREDIT_NOTE');
  const [searchQuery, setSearchQuery] = useState('');

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
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {activeTab === 'CREDIT_NOTE' ? 'Credit Notes (Sales Returns)' : 'Debit Notes (Purchase Returns)'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Statutory GST adjustment notes with auto-reversal of tax liability and stock adjustments
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Credit vs Debit Note Toggle */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('CREDIT_NOTE')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'CREDIT_NOTE'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Credit Notes (Customer Returns)
            </button>
            <button
              onClick={() => setActiveTab('DEBIT_NOTE')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'DEBIT_NOTE'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Debit Notes (Vendor Returns)
            </button>
          </div>

          <button
            onClick={onOpenNewVoucher}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Issue {activeTab === 'CREDIT_NOTE' ? 'Credit Note' : 'Debit Note'}</span>
          </button>
        </div>
      </div>

      {/* Statutory Guidance Box */}
      <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
        <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          {activeTab === 'CREDIT_NOTE' ? (
            <p>
              <strong>Credit Note Mechanism:</strong> Issued to a customer when goods are returned, damaged in transit, or an overcharge discount is credited. This reduces the customer's outstanding balance, restores inventory counts to the target warehouse, and reverses output GST liability in Table 9B of GSTR-1.
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
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {formatINR(totalTaxable)}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total GST Reversal Amount
          </p>
          <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
            {formatINR(totalTax)}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Net Adjustment Value
          </p>
          <p className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
            {formatINR(totalGrand)}
          </p>
        </div>
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
                <th className="py-2.5 px-3 w-24 text-center">Print</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {notesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No {activeTab.replace('_', ' ').toLowerCase()}s issued yet.
                  </td>
                </tr>
              ) : (
                notesList.map(n => (
                  <tr
                    key={n.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {n.date}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {n.voucherNo}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {n.partyName}
                      </p>
                      {n.notes && (
                        <p className="text-[11px] text-slate-500 italic truncate max-w-md">
                          Reason: {n.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {formatINR(n.subtotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      {formatINR(n.cgstTotal + n.sgstTotal + n.igstTotal)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                      {formatINR(n.grandTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => onSelectVoucherForPrint(n)}
                        className="px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded font-medium border border-blue-200 dark:border-blue-900"
                      >
                        Print
                      </button>
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

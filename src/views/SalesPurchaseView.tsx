import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Search,
  Plus,
  Printer
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { TransactionVoucher } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';

interface SalesPurchaseViewProps {
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
  onOpenNewVoucher: () => void;
}

export const SalesPurchaseView: React.FC<SalesPurchaseViewProps> = ({
  onSelectVoucherForPrint,
  onOpenNewVoucher,
}) => {
  const { vouchers } = useAccounting();

  const [activeTab, setActiveTab] = useState<'SALE' | 'PURCHASE'>('SALE');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBills = useMemo(() => {
    return vouchers.filter(v => {
      if (v.type !== activeTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          v.voucherNo.toLowerCase().includes(q) ||
          v.partyName?.toLowerCase().includes(q) ||
          v.referenceNo?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vouchers, activeTab, searchQuery]);

  const totalTaxable = filteredBills.reduce((acc, b) => acc + b.subtotal, 0);
  const totalCgst = filteredBills.reduce((acc, b) => acc + b.cgstTotal, 0);
  const totalSgst = filteredBills.reduce((acc, b) => acc + b.sgstTotal, 0);
  const totalIgst = filteredBills.reduce((acc, b) => acc + b.igstTotal, 0);
  const grandTotal = filteredBills.reduce((acc, b) => acc + b.grandTotal, 0);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {activeTab === 'SALE' ? 'GST Sales Invoicing' : 'Vendor Purchase Billing'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full GST compliance, itemized tax breakdowns, and automated inventory sync
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Sales vs Purchase Toggle */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('SALE')}
              className={`px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-md transition-colors min-h-[32px] ${
                activeTab === 'SALE'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Sales
            </button>
            <button
              onClick={() => setActiveTab('PURCHASE')}
              className={`px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-md transition-colors min-h-[32px] ${
                activeTab === 'PURCHASE'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Purchase
            </button>
          </div>

          <button
            onClick={onOpenNewVoucher}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create {activeTab === 'SALE' ? 'Invoice' : 'Bill'}</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Taxable Value
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-1 truncate">
            {formatINR(totalTaxable)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Net pre-tax sum</span>
        </div>

        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            CGST + SGST
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 truncate">
            {formatINR(totalCgst + totalSgst)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Intra-state Tax</span>
        </div>

        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            IGST
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1 truncate">
            {formatINR(totalIgst)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Inter-state Tax</span>
        </div>

        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Grand Total
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 truncate">
            {formatINR(grandTotal)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Inclusive of GST</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab === 'SALE' ? 'customer invoice' : 'supplier bill'} #, party...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-4 w-24">Date</th>
                <th className="py-2.5 px-3 w-32">Invoice No</th>
                <th className="py-2.5 px-3 min-w-[160px]">Party Name</th>
                <th className="py-2.5 px-3 w-20">Terms</th>
                <th className="py-2.5 px-3 w-24 text-right">Taxable</th>
                <th className="py-2.5 px-3 w-20 text-right">CGST</th>
                <th className="py-2.5 px-3 w-20 text-right">SGST</th>
                <th className="py-2.5 px-3 w-20 text-right">IGST</th>
                <th className="py-2.5 px-4 w-28 text-right font-bold text-slate-900 dark:text-slate-100">
                  Total (₹)
                </th>
                <th className="py-2.5 px-3 w-20 text-center">Print</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No {activeTab === 'SALE' ? 'sales invoices' : 'purchase bills'} recorded yet.
                  </td>
                </tr>
              ) : (
                filteredBills.map(b => (
                  <tr
                    key={b.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {b.date}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {b.voucherNo}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                        {b.partyName || 'Cash Customer'}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {(b.items || []).length} items billed
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {b.paymentMode}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatINR(b.subtotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                      {b.cgstTotal > 0 ? formatINR(b.cgstTotal) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                      {b.sgstTotal > 0 ? formatINR(b.sgstTotal) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                      {b.igstTotal > 0 ? formatINR(b.igstTotal) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-950 dark:text-slate-100 whitespace-nowrap">
                      {formatINR(b.grandTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => onSelectVoucherForPrint(b)}
                        className="px-2.5 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded font-medium border border-blue-200 dark:border-blue-900"
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

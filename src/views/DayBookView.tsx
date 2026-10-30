import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  Printer,
  Trash2,
  Plus
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { TransactionVoucher, VoucherType } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';

interface DayBookViewProps {
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
  onOpenNewVoucher: () => void;
}

export const DayBookView: React.FC<DayBookViewProps> = ({
  onSelectVoucherForPrint,
  onOpenNewVoucher,
}) => {
  const { vouchers, deleteVoucher } = useAccounting();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return vouchers.length > 0 ? vouchers[0].date : new Date().toISOString().split('T')[0];
  });

  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v => {
      // Date filter
      if (selectedDate && v.date !== selectedDate) {
        // filter by date if selected
      }
      // Type filter
      if (selectedType !== 'ALL' && v.type !== selectedType) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNo = v.voucherNo.toLowerCase().includes(q);
        const matchesParty = v.partyName?.toLowerCase().includes(q);
        const matchesNotes = v.notes?.toLowerCase().includes(q);
        if (!matchesNo && !matchesParty && !matchesNotes) return false;
      }

      return true;
    });
  }, [vouchers, selectedDate, selectedType, searchQuery]);

  // Daily totals calculations
  const totalSales = filteredVouchers
    .filter(v => v.type === 'SALE')
    .reduce((a, b) => a + b.grandTotal, 0);

  const totalPurchases = filteredVouchers
    .filter(v => v.type === 'PURCHASE')
    .reduce((a, b) => a + b.grandTotal, 0);

  const totalReceipts = filteredVouchers
    .filter(v => v.type === 'RECEIPT')
    .reduce((a, b) => a + b.grandTotal, 0);

  const totalPayments = filteredVouchers
    .filter(v => v.type === 'PAYMENT')
    .reduce((a, b) => a + b.grandTotal, 0);

  const handleDelete = (id: string, voucherNo: string) => {
    if (confirm(`Are you sure you want to delete voucher ${voucherNo}?`)) {
      deleteVoucher(id);
    }
  };

  const getVoucherBadgeClass = (type: VoucherType) => {
    switch (type) {
      case 'SALE':
        return 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800';
      case 'PURCHASE':
        return 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800';
      case 'RECEIPT':
        return 'text-teal-700 bg-teal-50 dark:text-teal-300 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800';
      case 'PAYMENT':
        return 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800';
      case 'CREDIT_NOTE':
        return 'text-purple-700 bg-purple-50 dark:text-purple-300 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800';
      case 'DEBIT_NOTE':
        return 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800';
      default:
        return 'text-slate-700 bg-slate-50 border border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Day Book (Roznamcha)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological ledger journal of all business transactions &amp; vouchers
          </p>
        </div>

        <button
          onClick={onOpenNewVoucher}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all min-h-[40px] whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Day Entry</span>
        </button>
      </div>

      {/* Financial Position Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Sales
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 truncate">
            {formatINR(totalSales)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Customer Billing</span>
        </div>

        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Purchases
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 truncate">
            {formatINR(totalPurchases)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Vendor Procurement</span>
        </div>

        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Money Received
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-teal-600 dark:text-teal-400 mt-1 truncate">
            {formatINR(totalReceipts)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Cash / Bank Inflow</span>
        </div>

        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Payments Made
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 truncate">
            {formatINR(totalPayments)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Cash / Bank Outflow</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search voucher #, party or narration..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Date filter */}
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800"
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate('')}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                >
                  All Dates
                </button>
              )}
            </div>
          </div>

          {/* Type Filter Buttons (Horizontal scrolling on small screens) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto pb-1.5 sm:pb-1">
            {(
              [
                { key: 'ALL', label: 'All' },
                { key: 'SALE', label: 'Sales' },
                { key: 'PURCHASE', label: 'Purchases' },
                { key: 'RECEIPT', label: 'Receipts' },
                { key: 'PAYMENT', label: 'Payments' },
                { key: 'CREDIT_NOTE', label: 'Credit Notes' },
                { key: 'DEBIT_NOTE', label: 'Debit Notes' },
              ] as const
            ).map(f => (
              <button
                key={f.key}
                onClick={() => setSelectedType(f.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap min-h-[32px] ${
                  selectedType === f.key
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions Table (Full responsive scroll on mobile) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-4 w-24">Date</th>
                <th className="py-2.5 px-3 w-32">Voucher No</th>
                <th className="py-2.5 px-3 w-28">Type</th>
                <th className="py-2.5 px-3 min-w-[160px]">Party / Particulars</th>
                <th className="py-2.5 px-3 w-20">Mode</th>
                <th className="py-2.5 px-3 w-24 text-right">Taxable</th>
                <th className="py-2.5 px-3 w-24 text-right">GST Total</th>
                <th className="py-2.5 px-4 w-32 text-right">Amount (₹)</th>
                <th className="py-2.5 px-3 w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map(v => (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {v.date}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                      {v.voucherNo}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getVoucherBadgeClass(
                          v.type
                        )}`}
                      >
                        {v.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                        {v.partyName || 'Direct Cash Entry'}
                      </p>
                      {v.notes && (
                        <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{v.notes}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {v.paymentMode}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatINR(v.subtotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                      {formatINR(v.cgstTotal + v.sgstTotal + v.igstTotal)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-950 dark:text-slate-100 whitespace-nowrap">
                      {formatINR(v.grandTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onSelectVoucherForPrint(v)}
                          title="Print A5 GST Invoice"
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded min-w-[32px] min-h-[32px] flex items-center justify-center"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id, v.voucherNo)}
                          title="Delete Voucher"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded min-w-[32px] min-h-[32px] flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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

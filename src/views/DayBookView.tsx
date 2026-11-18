import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  Printer,
  Trash2,
  Plus,
  TrendingUp,
  ShoppingCart,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Download
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { TransactionVoucher, VoucherType } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';
import { downloadInvoicePdf } from '../utils/invoicePdf';

interface DayBookViewProps {
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
  onOpenNewVoucher: () => void;
}

export const DayBookView: React.FC<DayBookViewProps> = ({
  onSelectVoucherForPrint,
  onOpenNewVoucher,
}) => {
  const { vouchers, settings, getLedgerById, deleteVoucher } = useAccounting();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  // Default to showing all transactions sorted newest-first so nothing is hidden on first load
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredVouchers = useMemo(() => {
    return vouchers
      .filter(v => {
        if (selectedDate && v.date !== selectedDate) return false;
        if (selectedType !== 'ALL' && v.type !== selectedType) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesNo = v.voucherNo.toLowerCase().includes(q);
          const matchesParty = (v.guestDetails?.name || v.partyName || '').toLowerCase().includes(q);
          const matchesNotes = v.notes?.toLowerCase().includes(q);
          if (!matchesNo && !matchesParty && !matchesNotes) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (diff !== 0) return diff;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  }, [vouchers, selectedDate, selectedType, searchQuery]);

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

  const todayStr = new Date().toISOString().split('T')[0];

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
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Day Book (Roznamcha)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological accounting journal of all sales, purchases, receipts, and payments
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewVoucher}
          className="theme-bg hover:opacity-95 active:scale-95 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 min-h-[40px] whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>New Voucher Entry</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Sales
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1.5 truncate">
            {formatINR(totalSales)}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Purchases
            </span>
            <ShoppingCart className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1.5 truncate">
            {formatINR(totalPurchases)}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Money Received
            </span>
            <ArrowDownLeft className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-teal-600 dark:text-teal-400 mt-1.5 truncate">
            {formatINR(totalReceipts)}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Payments Out
            </span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1.5 truncate">
            {formatINR(totalPayments)}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search by invoice #, party name, or remarks..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 shrink-0">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 font-mono font-medium"
              />
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className={`px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition-all ${
                  selectedDate === todayStr
                    ? 'theme-soft-badge font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1.5 text-[11px] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className={`px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition-all ${
                  selectedDate === ''
                    ? 'theme-soft-badge font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                All Dates
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg overflow-x-auto">
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
                type="button"
                onClick={() => setSelectedType(f.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap min-h-[30px] ${
                  selectedType === f.key
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4 w-24">Date</th>
                <th className="py-3 px-3 w-32">Voucher No</th>
                <th className="py-3 px-3 w-28">Type</th>
                <th className="py-3 px-3 min-w-[180px]">Party / Particulars</th>
                <th className="py-3 px-3 w-20">Mode</th>
                <th className="py-3 px-3 w-24 text-right">Taxable</th>
                <th className="py-3 px-3 w-24 text-right">GST Total</th>
                <th className="py-3 px-4 w-32 text-right">Grand Total (₹)</th>
                <th className="py-3 px-3 w-28 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 theme-text rounded-xl flex items-center justify-center">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          No Day Book Transactions
                        </h4>
                        <p className="text-xs text-slate-500">
                          {selectedDate || selectedType !== 'ALL' || searchQuery
                            ? 'No entries match your current search or date filter.'
                            : 'Start by recording your first sale, purchase, or receipt entry.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenNewVoucher}
                        className="mt-2 theme-bg text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs hover:opacity-90 transition-all flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Record First Entry</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVouchers.map(v => (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {v.date}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums font-bold text-slate-900 dark:text-slate-200 whitespace-nowrap">
                      {v.voucherNo}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${getVoucherBadgeClass(
                          v.type
                        )}`}
                      >
                        {v.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[220px]">
                        {v.guestDetails?.name || v.partyName || 'Direct Cash Entry'}
                      </p>
                      {v.notes && (
                        <p className="text-[10px] text-slate-400 truncate max-w-[220px]">{v.notes}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {v.paymentMode}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatINR(v.subtotal)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatINR(v.cgstTotal + v.sgstTotal + v.igstTotal)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-950 dark:text-slate-100 text-sm whitespace-nowrap">
                      {formatINR(v.grandTotal)}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            downloadInvoicePdf({
                              voucher: v,
                              settings,
                              party: v.partyId ? getLedgerById(v.partyId) : undefined,
                              useCustomTemplate: Boolean(settings.invoiceTemplate?.useAsDefault && settings.invoiceTemplate?.blocks.length),
                            })
                          }
                          title="Download PDF"
                          className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/30 rounded-lg min-w-[30px] min-h-[30px] flex items-center justify-center transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectVoucherForPrint(v)}
                          title="Print / Preview Invoice"
                          className="p-1.5 theme-text hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg min-w-[30px] min-h-[30px] flex items-center justify-center transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteId === v.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                deleteVoucher(v.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 text-[10px] font-bold bg-rose-600 text-white rounded"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-1 text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(v.id)}
                            title="Delete Voucher"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg min-w-[30px] min-h-[30px] flex items-center justify-center transition-colors"
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

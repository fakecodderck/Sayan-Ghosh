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
  Download,
  Edit2,
  FileBarChart2,
  Layers,
  List
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { TransactionVoucher, VoucherType } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';
import { downloadInvoicePdf } from '../utils/invoicePdf';
import {
  filterDayBookEntries,
  formatDateReadable,
  formatDateWithWeekday,
  groupDayBookEntriesByDate
} from '../utils/dayBookPdf';
import { DayBookReportModal } from '../components/DayBookReportModal';

interface DayBookViewProps {
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
  onEditVoucher?: (voucher: TransactionVoucher) => void;
  onOpenNewVoucher: () => void;
}

export const DayBookView: React.FC<DayBookViewProps> = ({
  onSelectVoucherForPrint,
  onEditVoucher,
  onOpenNewVoucher,
}) => {
  const { vouchers, settings, getLedgerById, deleteVoucher } = useAccounting();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  // Custom date range (defaults to all dates so nothing is hidden on first load)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [groupByDay, setGroupByDay] = useState<boolean>(true);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const last7DaysStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  }, []);

  const thisMonthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  }, []);

  const selectedCategoryArray = useMemo<VoucherType[]>(
    () => (selectedType === 'ALL' ? [] : [selectedType as VoucherType]),
    [selectedType]
  );

  const filteredVouchers = useMemo(() => {
    return filterDayBookEntries(
      vouchers,
      startDate,
      endDate,
      selectedCategoryArray,
      searchQuery
    ).sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (diff !== 0) return diff;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [vouchers, startDate, endDate, selectedCategoryArray, searchQuery]);

  const dayGroups = useMemo(
    () => groupDayBookEntriesByDate(filteredVouchers, 'desc'),
    [filteredVouchers]
  );

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

  const renderEntryRow = (v: TransactionVoucher) => (
    <tr
      key={v.id}
      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
    >
      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
        {v.date}
      </td>
      <td className="py-3 px-3 font-mono tabular-nums font-bold text-slate-900 dark:text-slate-200 whitespace-nowrap">
        {v.voucherNo || '—'}
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
          {onEditVoucher && (
            <button
              type="button"
              onClick={() => onEditVoucher(v)}
              title="Edit Invoice"
              className="w-7 h-7 text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 rounded-md inline-flex items-center justify-center transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              downloadInvoicePdf({
                voucher: v,
                settings,
                party: v.partyId ? getLedgerById(v.partyId) : undefined,
                useCustomTemplate: Boolean(
                  settings.invoiceTemplate?.useAsDefault && settings.invoiceTemplate?.blocks.length
                ),
              })
            }
            title="Download PDF"
            className="w-7 h-7 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/30 rounded-md inline-flex items-center justify-center transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSelectVoucherForPrint(v)}
            title="Print / Preview Invoice"
            className="w-7 h-7 theme-text hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md inline-flex items-center justify-center transition-colors"
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
              onClick={() => setConfirmDeleteId(v.id)}
              title="Delete Invoice"
              className="w-7 h-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-md inline-flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  const isTodayActive = startDate === todayStr && endDate === todayStr;
  const isYesterdayActive = startDate === yesterdayStr && endDate === yesterdayStr;
  const isLast7Active = startDate === last7DaysStart && endDate === todayStr;
  const isThisMonthActive = startDate === thisMonthStart && endDate === todayStr;
  const isAllDatesActive = !startDate && !endDate;

  return (
    <div className="space-y-5">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Day Book (Roznamcha)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Day-wise accounting register of all sales, purchases, receipts, and payments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="h-9 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold shadow-2xs transition-all whitespace-nowrap shrink-0"
          >
            <FileBarChart2 className="w-3.5 h-3.5 theme-text" />
            <span>Print / Export Report</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewVoucher}
            className="h-9 theme-bg hover:opacity-95 active:scale-95 text-white text-xs font-semibold px-3.5 rounded-lg shadow-xs transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Invoice</span>
          </button>
        </div>
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

      {/* Filter, Custom Date Range, and Search Bar */}
      <div className="p-3 sm:p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice #, party name, or remarks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden theme-ring"
            />
          </div>

          {/* Custom Date Range + Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              aria-label="From date"
              title="From Date"
              className="h-9 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 font-mono font-medium"
            />
            <span className="text-slate-400 font-medium">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              aria-label="To date"
              title="To Date"
              className="h-9 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 font-mono font-medium"
            />

            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setStartDate(todayStr);
                  setEndDate(todayStr);
                }}
                className={`h-8 px-2.5 text-[11px] rounded-lg font-medium transition-all inline-flex items-center justify-center whitespace-nowrap ${
                  isTodayActive
                    ? 'theme-soft-badge font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate(yesterdayStr);
                  setEndDate(yesterdayStr);
                }}
                className={`h-8 px-2.5 text-[11px] rounded-lg font-medium transition-all inline-flex items-center justify-center whitespace-nowrap ${
                  isYesterdayActive
                    ? 'theme-soft-badge font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate(last7DaysStart);
                  setEndDate(todayStr);
                }}
                className={`h-8 px-2.5 text-[11px] rounded-lg font-medium transition-all inline-flex items-center justify-center whitespace-nowrap ${
                  isLast7Active
                    ? 'theme-soft-badge font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate(thisMonthStart);
                  setEndDate(todayStr);
                }}
                className={`h-8 px-2.5 text-[11px] rounded-lg font-medium transition-all inline-flex items-center justify-center whitespace-nowrap ${
                  isThisMonthActive
                    ? 'theme-soft-badge font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className={`h-8 px-2.5 text-[11px] rounded-lg font-medium transition-all inline-flex items-center justify-center whitespace-nowrap ${
                  isAllDatesActive
                    ? 'theme-soft-badge font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                All Dates
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter + Day-Wise Grouping Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="h-9 inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg overflow-x-auto">
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
                className={`h-7 px-3 text-xs font-medium rounded-md transition-all inline-flex items-center justify-center whitespace-nowrap shrink-0 ${
                  selectedType === f.key
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
              {filteredVouchers.length} {filteredVouchers.length === 1 ? 'invoice' : 'invoices'}
            </span>
            <div className="h-9 inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setGroupByDay(true)}
                className={`h-7 inline-flex items-center justify-center gap-1 px-2.5 rounded-md font-semibold transition-all whitespace-nowrap ${
                  groupByDay
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Day-Wise</span>
              </button>
              <button
                type="button"
                onClick={() => setGroupByDay(false)}
                className={`h-7 inline-flex items-center justify-center gap-1 px-2.5 rounded-md font-semibold transition-all whitespace-nowrap ${
                  !groupByDay
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Flat List</span>
              </button>
            </div>
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
                <th className="py-3 px-3 w-32">Invoice No</th>
                <th className="py-3 px-3 w-28">Category</th>
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
                  <td colSpan={9} className="py-10 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center justify-center space-y-2.5">
                      <div className="w-11 h-11 bg-slate-100 dark:bg-slate-800 theme-text rounded-xl flex items-center justify-center">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          No Day Book Invoices
                        </h4>
                        <p className="text-xs text-slate-500">
                          {startDate || endDate || selectedType !== 'ALL' || searchQuery
                            ? 'No entries match your current search, category, or date range.'
                            : 'Start by recording your first sale, purchase, or receipt invoice.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenNewVoucher}
                        className="h-9 mt-1 theme-bg text-white text-xs font-semibold px-3.5 rounded-lg shadow-xs hover:opacity-90 transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Record First Invoice</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : groupByDay ? (
                dayGroups.map(group => {
                  const breakdownParts: string[] = [];
                  if (group.sales > 0) breakdownParts.push(`Sales ${formatINR(group.sales)}`);
                  if (group.purchases > 0) breakdownParts.push(`Purchases ${formatINR(group.purchases)}`);
                  if (group.receipts > 0) breakdownParts.push(`Receipts ${formatINR(group.receipts)}`);
                  if (group.payments > 0) breakdownParts.push(`Payments ${formatINR(group.payments)}`);

                  return (
                    <React.Fragment key={group.date}>
                      <tr className="bg-slate-100/90 dark:bg-slate-800/80 border-y border-slate-200 dark:border-slate-700">
                        <td colSpan={5} className="py-2 px-4">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                              {formatDateWithWeekday(group.date)}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              {group.entries.length} {group.entries.length === 1 ? 'invoice' : 'invoices'}
                            </span>
                            {breakdownParts.length > 0 && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:inline">
                                · {breakdownParts.join(' · ')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[11px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatINR(group.taxable)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[11px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatINR(group.gst)}
                        </td>
                        <td className="py-2 px-4 text-right font-mono tabular-nums text-xs font-extrabold theme-text whitespace-nowrap">
                          {formatINR(group.grandTotal)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setStartDate(group.date);
                              setEndDate(group.date);
                              setShowReportModal(true);
                            }}
                            title={`Print / Export Report for ${formatDateReadable(group.date)}`}
                            className="h-7 inline-flex items-center justify-center gap-1 px-2 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 border border-slate-300/80 dark:border-slate-600 rounded-md transition-colors whitespace-nowrap"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Day PDF</span>
                          </button>
                        </td>
                      </tr>
                      {group.entries.map(renderEntryRow)}
                    </React.Fragment>
                  );
                })
              ) : (
                filteredVouchers.map(renderEntryRow)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Day Book Print & Export Report Modal */}
      {showReportModal && (
        <DayBookReportModal
          initialStartDate={startDate}
          initialEndDate={endDate}
          initialCategory={selectedType}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Download,
  Calendar,
  FileSpreadsheet,
  BookOpen,
  ArrowUpDown,
  Check
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { PrintTextSize, VoucherType } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';
import {
  DAYBOOK_CATEGORY_META,
  downloadDayBookCsv,
  downloadDayBookPdf,
  filterDayBookEntries,
  formatCategoryLabel,
  formatDateReadable,
  formatDateWithWeekday,
  getCategoriesLabel,
  getDateRangeLabel,
  groupDayBookEntriesByDate
} from '../utils/dayBookPdf';

interface DayBookReportModalProps {
  initialStartDate: string;
  initialEndDate: string;
  initialCategory: string; // 'ALL' or VoucherType
  onClose: () => void;
}

export const DayBookReportModal: React.FC<DayBookReportModalProps> = ({
  initialStartDate,
  initialEndDate,
  initialCategory,
  onClose,
}) => {
  const { vouchers, settings } = useAccounting();

  const [startDate, setStartDate] = useState<string>(initialStartDate);
  const [endDate, setEndDate] = useState<string>(initialEndDate);
  const [selectedCategories, setSelectedCategories] = useState<VoucherType[]>(() => {
    if (initialCategory && initialCategory !== 'ALL') {
      return [initialCategory as VoucherType];
    }
    return [];
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [textSize, setTextSize] = useState<PrintTextSize>(settings.printTextSize || 'lg');

  useEffect(() => {
    setTextSize(settings.printTextSize || 'lg');
  }, [settings.printTextSize]);

  useEffect(() => {
    document.body.classList.add('portal-print-active');
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('portal-print-active');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const todayStr = new Date().toISOString().split('T')[0];

  const applyQuickRange = (preset: 'today' | 'yesterday' | '7d' | 'month' | 'all') => {
    const now = new Date();
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === '7d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleToggleCategory = (cat: VoucherType) => {
    setSelectedCategories(prev => {
      if (prev.length === 0) {
        return [cat];
      }
      if (prev.includes(cat)) {
        const next = prev.filter(c => c !== cat);
        return next;
      }
      const next = [...prev, cat];
      return next.length === DAYBOOK_CATEGORY_META.length ? [] : next;
    });
  };

  const filteredEntries = useMemo(
    () => filterDayBookEntries(vouchers, startDate, endDate, selectedCategories),
    [vouchers, startDate, endDate, selectedCategories]
  );

  const dayGroups = useMemo(
    () => groupDayBookEntriesByDate(filteredEntries, sortOrder),
    [filteredEntries, sortOrder]
  );

  const totals = useMemo(() => {
    return dayGroups.reduce(
      (acc, g) => ({
        sales: acc.sales + g.sales,
        purchases: acc.purchases + g.purchases,
        receipts: acc.receipts + g.receipts,
        payments: acc.payments + g.payments,
        creditNotes: acc.creditNotes + g.creditNotes,
        debitNotes: acc.debitNotes + g.debitNotes,
        taxable: acc.taxable + g.taxable,
        gst: acc.gst + g.gst,
        grandTotal: acc.grandTotal + g.grandTotal,
      }),
      {
        sales: 0,
        purchases: 0,
        receipts: 0,
        payments: 0,
        creditNotes: 0,
        debitNotes: 0,
        taxable: 0,
        gst: 0,
        grandTotal: 0,
      }
    );
  }, [dayGroups]);

  const rangeLabel = getDateRangeLabel(startDate, endDate);
  const categoryLabel = getCategoriesLabel(selectedCategories);

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  const handleDownloadPdf = () => {
    downloadDayBookPdf({
      vouchers,
      settings,
      startDate,
      endDate,
      selectedCategories,
      sortOrder,
      textSize,
    });
  };

  const handleDownloadCsv = () => {
    downloadDayBookCsv({
      vouchers,
      settings,
      startDate,
      endDate,
      selectedCategories,
      sortOrder,
    });
  };

  const modalNode = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Day Book Report Print and Export"
      data-print-portal="true"
      onClick={onClose}
      className="print-modal-root fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        className="print-modal-card relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden flex flex-col max-h-[94vh]"
      >
        {/* Top Action Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 inline-flex items-center justify-center theme-soft-badge rounded-lg shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate">
                Day Book Report — Print &amp; Export
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {rangeLabel} · {categoryLabel} · {filteredEntries.length} {filteredEntries.length === 1 ? 'Invoice' : 'Invoices'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <div
              className="inline-flex items-center h-8 p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 shrink-0"
              title="Select Print & PDF Text Size"
            >
              <span className="px-1.5 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                Size
              </span>
              {(
                [
                  { id: 'sm', label: 'S', title: 'Small print size' },
                  { id: 'md', label: 'M', title: 'Medium print size' },
                  { id: 'lg', label: 'L', title: 'Large print size (Default)' },
                  { id: 'xl', label: 'XL', title: 'Extra Large print size' },
                ] as const
              ).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTextSize(opt.id)}
                  title={opt.title}
                  className={`h-7 px-2 rounded-md transition-all inline-flex items-center justify-center whitespace-nowrap ${
                    textSize === opt.id ? 'bg-white dark:bg-slate-700 theme-text shadow-2xs font-bold' : ''
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              title="Toggle Date Sort Order"
              className="h-8 inline-flex items-center justify-center gap-1.5 px-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="h-8 inline-flex items-center justify-center gap-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="h-8 inline-flex items-center justify-center gap-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="theme-bg theme-bg-hover h-8 inline-flex items-center justify-center gap-1.5 px-3 active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close report preview"
              className="w-8 h-8 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-flex items-center justify-center transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Report Configuration Controls (Date Range + Categories) */}
        <div className="no-print px-4 sm:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 theme-text" />
                <span>Date Range:</span>
              </span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                aria-label="Report start date"
                className="h-8 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 font-mono"
              />
              <span className="text-slate-400 font-medium">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                aria-label="Report end date"
                className="h-8 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 font-mono"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: '7d', label: 'Last 7 Days' },
                  { id: 'month', label: 'This Month' },
                  { id: 'all', label: 'All Dates' },
                ] as const
              ).map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyQuickRange(preset.id)}
                  className="h-7 px-2.5 text-[11px] font-semibold rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap inline-flex items-center justify-center"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mr-1">
              Categories:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategories([])}
              className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1 ${
                selectedCategories.length === 0
                  ? 'theme-bg text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {selectedCategories.length === 0 && <Check className="w-3 h-3" />}
              <span>All</span>
            </button>
            {DAYBOOK_CATEGORY_META.map(cat => {
              const isSelected = selectedCategories.includes(cat.key);
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleToggleCategory(cat.key)}
                  className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1 ${
                    isSelected
                      ? 'theme-bg text-white shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Printable A4 Sheet Viewport */}
        <div className="print-viewport-wrapper flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100 dark:bg-slate-950/60 flex justify-center">
          <div
            data-text-size={textSize}
            className="print-only-container w-full max-w-[820px] bg-white text-slate-900 p-5 sm:p-7 shadow-sm border border-slate-300 font-sans rounded-xs h-fit"
          >
            {/* Report Letterhead */}
            <div className="border-b-2 border-slate-900 pb-3 mb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div>
                <h1 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-slate-950">
                  {settings.name || 'Ghosh Agency'}
                </h1>
                {settings.address && (
                  <p className="text-[10px] text-slate-600 mt-0.5">{settings.address}</p>
                )}
                <div className="flex flex-wrap gap-x-3 text-[10px] text-slate-700 mt-1">
                  {settings.gstin && (
                    <span>
                      GSTIN: <strong className="font-mono">{settings.gstin}</strong>
                    </span>
                  )}
                  {settings.phone && <span>Ph: {settings.phone}</span>}
                </div>
              </div>

              <div className="sm:text-right shrink-0">
                <div className="inline-block px-2.5 py-1 bg-slate-900 text-white text-[10px] font-bold tracking-wider uppercase rounded-xs">
                  DAY BOOK REPORT
                </div>
                <div className="mt-1.5 text-[10px] text-slate-700 space-y-0.5 font-mono">
                  <p>
                    <strong>Period:</strong> {rangeLabel}
                  </p>
                  <p>
                    <strong>Category:</strong> {categoryLabel}
                  </p>
                  <p>
                    <strong>Invoices:</strong> {filteredEntries.length} ({dayGroups.length}{' '}
                    {dayGroups.length === 1 ? 'Day' : 'Days'})
                  </p>
                </div>
              </div>
            </div>

            {/* Summary KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4 print-avoid-break">
              <div className="p-2.5 rounded-xs border border-slate-200 bg-slate-50">
                <p className="text-[9px] font-bold uppercase text-slate-500">Total Sales</p>
                <p className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-emerald-700 mt-0.5">
                  {formatINR(totals.sales)}
                </p>
              </div>
              <div className="p-2.5 rounded-xs border border-slate-200 bg-slate-50">
                <p className="text-[9px] font-bold uppercase text-slate-500">Total Purchases</p>
                <p className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-blue-700 mt-0.5">
                  {formatINR(totals.purchases)}
                </p>
              </div>
              <div className="p-2.5 rounded-xs border border-slate-200 bg-slate-50">
                <p className="text-[9px] font-bold uppercase text-slate-500">Receipts (In)</p>
                <p className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-teal-700 mt-0.5">
                  {formatINR(totals.receipts)}
                </p>
              </div>
              <div className="p-2.5 rounded-xs border border-slate-200 bg-slate-50">
                <p className="text-[9px] font-bold uppercase text-slate-500">Payments (Out)</p>
                <p className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-rose-700 mt-0.5">
                  {formatINR(totals.payments)}
                </p>
              </div>
            </div>

            {/* Day-Wise Grouped Tables */}
            {dayGroups.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-300 rounded-sm text-slate-500">
                No invoices match the selected date range and category filter.
              </div>
            ) : (
              <div className="space-y-4">
                {dayGroups.map(group => {
                  const breakdownParts: string[] = [];
                  if (group.sales > 0) breakdownParts.push(`Sales: ${formatINR(group.sales)}`);
                  if (group.purchases > 0) breakdownParts.push(`Purchases: ${formatINR(group.purchases)}`);
                  if (group.receipts > 0) breakdownParts.push(`Receipts: ${formatINR(group.receipts)}`);
                  if (group.payments > 0) breakdownParts.push(`Payments: ${formatINR(group.payments)}`);
                  if (group.creditNotes > 0) breakdownParts.push(`CN: ${formatINR(group.creditNotes)}`);
                  if (group.debitNotes > 0) breakdownParts.push(`DN: ${formatINR(group.debitNotes)}`);

                  return (
                    <div key={group.date} className="border border-slate-300 rounded-xs overflow-hidden">
                      <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between gap-2 text-[10px]">
                        <span className="font-bold tracking-wide">
                          {formatDateWithWeekday(group.date)}
                        </span>
                        <span className="font-mono">
                          {group.entries.length} {group.entries.length === 1 ? 'Invoice' : 'Invoices'} · Day Total:{' '}
                          <strong>{formatINR(group.grandTotal)}</strong>
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse print-table text-[10px]">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[9px]">
                              <th className="py-1.5 px-2 border-r border-slate-200 whitespace-nowrap">Invoice No</th>
                              <th className="py-1.5 px-2 border-r border-slate-200 whitespace-nowrap">Category</th>
                              <th className="py-1.5 px-2 border-r border-slate-200">Party / Particulars</th>
                              <th className="py-1.5 px-2 text-center border-r border-slate-200 whitespace-nowrap">Mode</th>
                              <th className="py-1.5 px-2 text-right border-r border-slate-200 whitespace-nowrap">Taxable</th>
                              <th className="py-1.5 px-2 text-right border-r border-slate-200 whitespace-nowrap">GST</th>
                              <th className="py-1.5 px-2 text-right whitespace-nowrap">Total (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {group.entries.map(v => {
                              const gstAmt =
                                Number(v.cgstTotal || 0) +
                                Number(v.sgstTotal || 0) +
                                Number(v.igstTotal || 0);
                              return (
                                <tr key={v.id}>
                                  <td className="py-1 px-2 font-mono font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                                    {v.voucherNo || '—'}
                                  </td>
                                  <td className="py-1 px-2 font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                    {formatCategoryLabel(v.type)}
                                  </td>
                                  <td className="py-1 px-2 text-slate-900 border-r border-slate-200">
                                    <span className="font-medium">
                                      {v.guestDetails?.name || v.partyName || 'Direct Cash Entry'}
                                    </span>
                                    {v.notes && (
                                      <span className="text-[9px] text-slate-500 ml-1.5">
                                        ({v.notes})
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1 px-2 text-center font-mono text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                    {v.paymentMode}
                                  </td>
                                  <td className="py-1 px-2 text-right font-mono tabular-nums text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                    {v.subtotal.toFixed(2)}
                                  </td>
                                  <td className="py-1 px-2 text-right font-mono tabular-nums text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                    {gstAmt.toFixed(2)}
                                  </td>
                                  <td className="py-1 px-2 text-right font-mono tabular-nums font-bold text-slate-950 whitespace-nowrap">
                                    {v.grandTotal.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-blue-50/80 border-t border-slate-300 font-bold text-slate-900 text-[10px]">
                              <td colSpan={4} className="py-1.5 px-2 border-r border-slate-200">
                                <span className="text-blue-900">
                                  Day Subtotal ({formatDateReadable(group.date)})
                                </span>
                                {breakdownParts.length > 0 && (
                                  <span className="font-normal text-[9px] text-slate-600 ml-2">
                                    {breakdownParts.join(' · ')}
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono tabular-nums border-r border-slate-200 whitespace-nowrap">
                                {group.taxable.toFixed(2)}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono tabular-nums border-r border-slate-200 whitespace-nowrap">
                                {group.gst.toFixed(2)}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono tabular-nums text-blue-900 whitespace-nowrap">
                                {formatINR(group.grandTotal)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}

                {/* Period Grand Total Summary */}
                <div className="p-3 bg-slate-900 text-white rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums print-avoid-break">
                  <span className="font-sans font-bold uppercase tracking-wider text-[10px]">
                    Period Grand Total ({filteredEntries.length} Invoices · {dayGroups.length} Days)
                  </span>
                  <div className="flex flex-wrap items-center gap-4 text-[11px]">
                    <span>
                      Taxable: <strong>{formatINR(totals.taxable)}</strong>
                    </span>
                    <span>
                      GST: <strong>{formatINR(totals.gst)}</strong>
                    </span>
                    <span className="text-sm font-extrabold">
                      Total: {formatINR(totals.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
              <span>{settings.name || 'Ghosh Agency'} — Day Book Accounting Register</span>
              <span>Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};

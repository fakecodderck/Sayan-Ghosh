import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Download,
  FileSpreadsheet,
  Calendar,
  ClipboardList,
  Check
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { formatINR } from '../utils/gstCalculations';
import { formatDateReadable, getDateRangeLabel } from '../utils/dayBookPdf';
import {
  STOCK_MOVEMENT_META,
  StockMovementType,
  buildStockTransactions,
  downloadStockReportCsv,
  downloadStockReportPdf,
  filterStockTransactions,
  getMovementLabel,
  getSelectedTypesLabel,
  summarizeByProduct
} from '../utils/stockReportPdf';

interface StockReportModalProps {
  initialStartDate: string;
  initialEndDate: string;
  initialMovementType: string; // 'ALL' or StockMovementType
  initialProductCategory: string; // 'ALL' or category name
  initialReportMode: 'transactions' | 'summary';
  onClose: () => void;
}

export const StockReportModal: React.FC<StockReportModalProps> = ({
  initialStartDate,
  initialEndDate,
  initialMovementType,
  initialProductCategory,
  initialReportMode,
  onClose,
}) => {
  const { vouchers, inventory, settings } = useAccounting();

  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [selectedTypes, setSelectedTypes] = useState<StockMovementType[]>(() =>
    initialMovementType && initialMovementType !== 'ALL'
      ? [initialMovementType as StockMovementType]
      : []
  );
  const [productCategory, setProductCategory] = useState(initialProductCategory || 'ALL');
  const [reportMode, setReportMode] = useState<'transactions' | 'summary'>(initialReportMode);

  useEffect(() => {
    document.body.classList.add('portal-print-active');
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.classList.remove('portal-print-active');
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const allTransactions = useMemo(
    () => buildStockTransactions(vouchers, inventory),
    [vouchers, inventory]
  );

  const productCategories = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach(i => {
      if (i.category?.trim()) set.add(i.category.trim());
    });
    allTransactions.forEach(r => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [inventory, allTransactions]);

  const filteredRows = useMemo(
    () => filterStockTransactions(allTransactions, startDate, endDate, selectedTypes, productCategory),
    [allTransactions, startDate, endDate, selectedTypes, productCategory]
  );

  const productSummaries = useMemo(
    () => summarizeByProduct(filteredRows, inventory),
    [filteredRows, inventory]
  );

  const totals = useMemo(() => {
    const soldQty = filteredRows
      .filter(r => r.movementType === 'SALE')
      .reduce((a, r) => a + r.qty, 0);
    const purchasedQty = filteredRows
      .filter(r => r.movementType === 'PURCHASE')
      .reduce((a, r) => a + r.qty, 0);
    const totalIn = filteredRows.reduce((a, r) => a + r.inQty, 0);
    const totalOut = filteredRows.reduce((a, r) => a + r.outQty, 0);
    const totalValue = filteredRows.reduce((a, r) => a + r.total, 0);
    return { soldQty, purchasedQty, totalIn, totalOut, netChange: totalIn - totalOut, totalValue };
  }, [filteredRows]);

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
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(todayStr);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleToggleType = (type: StockMovementType) => {
    setSelectedTypes(prev => {
      if (prev.length === 0) return [type];
      if (prev.includes(type)) return prev.filter(t => t !== type);
      const next = [...prev, type];
      return next.length === STOCK_MOVEMENT_META.length ? [] : next;
    });
  };

  const rangeLabel = getDateRangeLabel(startDate, endDate);
  const typesLabel = getSelectedTypesLabel(selectedTypes);
  const categoryLabel = productCategory === 'ALL' ? 'All Product Categories' : productCategory;

  const formatQty = (val: number) => (Number.isInteger(val) ? String(val) : val.toFixed(2));

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  const handleExportPdf = () => {
    downloadStockReportPdf({
      rows: filteredRows,
      productSummaries,
      settings,
      startDate,
      endDate,
      selectedTypes,
      productCategory,
      reportMode,
    });
  };

  const handleExportCsv = () => {
    downloadStockReportCsv({
      rows: filteredRows,
      productSummaries,
      settings,
      startDate,
      endDate,
      selectedTypes,
      productCategory,
      reportMode,
    });
  };

  const modalNode = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Stock Report Print and Export"
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
              <ClipboardList className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate">
                Stock Report — Print &amp; Export
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {rangeLabel} · {typesLabel} · {filteredRows.length} Movements
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <div className="inline-flex items-center h-8 p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg text-[11px] font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setReportMode('transactions')}
                className={`h-7 px-2.5 rounded-md transition-all whitespace-nowrap inline-flex items-center justify-center ${
                  reportMode === 'transactions'
                    ? 'bg-white dark:bg-slate-700 theme-text shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Transactions
              </button>
              <button
                type="button"
                onClick={() => setReportMode('summary')}
                className={`h-7 px-2.5 rounded-md transition-all whitespace-nowrap inline-flex items-center justify-center ${
                  reportMode === 'summary'
                    ? 'bg-white dark:bg-slate-700 theme-text shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Product Summary
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="h-8 inline-flex items-center justify-center gap-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
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
              aria-label="Close stock report preview"
              className="w-8 h-8 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-flex items-center justify-center transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
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
              ).map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyQuickRange(p.id)}
                  className="h-7 px-2.5 text-[11px] font-semibold rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap inline-flex items-center justify-center"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mr-1">
                Movement:
              </span>
              <button
                type="button"
                onClick={() => setSelectedTypes([])}
                className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1 ${
                  selectedTypes.length === 0
                    ? 'theme-bg text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {selectedTypes.length === 0 && <Check className="w-3 h-3" />}
                <span>All</span>
              </button>
              {STOCK_MOVEMENT_META.map(m => {
                const isSelected = selectedTypes.includes(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => handleToggleType(m.key)}
                    className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1 ${
                      isSelected
                        ? 'theme-bg text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Category:</span>
              <select
                value={productCategory}
                onChange={e => setProductCategory(e.target.value)}
                className="h-8 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 font-medium"
              >
                <option value="ALL">All Product Categories</option>
                {productCategories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Printable A4 Sheet */}
        <div className="print-viewport-wrapper flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100 dark:bg-slate-950/60 flex justify-center">
          <div className="print-only-container w-full max-w-[820px] bg-white text-slate-900 p-5 sm:p-7 shadow-sm border border-slate-300 font-sans text-xs rounded-xs h-fit">
            {/* Letterhead */}
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
                  {reportMode === 'summary' ? 'PRODUCT STOCK SUMMARY' : 'STOCK TRANSACTION REPORT'}
                </div>
                <div className="mt-1.5 text-[10px] text-slate-700 space-y-0.5 font-mono">
                  <p>
                    <strong>Period:</strong> {rangeLabel}
                  </p>
                  <p>
                    <strong>Filter:</strong> {typesLabel}
                  </p>
                  <p>
                    <strong>Category:</strong> {categoryLabel}
                  </p>
                </div>
              </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4 print-avoid-break">
              <div className="p-2.5 rounded-xs border border-slate-200 bg-slate-50">
                <p className="text-[9px] font-bold uppercase text-slate-500">Total Sold (Out)</p>
                <p className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-rose-700 mt-0.5">
                  -{formatQty(totals.soldQty)} Units
                </p>
              </div>
              <div className="p-2.5 rounded-xs border border-slate-200 bg-slate-50">
                <p className="text-[9px] font-bold uppercase text-slate-500">Total Purchased (In)</p>
                <p className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-emerald-700 mt-0.5">
                  +{formatQty(totals.purchasedQty)} Units
                </p>
              </div>
              <div className="p-2.5 rounded-xs border border-slate-200 bg-slate-50">
                <p className="text-[9px] font-bold uppercase text-slate-500">Net Stock Change</p>
                <p className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-blue-700 mt-0.5">
                  {totals.netChange >= 0 ? '+' : ''}
                  {formatQty(totals.netChange)} Units
                </p>
              </div>
              <div className="p-2.5 rounded-xs border border-slate-200 bg-slate-50">
                <p className="text-[9px] font-bold uppercase text-slate-500">Total Value Moved</p>
                <p className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-slate-900 mt-0.5">
                  {formatINR(totals.totalValue)}
                </p>
              </div>
            </div>

            {/* Table Content */}
            {reportMode === 'summary' ? (
              productSummaries.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-300 rounded-sm text-slate-500">
                  No product stock movements match the selected filters.
                </div>
              ) : (
                <div className="border border-slate-300 rounded-xs overflow-x-auto">
                  <table className="w-full text-left border-collapse print-table text-[10px]">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold uppercase text-[9px]">
                        <th className="py-1.5 px-2 border-r border-slate-700">Product</th>
                        <th className="py-1.5 px-2 w-24 border-r border-slate-700">Category</th>
                        <th className="py-1.5 px-2 w-20 text-right border-r border-slate-700">Purchased</th>
                        <th className="py-1.5 px-2 w-20 text-right border-r border-slate-700">Sold</th>
                        <th className="py-1.5 px-2 w-18 text-right border-r border-slate-700">Net Qty</th>
                        <th className="py-1.5 px-2 w-20 text-right border-r border-slate-700">Current Stock</th>
                        <th className="py-1.5 px-2 w-24 text-right">Sales Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {productSummaries.map(p => (
                        <tr key={p.key}>
                          <td className="py-1 px-2 border-r border-slate-200 font-semibold text-slate-900">
                            {p.productName}
                            {p.sku && <span className="text-[9px] font-mono text-slate-500 ml-1">({p.sku})</span>}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 text-slate-600">{p.category}</td>
                          <td className="py-1 px-2 border-r border-slate-200 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                            {p.purchasedQty > 0 ? `+${formatQty(p.purchasedQty)} ${p.unit}` : '—'}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 text-right font-mono tabular-nums text-rose-700 font-semibold">
                            {p.soldQty > 0 ? `-${formatQty(p.soldQty)} ${p.unit}` : '—'}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 text-right font-mono tabular-nums font-bold text-slate-900">
                            {p.netChange >= 0 ? '+' : ''}
                            {formatQty(p.netChange)}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 text-right font-mono tabular-nums font-bold text-slate-900">
                            {p.currentStock !== null ? `${formatQty(p.currentStock)} ${p.unit}` : 'Custom'}
                          </td>
                          <td className="py-1 px-2 text-right font-mono tabular-nums font-bold text-slate-900">
                            {formatINR(p.salesValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : filteredRows.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-300 rounded-sm text-slate-500">
                No stock transactions match the selected date range and filters.
              </div>
            ) : (
              <div className="border border-slate-300 rounded-xs overflow-x-auto">
                <table className="w-full text-left border-collapse print-table text-[10px]">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold uppercase text-[9px]">
                      <th className="py-1.5 px-2 w-20 border-r border-slate-700">Date</th>
                      <th className="py-1.5 px-2 w-28 border-r border-slate-700">Invoice No</th>
                      <th className="py-1.5 px-2 w-20 border-r border-slate-700">Type</th>
                      <th className="py-1.5 px-2 border-r border-slate-700">Product &amp; Category</th>
                      <th className="py-1.5 px-2 w-28 border-r border-slate-700">Party</th>
                      <th className="py-1.5 px-2 w-16 text-right border-r border-slate-700">In Qty</th>
                      <th className="py-1.5 px-2 w-16 text-right border-r border-slate-700">Out Qty</th>
                      <th className="py-1.5 px-2 w-24 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredRows.map(r => (
                      <tr key={r.id}>
                        <td className="py-1 px-2 border-r border-slate-200 font-mono text-slate-600 whitespace-nowrap">
                          {formatDateReadable(r.date)}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {r.voucherNo}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200 font-semibold text-slate-700 whitespace-nowrap">
                          {getMovementLabel(r.movementType)}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200">
                          <span className="font-semibold text-slate-900">{r.productName}</span>
                          <span className="text-[9px] text-slate-500 ml-1">[{r.category}]</span>
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200 text-slate-700 truncate max-w-[120px]">
                          {r.partyName}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200 text-right font-mono tabular-nums font-bold text-emerald-700 whitespace-nowrap">
                          {r.inQty > 0 ? `+${formatQty(r.inQty)} ${r.unit}` : '—'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200 text-right font-mono tabular-nums font-bold text-rose-700 whitespace-nowrap">
                          {r.outQty > 0 ? `-${formatQty(r.outQty)} ${r.unit}` : '—'}
                        </td>
                        <td className="py-1 px-2 text-right font-mono tabular-nums font-bold text-slate-950 whitespace-nowrap">
                          {r.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50/90 border-t border-slate-300 font-bold text-slate-900 text-[10px]">
                      <td colSpan={5} className="py-1.5 px-2 border-r border-slate-200 text-blue-900">
                        TOTAL ({filteredRows.length} Stock Movements)
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums text-emerald-700 border-r border-slate-200 whitespace-nowrap">
                        +{formatQty(totals.totalIn)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums text-rose-700 border-r border-slate-200 whitespace-nowrap">
                        -{formatQty(totals.totalOut)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums text-blue-900 whitespace-nowrap">
                        {formatINR(totals.totalValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="mt-4 pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
              <span>{settings.name || 'Ghosh Agency'} — Inventory Stock Movement Report</span>
              <span>
                Generated on{' '}
                {new Date().toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};

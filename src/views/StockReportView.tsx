import React, { useMemo, useState } from 'react';
import {
  ClipboardList,
  Search,
  Calendar,
  Download,
  FileSpreadsheet,
  FileBarChart2,
  Printer,
  Edit2,
  ArrowUpRight,
  ArrowDownLeft,
  Package,
  IndianRupee,
  List,
  Layers,
  Filter,
  X
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { TransactionVoucher } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';
import { formatDateReadable } from '../utils/dayBookPdf';
import {
  STOCK_MOVEMENT_META,
  StockMovementType,
  buildStockTransactions,
  downloadStockReportCsv,
  downloadStockReportPdf,
  filterStockTransactions,
  getMovementLabel,
  summarizeByProduct
} from '../utils/stockReportPdf';
import { StockReportModal } from '../components/StockReportModal';

interface StockReportViewProps {
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
  onEditVoucher?: (voucher: TransactionVoucher) => void;
}

export const StockReportView: React.FC<StockReportViewProps> = ({
  onSelectVoucherForPrint,
  onEditVoucher,
}) => {
  const { vouchers, inventory, settings } = useAccounting();

  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMovementType, setSelectedMovementType] = useState<'ALL' | StockMovementType>('ALL');
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'transactions' | 'summary'>('transactions');
  const [showReportModal, setShowReportModal] = useState(false);

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

  const allTransactions = useMemo(
    () => buildStockTransactions(vouchers, inventory),
    [vouchers, inventory]
  );

  const productCategories = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach(item => {
      if (item.category?.trim()) set.add(item.category.trim());
    });
    allTransactions.forEach(row => {
      if (row.category) set.add(row.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [inventory, allTransactions]);

  const selectedTypesArray = useMemo<StockMovementType[]>(
    () => (selectedMovementType === 'ALL' ? [] : [selectedMovementType]),
    [selectedMovementType]
  );

  const filteredRows = useMemo(
    () =>
      filterStockTransactions(
        allTransactions,
        startDate,
        endDate,
        selectedTypesArray,
        selectedProductCategory,
        searchQuery
      ),
    [allTransactions, startDate, endDate, selectedTypesArray, selectedProductCategory, searchQuery]
  );

  const productSummaries = useMemo(
    () => summarizeByProduct(filteredRows, inventory),
    [filteredRows, inventory]
  );

  const metrics = useMemo(() => {
    let soldQty = 0;
    let soldValue = 0;
    let purchasedQty = 0;
    let purchasedValue = 0;
    let totalIn = 0;
    let totalOut = 0;
    let totalValue = 0;

    for (const r of filteredRows) {
      totalIn += r.inQty;
      totalOut += r.outQty;
      totalValue += r.total;
      if (r.movementType === 'SALE') {
        soldQty += r.qty;
        soldValue += r.total;
      } else if (r.movementType === 'PURCHASE') {
        purchasedQty += r.qty;
        purchasedValue += r.total;
      }
    }

    return {
      soldQty,
      soldValue,
      purchasedQty,
      purchasedValue,
      totalIn,
      totalOut,
      netChange: totalIn - totalOut,
      totalValue,
    };
  }, [filteredRows]);

  const formatQty = (val: number) => (Number.isInteger(val) ? String(val) : val.toFixed(2));

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    selectedMovementType !== 'ALL' ||
    selectedProductCategory !== 'ALL';

  const clearAllFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSelectedMovementType('ALL');
    setSelectedProductCategory('ALL');
  };

  const isPresetActive = (preset: 'today' | 'yesterday' | '7d' | 'month' | 'all') => {
    if (preset === 'today') return startDate === todayStr && endDate === todayStr;
    if (preset === 'yesterday') return startDate === yesterdayStr && endDate === yesterdayStr;
    if (preset === '7d') return startDate === last7DaysStart && endDate === todayStr;
    if (preset === 'month') return startDate === thisMonthStart && endDate === todayStr;
    return !startDate && !endDate;
  };

  const applyDatePreset = (preset: 'today' | 'yesterday' | '7d' | 'month' | 'all') => {
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (preset === '7d') {
      setStartDate(last7DaysStart);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      setStartDate(thisMonthStart);
      setEndDate(todayStr);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleQuickExportCsv = () => {
    downloadStockReportCsv({
      rows: filteredRows,
      productSummaries,
      settings,
      startDate,
      endDate,
      selectedTypes: selectedTypesArray,
      productCategory: selectedProductCategory,
      reportMode: viewMode,
    });
  };

  const handleQuickExportPdf = () => {
    downloadStockReportPdf({
      rows: filteredRows,
      productSummaries,
      settings,
      startDate,
      endDate,
      selectedTypes: selectedTypesArray,
      productCategory: selectedProductCategory,
      reportMode: viewMode,
    });
  };

  const getMovementBadgeClass = (type: StockMovementType) => {
    switch (type) {
      case 'SALE':
        return 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800';
      case 'PURCHASE':
        return 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800';
      case 'CREDIT_NOTE':
        return 'text-purple-700 bg-purple-50 dark:text-purple-300 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800';
      case 'DEBIT_NOTE':
        return 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800';
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 theme-soft-badge rounded-xl shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Stock Report
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete log of products sold &amp; purchased with quantities, categories, and invoice numbers
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleQuickExportCsv}
            className="h-9 inline-flex items-center justify-center gap-1.5 px-3.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleQuickExportPdf}
            className="h-9 inline-flex items-center justify-center gap-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="theme-bg theme-bg-hover h-9 inline-flex items-center justify-center gap-1.5 px-3.5 active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0"
          >
            <FileBarChart2 className="w-3.5 h-3.5" />
            <span>Print / Export Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Qty Sold (Outward)
            </span>
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-2">
            -{formatQty(metrics.soldQty)} <span className="text-xs font-semibold text-slate-400">Units</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            Sales Value: {formatINR(metrics.soldValue)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Qty Purchased (Inward)
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-2">
            +{formatQty(metrics.purchasedQty)} <span className="text-xs font-semibold text-slate-400">Units</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            Purchase Value: {formatINR(metrics.purchasedValue)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Net Stock Change
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p
            className={`text-2xl font-extrabold font-mono tabular-nums mt-2 ${
              metrics.netChange >= 0
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {metrics.netChange >= 0 ? '+' : ''}
            {formatQty(metrics.netChange)}{' '}
            <span className="text-xs font-semibold text-slate-400">Units</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            In: +{formatQty(metrics.totalIn)} · Out: -{formatQty(metrics.totalOut)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Value Moved
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-2">
            {formatINR(metrics.totalValue)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {filteredRows.length} Stock Movements · {productSummaries.length} Products
          </p>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        {/* Row 1: Search, Category Dropdown, View Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by product name, SKU, invoice number, party, or category..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="h-9 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label htmlFor="stock-category-filter" className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Category:
              </label>
              <select
                id="stock-category-filter"
                value={selectedProductCategory}
                onChange={e => setSelectedProductCategory(e.target.value)}
                className="text-xs font-semibold bg-transparent text-slate-800 dark:text-slate-100 focus:outline-none pr-1"
              >
                <option value="ALL" className="dark:bg-slate-900">
                  All Categories
                </option>
                {productCategories.map(cat => (
                  <option key={cat} value={cat} className="dark:bg-slate-900">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-9 inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('transactions')}
                className={`h-7 inline-flex items-center justify-center gap-1.5 px-3 rounded-md transition-all whitespace-nowrap ${
                  viewMode === 'transactions'
                    ? 'bg-white dark:bg-slate-700 theme-text shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Transactions</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('summary')}
                className={`h-7 inline-flex items-center justify-center gap-1.5 px-3 rounded-md transition-all whitespace-nowrap ${
                  viewMode === 'summary'
                    ? 'bg-white dark:bg-slate-700 theme-text shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Product Summary</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Date Range + Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 theme-text" />
              <span>Date Range:</span>
            </span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              aria-label="Filter start date"
              className="h-8 px-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono"
            />
            <span className="text-slate-400 font-medium">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              aria-label="Filter end date"
              className="h-8 px-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono"
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
            ).map(preset => {
              const active = isPresetActive(preset.id);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyDatePreset(preset.id)}
                  className={`h-8 px-2.5 text-[11px] font-semibold rounded-lg border transition-colors whitespace-nowrap inline-flex items-center justify-center ${
                    active
                      ? 'theme-bg text-white border-transparent shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Movement Type Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
              Transaction Type:
            </span>
            <button
              type="button"
              onClick={() => setSelectedMovementType('ALL')}
              className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center justify-center ${
                selectedMovementType === 'ALL'
                  ? 'theme-bg text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All ({allTransactions.length})
            </button>
            {STOCK_MOVEMENT_META.map(m => {
              const isSelected = selectedMovementType === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelectedMovementType(m.key)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center justify-center ${
                    isSelected
                      ? 'theme-bg text-white shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="h-8 inline-flex items-center justify-center gap-1 px-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Report Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {viewMode === 'transactions' ? (
          filteredRows.length === 0 ? (
            <div className="py-10 px-6 text-center">
              <div className="w-11 h-11 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <ClipboardList className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No stock transactions found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                {allTransactions.length === 0
                  ? 'Create a Sales or Purchase Invoice with products to automatically track stock movements here.'
                  : 'Try adjusting your date range, product category, transaction type, or search query.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-3.5 h-9 px-4 text-xs font-semibold theme-bg text-white rounded-lg inline-flex items-center justify-center whitespace-nowrap"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 whitespace-nowrap">Date</th>
                    <th className="py-3 px-3 whitespace-nowrap">Invoice No</th>
                    <th className="py-3 px-3 whitespace-nowrap">Type</th>
                    <th className="py-3 px-3">Product &amp; Category</th>
                    <th className="py-3 px-3">Party</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">In Qty</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Out Qty</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Rate (₹)</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Amount (₹)</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredRows.map(row => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDateReadable(row.date)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {row.voucherNo && row.voucherNo !== '—' ? (
                          <button
                            type="button"
                            onClick={() => onSelectVoucherForPrint(row.voucher)}
                            title="View / Print Invoice"
                            className="font-mono tabular-nums font-bold theme-text hover:underline text-left"
                          >
                            {row.voucherNo}
                          </button>
                        ) : (
                          <span className="font-mono text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${getMovementBadgeClass(
                            row.movementType
                          )}`}
                        >
                          {getMovementLabel(row.movementType)}
                        </span>
                      </td>
                      <td className="py-3 px-3 min-w-[180px]">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {row.productName}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="font-medium text-slate-600 dark:text-slate-300">
                            {row.category}
                          </span>
                          {row.sku && <span className="font-mono">SKU: {row.sku}</span>}
                          {row.hsn && <span className="font-mono">HSN: {row.hsn}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 max-w-[180px] truncate">
                        {row.partyName}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {row.inQty > 0 ? `+${formatQty(row.inQty)} ${row.unit}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {row.outQty > 0 ? `-${formatQty(row.outQty)} ${row.unit}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatINR(row.rate)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatINR(row.total)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1">
                          {onEditVoucher && (
                            <button
                              type="button"
                              onClick={() => onEditVoucher(row.voucher)}
                              title="Edit Invoice"
                              aria-label={`Edit invoice ${row.voucherNo}`}
                              className="w-7 h-7 inline-flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectVoucherForPrint(row.voucher)}
                            title="View / Print Invoice"
                            aria-label={`Print invoice ${row.voucherNo}`}
                            className="w-7 h-7 inline-flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/30 rounded-md transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 font-bold text-xs">
                    <td colSpan={5} className="py-3 px-4 text-slate-800 dark:text-slate-200">
                      TOTAL ({filteredRows.length} Stock Movements)
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      +{formatQty(metrics.totalIn)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      -{formatQty(metrics.totalOut)}
                    </td>
                    <td className="py-3 px-3" />
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                      {formatINR(metrics.totalValue)}
                    </td>
                    <td className="py-3 px-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        ) : productSummaries.length === 0 ? (
          <div className="py-10 px-6 text-center">
            <div className="w-11 h-11 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No product summary available
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              No products match the selected filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-3 whitespace-nowrap">Category</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Purchased (In)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Sold (Out)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Returns</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Net Change</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Current Stock</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Purchase Value</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Sales Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {productSummaries.map(p => {
                  const hasReturns = p.salesReturnQty > 0 || p.purchaseReturnQty > 0;
                  return (
                    <tr
                      key={p.key}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 min-w-[180px]">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {p.productName}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {p.sku && <span className="font-mono">SKU: {p.sku}</span>}
                          <span>{p.txCount} {p.txCount === 1 ? 'movement' : 'movements'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {p.category}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {p.purchasedQty > 0 ? `+${formatQty(p.purchasedQty)} ${p.unit}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {p.soldQty > 0 ? `-${formatQty(p.soldQty)} ${p.unit}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {hasReturns ? (
                          <div className="space-y-0.5">
                            {p.salesReturnQty > 0 && (
                              <div className="text-purple-600 dark:text-purple-400">
                                +{formatQty(p.salesReturnQty)} SR
                              </div>
                            )}
                            {p.purchaseReturnQty > 0 && (
                              <div className="text-amber-600 dark:text-amber-400">
                                -{formatQty(p.purchaseReturnQty)} PR
                              </div>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                          p.netChange >= 0
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {p.netChange >= 0 ? '+' : ''}
                        {formatQty(p.netChange)} {p.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {p.currentStock !== null ? `${formatQty(p.currentStock)} ${p.unit}` : 'Custom'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatINR(p.purchaseValue)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatINR(p.salesValue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print / Export Modal */}
      {showReportModal && (
        <StockReportModal
          initialStartDate={startDate}
          initialEndDate={endDate}
          initialMovementType={selectedMovementType}
          initialProductCategory={selectedProductCategory}
          initialReportMode={viewMode}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
};

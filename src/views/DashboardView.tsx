import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  CreditCard,
  Calendar,
  ChevronDown,
  Plus,
  Users,
  Truck,
  Boxes,
  FileText,
  Percent,
  Coins,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Printer,
  Eye
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { ActiveModule } from '../components/Sidebar';
import { TransactionVoucher, VoucherType } from '../types/accounting';
import { formatINR, computeGSTR1Summary } from '../utils/gstCalculations';

interface DashboardViewProps {
  onNavigate: (module: ActiveModule) => void;
  onOpenNewVoucher: (type: VoucherType) => void;
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenNewVoucher,
  onSelectVoucherForPrint,
}) => {
  const { vouchers, ledgers, inventory, settings } = useAccounting();
  const [chartTimeframe, setChartTimeframe] = useState<'6M' | '3M' | '1Y'>('6M');
  const [showVoucherMenu, setShowVoucherMenu] = useState(false);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<{ monthIdx: number; type: 'sales' | 'purchases' } | null>(null);

  // Time & Greeting
  const today = new Date();
  const dateFormatted = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Calculate current Financial Year (India: April to March)
  const currentMonth = today.getMonth(); // 0-indexed (0 = Jan, 3 = Apr)
  const currentYear = today.getFullYear();
  const fyStart = currentMonth >= 3 ? currentYear : currentYear - 1;
  const fyEnd = (fyStart + 1).toString().slice(-2);
  const financialYearStr = `Financial Year ${fyStart}-${fyEnd}`;

  // Greeting
  const hour = today.getHours();
  const greetingTime = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const userName = settings.name ? settings.name.split(' ')[0] : 'Partner';

  // 1. KPI Calculations
  const salesVouchers = useMemo(() => vouchers.filter(v => v.type === 'SALE'), [vouchers]);
  const purchaseVouchers = useMemo(() => vouchers.filter(v => v.type === 'PURCHASE'), [vouchers]);

  const totalSales = useMemo(() => {
    return salesVouchers.reduce((acc, v) => acc + (v.grandTotal || 0), 0);
  }, [salesVouchers]);

  const totalPurchases = useMemo(() => {
    return purchaseVouchers.reduce((acc, v) => acc + (v.grandTotal || 0), 0);
  }, [purchaseVouchers]);

  // Receivables (Sundry Debtors with positive balance)
  const customerDebtors = useMemo(() => ledgers.filter(l => l.group === 'Sundry Debtors'), [ledgers]);
  const debtorsWithDue = useMemo(() => customerDebtors.filter(c => (c.currentBalance || 0) > 0), [customerDebtors]);
  const totalReceivables = useMemo(() => {
    return debtorsWithDue.reduce((acc, c) => acc + (c.currentBalance || 0), 0);
  }, [debtorsWithDue]);

  // Payables (Sundry Creditors with negative balance)
  const supplierCreditors = useMemo(() => ledgers.filter(l => l.group === 'Sundry Creditors'), [ledgers]);
  const creditorsWithDue = useMemo(() => supplierCreditors.filter(c => (c.currentBalance || 0) < 0), [supplierCreditors]);
  const totalPayables = useMemo(() => {
    return creditorsWithDue.reduce((acc, c) => acc + Math.abs(c.currentBalance || 0), 0);
  }, [creditorsWithDue]);

  // 2. Business Highlights
  const totalProductsCount = inventory.length;
  const totalStockValue = useMemo(() => {
    return inventory.reduce((acc, item) => acc + (item.currentStock || 0) * (item.purchasePrice || 0), 0);
  }, [inventory]);

  const gstrSummary = useMemo(() => computeGSTR1Summary(vouchers, ledgers), [vouchers, ledgers]);
  const itcEstimate = useMemo(() => {
    return purchaseVouchers.reduce((acc, v) => acc + (v.cgstTotal + v.sgstTotal + v.igstTotal), 0);
  }, [purchaseVouchers]);
  const netGstPayable = Math.max(0, gstrSummary.totalTax - itcEstimate);

  // 3. Trailing Monthly Bar Chart Data (Sales vs Purchases)
  const chartData = useMemo(() => {
    const monthCount = chartTimeframe === '3M' ? 3 : chartTimeframe === '1Y' ? 12 : 6;
    const months: {
      key: string;
      label: string;
      year: number;
      month: number;
      sales: number;
      purchases: number;
    }[] = [];

    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthNum = d.getMonth();
      const yr = d.getFullYear();
      const monthLabel = d.toLocaleString('en-US', { month: 'short' });
      const key = `${yr}-${String(monthNum + 1).padStart(2, '0')}`;

      months.push({
        key,
        label: monthLabel,
        year: yr,
        month: monthNum,
        sales: 0,
        purchases: 0,
      });
    }

    // Populate with real voucher data
    for (const v of vouchers) {
      if (!v.date) continue;
      const vDate = new Date(v.date);
      const vMonthNum = vDate.getMonth();
      const vYear = vDate.getFullYear();
      const match = months.find(m => m.month === vMonthNum && m.year === vYear);
      if (match) {
        if (v.type === 'SALE') {
          match.sales += v.grandTotal || 0;
        } else if (v.type === 'PURCHASE') {
          match.purchases += v.grandTotal || 0;
        }
      }
    }

    return months;
  }, [vouchers, chartTimeframe]);

  // Max value for chart Y-axis scale
  const maxChartVal = useMemo(() => {
    const highest = Math.max(
      ...chartData.map(d => Math.max(d.sales, d.purchases)),
      100000
    );
    // Round up to nice number
    const magnitude = Math.pow(10, Math.floor(Math.log10(highest)));
    return Math.ceil(highest / magnitude) * magnitude;
  }, [chartData]);

  // Format short Lakhs / Thousands for Y-axis
  const formatYAxis = (val: number) => {
    if (val === 0) return '0';
    if (val >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `${Math.round(val / 100000)}L`;
    if (val >= 1000) return `${Math.round(val / 1000)}k`;
    return `${val}`;
  };

  // 4. Recent Vouchers (top 5)
  const recentVouchers = useMemo(() => {
    return [...vouchers]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [vouchers]);

  // 5. Top Customers by Total Sales
  const topCustomers = useMemo(() => {
    return customerDebtors
      .map(c => {
        const custSales = vouchers
          .filter(v => v.partyId === c.id && v.type === 'SALE')
          .reduce((sum, v) => sum + (v.grandTotal || 0), 0);
        return {
          customer: c,
          totalSales: custSales,
          outstanding: c.currentBalance || 0,
        };
      })
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 5);
  }, [customerDebtors, vouchers]);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'SALE':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'PURCHASE':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'RECEIPT':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'PAYMENT':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'CREDIT_NOTE':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'SALE':
        return 'Sales';
      case 'PURCHASE':
        return 'Purchase';
      case 'RECEIPT':
        return 'Receipt';
      case 'PAYMENT':
        return 'Payment';
      case 'CREDIT_NOTE':
        return 'Credit Note';
      case 'DEBIT_NOTE':
        return 'Debit Note';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Greeting & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>{greetingTime}, {userName}!</span>
            <span className="inline-block animate-wave text-2xl sm:text-3xl">👋</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Here's what's happening with your business today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Financial Year & Date Pill */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="text-left leading-tight">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{dateFormatted}</p>
              <p className="text-[10px] text-slate-400">{financialYearStr}</p>
            </div>
          </div>

          {/* Quick Create Voucher Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setShowVoucherMenu(!showVoucherMenu)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all min-h-[40px]"
            >
              <Plus className="w-4 h-4" />
              <span>Create Voucher</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showVoucherMenu ? 'rotate-180' : ''}`} />
            </button>

            {showVoucherMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 p-1.5 text-xs">
                <button
                  onClick={() => {
                    onOpenNewVoucher('SALE');
                    setShowVoucherMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium text-left"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Sales Invoice (GST / Bill)</span>
                </button>
                <button
                  onClick={() => {
                    onOpenNewVoucher('PURCHASE');
                    setShowVoucherMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-medium text-left"
                >
                  <ArrowDownRight className="w-4 h-4" />
                  <span>Purchase Bill (Inward)</span>
                </button>
                <button
                  onClick={() => {
                    onOpenNewVoucher('RECEIPT');
                    setShowVoucherMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium text-left"
                >
                  <IndianRupee className="w-4 h-4" />
                  <span>Money Receipt (From Customer)</span>
                </button>
                <button
                  onClick={() => {
                    onOpenNewVoucher('PAYMENT');
                    setShowVoucherMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium text-left"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Payment Disbursal (To Supplier)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Top 4 Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Total Sales */}
        <div
          onClick={() => onNavigate('sales')}
          className="p-3.5 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.5]" />
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">Total Sales</p>
            </div>
            <h3 className="text-base xs:text-lg sm:text-2xl font-extrabold font-mono text-slate-900 dark:text-slate-100 tracking-tight mt-2">
              {formatINR(totalSales)}
            </h3>
          </div>
          <div className="mt-2.5 pt-2 sm:mt-3 sm:pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>+12.5%</span>
            </span>
            <span className="text-slate-400 font-normal ml-1 hidden xs:inline">vs last mo</span>
          </div>
        </div>

        {/* Card 2: Total Purchases */}
        <div
          onClick={() => onNavigate('purchases')}
          className="p-3.5 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <ArrowDownRight className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.5]" />
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">Total Purchases</p>
            </div>
            <h3 className="text-base xs:text-lg sm:text-2xl font-extrabold font-mono text-slate-900 dark:text-slate-100 tracking-tight mt-2">
              {formatINR(totalPurchases)}
            </h3>
          </div>
          <div className="mt-2.5 pt-2 sm:mt-3 sm:pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center text-[10px] sm:text-[11px] font-semibold text-rose-600 dark:text-rose-400">
            <span className="flex items-center gap-0.5">
              <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>-8.2%</span>
            </span>
            <span className="text-slate-400 font-normal ml-1 hidden xs:inline">vs last mo</span>
          </div>
        </div>

        {/* Card 3: Receivables */}
        <div
          onClick={() => onNavigate('customers')}
          className="p-3.5 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <IndianRupee className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.5]" />
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">Receivables</p>
            </div>
            <h3 className="text-base xs:text-lg sm:text-2xl font-extrabold font-mono text-slate-900 dark:text-slate-100 tracking-tight mt-2">
              {formatINR(totalReceivables)}
            </h3>
          </div>
          <div className="mt-2.5 pt-2 sm:mt-3 sm:pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center text-[10px] sm:text-[11px] font-semibold text-blue-600 dark:text-blue-400">
            <span className="flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>+5.1%</span>
            </span>
            <span className="text-slate-400 font-normal ml-1 truncate">{debtorsWithDue.length} dues</span>
          </div>
        </div>

        {/* Card 4: Payables */}
        <div
          onClick={() => onNavigate('companies')}
          className="p-3.5 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.5]" />
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">Payables</p>
            </div>
            <h3 className="text-base xs:text-lg sm:text-2xl font-extrabold font-mono text-slate-900 dark:text-slate-100 tracking-tight mt-2">
              {formatINR(totalPayables)}
            </h3>
          </div>
          <div className="mt-2.5 pt-2 sm:mt-3 sm:pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center text-[10px] sm:text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            <span className="flex items-center gap-0.5">
              <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>-3.4%</span>
            </span>
            <span className="text-slate-400 font-normal ml-1 truncate">{creditorsWithDue.length} dues</span>
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Sales & Purchase Bar Chart (2/3 width) + Business Highlights (1/3 width) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Bar Chart */}
        <div className="lg:col-span-8 p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          {/* Chart Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                Sales &amp; Purchase Overview
              </h3>
            </div>

            <div className="flex items-center gap-4 text-xs">
              {/* Legend */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-blue-500 inline-block" />
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Sales</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Purchases</span>
                </div>
              </div>

              {/* Timeframe selector */}
              <select
                value={chartTimeframe}
                onChange={e => setChartTimeframe(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                <option value="6M">Last 6 Months</option>
                <option value="3M">Last 3 Months</option>
                <option value="1Y">This Year</option>
              </select>
            </div>
          </div>

          {/* SVG Bar Chart */}
          <div className="relative w-full h-64 sm:h-72">
            {/* Tooltip Popup */}
            {hoveredBarIndex !== null && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-slate-900 text-white text-xs font-mono rounded-lg shadow-lg pointer-events-none">
                <span className="font-sans font-bold capitalize mr-1 text-slate-300">
                  {chartData[hoveredBarIndex.monthIdx]?.label} {hoveredBarIndex.type}:
                </span>
                {formatINR(
                  hoveredBarIndex.type === 'sales'
                    ? chartData[hoveredBarIndex.monthIdx]?.sales || 0
                    : chartData[hoveredBarIndex.monthIdx]?.purchases || 0
                )}
              </div>
            )}

            {/* Grid Lines & Labels */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 pr-2">
              {[1, 0.75, 0.5, 0.25, 0].map((ratio, idx) => (
                <div key={idx} className="flex items-center gap-2 w-full text-[10px] text-slate-400 font-mono">
                  <span className="w-7 text-right">{formatYAxis(maxChartVal * ratio)}</span>
                  <div className="flex-1 border-b border-slate-100 dark:border-slate-800/80" />
                </div>
              ))}
            </div>

            {/* Bars Container */}
            <div className="absolute inset-0 pl-10 pr-4 pb-6 pt-2 flex items-end justify-between gap-2 sm:gap-4">
              {chartData.map((d, idx) => {
                const salesHeight = maxChartVal > 0 ? (d.sales / maxChartVal) * 100 : 0;
                const purchasesHeight = maxChartVal > 0 ? (d.purchases / maxChartVal) * 100 : 0;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                    {/* Bars pair */}
                    <div className="flex items-end justify-center gap-1 sm:gap-2 w-full h-full pb-1">
                      {/* Sales Bar */}
                      <div
                        onMouseEnter={() => setHoveredBarIndex({ monthIdx: idx, type: 'sales' })}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                        style={{ height: `${Math.max(4, salesHeight)}%` }}
                        className="w-1/2 max-w-[28px] bg-blue-500 hover:bg-blue-600 rounded-t-sm sm:rounded-t-md transition-all duration-300 relative cursor-pointer"
                      />

                      {/* Purchases Bar */}
                      <div
                        onMouseEnter={() => setHoveredBarIndex({ monthIdx: idx, type: 'purchases' })}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                        style={{ height: `${Math.max(4, purchasesHeight)}%` }}
                        className="w-1/2 max-w-[28px] bg-emerald-500 hover:bg-emerald-600 rounded-t-sm sm:rounded-t-md transition-all duration-300 relative cursor-pointer"
                      />
                    </div>

                    {/* Month Label */}
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-2">
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Business Highlights */}
        <div className="lg:col-span-4 p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">💡</span>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
              Business Highlights
            </h3>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {/* 1. Total Customers */}
            <div
              onClick={() => onNavigate('customers')}
              className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg">
                  <Users className="w-4 h-4" />
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Total Customers</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {customerDebtors.length}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  +3
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* 2. Total Suppliers */}
            <div
              onClick={() => onNavigate('companies')}
              className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg">
                  <Truck className="w-4 h-4" />
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Total Suppliers</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {supplierCreditors.length}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  +2
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* 3. Total Products */}
            <div
              onClick={() => onNavigate('inventory')}
              className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg">
                  <Boxes className="w-4 h-4" />
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Total Products</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {totalProductsCount}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  +8
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* 4. Total Vouchers */}
            <div
              onClick={() => onNavigate('daybook')}
              className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-lg">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Total Vouchers</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {vouchers.length}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  +{vouchers.length}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* 5. GST Payable */}
            <div
              onClick={() => onNavigate('gstr_reports')}
              className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-lg">
                  <Percent className="w-4 h-4" />
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">GST Payable (This Month)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {formatINR(netGstPayable)}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                  +6.2%
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* 6. Stock Value */}
            <div
              onClick={() => onNavigate('inventory')}
              className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-50 dark:bg-teal-950/40 text-teal-600 rounded-lg">
                  <Coins className="w-4 h-4" />
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Stock Value</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {formatINR(totalStockValue)}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  +4.1%
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Section: Recent Vouchers (6 cols) + Top Customers (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Vouchers */}
        <div className="lg:col-span-6 p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                Recent Vouchers
              </h3>
            </div>
            <button
              onClick={() => onNavigate('daybook')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>View All</span>
            </button>
          </div>

          <div className="w-full">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="pb-2.5 font-medium pr-1 sm:pr-2">Date</th>
                  <th className="pb-2.5 font-medium px-1 sm:px-2">Type</th>
                  <th className="pb-2.5 font-medium px-1 sm:px-2 hidden sm:table-cell">Voucher No</th>
                  <th className="pb-2.5 font-medium px-1 sm:px-2">Party</th>
                  <th className="pb-2.5 font-medium text-right pl-1 sm:pl-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {recentVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No transaction vouchers recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentVouchers.map(v => (
                    <tr
                      key={v.id}
                      onClick={() => onSelectVoucherForPrint(v)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 sm:py-3 text-slate-500 whitespace-nowrap text-[10px] sm:text-xs pr-1 sm:pr-2">
                        {v.date ? new Date(v.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                      </td>
                      <td className="py-2.5 sm:py-3 px-1 sm:px-2">
                        <span className={`inline-block px-1.5 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border ${getTypeBadge(v.type)}`}>
                          {getTypeName(v.type)}
                        </span>
                      </td>
                      <td className="py-2.5 sm:py-3 px-1 sm:px-2 font-mono font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap hidden sm:table-cell">
                        {v.voucherNo}
                      </td>
                      <td className="py-2.5 sm:py-3 px-1 sm:px-2 font-medium text-slate-700 dark:text-slate-300 max-w-[80px] xs:max-w-[110px] sm:max-w-[140px] truncate text-[11px] sm:text-xs">
                        {v.partyName || 'Cash / Direct'}
                      </td>
                      <td className="py-2.5 sm:py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap text-[11px] sm:text-xs pl-1 sm:pl-2">
                        {formatINR(v.grandTotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Top Customers */}
        <div className="lg:col-span-6 p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                Top Customers
              </h3>
            </div>
            <button
              onClick={() => onNavigate('customers')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>View All</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="pb-2.5 font-medium">Customer</th>
                  <th className="pb-2.5 font-medium text-right">Total Sales</th>
                  <th className="pb-2.5 font-medium text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {topCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">
                      No customer ledger accounts added yet.
                    </td>
                  </tr>
                ) : (
                  topCustomers.map(({ customer, totalSales, outstanding }) => (
                    <tr
                      key={customer.id}
                      onClick={() => onNavigate('customers')}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 font-medium text-slate-800 dark:text-slate-200">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">{customer.name}</p>
                          <p className="text-[10px] text-slate-400">{customer.phone || customer.gstin || 'Retail Customer'}</p>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatINR(totalSales)}
                      </td>
                      <td className="py-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={outstanding > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}>
                          {formatINR(Math.abs(outstanding))}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

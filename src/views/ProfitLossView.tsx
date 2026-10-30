import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  Printer,
  Calendar,
  Building,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { computeProfitAndLoss, formatINR } from '../utils/gstCalculations';

export const ProfitLossView: React.FC = () => {
  const { vouchers, inventory, ledgers, settings } = useAccounting();

  const report = useMemo(() => {
    return computeProfitAndLoss(vouchers, inventory, ledgers);
  }, [vouchers, inventory, ledgers]);

  const isNetProfit = report.netProfit >= 0;
  const isGrossProfit = report.grossProfit >= 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Profit &amp; Loss Statement (Nafa Nuqsan)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-calculated Trading Account, COGS, Gross Profit, and Net Operating Income
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-200 dark:border-slate-700 min-h-[40px]"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print P&amp;L Statement</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Net Sales Revenue
          </p>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {formatINR(report.netSales)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Gross {formatINR(report.grossSales)} - Returns {formatINR(report.salesReturns)}
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Cost of Goods Sold (COGS)
          </p>
          <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
            {formatINR(report.costOfGoodsSold)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Purchases + Direct Freight
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Gross Profit (Margin: {report.grossProfitMargin.toFixed(1)}%)
          </p>
          <p className={`text-xl font-bold font-mono mt-1 ${isGrossProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
            {formatINR(report.grossProfit)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Trading Account Margin
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Net Operating Profit ({report.netProfitMargin.toFixed(1)}%)
          </p>
          <p className={`text-xl font-bold font-mono mt-1 ${isNetProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
            {formatINR(report.netProfit)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            After Rent, Wages &amp; Utilities
          </span>
        </div>
      </div>

      {/* Traditional T-Form Accounting Layout (Trading & P&L Statement) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Side: Trading & Operating Debits (Expenses & Costs) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-xs uppercase tracking-wider text-rose-700 dark:text-rose-300">
              Debits / Expenses &amp; Direct Costs
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Amount (₹)</span>
          </div>

          <div className="p-4 space-y-4 text-xs font-mono">
            {/* Trading Section */}
            <div>
              <p className="font-bold text-[11px] uppercase tracking-wider text-slate-400 font-sans pb-1 border-b border-slate-100 dark:border-slate-800">
                Part I: Direct Manufacturing &amp; Trading Costs
              </p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-2 space-y-1">
                <div className="flex justify-between py-1 text-slate-700 dark:text-slate-300">
                  <span>To Opening Stock</span>
                  <span>{formatINR(report.openingStockValue)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700 dark:text-slate-300">
                  <span>To Gross Purchases</span>
                  <span>{formatINR(report.grossPurchases)}</span>
                </div>
                {report.purchaseReturns > 0 && (
                  <div className="flex justify-between py-1 text-slate-500">
                    <span>Less: Purchase Returns (Debit Notes)</span>
                    <span className="text-rose-500">-{formatINR(report.purchaseReturns)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 text-slate-700 dark:text-slate-300">
                  <span>To Direct Expenses (Freight &amp; Carriage)</span>
                  <span>{formatINR(report.directExpenses)}</span>
                </div>
                {isGrossProfit && (
                  <div className="flex justify-between py-1.5 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 rounded">
                    <span>To Gross Profit c/d (Trading Balance)</span>
                    <span>{formatINR(report.grossProfit)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* P&L Indirect Section */}
            <div className="pt-2">
              <p className="font-bold text-[11px] uppercase tracking-wider text-slate-400 font-sans pb-1 border-b border-slate-100 dark:border-slate-800">
                Part II: Indirect Operating Overheads
              </p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-2 space-y-1">
                {report.expenseBreakdown.map((exp, i) => (
                  <div key={i} className="flex justify-between py-1 text-slate-700 dark:text-slate-300">
                    <span>To {exp.name}</span>
                    <span>{formatINR(exp.amount)}</span>
                  </div>
                ))}
                {isNetProfit && (
                  <div className="flex justify-between py-2 font-bold text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 rounded mt-2">
                    <span>To Net Profit Transferred to Capital</span>
                    <span>{formatINR(report.netProfit)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Trading & Operating Credits (Revenues & Stock) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Credits / Sales Revenues &amp; Valuations
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Amount (₹)</span>
          </div>

          <div className="p-4 space-y-4 text-xs font-mono">
            {/* Trading Section */}
            <div>
              <p className="font-bold text-[11px] uppercase tracking-wider text-slate-400 font-sans pb-1 border-b border-slate-100 dark:border-slate-800">
                Part I: Sales &amp; Closing Inventory
              </p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-2 space-y-1">
                <div className="flex justify-between py-1 text-slate-700 dark:text-slate-300">
                  <span>By Gross Sales</span>
                  <span>{formatINR(report.grossSales)}</span>
                </div>
                {report.salesReturns > 0 && (
                  <div className="flex justify-between py-1 text-slate-500">
                    <span>Less: Sales Returns (Credit Notes)</span>
                    <span className="text-rose-500">-{formatINR(report.salesReturns)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 text-slate-700 dark:text-slate-300">
                  <span>By Closing Stock Valuation</span>
                  <span>{formatINR(report.closingStockValue)}</span>
                </div>
                {!isGrossProfit && (
                  <div className="flex justify-between py-1.5 font-bold text-rose-600 bg-rose-50/50 px-2 rounded">
                    <span>By Gross Loss c/d</span>
                    <span>{formatINR(Math.abs(report.grossProfit))}</span>
                  </div>
                )}
              </div>
            </div>

            {/* P&L Indirect Section */}
            <div className="pt-2">
              <p className="font-bold text-[11px] uppercase tracking-wider text-slate-400 font-sans pb-1 border-b border-slate-100 dark:border-slate-800">
                Part II: Operating Incomes &amp; Margins
              </p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-2 space-y-1">
                {isGrossProfit && (
                  <div className="flex justify-between py-1 text-slate-700 dark:text-slate-300 font-medium">
                    <span>By Gross Profit b/d</span>
                    <span>{formatINR(report.grossProfit)}</span>
                  </div>
                )}
                {report.indirectIncome > 0 && (
                  <div className="flex justify-between py-1 text-slate-700 dark:text-slate-300">
                    <span>By Indirect Income / Discounts Received</span>
                    <span>{formatINR(report.indirectIncome)}</span>
                  </div>
                )}
                {!isNetProfit && (
                  <div className="flex justify-between py-2 font-bold text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-2 rounded mt-2">
                    <span>By Net Loss Incurred</span>
                    <span>{formatINR(Math.abs(report.netProfit))}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

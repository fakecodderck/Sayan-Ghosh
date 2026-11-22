import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  FileCheck2,
  Table,
  Building
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { computeGSTR1Summary, computeGSTR3BSummary, formatINR } from '../utils/gstCalculations';

export const GSTRReportsView: React.FC = () => {
  const { vouchers, ledgers, settings } = useAccounting();

  const [activeTab, setActiveTab] = useState<'GSTR1' | 'GSTR3B'>('GSTR1');

  const gstr1 = useMemo(() => {
    return computeGSTR1Summary(vouchers, ledgers);
  }, [vouchers, ledgers]);

  const gstr3b = useMemo(() => {
    return computeGSTR3BSummary(vouchers, ledgers);
  }, [vouchers, ledgers]);

  const {
    itcCgst,
    itcSgst,
    itcIgst,
    totalItc,
    netCgstPayable,
    netSgstPayable,
    netIgstPayable,
    netTotalPayable,
  } = gstr3b;

  const downloadCSV = () => {
    const header = 'HSN,Description,Unit,Total Quantity,Taxable Value,GST Rate,CGST,SGST,IGST,Total Tax';
    const escapeCsv = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
    const rows = gstr1.hsnSummary.map(row =>
      [
        escapeCsv(row.hsn),
        escapeCsv(row.description),
        escapeCsv(row.unit),
        row.totalQty,
        row.taxableValue,
        `${row.gstRate}%`,
        row.cgst,
        row.sgst,
        row.igst,
        row.totalTax,
      ].join(',')
    );
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `GSTR1_HSN_Summary_${settings.gstin || 'report'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            GST Statutory Returns &amp; Tax Audit
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-compiled GSTR-1 (Outward Supplies &amp; HSN) and GSTR-3B (Tax Computation &amp; ITC)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="h-9 inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('GSTR1')}
              className={`h-7 px-3 text-xs font-semibold rounded-md transition-colors inline-flex items-center justify-center whitespace-nowrap ${
                activeTab === 'GSTR1'
                  ? 'bg-white dark:bg-slate-700 theme-text shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              GSTR-1 (Outward Sales &amp; HSN)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('GSTR3B')}
              className={`h-7 px-3 text-xs font-semibold rounded-md transition-colors inline-flex items-center justify-center whitespace-nowrap ${
                activeTab === 'GSTR3B'
                  ? 'bg-white dark:bg-slate-700 theme-text shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              GSTR-3B (Monthly Summary &amp; ITC)
            </button>
          </div>

          <button
            type="button"
            onClick={downloadCSV}
            className="h-9 inline-flex items-center justify-center gap-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {activeTab === 'GSTR1' ? (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Taxable Turnover
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {formatINR(gstr1.totalTaxable)}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Net of sales returns
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                CGST + SGST (Central/State)
              </p>
              <p className="text-xl font-bold font-mono tabular-nums theme-text mt-1">
                {formatINR(gstr1.totalCgst + gstr1.totalSgst)}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Intra-state sales tax
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                IGST (Integrated Tax)
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
                {formatINR(gstr1.totalIgst)}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Inter-state sales tax
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Output GST Liability
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {formatINR(gstr1.totalTax)}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Tax collected on outward bills
              </span>
            </div>
          </div>

          {/* Section Breakdown (B2B, B2C, Notes) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200">
                Table 4: B2B Invoices (With GSTIN)
              </h4>
              <div className="mt-2 space-y-1 font-mono tabular-nums text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Count:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{gstr1.b2bInvoicesCount}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Taxable:</span>
                  <span>{formatINR(gstr1.b2bTaxableValue)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tax:</span>
                  <span className="font-semibold theme-text">{formatINR(gstr1.b2bTaxAmount)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200">
                Table 7: B2C Invoices (Retail)
              </h4>
              <div className="mt-2 space-y-1 font-mono tabular-nums text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Count:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{gstr1.b2cInvoicesCount}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Taxable:</span>
                  <span>{formatINR(gstr1.b2cTaxableValue)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tax:</span>
                  <span className="font-semibold theme-text">{formatINR(gstr1.b2cTaxAmount)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200">
                Table 9B: Credit / Debit Notes
              </h4>
              <div className="mt-2 space-y-1 font-mono tabular-nums text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Count:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{gstr1.creditNotesCount}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Taxable:</span>
                  <span>{formatINR(gstr1.creditNotesTaxableValue)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tax:</span>
                  <span className="font-semibold text-rose-500">{formatINR(gstr1.creditNotesTaxAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table 12: HSN Summary of Outward Supplies */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex justify-between items-center">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Table 12: HSN-wise Summary of Outward Supplies
              </h3>
              <span className="text-[11px] text-slate-500">
                Mandatory for GST Portal GSTR-1 Filing
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-4 w-24">HSN Code</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 w-16 text-center">UQC</th>
                    <th className="py-2.5 px-3 w-24 text-right">Total Qty</th>
                    <th className="py-2.5 px-3 w-28 text-right">Taxable (₹)</th>
                    <th className="py-2.5 px-3 w-16 text-center">Rate</th>
                    <th className="py-2.5 px-3 w-24 text-right">CGST</th>
                    <th className="py-2.5 px-3 w-24 text-right">SGST</th>
                    <th className="py-2.5 px-3 w-24 text-right">IGST</th>
                    <th className="py-2.5 px-4 w-32 text-right font-bold text-slate-900 dark:text-slate-100">
                      Total Tax (₹)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono tabular-nums">
                  {gstr1.hsnSummary.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-400 font-sans">
                        No sales transactions recorded yet to compile HSN report.
                      </td>
                    </tr>
                  ) : (
                    gstr1.hsnSummary.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 font-bold theme-text">
                          {row.hsn}
                        </td>
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-900 dark:text-slate-200">
                          {row.description}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500">
                          {row.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {row.totalQty}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                          {formatINR(row.taxableValue)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {row.gstRate}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {formatINR(row.cgst)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {formatINR(row.sgst)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {formatINR(row.igst)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-950 dark:text-slate-100">
                          {formatINR(row.totalTax)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* GSTR-3B View */
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 pb-2 border-b border-slate-200 dark:border-slate-800">
              GSTR-3B Monthly Tax Computation &amp; Input Tax Credit (ITC)
            </h3>

            {/* Table 3.1 & 4.0 Comparison */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Tax Component</th>
                    <th className="py-3 px-4 text-right">3.1 Outward Liability (₹)</th>
                    <th className="py-3 px-4 text-right">4.0 Eligible ITC (₹)</th>
                    <th className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                      Net Tax Payable in Cash (₹)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900 dark:text-slate-200">
                      Central Tax (CGST)
                    </td>
                    <td className="py-3 px-4 text-right">{formatINR(gstr1.totalCgst)}</td>
                    <td className="py-3 px-4 text-right text-emerald-600">{formatINR(itcCgst)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatINR(netCgstPayable)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900 dark:text-slate-200">
                      State / UT Tax (SGST)
                    </td>
                    <td className="py-3 px-4 text-right">{formatINR(gstr1.totalSgst)}</td>
                    <td className="py-3 px-4 text-right text-emerald-600">{formatINR(itcSgst)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatINR(netSgstPayable)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900 dark:text-slate-200">
                      Integrated Tax (IGST)
                    </td>
                    <td className="py-3 px-4 text-right">{formatINR(gstr1.totalIgst)}</td>
                    <td className="py-3 px-4 text-right text-emerald-600">{formatINR(itcIgst)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatINR(netIgstPayable)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold text-sm">
                    <td className="py-3 px-4 font-sans text-slate-900 dark:text-slate-100">
                      Total Tax Payable
                    </td>
                    <td className="py-3 px-4 text-right">{formatINR(gstr1.totalTax)}</td>
                    <td className="py-3 px-4 text-right text-emerald-600">{formatINR(totalItc)}</td>
                    <td className="py-3 px-4 text-right theme-text">
                      {formatINR(netTotalPayable)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

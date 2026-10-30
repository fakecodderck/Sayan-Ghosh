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
import { computeGSTR1Summary, formatINR } from '../utils/gstCalculations';

export const GSTRReportsView: React.FC = () => {
  const { vouchers, ledgers, settings } = useAccounting();

  const [activeTab, setActiveTab] = useState<'GSTR1' | 'GSTR3B'>('GSTR1');

  const gstr1 = useMemo(() => {
    return computeGSTR1Summary(vouchers, ledgers);
  }, [vouchers, ledgers]);

  // Purchases for GSTR-3B ITC (Input Tax Credit)
  const purchases = vouchers.filter(v => v.type === 'PURCHASE');
  const itcCgst = purchases.reduce((acc, v) => acc + v.cgstTotal, 0);
  const itcSgst = purchases.reduce((acc, v) => acc + v.sgstTotal, 0);
  const itcIgst = purchases.reduce((acc, v) => acc + v.igstTotal, 0);
  const totalItc = itcCgst + itcSgst + itcIgst;

  // Net payable = Outward Tax - Eligible ITC
  const netCgstPayable = Math.max(0, gstr1.totalCgst - itcCgst);
  const netSgstPayable = Math.max(0, gstr1.totalSgst - itcSgst);
  const netIgstPayable = Math.max(0, gstr1.totalIgst - itcIgst);
  const netTotalPayable = netCgstPayable + netSgstPayable + netIgstPayable;

  const downloadCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'HSN,Description,Unit,Total Quantity,Taxable Value,GST Rate,CGST,SGST,IGST,Total Tax\n';

    gstr1.hsnSummary.forEach(row => {
      csvContent += `"${row.hsn}","${row.description}","${row.unit}",${row.totalQty},${row.taxableValue},${row.gstRate}%,${row.cgst},${row.sgst},${row.igst},${row.totalTax}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GSTR1_HSN_Summary_${settings.gstin}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            GST Statutory Returns &amp; Tax Audit
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-compiled GSTR-1 (Outward Supplies &amp; HSN) and GSTR-3B (Tax Computation &amp; ITC)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('GSTR1')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'GSTR1'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              GSTR-1 (Outward Sales &amp; HSN)
            </button>
            <button
              onClick={() => setActiveTab('GSTR3B')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'GSTR3B'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              GSTR-3B (Monthly Summary &amp; ITC)
            </button>
          </div>

          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {activeTab === 'GSTR1' ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Taxable Turnover
              </p>
              <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
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
              <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
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
              <p className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
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
              <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
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
              <div className="mt-2 space-y-1 font-mono text-xs">
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
                  <span className="font-semibold text-blue-600">{formatINR(gstr1.b2bTaxAmount)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200">
                Table 7: B2C Invoices (Retail)
              </h4>
              <div className="mt-2 space-y-1 font-mono text-xs">
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
                  <span className="font-semibold text-blue-600">{formatINR(gstr1.b2cTaxAmount)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200">
                Table 9B: Credit / Debit Notes
              </h4>
              <div className="mt-2 space-y-1 font-mono text-xs">
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
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
                  {gstr1.hsnSummary.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-sans">
                        No sales transactions recorded yet to compile HSN report.
                      </td>
                    </tr>
                  ) : (
                    gstr1.hsnSummary.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 font-bold text-blue-600 dark:text-blue-400">
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
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 pb-2 border-b border-slate-200 dark:border-slate-800">
              GSTR-3B Monthly Tax Computation &amp; Input Tax Credit (ITC)
            </h3>

            {/* Table 3.1 & 4.0 Comparison */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
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
                    <td className="py-3 px-4 text-right text-blue-600 dark:text-blue-400">
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

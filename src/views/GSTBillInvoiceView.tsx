import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  Printer,
  Sliders,
  QrCode,
  Building,
  Check,
  Eye,
  FileText,
  RotateCw,
  Search,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { TransactionVoucher } from '../types/accounting';
import { formatINR, numberToWordsINR } from '../utils/gstCalculations';

interface GSTBillInvoiceViewProps {
  onOpenNewInvoice?: (isGst?: boolean) => void;
}

export const GSTBillInvoiceView: React.FC<GSTBillInvoiceViewProps> = ({
  onOpenNewInvoice,
}) => {
  const { vouchers, settings, updateSettings, getLedgerById } = useAccounting();

  // Filter all goods invoices (Sales, Purchases, Credit/Debit Notes)
  const allInvoices = useMemo(() => {
    return vouchers.filter(v => ['SALE', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(v.type));
  }, [vouchers]);

  const [docTypeFilter, setDocTypeFilter] = useState<'SALE' | 'PURCHASE' | 'ALL'>('SALE');
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');

  // Invoices matching current filter
  const filteredInvoiceList = useMemo(() => {
    return allInvoices.filter(v => {
      if (docTypeFilter === 'SALE' && v.type !== 'SALE') return false;
      if (docTypeFilter === 'PURCHASE' && v.type !== 'PURCHASE') return false;

      if (invoiceSearchQuery.trim()) {
        const query = invoiceSearchQuery.toLowerCase().trim();
        const party = v.partyId ? getLedgerById(v.partyId) : undefined;
        const partyName = (v.partyName || party?.name || '').toLowerCase();
        const voucherNo = (v.voucherNo || '').toLowerCase();
        return voucherNo.includes(query) || partyName.includes(query);
      }
      return true;
    });
  }, [allInvoices, docTypeFilter, invoiceSearchQuery, getLedgerById]);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    filteredInvoiceList[0]?.id || allInvoices[0]?.id || ''
  );

  // Active selected invoice object
  const currentInvoice = useMemo(() => {
    return vouchers.find(v => v.id === selectedInvoiceId) || filteredInvoiceList[0] || allInvoices[0];
  }, [vouchers, selectedInvoiceId, filteredInvoiceList, allInvoices]);

  const party = currentInvoice?.partyId ? getLedgerById(currentInvoice.partyId) : undefined;

  // Live customizable invoice options
  const [paperSize, setPaperSize] = useState<'A5' | 'A4'>('A5');
  const [showQrCode, setShowQrCode] = useState(true);
  const [showBankDetails, setShowBankDetails] = useState(true);
  const [showHsnSummary, setShowHsnSummary] = useState(true);
  const [customHeaderTitle, setCustomHeaderTitle] = useState(() => {
    if (currentInvoice?.type === 'PURCHASE') return 'PURCHASE INWARD VOUCHER';
    if (currentInvoice?.type === 'CREDIT_NOTE') return 'CREDIT NOTE';
    if (currentInvoice?.type === 'DEBIT_NOTE') return 'DEBIT NOTE';
    return 'TAX INVOICE';
  });
  const [isSavedSettings, setIsSavedSettings] = useState(false);

  // Group items by HSN
  const hsnBreakup: Record<
    string,
    {
      hsn: string;
      taxableAmount: number;
      gstRate: number;
      cgst: number;
      sgst: number;
      igst: number;
      totalTax: number;
    }
  > = {};

  (currentInvoice?.items || []).forEach(item => {
    const key = `${item.hsn || '9999'}_${item.gstRate}`;
    if (!hsnBreakup[key]) {
      hsnBreakup[key] = {
        hsn: item.hsn || '9999',
        taxableAmount: 0,
        gstRate: item.gstRate,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
      };
    }
    hsnBreakup[key].taxableAmount += item.taxableAmount;
    hsnBreakup[key].cgst += item.cgst;
    hsnBreakup[key].sgst += item.sgst;
    hsnBreakup[key].igst += item.igst;
    hsnBreakup[key].totalTax += item.cgst + item.sgst + item.igst;
  });

  const handlePrint = () => {
    window.print();
  };

  const handleSaveDefaults = async () => {
    await updateSettings({
      ...settings,
      paperSize,
      showQrCode,
    });
    setIsSavedSettings(true);
    setTimeout(() => setIsSavedSettings(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-blue-600" />
            <span>GST Bill &amp; Invoice Customization Station</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select, customize, and print/download any generated Sales Invoice or Purchase Bill
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenNewInvoice && (
            <button
              onClick={() => onOpenNewInvoice(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px]"
            >
              <FileText className="w-4 h-4" />
              <span>+ Generate New Bill</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px]"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice Now</span>
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column Controls */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 text-xs">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>Invoice Selection &amp; Customization</span>
            </h3>

            {/* Invoice Category Selector Tabs */}
            <div className="space-y-2">
              <label className="block font-medium text-slate-600 dark:text-slate-400">
                Select Invoice Document
              </label>

              {/* Type Filter Buttons */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setDocTypeFilter('SALE')}
                  className={`flex-1 py-1 px-2 rounded-md transition-all ${
                    docTypeFilter === 'SALE'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  Sales ({allInvoices.filter(v => v.type === 'SALE').length})
                </button>
                <button
                  type="button"
                  onClick={() => setDocTypeFilter('PURCHASE')}
                  className={`flex-1 py-1 px-2 rounded-md transition-all ${
                    docTypeFilter === 'PURCHASE'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  Purchases ({allInvoices.filter(v => v.type === 'PURCHASE').length})
                </button>
                <button
                  type="button"
                  onClick={() => setDocTypeFilter('ALL')}
                  className={`flex-1 py-1 px-2 rounded-md transition-all ${
                    docTypeFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  All ({allInvoices.length})
                </button>
              </div>

              {/* Filter Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Quick search invoice no or party..."
                  value={invoiceSearchQuery}
                  onChange={e => setInvoiceSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px]"
                />
              </div>

              {/* Visual Invoice List Selector (Non-overflowing smooth list) */}
              <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                {filteredInvoiceList.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-[11px]">
                    No invoices matching query.
                  </div>
                ) : (
                  filteredInvoiceList.map(inv => {
                    const isSelected = inv.id === currentInvoice?.id;
                    return (
                      <button
                        key={inv.id}
                        type="button"
                        onClick={() => {
                          setSelectedInvoiceId(inv.id);
                          if (inv.type === 'PURCHASE') setCustomHeaderTitle('PURCHASE INWARD VOUCHER');
                          else if (inv.type === 'CREDIT_NOTE') setCustomHeaderTitle('CREDIT NOTE');
                          else if (inv.type === 'DEBIT_NOTE') setCustomHeaderTitle('DEBIT NOTE');
                          else setCustomHeaderTitle('TAX INVOICE');
                        }}
                        className={`w-full p-2 text-left transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/60 border-l-4 border-blue-600 font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              {inv.voucherNo}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              inv.type === 'SALE'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}>
                              {inv.type === 'SALE' ? 'Sale' : inv.type === 'PURCHASE' ? 'Pur' : 'Note'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">
                            {inv.partyName || 'Cash Party'} · {inv.date}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                            {formatINR(inv.grandTotal)}
                          </p>
                          {isSelected && (
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-pulse mt-1" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Paper Dimension Toggle */}
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Print Paper Dimension
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaperSize('A5')}
                  className={`py-2 px-3 rounded-lg border text-center transition-all ${
                    paperSize === 'A5'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs">A5 Portrait</p>
                  <p className="text-[10px] text-slate-400 font-mono">148 × 210 mm</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperSize('A4')}
                  className={`py-2 px-3 rounded-lg border text-center transition-all ${
                    paperSize === 'A4'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs">A4 Standard</p>
                  <p className="text-[10px] text-slate-400 font-mono">210 × 297 mm</p>
                </button>
              </div>
            </div>

            {/* Layout Element Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Visible Layout Elements
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showQrCode}
                  onChange={e => setShowQrCode(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  Include UPI Payment QR Code
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBankDetails}
                  onChange={e => setShowBankDetails(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  Print Bank Account Details (IFSC/A/c)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showHsnSummary}
                  onChange={e => setShowHsnSummary(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  Print HSN / SAC Tax Slab Breakup Table
                </span>
              </label>
            </div>

            {/* Title override */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Invoice Heading Label
              </label>
              <input
                type="text"
                value={customHeaderTitle}
                onChange={e => setCustomHeaderTitle(e.target.value)}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveDefaults}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-300 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              {isSavedSettings ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Saved as Default Format!</span>
                </>
              ) : (
                <span>Save Formatting as Company Default</span>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Printable Sheet Viewport (Responsive auto-fit) */}
        <div className="lg:col-span-8 bg-slate-200 dark:bg-slate-950 p-3 sm:p-6 rounded-xl flex justify-center overflow-x-auto shadow-inner w-full max-w-full">
          {currentInvoice ? (
            <div
              className="print-only-container bg-white text-slate-900 p-4 sm:p-6 shadow-xl border border-slate-300 font-sans text-xs leading-relaxed transition-all w-full max-w-[650px] min-h-[700px]"
            >
              {/* Top Banner */}
              <div className="border-b-2 border-slate-900 pb-3 mb-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="max-w-[65%]">
                    <h1 className="text-sm sm:text-base font-bold uppercase tracking-tight text-slate-950">
                      {settings.name}
                    </h1>
                    <p className="text-[10px] text-slate-600 leading-tight mt-0.5">
                      {settings.address}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-medium text-slate-800 mt-1">
                      <span>GSTIN: <strong className="font-mono">{settings.gstin}</strong></span>
                      <span>State: {settings.state} ({settings.stateCode})</span>
                      <span>Ph: {settings.phone}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="inline-block px-2.5 py-1 bg-slate-900 text-white text-[9px] sm:text-[10px] font-bold tracking-wider rounded-xs uppercase">
                      {customHeaderTitle}
                    </div>
                    <div className="mt-2 text-[10px] text-slate-700 space-y-0.5 font-mono">
                      <p><strong>Doc No:</strong> {currentInvoice.voucherNo}</p>
                      <p><strong>Date:</strong> {currentInvoice.date}</p>
                      <p><strong>Payment Mode:</strong> {currentInvoice.paymentMode}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Party & Dispatch Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-300 p-2.5 rounded-xs mb-3 bg-slate-50/50 text-[10px]">
                <div>
                  <p className="uppercase font-bold text-slate-500 tracking-wider">
                    {currentInvoice.type === 'PURCHASE' ? 'Supplier (Vendor) Details' : 'Customer (Buyer) Details'}
                  </p>
                  <p className="font-bold text-slate-950 text-xs mt-0.5">
                    {party?.name || currentInvoice.partyName || 'Cash Party'}
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    {party?.address || 'Local Transaction'}
                  </p>
                  <p className="mt-1">
                    GSTIN: <strong className="font-mono">{party?.gstin || 'Unregistered B2C'}</strong>
                  </p>
                  <p>State: Code {party?.stateCode || settings.stateCode}</p>
                </div>

                <div className="sm:border-l border-slate-200 sm:pl-3 pt-2 sm:pt-0 border-t sm:border-t-0">
                  <p className="uppercase font-bold text-slate-500 tracking-wider">
                    Business Address
                  </p>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {settings.name}
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    {settings.address}
                  </p>
                  {currentInvoice.notes && (
                    <p className="text-slate-500 italic mt-1 border-t border-slate-200 pt-0.5">
                      Remark: {currentInvoice.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-300 rounded-xs overflow-x-auto mb-3">
                <table className="w-full text-left border-collapse print-table text-[10px] min-w-[420px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 uppercase">
                      <th className="py-1 px-1.5 w-6 text-center border-r border-slate-200">#</th>
                      <th className="py-1 px-2 border-r border-slate-200">Description of Goods</th>
                      <th className="py-1 px-1.5 w-14 text-center border-r border-slate-200">HSN</th>
                      <th className="py-1 px-1.5 w-10 text-right border-r border-slate-200">Qty</th>
                      <th className="py-1 px-1.5 w-16 text-right border-r border-slate-200">
                        {currentInvoice.isGstInclusive ? 'Rate (Incl)' : 'Rate'}
                      </th>
                      <th className="py-1 px-2 w-16 text-right border-r border-slate-200">Taxable</th>
                      <th className="py-1 px-1.5 w-10 text-center border-r border-slate-200">GST</th>
                      <th className="py-1 px-2 w-18 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[10px]">
                    {(currentInvoice.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1 px-1 text-center text-slate-500 border-r border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200 font-medium">
                          {item.name}
                        </td>
                        <td className="py-1 px-1.5 text-center font-mono border-r border-slate-200">
                          {item.hsn}
                        </td>
                        <td className="py-1 px-1.5 text-right font-mono border-r border-slate-200">
                          {item.qty} {item.unit}
                        </td>
                        <td className="py-1 px-1.5 text-right font-mono border-r border-slate-200">
                          {item.rate.toFixed(2)}
                        </td>
                        <td className="py-1 px-2 text-right font-mono border-r border-slate-200">
                          {item.taxableAmount.toFixed(2)}
                        </td>
                        <td className="py-1 px-1.5 text-center font-mono border-r border-slate-200">
                          {item.gstRate}%
                        </td>
                        <td className="py-1 px-2 text-right font-mono font-bold text-slate-950">
                          {item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Amount in words & Totals */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-3">
                <div className="sm:col-span-7 flex flex-col justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase text-slate-500">
                      Amount in words:
                    </p>
                    <p className="font-semibold text-slate-900 italic text-[10px] mt-0.5">
                      {numberToWordsINR(currentInvoice.grandTotal)}
                    </p>
                  </div>

                  {showBankDetails && (
                    <div className="border border-slate-200 p-2 rounded-xs bg-slate-50 text-[9px] font-mono mt-2">
                      <p className="font-bold uppercase text-slate-700">Bank Details for Transfer:</p>
                      <p>Bank: {settings.bankName} · A/c: {settings.accountNo}</p>
                      <p>IFSC: {settings.ifsc} · UPI: {settings.upiId}</p>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-5 border border-slate-300 rounded-xs p-2 bg-slate-50 font-mono text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>Taxable Subtotal:</span>
                    <span>{formatINR(currentInvoice.subtotal)}</span>
                  </div>
                  {currentInvoice.cgstTotal > 0 && (
                    <div className="flex justify-between">
                      <span>CGST:</span>
                      <span>{formatINR(currentInvoice.cgstTotal)}</span>
                    </div>
                  )}
                  {currentInvoice.sgstTotal > 0 && (
                    <div className="flex justify-between">
                      <span>SGST:</span>
                      <span>{formatINR(currentInvoice.sgstTotal)}</span>
                    </div>
                  )}
                  {currentInvoice.igstTotal > 0 && (
                    <div className="flex justify-between">
                      <span>IGST:</span>
                      <span>{formatINR(currentInvoice.igstTotal)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-900 pt-1 flex justify-between font-bold text-xs text-slate-950">
                    <span>Grand Total:</span>
                    <span>{formatINR(currentInvoice.grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* HSN Table if enabled */}
              {showHsnSummary && Object.keys(hsnBreakup).length > 0 && (
                <div className="border border-slate-200 rounded-xs mb-3 text-[9px] overflow-x-auto">
                  <div className="bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                    HSN / SAC Summary Breakdown
                  </div>
                  <table className="w-full text-center border-collapse min-w-[360px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-semibold">
                        <th className="py-0.5 px-1">HSN</th>
                        <th className="py-0.5 px-1">Taxable</th>
                        <th className="py-0.5 px-1">Rate</th>
                        <th className="py-0.5 px-1">CGST</th>
                        <th className="py-0.5 px-1">SGST</th>
                        <th className="py-0.5 px-1">IGST</th>
                        <th className="py-0.5 px-1">Tax Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {Object.values(hsnBreakup).map((h, i) => (
                        <tr key={i}>
                          <td className="py-0.5 px-1">{h.hsn}</td>
                          <td className="py-0.5 px-1">{h.taxableAmount.toFixed(2)}</td>
                          <td className="py-0.5 px-1">{h.gstRate}%</td>
                          <td className="py-0.5 px-1">{h.cgst.toFixed(2)}</td>
                          <td className="py-0.5 px-1">{h.sgst.toFixed(2)}</td>
                          <td className="py-0.5 px-1">{h.igst.toFixed(2)}</td>
                          <td className="py-0.5 px-1 font-bold">{h.totalTax.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Terms and Signatory Footer */}
              <div className="grid grid-cols-12 gap-3 pt-2 border-t border-slate-300 text-[9px]">
                <div className="col-span-7">
                  <p className="font-bold uppercase text-slate-600">Declaration &amp; Terms:</p>
                  <p className="text-slate-500 whitespace-pre-line leading-tight mt-0.5">
                    {settings.invoiceTerms}
                  </p>
                </div>

                <div className="col-span-5 text-right flex flex-col justify-between items-end">
                  <p className="font-semibold text-slate-800">
                    {settings.authorizedSignatoryTitle}
                  </p>
                  <div className="mt-6 border-t border-slate-400 w-32 sm:w-36 pt-0.5 text-center text-slate-500">
                    Authorized Signatory
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-slate-400 text-center">
              No invoice document selected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useRef, useState } from 'react';
import {
  Printer,
  X,
  Building,
  FileText,
  Copy,
  Check,
  CheckCircle2,
  Share2
} from 'lucide-react';
import { TransactionVoucher } from '../types/accounting';
import { formatINR, numberToWordsINR } from '../utils/gstCalculations';
import { useAccounting } from '../context/AccountingContext';

interface InvoicePrintModalProps {
  voucher: TransactionVoucher | null;
  onClose: () => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({ voucher, onClose }) => {
  const { settings, getLedgerById } = useAccounting();
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [paperSize, setPaperSize] = useState<'A5' | 'A4'>(settings.paperSize || 'A5');
  const [copied, setCopied] = useState(false);

  if (!voucher) return null;

  const party = voucher.partyId ? getLedgerById(voucher.partyId) : undefined;

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  const handleCopySummary = () => {
    const text = `*${settings.name}*\n` +
      `Doc: ${voucher.voucherNo} (${voucher.type})\n` +
      `Date: ${voucher.date}\n` +
      `Party: ${party?.name || voucher.partyName || 'Cash'}\n` +
      `Amount: ${formatINR(voucher.grandTotal)}\n` +
      `Payment Mode: ${voucher.paymentMode}\n` +
      (voucher.referenceNo ? `Ref: ${voucher.referenceNo}\n` : '') +
      `Thank you for your business!`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isSale = voucher.type === 'SALE';
  const isCreditNote = voucher.type === 'CREDIT_NOTE';
  const isDebitNote = voucher.type === 'DEBIT_NOTE';
  const isPurchase = voucher.type === 'PURCHASE';
  const isPayment = voucher.type === 'PAYMENT';
  const isReceipt = voucher.type === 'RECEIPT';
  const isGoodsDoc = isSale || isPurchase || isCreditNote || isDebitNote;

  let docTitle = 'TAX INVOICE';
  if (isCreditNote) docTitle = 'CREDIT NOTE (SALES RETURN)';
  else if (isDebitNote) docTitle = 'DEBIT NOTE (PURCHASE RETURN)';
  else if (isPurchase) docTitle = 'PURCHASE INWARD VOUCHER';
  else if (isPayment) docTitle = 'PAYMENT DISBURSAL VOUCHER';
  else if (isReceipt) docTitle = 'MONEY RECEIPT VOUCHER';

  // Group items by HSN for goods transactions
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

  if (isGoodsDoc) {
    (voucher.items || []).forEach(item => {
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
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
    >
      {/* Dynamic Print CSS for chosen Paper Size */}
      <style>{`
        @media print {
          @page {
            size: ${paperSize} portrait;
            margin: 5mm;
          }
        }
      `}</style>

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-3.5 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate">
                {docTitle} ({paperSize} Format)
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate font-mono">
                #{voucher.voucherNo} · {voucher.date}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Paper Size Switcher */}
            <div className="hidden xs:flex items-center p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <button
                onClick={() => setPaperSize('A5')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  paperSize === 'A5' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold' : ''
                }`}
              >
                A5
              </button>
              <button
                onClick={() => setPaperSize('A4')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  paperSize === 'A4' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold' : ''
                }`}
              >
                A4
              </button>
            </div>

            {/* Quick Copy Summary Button */}
            <button
              onClick={handleCopySummary}
              title="Copy Summary to Clipboard"
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center gap-1.5 text-xs font-medium"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs transition-all min-h-[36px] whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>Print {paperSize}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Preview Viewport (Scrollable with responsive padding) */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-6 md:p-8 bg-slate-100 dark:bg-slate-950/60 flex justify-center">
          <div
            ref={printAreaRef}
            className="print-only-container w-full max-w-[650px] bg-white text-slate-900 p-4 sm:p-6 shadow-sm border border-slate-300 font-sans text-xs leading-relaxed rounded-xs"
          >
            {/* Header: Company & Tax Header */}
            <div className="border-b-2 border-slate-900 pb-3 mb-3">
              <div className="flex justify-between items-start gap-3">
                <div className="max-w-[65%]">
                  <h1 className="text-sm sm:text-base font-extrabold uppercase tracking-tight text-slate-950">
                    {settings.name || 'Apex Traders & Distributors'}
                  </h1>
                  {settings.address && (
                    <p className="text-[10px] text-slate-600 leading-tight mt-0.5">
                      {settings.address}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-medium text-slate-800 mt-1">
                    {settings.gstin && (
                      <span>GSTIN: <strong className="font-mono">{settings.gstin}</strong></span>
                    )}
                    {settings.state && (
                      <span>State: {settings.state} ({settings.stateCode})</span>
                    )}
                    {settings.phone && <span>Ph: {settings.phone}</span>}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="inline-block px-2.5 py-1 bg-slate-900 text-white text-[9px] sm:text-[10px] font-bold tracking-wider rounded-xs uppercase">
                    {docTitle}
                  </div>
                  <div className="mt-2 text-[10px] text-slate-700 space-y-0.5 font-mono">
                    <p><strong>Doc No:</strong> {voucher.voucherNo}</p>
                    <p><strong>Date:</strong> {voucher.date}</p>
                    <p><strong>Mode:</strong> {voucher.paymentMode}</p>
                    {voucher.referenceNo && <p><strong>Ref No:</strong> {voucher.referenceNo}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Bill To / Party Details */}
            <div className="border border-slate-300 p-2.5 rounded-xs mb-3 bg-slate-50/50 text-[10px]">
              <p className="uppercase font-bold text-slate-500 tracking-wider">
                {isPayment ? 'Paid To (Beneficiary)' : isReceipt ? 'Received From (Customer)' : 'Billed To (Party Details)'}
              </p>
              <p className="font-bold text-slate-950 text-xs sm:text-sm mt-0.5">
                {party?.name || voucher.partyName || (isPayment ? 'Expense Payment' : 'Cash Party')}
              </p>
              {party?.address && (
                <p className="text-slate-600 mt-0.5">{party.address}</p>
              )}
              <div className="mt-1 flex flex-wrap gap-x-3 text-slate-700">
                {party?.gstin && <p>GSTIN: <strong className="font-mono">{party.gstin}</strong></p>}
                {party?.stateCode && <p>State Code: {party.stateCode}</p>}
                {party?.phone && <p>Ph: {party.phone}</p>}
              </div>
              {voucher.notes && (
                <p className="text-[10px] text-slate-500 italic mt-1.5 border-t border-slate-200 pt-1">
                  Remark: {voucher.notes}
                </p>
              )}
            </div>

            {/* Conditional Content: Goods Invoice Table vs Payment/Receipt Details */}
            {isGoodsDoc ? (
              <>
                {/* Items Table (Responsive with smooth horizontal scroll on tiny screens) */}
                <div className="border border-slate-300 rounded-xs overflow-x-auto mb-3">
                  <table className="w-full text-left border-collapse print-table text-[10px] min-w-[440px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 uppercase">
                        <th className="py-1.5 px-2 w-7 text-center border-r border-slate-200">#</th>
                        <th className="py-1.5 px-2 border-r border-slate-200">Item Description</th>
                        <th className="py-1.5 px-2 w-14 text-center border-r border-slate-200">HSN</th>
                        <th className="py-1.5 px-2 w-12 text-right border-r border-slate-200">Qty</th>
                        <th className="py-1.5 px-2 w-14 text-right border-r border-slate-200">Rate</th>
                        <th className="py-1.5 px-2 w-16 text-right border-r border-slate-200">Taxable</th>
                        <th className="py-1.5 px-2 w-10 text-center border-r border-slate-200">GST</th>
                        <th className="py-1.5 px-2 w-18 text-right">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(voucher.items || []).map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-1 px-1.5 text-center text-slate-500 border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 font-medium text-slate-900">
                            {item.name}
                          </td>
                          <td className="py-1 px-2 text-center font-mono text-slate-600 border-r border-slate-200">
                            {item.hsn || '-'}
                          </td>
                          <td className="py-1 px-2 text-right font-mono border-r border-slate-200">
                            {item.qty} {item.unit}
                          </td>
                          <td className="py-1 px-2 text-right font-mono border-r border-slate-200">
                            {item.rate.toFixed(2)}
                          </td>
                          <td className="py-1 px-2 text-right font-mono border-r border-slate-200">
                            {item.taxableAmount.toFixed(2)}
                          </td>
                          <td className="py-1 px-2 text-center font-mono border-r border-slate-200">
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

                {/* Subtotal & Tax Breakdown */}
                <div className="grid grid-cols-12 gap-3 mb-3 text-[10px]">
                  <div className="col-span-12 sm:col-span-7 flex flex-col justify-between order-2 sm:order-1">
                    <div>
                      <p className="font-bold uppercase text-slate-500">
                        Amount Chargeable (in words):
                      </p>
                      <p className="font-semibold text-slate-900 italic mt-0.5">
                        {numberToWordsINR(voucher.grandTotal)}
                      </p>
                    </div>

                    {/* Bank / UPI Details */}
                    {settings.bankName && (
                      <div className="border border-slate-200 p-2 rounded-xs bg-slate-50 font-mono mt-2 text-[9px]">
                        <p className="font-bold uppercase text-slate-700 flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-blue-600" />
                          Electronic Payment (Bank / UPI)
                        </p>
                        <p className="mt-0.5">Bank: <strong>{settings.bankName}</strong> · A/c: <strong>{settings.accountNo}</strong></p>
                        <p>IFSC: <strong>{settings.ifsc}</strong> {settings.upiId && `· UPI: ${settings.upiId}`}</p>
                      </div>
                    )}
                  </div>

                  <div className="col-span-12 sm:col-span-5 border border-slate-300 rounded-xs p-2.5 bg-slate-50/70 font-mono space-y-1 order-1 sm:order-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatINR(voucher.subtotal)}</span>
                    </div>
                    {voucher.cgstTotal > 0 && (
                      <div className="flex justify-between">
                        <span>CGST:</span>
                        <span>{formatINR(voucher.cgstTotal)}</span>
                      </div>
                    )}
                    {voucher.sgstTotal > 0 && (
                      <div className="flex justify-between">
                        <span>SGST:</span>
                        <span>{formatINR(voucher.sgstTotal)}</span>
                      </div>
                    )}
                    {voucher.igstTotal > 0 && (
                      <div className="flex justify-between">
                        <span>IGST:</span>
                        <span>{formatINR(voucher.igstTotal)}</span>
                      </div>
                    )}
                    <div className="border-t-2 border-slate-900 pt-1.5 flex justify-between font-bold text-xs sm:text-sm text-slate-950">
                      <span>Grand Total:</span>
                      <span>{formatINR(voucher.grandTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* HSN Summary Table */}
                {Object.keys(hsnBreakup).length > 0 && (
                  <div className="border border-slate-200 rounded-xs mb-3 text-[9px] overflow-x-auto">
                    <div className="bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                      HSN / SAC Tax Breakdown Summary
                    </div>
                    <table className="w-full text-center border-collapse min-w-[380px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="py-0.5 px-1">HSN/SAC</th>
                          <th className="py-0.5 px-1">Taxable</th>
                          <th className="py-0.5 px-1">Rate</th>
                          <th className="py-0.5 px-1">CGST</th>
                          <th className="py-0.5 px-1">SGST</th>
                          <th className="py-0.5 px-1">IGST</th>
                          <th className="py-0.5 px-1">Total Tax</th>
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
                            <td className="py-0.5 px-1 font-semibold">{h.totalTax.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              /* Payment or Receipt Voucher Body */
              <div className="border border-slate-300 rounded-xs p-4 mb-4 bg-slate-50/40 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-600 uppercase text-[10px]">Payment Mode</span>
                  <span className="font-mono font-bold text-slate-900 bg-slate-200/80 px-2.5 py-0.5 rounded-sm">
                    {voucher.paymentMode}
                  </span>
                </div>
                {voucher.referenceNo && (
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[10px]">
                    <span className="font-semibold text-slate-600">Cheque / UTR / Reference No:</span>
                    <span className="font-mono font-bold text-slate-900">{voucher.referenceNo}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-600 uppercase text-[10px]">Settlement Amount</span>
                  <span className="font-mono font-extrabold text-base sm:text-lg text-slate-950">
                    {formatINR(voucher.grandTotal)}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 uppercase text-[9px] block">Amount in Words:</span>
                  <p className="font-semibold text-slate-900 italic mt-0.5 text-xs">
                    {numberToWordsINR(voucher.grandTotal)}
                  </p>
                </div>
              </div>
            )}

            {/* Terms and Signatory Footer */}
            <div className="grid grid-cols-12 gap-3 pt-3 border-t border-slate-300 text-[9px]">
              <div className="col-span-7">
                <p className="font-bold uppercase text-slate-600">Terms &amp; Declaration:</p>
                <p className="text-slate-500 whitespace-pre-line leading-tight mt-0.5">
                  {settings.invoiceTerms || '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction only.'}
                </p>
              </div>

              <div className="col-span-5 text-right flex flex-col justify-between items-end">
                <p className="font-semibold text-slate-800">
                  {settings.authorizedSignatoryTitle || `For ${settings.name}`}
                </p>
                <div className="mt-8 border-t border-slate-400 w-32 sm:w-36 pt-0.5 text-center text-slate-500">
                  Authorized Signatory
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useRef } from 'react';
import {
  Printer,
  X,
  Building,
  FileText
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

  if (!voucher) return null;

  const party = voucher.partyId ? getLedgerById(voucher.partyId) : undefined;

  const handlePrint = () => {
    window.print();
  };

  const isSale = voucher.type === 'SALE';
  const isCreditNote = voucher.type === 'CREDIT_NOTE';
  const isDebitNote = voucher.type === 'DEBIT_NOTE';
  const isPurchase = voucher.type === 'PURCHASE';

  let docTitle = 'TAX INVOICE';
  if (isCreditNote) docTitle = 'CREDIT NOTE (SALES RETURN)';
  else if (isDebitNote) docTitle = 'DEBIT NOTE (PURCHASE RETURN)';
  else if (isPurchase) docTitle = 'PURCHASE VOUCHER';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      {/* Control Bar & Preview Container */}
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 my-4 sm:my-8 overflow-hidden">
        <div className="no-print flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5 truncate mr-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate">
                GST Tax Invoice (A5 Paper Print)
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                #{voucher.voucherNo} · {voucher.date}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all min-h-[38px] whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>Print A5</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg min-w-[38px] min-h-[38px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Container (Designed specifically for A5 dimensions) */}
        <div className="p-3 sm:p-6 md:p-8 bg-slate-100 dark:bg-slate-950/60 overflow-x-auto flex justify-center">
          <div
            ref={printAreaRef}
            className="print-only-container w-full max-w-[650px] min-w-[500px] bg-white text-slate-900 p-5 sm:p-6 shadow-sm border border-slate-300 font-sans text-xs leading-relaxed"
            style={{ minHeight: '750px' }}
          >
            {/* Header: Company & Tax Header */}
            <div className="border-b-2 border-slate-900 pb-3 mb-3">
              <div className="flex justify-between items-start">
                <div className="max-w-[65%]">
                  <h1 className="text-base font-bold uppercase tracking-tight text-slate-950">
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

                <div className="text-right">
                  <div className="inline-block px-2.5 py-1 bg-slate-900 text-white text-[10px] font-bold tracking-wider rounded-xs uppercase">
                    {docTitle}
                  </div>
                  <div className="mt-2 text-[10px] text-slate-700 space-y-0.5 font-mono">
                    <p><strong>Inv No:</strong> {voucher.voucherNo}</p>
                    <p><strong>Date:</strong> {voucher.date}</p>
                    <p><strong>Mode:</strong> {voucher.paymentMode}</p>
                    {voucher.referenceNo && <p><strong>Ref:</strong> {voucher.referenceNo}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Bill To & Dispatch */}
            <div className="border border-slate-300 p-2.5 rounded-xs mb-3 bg-slate-50/50 text-[10px]">
              <p className="uppercase font-bold text-slate-500 tracking-wider">
                Billed To (Customer / Party)
              </p>
              <p className="font-bold text-slate-950 text-xs mt-0.5">
                {party?.name || voucher.partyName || 'Cash Customer'}
              </p>
              <p className="text-slate-600 mt-0.5">
                {party?.address || 'Local Cash Sale'}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3">
                {party?.gstin && <p>GSTIN: <strong className="font-mono">{party.gstin}</strong></p>}
                {party?.stateCode && <p>State Code: {party.stateCode}</p>}
                {party?.phone && <p>Ph: {party.phone}</p>}
              </div>
              {voucher.notes && (
                <p className="text-[10px] text-slate-500 italic mt-1 border-t border-slate-200 pt-0.5">
                  Remark: {voucher.notes}
                </p>
              )}
            </div>

            {/* Items Table */}
            <div className="border border-slate-300 rounded-xs overflow-hidden mb-3">
              <table className="w-full text-left border-collapse print-table text-[10px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 uppercase">
                    <th className="py-1.5 px-2 w-7 text-center border-r border-slate-200">#</th>
                    <th className="py-1.5 px-2 border-r border-slate-200">Item Description</th>
                    <th className="py-1.5 px-2 w-14 text-center border-r border-slate-200">HSN</th>
                    <th className="py-1.5 px-2 w-10 text-right border-r border-slate-200">Qty</th>
                    <th className="py-1.5 px-2 w-14 text-right border-r border-slate-200">Rate</th>
                    <th className="py-1.5 px-2 w-16 text-right border-r border-slate-200">Taxable</th>
                    <th className="py-1.5 px-2 w-10 text-center border-r border-slate-200">GST</th>
                    <th className="py-1.5 px-2 w-18 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[10px]">
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

            {/* Calculations & Amount in Words */}
            <div className="grid grid-cols-12 gap-3 mb-3 text-[10px]">
              <div className="col-span-7 flex flex-col justify-between">
                <div>
                  <p className="font-bold uppercase text-slate-500">
                    Amount Chargeable (in words):
                  </p>
                  <p className="font-semibold text-slate-900 italic mt-0.5">
                    {numberToWordsINR(voucher.grandTotal)}
                  </p>
                </div>

                <div className="border border-slate-200 p-2 rounded-xs bg-slate-50 font-mono mt-2">
                  <p className="font-bold uppercase text-slate-700 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-blue-600" />
                    Electronic Payment Details (NEFT/RTGS/UPI)
                  </p>
                  <p className="mt-0.5">Bank: <strong>{settings.bankName}</strong> · A/c: <strong>{settings.accountNo}</strong></p>
                  <p>IFSC: <strong>{settings.ifsc}</strong> · UPI ID: <strong>{settings.upiId}</strong></p>
                </div>
              </div>

              <div className="col-span-5 border border-slate-300 rounded-xs p-2 bg-slate-50/70 font-mono space-y-0.5">
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
                <div className="border-t border-slate-900 pt-1 flex justify-between font-bold text-xs text-slate-950">
                  <span>Grand Total:</span>
                  <span>{formatINR(voucher.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* HSN Summary Table */}
            <div className="border border-slate-200 rounded-xs mb-3 text-[9px]">
              <div className="bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                HSN / SAC Tax Breakdown Summary
              </div>
              <table className="w-full text-center border-collapse">
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

            {/* Terms and Signatory */}
            <div className="grid grid-cols-12 gap-3 pt-2 border-t border-slate-300 text-[9px]">
              <div className="col-span-7">
                <p className="font-bold uppercase text-slate-600">Terms &amp; Conditions:</p>
                <p className="text-slate-500 whitespace-pre-line leading-tight mt-0.5">
                  {settings.invoiceTerms}
                </p>
              </div>

              <div className="col-span-5 text-right flex flex-col justify-between items-end">
                <p className="font-semibold text-slate-800">
                  {settings.authorizedSignatoryTitle}
                </p>
                <div className="mt-6 border-t border-slate-400 w-36 pt-0.5 text-center text-slate-500">
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

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  Download,
  X,
  Building,
  FileText,
  Copy,
  CheckCircle2,
  LayoutTemplate,
  Edit2,
  ChevronDown
} from 'lucide-react';
import { TransactionVoucher } from '../types/accounting';
import { formatINR, numberToWordsINR } from '../utils/gstCalculations';
import { useAccounting } from '../context/AccountingContext';
import { QrCodeSvg, buildUpiPaymentUri } from '../utils/qrCode';
import { CustomInvoiceRenderer } from './CustomInvoiceRenderer';
import { downloadInvoicePdf } from '../utils/invoicePdf';

interface InvoicePrintModalProps {
  voucher: TransactionVoucher | null;
  onClose: () => void;
  onEditVoucher?: (voucher: TransactionVoucher) => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({ voucher, onClose, onEditVoucher }) => {
  const { settings, getLedgerById } = useAccounting();
  const printAreaRef = useRef<HTMLDivElement>(null);

  const hasCustomTemplate =
    Boolean(settings.invoiceTemplate) && (settings.invoiceTemplate?.blocks.length || 0) > 0;

  const [useCustomTemplate, setUseCustomTemplate] = useState<boolean>(
    Boolean(settings.invoiceTemplate?.useAsDefault && hasCustomTemplate)
  );
  const [paperSize, setPaperSize] = useState<'A5' | 'A4'>(
    settings.invoiceTemplate?.useAsDefault && settings.invoiceTemplate?.paperSize
      ? settings.invoiceTemplate.paperSize
      : settings.paperSize || 'A5'
  );
  const [copied, setCopied] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canUse = Boolean(settings.invoiceTemplate?.useAsDefault && settings.invoiceTemplate?.blocks.length);
    setUseCustomTemplate(canUse);
    setPaperSize(
      canUse && settings.invoiceTemplate?.paperSize
        ? settings.invoiceTemplate.paperSize
        : settings.paperSize || 'A5'
    );
  }, [settings, voucher?.id]);

  useEffect(() => {
    if (!voucher) return;
    document.body.classList.add('portal-print-active');
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPrintOptions) {
          setShowPrintOptions(false);
        } else {
          onClose();
        }
      }
    };
    const handleOutside = (e: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node)) {
        setShowPrintOptions(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleOutside);
    return () => {
      document.body.classList.remove('portal-print-active');
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [voucher, onClose, showPrintOptions]);

  if (!voucher) return null;

  const isSale = voucher.type === 'SALE';
  const isCreditNote = voucher.type === 'CREDIT_NOTE';
  const isDebitNote = voucher.type === 'DEBIT_NOTE';
  const isPurchase = voucher.type === 'PURCHASE';
  const isPayment = voucher.type === 'PAYMENT';
  const isReceipt = voucher.type === 'RECEIPT';
  const isGoodsDoc = isSale || isPurchase || isCreditNote || isDebitNote;
  const receiptEntries = isReceipt ? voucher.receiptEntries || [] : [];
  const hasMultiCustomerReceipt = isReceipt && receiptEntries.length > 1;

  const resolvedPartyId =
    voucher.partyId || (receiptEntries.length === 1 ? receiptEntries[0].partyId : undefined);
  const party = resolvedPartyId ? getLedgerById(resolvedPartyId) : undefined;
  const partyName = hasMultiCustomerReceipt
    ? `${receiptEntries.length} Customers (${receiptEntries.map(r => r.partyName).join(', ')})`
    : party?.name ||
      (receiptEntries.length === 1 ? receiptEntries[0].partyName : '') ||
      voucher.guestDetails?.name ||
      voucher.partyName ||
      (isPayment ? 'Expense Payment' : 'Walk-in / Cash Customer');
  const partyAddress = hasMultiCustomerReceipt ? undefined : party?.address || voucher.guestDetails?.address;
  const partyGstin = hasMultiCustomerReceipt ? undefined : party?.gstin || voucher.guestDetails?.gstin;
  const partyPhone = hasMultiCustomerReceipt ? undefined : party?.phone || voucher.guestDetails?.phone;
  const partyStateCode = hasMultiCustomerReceipt ? undefined : party?.stateCode || voucher.guestDetails?.stateCode;

  const handlePrintWithSize = (targetSize: 'A5' | 'A4') => {
    setShowPrintOptions(false);
    if (paperSize !== targetSize) {
      setPaperSize(targetSize);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.focus();
          window.print();
        });
      });
    } else {
      window.focus();
      window.print();
    }
  };

  const handleDownloadPdf = () => {
    downloadInvoicePdf({
      voucher,
      settings,
      party,
      paperSize,
      useCustomTemplate,
    });
  };

  const handleCopySummary = () => {
    const receiptBreakdown =
      isReceipt && receiptEntries.length > 0
        ? receiptEntries.map(r => `  - ${r.partyName}: ${formatINR(r.amount)}`).join('\n') + '\n'
        : '';

    const text =
      `*${settings.name}*\n` +
      (voucher.voucherNo ? `Doc: ${voucher.voucherNo} (${voucher.type})\n` : `Type: ${voucher.type}\n`) +
      `Date: ${voucher.date}\n` +
      (hasMultiCustomerReceipt
        ? `Customers:\n${receiptBreakdown}`
        : `Party: ${partyName}\n`) +
      `Total: ${formatINR(voucher.grandTotal)}\n` +
      `Payment Mode: ${voucher.paymentMode}\n` +
      (voucher.referenceNo ? `Ref: ${voucher.referenceNo}\n` : '') +
      `Thank you for your business!`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  let docTitle = voucher.isGstBill ? 'TAX INVOICE' : 'BILL OF SUPPLY';
  if (isCreditNote) docTitle = 'CREDIT NOTE (SALES RETURN)';
  else if (isDebitNote) docTitle = 'DEBIT NOTE (PURCHASE RETURN)';
  else if (isPurchase) docTitle = 'PURCHASE INVOICE';
  else if (isPayment) docTitle = 'PAYMENT INVOICE';
  else if (isReceipt) docTitle = 'PAYMENT RECEIPT';

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

  const upiUri =
    settings.showQrCode !== false && settings.upiId
      ? buildUpiPaymentUri(
          settings.upiId,
          settings.name,
          voucher.grandTotal,
          voucher.voucherNo ? `Inv ${voucher.voucherNo}` : 'Receipt'
        )
      : '';

  const modalNode = (
    <div
      role="dialog"
      aria-modal="true"
      data-print-portal="true"
      onClick={onClose}
      className="print-modal-root fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
        }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        className="print-modal-card relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Top Control Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2.5 px-3.5 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 inline-flex items-center justify-center theme-soft-badge rounded-lg shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate">
                {docTitle} ({paperSize === 'A5' ? 'A5 · Half A4 Page' : 'A4 · Full Page'})
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate font-mono">
                {voucher.voucherNo ? `#${voucher.voucherNo} · ${voucher.date}` : voucher.date}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {hasCustomTemplate && (
              <button
                type="button"
                onClick={() => setUseCustomTemplate(!useCustomTemplate)}
                className={`h-8 inline-flex items-center justify-center gap-1.5 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                  useCustomTemplate
                    ? 'theme-soft-badge'
                    : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <LayoutTemplate className="w-3.5 h-3.5" />
                <span>{useCustomTemplate ? 'Custom Format' : 'Standard Format'}</span>
              </button>
            )}

            <div className="inline-flex items-center h-8 p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 shrink-0">
              <button
                type="button"
                onClick={() => setPaperSize('A5')}
                title="A5 Half-Page on A4 Xerox Sheet (210 × 148 mm)"
                className={`h-7 px-2.5 rounded-md transition-all inline-flex items-center justify-center whitespace-nowrap ${
                  paperSize === 'A5' ? 'bg-white dark:bg-slate-700 theme-text shadow-2xs font-bold' : ''
                }`}
              >
                A5 (Half A4)
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('A4')}
                title="Full A4 Sheet (210 × 297 mm)"
                className={`h-7 px-2.5 rounded-md transition-all inline-flex items-center justify-center whitespace-nowrap ${
                  paperSize === 'A4' ? 'bg-white dark:bg-slate-700 theme-text shadow-2xs font-bold' : ''
                }`}
              >
                A4 (Full)
              </button>
            </div>

            {onEditVoucher && (
              <button
                type="button"
                onClick={() => onEditVoucher(voucher)}
                title="Edit Invoice"
                className="h-8 inline-flex items-center justify-center gap-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopySummary}
              title="Copy Summary to Clipboard"
              className="h-8 px-2.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="h-8 inline-flex items-center justify-center gap-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0"
              title={`Download ${paperSize} PDF Invoice`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            <div className="relative" ref={printMenuRef}>
              <button
                type="button"
                onClick={() => setShowPrintOptions(prev => !prev)}
                className="theme-bg theme-bg-hover h-8 inline-flex items-center justify-center gap-1.5 px-3 active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-80" />
              </button>

              {showPrintOptions && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-50 space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Choose Print Format
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePrintWithSize('A4')}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                      paperSize === 'A4'
                        ? 'theme-soft-badge'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold">A4 — Full Page</p>
                      <p className="text-[10px] opacity-75">210 × 297 mm full sheet</p>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-current/20">
                      A4
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintWithSize('A5')}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                      paperSize === 'A5'
                        ? 'theme-soft-badge'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold">A5 — Half A4 Xerox Page</p>
                      <p className="text-[10px] opacity-75">Top half (210 × 148 mm) on A4</p>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-current/20">
                      A5
                    </span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-flex items-center justify-center transition-colors shrink-0"
              aria-label="Close print preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Invoice Preview Viewport */}
        <div className="print-viewport-wrapper flex-1 overflow-y-auto p-2.5 sm:p-6 md:p-8 bg-slate-100 dark:bg-slate-950/60 flex justify-center items-start">
          <div
            ref={printAreaRef}
            className={`print-only-container w-full bg-white text-slate-900 shadow-sm border border-slate-300 font-sans rounded-xs flex flex-col ${
              paperSize === 'A5'
                ? 'print-sheet-a5 max-w-[680px] min-h-[440px] p-3.5 sm:p-5 text-[11px] leading-snug'
                : 'print-sheet-a4 max-w-[780px] min-h-[920px] p-5 sm:p-8 text-xs leading-relaxed'
            }`}
          >
            {useCustomTemplate && settings.invoiceTemplate ? (
              <CustomInvoiceRenderer
                template={settings.invoiceTemplate}
                voucher={voucher}
                settings={settings}
                party={party}
              />
            ) : (
              <>
                {/* Header */}
                <div className="border-b-2 border-slate-900 pb-3 mb-3 print-tight-mb">
                  <div className="flex justify-between items-start gap-3">
                    <div className="max-w-[65%]">
                      <h1 className="text-sm sm:text-base font-extrabold uppercase tracking-tight text-slate-950">
                        {settings.name || 'Ghosh Agency'}
                      </h1>
                      {settings.address && (
                        <p className="text-[10px] text-slate-600 leading-tight mt-0.5">{settings.address}</p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-medium text-slate-800 mt-1">
                        {settings.gstin && (
                          <span>
                            GSTIN: <strong className="font-mono">{settings.gstin}</strong>
                          </span>
                        )}
                        {settings.state && (
                          <span>
                            State: {settings.state} ({settings.stateCode})
                          </span>
                        )}
                        {settings.phone && <span>Ph: {settings.phone}</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="inline-block px-2.5 py-1 bg-slate-900 text-white text-[9px] sm:text-[10px] font-bold tracking-wider rounded-xs uppercase">
                        {docTitle}
                      </div>
                      <div className="mt-2 text-[10px] text-slate-700 space-y-0.5 font-mono">
                        {voucher.voucherNo && (
                          <p>
                            <strong>Doc No:</strong> {voucher.voucherNo}
                          </p>
                        )}
                        <p>
                          <strong>Date:</strong> {voucher.date}
                        </p>
                        <p>
                          <strong>Mode:</strong> {voucher.paymentMode}
                        </p>
                        {voucher.referenceNo && (
                          <p>
                            <strong>Ref No:</strong> {voucher.referenceNo}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Party Details */}
                <div className="border border-slate-300 p-2.5 print-tight-p rounded-xs mb-3 print-tight-mb bg-slate-50/50 text-[10px]">
                  <p className="uppercase font-bold text-slate-500 tracking-wider">
                    {isPayment
                      ? 'Paid To (Beneficiary)'
                      : isReceipt
                      ? hasMultiCustomerReceipt
                        ? `Received From (${receiptEntries.length} Customers)`
                        : 'Received From (Customer)'
                      : 'Billed To (Party Details)'}
                    {voucher.customerMode === 'guest' && ' · Guest Customer'}
                  </p>
                  <p className="font-bold text-slate-950 text-xs sm:text-sm mt-0.5">{partyName}</p>
                  {partyAddress && <p className="text-slate-600 mt-0.5">{partyAddress}</p>}
                  {!hasMultiCustomerReceipt && (
                    <div className="mt-1 flex flex-wrap gap-x-3 text-slate-700">
                      {partyGstin && (
                        <p>
                          GSTIN: <strong className="font-mono">{partyGstin}</strong>
                        </p>
                      )}
                      {partyStateCode && <p>State Code: {partyStateCode}</p>}
                      {partyPhone && <p>Ph: {partyPhone}</p>}
                    </div>
                  )}
                  {voucher.notes && (
                    <p className="text-[10px] text-slate-500 italic mt-1.5 border-t border-slate-200 pt-1">
                      Remark: {voucher.notes}
                    </p>
                  )}
                </div>

                {isGoodsDoc ? (
                  <>
                    <div className="border border-slate-300 rounded-xs overflow-x-auto mb-3 print-tight-mb">
                      <table className="w-full text-left border-collapse print-table text-[10px] min-w-[440px]">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 uppercase">
                            <th className="py-1.5 px-2 w-7 text-center border-r border-slate-200">#</th>
                            <th className="py-1.5 px-2 border-r border-slate-200">Item Description</th>
                            <th className="py-1.5 px-2 w-14 text-center border-r border-slate-200">HSN</th>
                            <th className="py-1.5 px-2 w-12 text-right border-r border-slate-200">Qty</th>
                            <th className="py-1.5 px-2 w-16 text-right border-r border-slate-200">
                              {voucher.isGstInclusive ? 'Rate (Incl)' : 'Rate'}
                            </th>
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

                    <div className="print-totals-grid grid grid-cols-12 gap-3 mb-3 print-tight-mb text-[10px] print-avoid-break">
                      <div className="print-totals-left col-span-12 sm:col-span-7 flex flex-col justify-between order-2 sm:order-1">
                        <div>
                          <p className="font-bold uppercase text-slate-500">Amount Chargeable (in words):</p>
                          <p className="font-semibold text-slate-900 italic mt-0.5">
                            {numberToWordsINR(voucher.grandTotal)}
                          </p>
                        </div>

                        {(settings.bankName || upiUri) && (
                          <div className="border border-slate-200 p-2 print-tight-p rounded-xs bg-slate-50 font-mono mt-1.5 text-[9px] flex items-center justify-between gap-2">
                            <div>
                              <p className="font-bold uppercase text-slate-700 flex items-center gap-1">
                                <Building className="w-3.5 h-3.5 text-blue-600" />
                                Electronic Payment (Bank / UPI)
                              </p>
                              {settings.bankName && (
                                <p className="mt-0.5">
                                  Bank: <strong>{settings.bankName}</strong> · A/c: <strong>{settings.accountNo}</strong>
                                </p>
                              )}
                              <p>
                                {settings.ifsc && (
                                  <>
                                    IFSC: <strong>{settings.ifsc}</strong>
                                  </>
                                )}
                                {settings.upiId && ` · UPI: ${settings.upiId}`}
                              </p>
                            </div>
                            {upiUri && (
                              <div className="shrink-0 bg-white p-1 border border-slate-200 rounded-xs">
                                <QrCodeSvg value={upiUri} size={52} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="print-totals-right col-span-12 sm:col-span-5 border border-slate-300 rounded-xs p-2.5 print-tight-p bg-slate-50/70 font-mono space-y-1 order-1 sm:order-2">
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
                        {Math.abs(voucher.roundOff || 0) > 0 && (
                          <div className="flex justify-between text-slate-700">
                            <span>Round Off:</span>
                            <span>
                              {(voucher.roundOff || 0) > 0
                                ? `+${formatINR(voucher.roundOff!)}`
                                : `-${formatINR(Math.abs(voucher.roundOff!))}`}
                            </span>
                          </div>
                        )}
                        <div className="border-t-2 border-slate-900 pt-1.5 flex justify-between font-bold text-xs sm:text-sm text-slate-950">
                          <span>Grand Total:</span>
                          <span>{formatINR(voucher.grandTotal)}</span>
                        </div>
                      </div>
                    </div>

                    {Object.keys(hsnBreakup).length > 0 && (
                      <div className="border border-slate-200 rounded-xs mb-3 print-tight-mb text-[9px] overflow-x-auto print-avoid-break">
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
                  <div className="space-y-3 mb-4 print-avoid-break">
                    {isReceipt && receiptEntries.length > 0 && (
                      <div className="border border-slate-300 rounded-xs overflow-x-auto">
                        <table className="w-full text-left border-collapse print-table text-[10px]">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 uppercase">
                              <th className="py-1.5 px-2 w-8 text-center border-r border-slate-200">#</th>
                              <th className="py-1.5 px-2 border-r border-slate-200">Customer Name</th>
                              <th className="py-1.5 px-2 w-28 text-right border-r border-slate-200">Available Due</th>
                              <th className="py-1.5 px-2 border-r border-slate-200">Remark</th>
                              <th className="py-1.5 px-2 w-28 text-right">Amount Received (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {receiptEntries.map((entry, idx) => (
                              <tr key={`${entry.partyId}_${idx}`}>
                                <td className="py-1 px-2 text-center text-slate-500 border-r border-slate-200">
                                  {idx + 1}
                                </td>
                                <td className="py-1 px-2 border-r border-slate-200 font-semibold text-slate-900">
                                  {entry.partyName}
                                </td>
                                <td className="py-1 px-2 text-right font-mono text-slate-600 border-r border-slate-200">
                                  {entry.availableDue !== undefined ? formatINR(entry.availableDue) : '—'}
                                </td>
                                <td className="py-1 px-2 text-slate-600 border-r border-slate-200">
                                  {entry.notes || '—'}
                                </td>
                                <td className="py-1 px-2 text-right font-mono font-bold text-slate-950">
                                  {formatINR(entry.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="border border-slate-300 rounded-xs p-3.5 bg-slate-50/40 space-y-2.5">
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
                        <span className="font-semibold text-slate-600 uppercase text-[10px]">
                          {isReceipt ? 'Total Amount Received' : 'Settlement Amount'}
                        </span>
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
                  </div>
                )}

                <div className="print-footer-anchor grid grid-cols-12 gap-3 pt-2.5 border-t border-slate-300 text-[9px] print-avoid-break">
                  <div className="col-span-7">
                    <p className="font-bold uppercase text-slate-600">Terms &amp; Declaration:</p>
                    <p className="text-slate-500 whitespace-pre-line leading-tight mt-0.5">
                      {settings.invoiceTerms ||
                        '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction only.'}
                    </p>
                  </div>

                  <div className="col-span-5 text-right flex flex-col justify-between items-end">
                    <p className="font-semibold text-slate-800">
                      {settings.authorizedSignatoryTitle || `For ${settings.name}`}
                    </p>
                    <div className="mt-7 print-sig-gap border-t border-slate-400 w-32 sm:w-36 pt-0.5 text-center text-slate-500">
                      Authorized Signatory
                    </div>
                  </div>
                </div>
              </>
            )}

            {paperSize === 'A5' && (
              <div className="print-cut-guide mt-2 pt-1 border-t border-dashed border-slate-300 flex items-center justify-between text-[8px] text-slate-400 select-none">
                <span>✂ A5 Half-Page (Prints on Top Half of A4 Xerox)</span>
                <span>Cut / Fold Here</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};

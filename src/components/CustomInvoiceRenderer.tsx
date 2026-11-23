import React from 'react';
import { Building } from 'lucide-react';
import {
  CompanySettings,
  InvoiceBlockConfig,
  InvoiceTemplateConfig,
  LedgerAccount,
  TransactionVoucher
} from '../types/accounting';
import { formatINR, numberToWordsINR } from '../utils/gstCalculations';
import { QrCodeSvg, buildUpiPaymentUri } from '../utils/qrCode';

interface CustomInvoiceRendererProps {
  template: InvoiceTemplateConfig;
  voucher: TransactionVoucher;
  settings: CompanySettings;
  party?: LedgerAccount;
  interactive?: boolean;
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string) => void;
}

export const CustomInvoiceRenderer: React.FC<CustomInvoiceRendererProps> = ({
  template,
  voucher,
  settings,
  party,
  interactive = false,
  selectedBlockId,
  onSelectBlock,
}) => {
  const accent = template.accentColor || '#0f172a';
  const radiusClass =
    template.borderStyle === 'rounded'
      ? 'rounded-lg'
      : template.borderStyle === 'minimal'
      ? 'rounded-none'
      : 'rounded-xs';
  const fontClass =
    template.fontFamily === 'mono'
      ? 'font-mono'
      : template.fontFamily === 'serif'
      ? 'font-serif'
      : 'font-sans';
  const padY = template.density === 'compact' ? 'py-1' : 'py-1.5';
  const blockSpacing = template.density === 'compact' ? 'space-y-2 print:space-y-1.5' : 'space-y-3 print:space-y-1.5';

  const isReceipt = voucher.type === 'RECEIPT';
  const receiptEntries = isReceipt ? voucher.receiptEntries || [] : [];
  const hasMultiCustomerReceipt = isReceipt && receiptEntries.length > 1;

  const buyerName = hasMultiCustomerReceipt
    ? `${receiptEntries.length} Customers (${receiptEntries.map(r => r.partyName).join(', ')})`
    : party?.name ||
      (receiptEntries.length === 1 ? receiptEntries[0].partyName : '') ||
      voucher.guestDetails?.name ||
      voucher.partyName ||
      (voucher.type === 'PAYMENT' ? 'Expense Payment' : 'Walk-in / Cash Customer');
  const buyerAddress = hasMultiCustomerReceipt ? '' : party?.address || voucher.guestDetails?.address || '';
  const buyerGstin = hasMultiCustomerReceipt ? '' : party?.gstin || voucher.guestDetails?.gstin || '';
  const buyerPhone = hasMultiCustomerReceipt ? '' : party?.phone || voucher.guestDetails?.phone || '';
  const buyerStateCode = hasMultiCustomerReceipt
    ? settings.stateCode
    : party?.stateCode || voucher.guestDetails?.stateCode || settings.stateCode;

  const isGoodsDoc = ['SALE', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(voucher.type);

  // HSN Summary grouping
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

  const upiUri = settings.upiId
    ? buildUpiPaymentUri(
        settings.upiId,
        settings.name,
        voucher.grandTotal,
        voucher.voucherNo ? `Inv ${voucher.voucherNo}` : 'Receipt'
      )
    : '';

  const renderBlock = (block: InvoiceBlockConfig) => {
    if (!block.visible) return null;

    switch (block.type) {
      case 'company_header': {
        const alignCenter = block.align === 'center';
        const alignRight = block.align === 'right';
        return (
          <div
            className="pb-3 border-b-2"
            style={{ borderColor: accent }}
          >
            <div
              className={`flex justify-between items-start gap-3 ${
                alignCenter ? 'flex-col items-center text-center' : alignRight ? 'flex-row-reverse text-right' : ''
              }`}
            >
              <div className={alignCenter ? 'max-w-full' : 'max-w-[68%]'}>
                <h1
                  className="text-base sm:text-lg font-extrabold uppercase tracking-tight"
                  style={{ color: accent }}
                >
                  {settings.name || 'Ghosh Agency'}
                </h1>
                {settings.address && (
                  <p className="text-[10px] text-slate-600 leading-snug mt-0.5">{settings.address}</p>
                )}
                <div
                  className={`flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-medium text-slate-800 mt-1 ${
                    alignCenter ? 'justify-center' : alignRight ? 'justify-end' : ''
                  }`}
                >
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

              <div className={alignCenter ? '' : 'text-right shrink-0'}>
                <span
                  className={`inline-block px-2.5 py-1 text-white text-[10px] font-bold tracking-wider uppercase ${radiusClass}`}
                  style={{ backgroundColor: accent }}
                >
                  {block.customHeading ||
                    (voucher.type === 'SALE'
                      ? voucher.isGstBill
                        ? 'TAX INVOICE'
                        : 'BILL OF SUPPLY'
                      : voucher.type.replace('_', ' '))}
                </span>
              </div>
            </div>
          </div>
        );
      }

      case 'invoice_meta': {
        return (
          <div
            className={`grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-2 p-2.5 print-tight-p bg-slate-50 border ${
              template.borderStyle === 'minimal' ? 'border-slate-200 border-x-0' : 'border-slate-300'
            } ${radiusClass} text-[10px]`}
          >
            <div>
              <span className="text-slate-500 uppercase font-semibold block text-[9px]">
                {voucher.voucherNo ? 'Document No' : 'Document Type'}
              </span>
              <span className="font-mono font-bold text-slate-900">
                {voucher.voucherNo || (isReceipt ? 'Payment Receipt' : '—')}
              </span>
            </div>
            <div>
              <span className="text-slate-500 uppercase font-semibold block text-[9px]">
                {isReceipt ? 'Receipt Date' : 'Invoice Date'}
              </span>
              <span className="font-mono font-bold text-slate-900">{voucher.date}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase font-semibold block text-[9px]">Payment Mode</span>
              <span className="font-mono font-bold text-slate-900">{voucher.paymentMode}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase font-semibold block text-[9px]">
                {voucher.referenceNo ? 'Reference' : 'Supply State'}
              </span>
              <span className="font-mono font-bold text-slate-900">
                {voucher.referenceNo || `Code ${buyerStateCode}`}
              </span>
            </div>
          </div>
        );
      }

      case 'bill_to': {
        return (
          <div
            className={`p-2.5 border border-slate-300 ${radiusClass} bg-white text-[10px] ${
              block.align === 'right' ? 'text-right' : block.align === 'center' ? 'text-center' : 'text-left'
            }`}
          >
            <p className="uppercase font-bold text-slate-500 tracking-wider text-[9px]">
              {block.customHeading ||
                (voucher.type === 'PURCHASE'
                  ? 'Supplier Details'
                  : isReceipt
                  ? hasMultiCustomerReceipt
                    ? `Received From (${receiptEntries.length} Customers)`
                    : 'Received From (Customer)'
                  : 'Billed To (Customer)')}
              {voucher.customerMode === 'guest' && ' · Guest Walk-In'}
            </p>
            <p className="font-bold text-slate-950 text-xs sm:text-sm mt-0.5">{buyerName}</p>
            {buyerAddress && <p className="text-slate-600 mt-0.5">{buyerAddress}</p>}
            <div
              className={`mt-1 flex flex-wrap gap-x-3 text-slate-700 ${
                block.align === 'right' ? 'justify-end' : block.align === 'center' ? 'justify-center' : ''
              }`}
            >
              {buyerGstin && (
                <span>
                  GSTIN: <strong className="font-mono">{buyerGstin}</strong>
                </span>
              )}
              {buyerPhone && <span>Ph: {buyerPhone}</span>}
              <span>State Code: {buyerStateCode}</span>
            </div>
          </div>
        );
      }

      case 'dispatch_info': {
        const isInterState = buyerStateCode && settings.stateCode && buyerStateCode !== settings.stateCode;
        return (
          <div
            className={`flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 ${radiusClass} text-[10px] text-slate-700`}
          >
            <span>
              <strong>Place of Supply:</strong> State Code {buyerStateCode} (
              {isInterState ? 'Inter-State IGST' : 'Intra-State CGST+SGST'})
            </span>
            {voucher.notes && (
              <span className="italic text-slate-600">
                <strong>Note:</strong> {voucher.notes}
              </span>
            )}
          </div>
        );
      }

      case 'items_table': {
        if (!isGoodsDoc) {
          if (isReceipt && receiptEntries.length > 0) {
            return (
              <div className={`border border-slate-300 ${radiusClass} overflow-x-auto`}>
                <table className="w-full text-left border-collapse print-table text-[10px]">
                  <thead>
                    <tr
                      className="border-b border-slate-300 font-bold text-slate-900 uppercase"
                      style={{ backgroundColor: `${accent}12` }}
                    >
                      <th className={`${padY} px-2 w-8 text-center border-r border-slate-200`}>#</th>
                      <th className={`${padY} px-2 border-r border-slate-200`}>Customer Name</th>
                      <th className={`${padY} px-2 w-28 text-right border-r border-slate-200`}>Available Due</th>
                      <th className={`${padY} px-2 border-r border-slate-200`}>Remark</th>
                      <th className={`${padY} px-2 w-28 text-right`}>Amount Received (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {receiptEntries.map((entry, idx) => (
                      <tr key={`${entry.partyId}_${idx}`}>
                        <td className={`${padY} px-2 text-center text-slate-500 border-r border-slate-200`}>
                          {idx + 1}
                        </td>
                        <td className={`${padY} px-2 border-r border-slate-200 font-semibold text-slate-900`}>
                          {entry.partyName}
                        </td>
                        <td className={`${padY} px-2 text-right font-mono text-slate-600 border-r border-slate-200`}>
                          {entry.availableDue !== undefined ? formatINR(entry.availableDue) : '—'}
                        </td>
                        <td className={`${padY} px-2 text-slate-600 border-r border-slate-200`}>
                          {entry.notes || '—'}
                        </td>
                        <td className={`${padY} px-2 text-right font-mono font-bold text-slate-950`}>
                          {formatINR(entry.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          return (
            <div className={`border border-slate-300 ${radiusClass} p-3 bg-slate-50/60 text-xs`}>
              <div className="flex justify-between font-bold">
                <span>{isReceipt ? 'Total Amount Received' : 'Settlement Amount'}</span>
                <span className="font-mono">{formatINR(voucher.grandTotal)}</span>
              </div>
            </div>
          );
        }
        const showHsn = block.showHsnColumn !== false;
        const showDisc = Boolean(block.showDiscountColumn);
        const showTax = block.showTaxColumn !== false;
        const showUnit = block.showUnitColumn !== false;

        return (
          <div className={`border border-slate-300 ${radiusClass} overflow-x-auto`}>
            <table className="w-full text-left border-collapse print-table text-[10px] min-w-[400px]">
              <thead>
                <tr
                  className="border-b border-slate-300 font-bold text-slate-900 uppercase"
                  style={{ backgroundColor: `${accent}12` }}
                >
                  <th className={`${padY} px-2 w-7 text-center border-r border-slate-200`}>#</th>
                  <th className={`${padY} px-2 border-r border-slate-200`}>Item Description</th>
                  {showHsn && (
                    <th className={`${padY} px-2 w-14 text-center border-r border-slate-200`}>HSN</th>
                  )}
                  <th className={`${padY} px-2 w-14 text-right border-r border-slate-200`}>Qty</th>
                  <th className={`${padY} px-2 w-16 text-right border-r border-slate-200`}>Rate</th>
                  {showDisc && (
                    <th className={`${padY} px-2 w-12 text-right border-r border-slate-200`}>Disc</th>
                  )}
                  <th className={`${padY} px-2 w-16 text-right border-r border-slate-200`}>Taxable</th>
                  {showTax && (
                    <th className={`${padY} px-2 w-11 text-center border-r border-slate-200`}>GST</th>
                  )}
                  <th className={`${padY} px-2 w-20 text-right`}>Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(voucher.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className={`${padY} px-1.5 text-center text-slate-500 border-r border-slate-200`}>
                      {idx + 1}
                    </td>
                    <td className={`${padY} px-2 border-r border-slate-200 font-medium text-slate-900`}>
                      {item.name}
                    </td>
                    {showHsn && (
                      <td className={`${padY} px-2 text-center font-mono text-slate-600 border-r border-slate-200`}>
                        {item.hsn || '-'}
                      </td>
                    )}
                    <td className={`${padY} px-2 text-right font-mono border-r border-slate-200 whitespace-nowrap`}>
                      {item.qty} {showUnit ? item.unit : ''}
                    </td>
                    <td className={`${padY} px-2 text-right font-mono border-r border-slate-200`}>
                      {item.rate.toFixed(2)}
                    </td>
                    {showDisc && (
                      <td className={`${padY} px-2 text-right font-mono border-r border-slate-200`}>
                        {item.discount}%
                      </td>
                    )}
                    <td className={`${padY} px-2 text-right font-mono border-r border-slate-200`}>
                      {item.taxableAmount.toFixed(2)}
                    </td>
                    {showTax && (
                      <td className={`${padY} px-2 text-center font-mono border-r border-slate-200`}>
                        {item.gstRate}%
                      </td>
                    )}
                    <td className={`${padY} px-2 text-right font-mono font-bold text-slate-950`}>
                      {item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case 'totals_box': {
        return (
          <div className="flex justify-end print-avoid-break">
            <div
              className={`w-full sm:w-64 print:w-60 border border-slate-300 ${radiusClass} p-2.5 print-tight-p bg-slate-50/70 font-mono text-[10px] space-y-1`}
            >
              <div className="flex justify-between">
                <span>Taxable Subtotal:</span>
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
              <div
                className="border-t-2 pt-1.5 flex justify-between font-bold text-xs sm:text-sm"
                style={{ borderColor: accent, color: accent }}
              >
                <span>Grand Total:</span>
                <span>{formatINR(voucher.grandTotal)}</span>
              </div>
            </div>
          </div>
        );
      }

      case 'amount_words': {
        return (
          <div
            className={`p-2 border border-slate-200 ${radiusClass} bg-slate-50/40 text-[10px] ${
              block.align === 'right' ? 'text-right' : block.align === 'center' ? 'text-center' : 'text-left'
            }`}
          >
            <span className="font-bold uppercase text-slate-500 text-[9px] mr-1.5">
              Amount in Words:
            </span>
            <span className="font-semibold text-slate-900 italic">
              {numberToWordsINR(voucher.grandTotal)}
            </span>
          </div>
        );
      }

      case 'hsn_summary': {
        if (!isGoodsDoc || Object.keys(hsnBreakup).length === 0) return null;
        return (
          <div className={`border border-slate-200 ${radiusClass} text-[9px] overflow-x-auto print-avoid-break`}>
            <div className="bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
              HSN / SAC Tax Breakdown Summary
            </div>
            <table className="w-full text-center border-collapse min-w-[360px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-0.5 px-1">HSN</th>
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
        );
      }

      case 'bank_qr': {
        const showQr = block.showQrCode !== false && Boolean(upiUri);
        const showBank = block.showBankDetails !== false && Boolean(settings.bankName);
        if (!showQr && !showBank) return null;

        return (
          <div
            className={`flex items-center justify-between gap-3 border border-slate-200 p-2.5 ${radiusClass} bg-slate-50/70 print-avoid-break`}
          >
            {showBank ? (
              <div className="font-mono text-[9px] space-y-0.5">
                <p className="font-bold uppercase text-slate-700 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" style={{ color: accent }} />
                  Bank &amp; Electronic Payment
                </p>
                <p>
                  Bank: <strong>{settings.bankName}</strong> · A/c: <strong>{settings.accountNo}</strong>
                </p>
                <p>
                  IFSC: <strong>{settings.ifsc}</strong>
                  {settings.upiId ? ` · UPI: ${settings.upiId}` : ''}
                </p>
              </div>
            ) : (
              <div className="text-[9px] text-slate-600 font-mono">
                <p className="font-bold uppercase text-slate-800">Scan to Pay via UPI</p>
                <p>{settings.upiId}</p>
              </div>
            )}

            {showQr && (
              <div className="flex flex-col items-center shrink-0 bg-white p-1 border border-slate-200 rounded-xs">
                <QrCodeSvg value={upiUri} size={64} />
                <span className="text-[8px] font-mono text-slate-500 mt-0.5">UPI QR</span>
              </div>
            )}
          </div>
        );
      }

      case 'terms_signatory': {
        return (
          <div className="grid grid-cols-12 gap-3 pt-2.5 print:pt-1.5 border-t border-slate-300 text-[9px] print-avoid-break">
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
              <div className="mt-8 print-sig-gap border-t border-slate-400 w-32 sm:w-36 pt-0.5 text-center text-slate-500">
                Authorized Signatory
              </div>
            </div>
          </div>
        );
      }

      case 'custom_text': {
        return (
          <div
            className={`px-2 py-1.5 text-[10px] text-slate-700 ${
              block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : 'text-left'
            }`}
          >
            {block.customHeading && (
              <p className="font-bold uppercase text-[9px] text-slate-500 mb-0.5">{block.customHeading}</p>
            )}
            <p className="whitespace-pre-line font-medium">{block.customBody || ''}</p>
          </div>
        );
      }

      case 'divider': {
        return <hr className="border-t border-slate-300 my-1" style={{ borderColor: `${accent}44` }} />;
      }

      default:
        return null;
    }
  };

  return (
    <div
      className={`bg-white text-slate-900 ${fontClass} text-xs leading-relaxed ${blockSpacing}`}
    >
      {template.blocks.map(block => {
        const isSelected = interactive && selectedBlockId === block.id;
        if (!interactive && !block.visible) return null;

        return (
          <div
            key={block.id}
            onClick={interactive && onSelectBlock ? () => onSelectBlock(block.id) : undefined}
            className={
              interactive
                ? `relative transition-all cursor-pointer rounded-md p-1 -m-1 ${
                    isSelected
                      ? 'ring-2 ring-blue-600 bg-blue-50/30'
                      : 'hover:ring-1 hover:ring-slate-300'
                  } ${!block.visible ? 'opacity-40' : ''}`
                : ''
            }
          >
            {renderBlock(block)}
          </div>
        );
      })}
    </div>
  );
};

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileCheck2,
  Printer,
  Download,
  Sliders,
  Check,
  FileText,
  Search,
  LayoutTemplate,
  ChevronDown
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { formatINR, numberToWordsINR } from '../utils/gstCalculations';
import { QrCodeSvg, buildUpiPaymentUri } from '../utils/qrCode';
import { CustomInvoiceRenderer } from '../components/CustomInvoiceRenderer';
import { downloadInvoicePdf } from '../utils/invoicePdf';

interface GSTBillInvoiceViewProps {
  onOpenNewInvoice?: (isGst?: boolean) => void;
  onOpenBuilder?: () => void;
}

export const GSTBillInvoiceView: React.FC<GSTBillInvoiceViewProps> = ({
  onOpenNewInvoice,
  onOpenBuilder,
}) => {
  const { vouchers, settings, updateSettings, getLedgerById } = useAccounting();

  const allInvoices = useMemo(() => {
    return vouchers.filter(v => ['SALE', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(v.type));
  }, [vouchers]);

  const [docTypeFilter, setDocTypeFilter] = useState<'SALE' | 'PURCHASE' | 'ALL'>('SALE');
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');

  const filteredInvoiceList = useMemo(() => {
    return allInvoices.filter(v => {
      if (docTypeFilter === 'SALE' && v.type !== 'SALE') return false;
      if (docTypeFilter === 'PURCHASE' && v.type !== 'PURCHASE') return false;

      if (invoiceSearchQuery.trim()) {
        const query = invoiceSearchQuery.toLowerCase().trim();
        const party = v.partyId ? getLedgerById(v.partyId) : undefined;
        const partyName = (v.guestDetails?.name || v.partyName || party?.name || '').toLowerCase();
        const voucherNo = (v.voucherNo || '').toLowerCase();
        return voucherNo.includes(query) || partyName.includes(query);
      }
      return true;
    });
  }, [allInvoices, docTypeFilter, invoiceSearchQuery, getLedgerById]);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    filteredInvoiceList[0]?.id || allInvoices[0]?.id || ''
  );

  const currentInvoice = useMemo(() => {
    return vouchers.find(v => v.id === selectedInvoiceId) || filteredInvoiceList[0] || allInvoices[0];
  }, [vouchers, selectedInvoiceId, filteredInvoiceList, allInvoices]);

  const party = currentInvoice?.partyId ? getLedgerById(currentInvoice.partyId) : undefined;
  const partyName =
    party?.name || currentInvoice?.guestDetails?.name || currentInvoice?.partyName || 'Walk-in / Cash Customer';
  const partyAddress = party?.address || currentInvoice?.guestDetails?.address || 'Local Transaction';
  const partyGstin = party?.gstin || currentInvoice?.guestDetails?.gstin || 'Unregistered B2C';
  const partyStateCode = party?.stateCode || currentInvoice?.guestDetails?.stateCode || settings.stateCode;

  const hasCustomTemplate =
    Boolean(settings.invoiceTemplate) && (settings.invoiceTemplate?.blocks.length || 0) > 0;

  const [useCustomTemplate, setUseCustomTemplate] = useState<boolean>(
    Boolean(settings.invoiceTemplate?.useAsDefault && hasCustomTemplate)
  );
  const [paperSize, setPaperSize] = useState<'A5' | 'A4'>(settings.paperSize || 'A5');
  const [showQrCode, setShowQrCode] = useState<boolean>(settings.showQrCode !== false);
  const [showBankDetails, setShowBankDetails] = useState(true);
  const [showHsnSummary, setShowHsnSummary] = useState(true);
  const [customHeaderTitle, setCustomHeaderTitle] = useState(() => {
    if (currentInvoice?.type === 'PURCHASE') return 'PURCHASE INVOICE';
    if (currentInvoice?.type === 'CREDIT_NOTE') return 'CREDIT NOTE';
    if (currentInvoice?.type === 'DEBIT_NOTE') return 'DEBIT NOTE';
    return 'TAX INVOICE';
  });
  const [isSavedSettings, setIsSavedSettings] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);
  const lastSyncedInvoiceIdRef = useRef<string | undefined>(currentInvoice?.id);

  // Sync defaults when settings load asynchronously
  useEffect(() => {
    setPaperSize(settings.paperSize || 'A5');
    setShowQrCode(settings.showQrCode !== false);
    if (settings.invoiceTemplate?.useAsDefault && settings.invoiceTemplate.blocks.length > 0) {
      setUseCustomTemplate(true);
    }
  }, [settings]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node)) {
        setShowPrintOptions(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPrintOptions(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Keep header title synced when the active invoice changes
  useEffect(() => {
    if (currentInvoice && currentInvoice.id !== lastSyncedInvoiceIdRef.current) {
      lastSyncedInvoiceIdRef.current = currentInvoice.id;
      if (currentInvoice.type === 'PURCHASE') setCustomHeaderTitle('PURCHASE INVOICE');
      else if (currentInvoice.type === 'CREDIT_NOTE') setCustomHeaderTitle('CREDIT NOTE');
      else if (currentInvoice.type === 'DEBIT_NOTE') setCustomHeaderTitle('DEBIT NOTE');
      else setCustomHeaderTitle(currentInvoice.isGstBill ? 'TAX INVOICE' : 'BILL OF SUPPLY');
    }
  }, [currentInvoice]);

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
    if (!currentInvoice) return;
    downloadInvoicePdf({
      voucher: currentInvoice,
      settings,
      party,
      paperSize,
      useCustomTemplate,
      customHeaderTitle,
      showBankDetails,
      showHsnSummary,
      showQrCode,
    });
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

  const upiUri =
    showQrCode && settings.upiId && currentInvoice
      ? buildUpiPaymentUri(
          settings.upiId,
          settings.name,
          currentInvoice.grandTotal,
          `Inv ${currentInvoice.voucherNo}`
        )
      : '';

  return (
    <div className="space-y-5 print:space-y-0">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
        }
      `}</style>

      {/* View Header (Hidden during print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 theme-text shrink-0" />
            <span>GST Print &amp; Invoice Preview Station</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select, customize, and print any generated Sales Invoice or Purchase Bill
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenBuilder && (
            <button
              type="button"
              onClick={onOpenBuilder}
              className="h-9 inline-flex items-center justify-center gap-1.5 px-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0"
            >
              <LayoutTemplate className="w-3.5 h-3.5 theme-text" />
              <span>Drag &amp; Drop Builder</span>
            </button>
          )}

          {onOpenNewInvoice && (
            <button
              type="button"
              onClick={() => onOpenNewInvoice(true)}
              className="h-9 inline-flex items-center justify-center gap-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>New Invoice</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!currentInvoice}
            className="h-9 inline-flex items-center justify-center gap-1.5 px-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          <div className="relative" ref={printMenuRef}>
            <button
              type="button"
              onClick={() => setShowPrintOptions(prev => !prev)}
              disabled={!currentInvoice}
              className="h-9 inline-flex items-center justify-center gap-1.5 px-3.5 theme-bg theme-bg-hover disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0"
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
        </div>
      </div>

      {/* Grid Layout */}
      <div className="print-layout-reset grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column Controls (Hidden during print!) */}
        <div className="no-print lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 theme-text" />
              <span>Invoice Selection &amp; Options</span>
            </h3>

            {/* Invoice Category Selector Tabs */}
            <div className="space-y-2">
              <label className="block font-medium text-slate-600 dark:text-slate-400">
                Select Invoice Document
              </label>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setDocTypeFilter('SALE')}
                  className={`flex-1 h-7 px-2 rounded-md transition-all tabular-nums whitespace-nowrap inline-flex items-center justify-center ${
                    docTypeFilter === 'SALE'
                      ? 'bg-white dark:bg-slate-700 theme-text shadow-2xs font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  Sales ({allInvoices.filter(v => v.type === 'SALE').length})
                </button>
                <button
                  type="button"
                  onClick={() => setDocTypeFilter('PURCHASE')}
                  className={`flex-1 h-7 px-2 rounded-md transition-all tabular-nums whitespace-nowrap inline-flex items-center justify-center ${
                    docTypeFilter === 'PURCHASE'
                      ? 'bg-white dark:bg-slate-700 theme-text shadow-2xs font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  Purchases ({allInvoices.filter(v => v.type === 'PURCHASE').length})
                </button>
                <button
                  type="button"
                  onClick={() => setDocTypeFilter('ALL')}
                  className={`flex-1 h-7 px-2 rounded-md transition-all tabular-nums whitespace-nowrap inline-flex items-center justify-center ${
                    docTypeFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 theme-text shadow-2xs font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  All ({allInvoices.length})
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Quick search invoice no or party..."
                  value={invoiceSearchQuery}
                  onChange={e => setInvoiceSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] theme-ring focus:outline-none"
                />
              </div>

              <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                {filteredInvoiceList.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-[11px]">
                    No invoices found. Create one from the Create Invoice page.
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
                          if (inv.type === 'PURCHASE') setCustomHeaderTitle('PURCHASE INVOICE');
                          else if (inv.type === 'CREDIT_NOTE') setCustomHeaderTitle('CREDIT NOTE');
                          else if (inv.type === 'DEBIT_NOTE') setCustomHeaderTitle('DEBIT NOTE');
                          else setCustomHeaderTitle(inv.isGstBill ? 'TAX INVOICE' : 'BILL OF SUPPLY');
                        }}
                        className={`w-full p-2.5 text-left transition-colors flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'theme-active-nav font-semibold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 font-mono tabular-nums text-[11px]">
                            <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              {inv.voucherNo}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              · {inv.type === 'SALE' ? 'Sale' : inv.type === 'PURCHASE' ? 'Purchase' : 'Note'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">
                            {inv.guestDetails?.name || inv.partyName || 'Walk-in Customer'} · {inv.date}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                            {formatINR(inv.grandTotal)}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {hasCustomTemplate && (
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Use Custom Drag &amp; Drop Format
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {settings.invoiceTemplate?.name}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={useCustomTemplate}
                  onChange={e => setUseCustomTemplate(e.target.checked)}
                  className="rounded theme-text theme-ring"
                />
              </div>
            )}

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
                      ? 'theme-soft-badge font-bold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <p className="text-xs">A5 (Half A4)</p>
                  <p className="text-[10px] text-slate-400 font-mono tabular-nums">Top half · 210 × 148 mm</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperSize('A4')}
                  className={`py-2 px-3 rounded-lg border text-center transition-all ${
                    paperSize === 'A4'
                      ? 'theme-soft-badge font-bold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <p className="text-xs">A4 (Full Page)</p>
                  <p className="text-[10px] text-slate-400 font-mono tabular-nums">Full sheet · 210 × 297 mm</p>
                </button>
              </div>
            </div>

            {!useCustomTemplate && (
              <>
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Visible Layout Elements
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showQrCode}
                      onChange={e => setShowQrCode(e.target.checked)}
                      className="rounded theme-text theme-ring"
                    />
                    <span className="text-slate-700 dark:text-slate-300">Include UPI Payment QR Code</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBankDetails}
                      onChange={e => setShowBankDetails(e.target.checked)}
                      className="rounded theme-text theme-ring"
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
                      className="rounded theme-text theme-ring"
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      Print HSN / SAC Tax Slab Breakup Table
                    </span>
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Invoice Heading Label
                  </label>
                  <input
                    type="text"
                    value={customHeaderTitle}
                    onChange={e => setCustomHeaderTitle(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 theme-ring focus:outline-none"
                  />
                </div>
              </>
            )}

            <button
              type="button"
              onClick={handleSaveDefaults}
              className="w-full h-9 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-300 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {isSavedSettings ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Saved as Default Format</span>
                </>
              ) : (
                <span>Save Formatting as Company Default</span>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Printable Sheet Viewport */}
        <div className="print-viewport-wrapper lg:col-span-8 bg-slate-200 dark:bg-slate-950 p-3 sm:p-6 rounded-xl flex justify-center items-start overflow-x-auto w-full max-w-full">
          {currentInvoice ? (
            <div
              className={`print-only-container bg-white text-slate-900 shadow-md border border-slate-300 font-sans w-full flex flex-col ${
                paperSize === 'A5'
                  ? 'print-sheet-a5 max-w-[680px] min-h-[440px] p-3.5 sm:p-5 text-[11px] leading-snug'
                  : 'print-sheet-a4 max-w-[760px] min-h-[920px] p-5 sm:p-7 text-xs leading-relaxed'
              }`}
            >
              {useCustomTemplate && settings.invoiceTemplate ? (
                <CustomInvoiceRenderer
                  template={settings.invoiceTemplate}
                  voucher={currentInvoice}
                  settings={settings}
                  party={party}
                />
              ) : (
                <>
                  {/* Top Banner */}
                  <div className="border-b-2 border-slate-900 pb-3 mb-3 print-tight-mb">
                    <div className="flex justify-between items-start gap-2">
                      <div className="max-w-[65%]">
                        <h1 className="text-sm sm:text-base font-bold uppercase tracking-tight text-slate-950">
                          {settings.name}
                        </h1>
                        <p className="text-[10px] text-slate-600 leading-tight mt-0.5">{settings.address}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-medium text-slate-800 mt-1">
                          <span>
                            GSTIN: <strong className="font-mono">{settings.gstin}</strong>
                          </span>
                          <span>
                            State: {settings.state} ({settings.stateCode})
                          </span>
                          <span>Ph: {settings.phone}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="inline-block px-2.5 py-1 bg-slate-900 text-white text-[9px] sm:text-[10px] font-bold tracking-wider rounded-xs uppercase">
                          {customHeaderTitle}
                        </div>
                        <div className="mt-2 text-[10px] text-slate-700 space-y-0.5 font-mono">
                          <p>
                            <strong>Doc No:</strong> {currentInvoice.voucherNo}
                          </p>
                          <p>
                            <strong>Date:</strong> {currentInvoice.date}
                          </p>
                          <p>
                            <strong>Payment Mode:</strong> {currentInvoice.paymentMode}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Party & Business Box */}
                  <div className="print-two-col grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-300 p-2.5 print-tight-p rounded-xs mb-3 print-tight-mb bg-slate-50/50 text-[10px]">
                    <div>
                      <p className="uppercase font-bold text-slate-500 tracking-wider">
                        {currentInvoice.type === 'PURCHASE' ? 'Supplier (Vendor) Details' : 'Customer (Buyer) Details'}
                      </p>
                      <p className="font-bold text-slate-950 text-xs mt-0.5">{partyName}</p>
                      <p className="text-slate-600 mt-0.5">{partyAddress}</p>
                      <p className="mt-1">
                        GSTIN: <strong className="font-mono">{partyGstin}</strong>
                      </p>
                      <p>State: Code {partyStateCode}</p>
                    </div>

                    <div className="sm:border-l print:border-l border-slate-200 sm:pl-3 print:pl-3 pt-2 sm:pt-0 print:pt-0 border-t sm:border-t-0 print:border-t-0">
                      <p className="uppercase font-bold text-slate-500 tracking-wider">Business Address</p>
                      <p className="font-semibold text-slate-900 mt-0.5">{settings.name}</p>
                      <p className="text-slate-600 mt-0.5">{settings.address}</p>
                      {currentInvoice.notes && (
                        <p className="text-slate-500 italic mt-1 border-t border-slate-200 pt-0.5">
                          Remark: {currentInvoice.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="border border-slate-300 rounded-xs overflow-x-auto mb-3 print-tight-mb">
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
                            <td className="py-1 px-2 border-r border-slate-200 font-medium">{item.name}</td>
                            <td className="py-1 px-1.5 text-center font-mono border-r border-slate-200">{item.hsn}</td>
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

                  {/* Amount in words, Bank + QR, & Totals */}
                  <div className="print-totals-grid grid grid-cols-1 sm:grid-cols-12 gap-2 mb-3 print-tight-mb print-avoid-break">
                    <div className="print-totals-left sm:col-span-7 flex flex-col justify-between">
                      <div>
                        <p className="text-[9px] font-bold uppercase text-slate-500">Amount in words:</p>
                        <p className="font-semibold text-slate-900 italic text-[10px] mt-0.5">
                          {numberToWordsINR(currentInvoice.grandTotal)}
                        </p>
                      </div>

                      {(showBankDetails || upiUri) && (
                        <div className="border border-slate-200 p-2 print-tight-p rounded-xs bg-slate-50 text-[9px] font-mono mt-1.5 flex items-center justify-between gap-2">
                          <div>
                            {showBankDetails ? (
                              <>
                                <p className="font-bold uppercase text-slate-700">Bank Details for Transfer:</p>
                                <p>
                                  Bank: {settings.bankName} · A/c: {settings.accountNo}
                                </p>
                                <p>
                                  IFSC: {settings.ifsc} · UPI: {settings.upiId}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="font-bold uppercase text-slate-700">Pay via UPI</p>
                                <p>{settings.upiId}</p>
                              </>
                            )}
                          </div>
                          {upiUri && (
                            <div className="shrink-0 bg-white p-1 border border-slate-200 rounded-xs">
                              <QrCodeSvg value={upiUri} size={52} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="print-totals-right sm:col-span-5 border border-slate-300 rounded-xs p-2 print-tight-p bg-slate-50 font-mono text-[10px] space-y-0.5">
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
                      {Math.abs(currentInvoice.roundOff || 0) > 0 && (
                        <div className="flex justify-between text-slate-700">
                          <span>Round Off:</span>
                          <span>
                            {(currentInvoice.roundOff || 0) > 0
                              ? `+${formatINR(currentInvoice.roundOff!)}`
                              : `-${formatINR(Math.abs(currentInvoice.roundOff!))}`}
                          </span>
                        </div>
                      )}
                      <div className="border-t border-slate-900 pt-1 flex justify-between font-bold text-xs text-slate-950">
                        <span>Grand Total:</span>
                        <span>{formatINR(currentInvoice.grandTotal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* HSN Summary */}
                  {showHsnSummary && Object.keys(hsnBreakup).length > 0 && (
                    <div className="border border-slate-200 rounded-xs mb-3 print-tight-mb text-[9px] overflow-x-auto print-avoid-break">
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

                  {/* Footer */}
                  <div className="print-footer-anchor grid grid-cols-12 gap-3 pt-2 border-t border-slate-300 text-[9px] print-avoid-break">
                    <div className="col-span-7">
                      <p className="font-bold uppercase text-slate-600">Declaration &amp; Terms:</p>
                      <p className="text-slate-500 whitespace-pre-line leading-tight mt-0.5">
                        {settings.invoiceTerms}
                      </p>
                    </div>

                    <div className="col-span-5 text-right flex flex-col justify-between items-end">
                      <p className="font-semibold text-slate-800">{settings.authorizedSignatoryTitle}</p>
                      <div className="mt-6 print-sig-gap border-t border-slate-400 w-32 sm:w-36 pt-0.5 text-center text-slate-500">
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
          ) : (
            <div className="min-h-[360px] flex items-center justify-center p-10 text-slate-400 text-center text-xs">
              No invoice document selected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

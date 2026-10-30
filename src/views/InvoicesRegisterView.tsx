import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Printer,
  Eye,
  Plus,
  TrendingUp,
  ShoppingCart,
  RotateCcw,
  Building,
  CheckCircle2,
  Calendar,
  Filter,
  Download,
  Trash2
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { TransactionVoucher, VoucherType } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';

interface InvoicesRegisterViewProps {
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
  onOpenNewSale: () => void;
  onOpenNewPurchase: () => void;
}

export const InvoicesRegisterView: React.FC<InvoicesRegisterViewProps> = ({
  onSelectVoucherForPrint,
  onOpenNewSale,
  onOpenNewPurchase,
}) => {
  const { vouchers, getLedgerById, deleteVoucher } = useAccounting();

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SALE' | 'PURCHASE' | 'NOTES'>('ALL');
  const [gstFilter, setGstFilter] = useState<'ALL' | 'GST' | 'NON_GST'>('ALL');
  const [selectedVoucherForDetails, setSelectedVoucherForDetails] = useState<TransactionVoucher | null>(null);

  // Filter all commercial goods invoices (Sales, Purchases, Credit & Debit Notes)
  const invoiceVouchers = useMemo(() => {
    return vouchers.filter(v => ['SALE', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(v.type));
  }, [vouchers]);

  // Applied filtered list
  const filteredInvoices = useMemo(() => {
    return invoiceVouchers.filter(v => {
      // Type Filter
      if (typeFilter === 'SALE' && v.type !== 'SALE') return false;
      if (typeFilter === 'PURCHASE' && v.type !== 'PURCHASE') return false;
      if (typeFilter === 'NOTES' && !['CREDIT_NOTE', 'DEBIT_NOTE'].includes(v.type)) return false;

      // GST Filter
      if (gstFilter === 'GST' && !v.isGstBill) return false;
      if (gstFilter === 'NON_GST' && v.isGstBill) return false;

      // Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const party = v.partyId ? getLedgerById(v.partyId) : undefined;
        const partyName = (v.partyName || party?.name || '').toLowerCase();
        const voucherNo = (v.voucherNo || '').toLowerCase();
        const gstin = (party?.gstin || '').toLowerCase();
        const notes = (v.notes || '').toLowerCase();
        const itemsMatch = (v.items || []).some(
          it => it.name.toLowerCase().includes(query) || (it.hsn || '').toLowerCase().includes(query)
        );

        return (
          voucherNo.includes(query) ||
          partyName.includes(query) ||
          gstin.includes(query) ||
          notes.includes(query) ||
          itemsMatch
        );
      }

      return true;
    });
  }, [invoiceVouchers, typeFilter, gstFilter, searchQuery, getLedgerById]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let salesCount = 0;
    let salesTotal = 0;
    let salesGst = 0;

    let purchaseCount = 0;
    let purchaseTotal = 0;
    let purchaseGst = 0;

    invoiceVouchers.forEach(v => {
      const gstSum = (v.cgstTotal || 0) + (v.sgstTotal || 0) + (v.igstTotal || 0);
      if (v.type === 'SALE') {
        salesCount++;
        salesTotal += v.grandTotal || 0;
        salesGst += gstSum;
      } else if (v.type === 'PURCHASE') {
        purchaseCount++;
        purchaseTotal += v.grandTotal || 0;
        purchaseGst += gstSum;
      }
    });

    return {
      totalCount: invoiceVouchers.length,
      salesCount,
      salesTotal,
      salesGst,
      purchaseCount,
      purchaseTotal,
      purchaseGst,
      netGst: salesGst - purchaseGst,
    };
  }, [invoiceVouchers]);

  const getTypeBadge = (type: VoucherType) => {
    switch (type) {
      case 'SALE':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'PURCHASE':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'CREDIT_NOTE':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'DEBIT_NOTE':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getTypeName = (type: VoucherType) => {
    switch (type) {
      case 'SALE':
        return 'Sales Invoice';
      case 'PURCHASE':
        return 'Purchase Bill';
      case 'CREDIT_NOTE':
        return 'Credit Note';
      case 'DEBIT_NOTE':
        return 'Debit Note';
      default:
        return type;
    }
  };

  const handleDeleteVoucher = (v: TransactionVoucher) => {
    if (window.confirm(`Are you sure you want to delete invoice ${v.voucherNo}? This action will reverse inventory stock and ledger postings.`)) {
      deleteVoucher(v.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Core Invoice Register</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Central repository of all generated Sales Invoices, Purchase Bills, and Tax Adjustments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenNewPurchase}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all min-h-[38px]"
          >
            <Plus className="w-4 h-4" />
            <span>New Purchase Bill</span>
          </button>
          <button
            onClick={onOpenNewSale}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs transition-all min-h-[38px]"
          >
            <Plus className="w-4 h-4" />
            <span>New Sales Invoice</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Invoices */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Generated Invoices
          </p>
          <p className="text-xl font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {metrics.totalCount}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {metrics.salesCount} Sales · {metrics.purchaseCount} Purchases
          </span>
        </div>

        {/* Total Sales Invoices */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Sales Value
          </p>
          <p className="text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatINR(metrics.salesTotal)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            GST Output: {formatINR(metrics.salesGst)}
          </span>
        </div>

        {/* Total Purchase Bills */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Purchase Inward
          </p>
          <p className="text-xl font-extrabold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {formatINR(metrics.purchaseTotal)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            GST ITC Input: {formatINR(metrics.purchaseGst)}
          </span>
        </div>

        {/* Net GST Output */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Net Tax Position
          </p>
          <p className="text-xl font-extrabold font-mono text-blue-600 dark:text-blue-400 mt-1">
            {formatINR(Math.max(0, metrics.netGst))}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Output Tax minus Inward ITC
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Invoice No, Party Name, GSTIN, or Item Name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-medium"
            />
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'ALL', label: 'All Invoices' },
              { id: 'SALE', label: 'Sales Only' },
              { id: 'PURCHASE', label: 'Purchases Only' },
              { id: 'NOTES', label: 'Credit/Debit Notes' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTypeFilter(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap min-h-[32px] ${
                  typeFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary GST Filter Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-600 dark:text-slate-400">Tax Type:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setGstFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  gstFilter === 'ALL'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setGstFilter('GST')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  gstFilter === 'GST'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                ✓ GST Tax Invoices
              </button>
              <button
                onClick={() => setGstFilter('NON_GST')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  gstFilter === 'NON_GST'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Bill of Supply (Non-GST)
              </button>
            </div>
          </div>

          <span className="text-[11px] text-slate-400 font-mono">
            Showing {filteredInvoices.length} of {invoiceVouchers.length} documents
          </span>
        </div>
      </div>

      {/* Main Register Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4 w-28">Date</th>
                <th className="py-3 px-3 w-32">Invoice No</th>
                <th className="py-3 px-3 w-28">Nature</th>
                <th className="py-3 px-4">Party &amp; Account Details</th>
                <th className="py-3 px-3 w-20 text-center">Items</th>
                <th className="py-3 px-3 w-28 text-right">Taxable</th>
                <th className="py-3 px-3 w-24 text-right">GST Tax</th>
                <th className="py-3 px-4 w-32 text-right font-bold text-slate-900 dark:text-slate-100">
                  Total Amount (₹)
                </th>
                <th className="py-3 px-4 w-28 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No invoices matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(v => {
                  const party = v.partyId ? getLedgerById(v.partyId) : undefined;
                  const gstTotal = (v.cgstTotal || 0) + (v.sgstTotal || 0) + (v.igstTotal || 0);

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {v.date}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {v.voucherNo}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${getTypeBadge(v.type)}`}>
                          {getTypeName(v.type)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {party?.name || v.partyName || 'Cash / Retail Sale'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {party?.gstin ? `GSTIN: ${party.gstin}` : v.isGstBill ? 'Tax Invoice' : 'Bill of Supply'}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-600 dark:text-slate-400">
                        {v.items?.length || 0}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatINR(v.subtotal)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-blue-600 dark:text-blue-400">
                        {formatINR(gstTotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-950 dark:text-slate-100">
                        {formatINR(v.grandTotal)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Details Modal Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedVoucherForDetails(v)}
                            title="View Full Itemized Breakdown"
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-950/50 rounded-lg transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Print & Download Modal Button */}
                          <button
                            type="button"
                            onClick={() => onSelectVoucherForPrint(v)}
                            title="Print / Export PDF Invoice"
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/50 rounded-lg transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Delete Invoice Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteVoucher(v)}
                            title="Delete Invoice"
                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/50 rounded-lg transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details View Modal */}
      {selectedVoucherForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mb-1 ${getTypeBadge(selectedVoucherForDetails.type)}`}>
                  {getTypeName(selectedVoucherForDetails.type)}
                </span>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base font-mono">
                  #{selectedVoucherForDetails.voucherNo}
                </h3>
              </div>
              <button
                onClick={() => setSelectedVoucherForDetails(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Meta details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Date</p>
                <p className="font-mono font-bold text-slate-900 dark:text-slate-100">{selectedVoucherForDetails.date}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Party Name</p>
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {selectedVoucherForDetails.partyName || 'Cash / Retail Party'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Payment Mode</p>
                <p className="font-mono font-medium text-slate-800 dark:text-slate-200">{selectedVoucherForDetails.paymentMode}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Rate Input Mode</p>
                <p className="font-mono font-medium text-slate-800 dark:text-slate-200">
                  {selectedVoucherForDetails.isGstInclusive ? 'GST Inclusive Rates' : 'GST Exclusive Rates'}
                </p>
              </div>
            </div>

            {/* Line items table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Rate</th>
                    <th className="p-2.5 text-right">GST %</th>
                    <th className="p-2.5 text-right">Tax</th>
                    <th className="p-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {(selectedVoucherForDetails.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-sans font-medium text-slate-900 dark:text-slate-100">
                        {it.name}
                      </td>
                      <td className="p-2.5 text-center">{it.qty} {it.unit}</td>
                      <td className="p-2.5 text-right">{it.rate.toFixed(2)}</td>
                      <td className="p-2.5 text-right">{it.gstRate}%</td>
                      <td className="p-2.5 text-right">{(it.cgst + it.sgst + it.igst).toFixed(2)}</td>
                      <td className="p-2.5 text-right font-bold text-slate-950 dark:text-slate-100">{it.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800 font-mono text-xs">
              <div className="text-slate-500">
                Taxable: {formatINR(selectedVoucherForDetails.subtotal)}
              </div>
              <div className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                Grand Total: {formatINR(selectedVoucherForDetails.grandTotal)}
              </div>
            </div>

            {/* Action toolbar */}
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  const v = selectedVoucherForDetails;
                  setSelectedVoucherForDetails(null);
                  handleDeleteVoucher(v);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg border border-rose-200 dark:border-rose-900 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Invoice</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedVoucherForDetails(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const v = selectedVoucherForDetails;
                    setSelectedVoucherForDetails(null);
                    onSelectVoucherForPrint(v);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Download Invoice</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

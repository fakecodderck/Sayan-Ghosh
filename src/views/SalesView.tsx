import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Search,
  Plus,
  Printer,
  Trash2,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { TransactionVoucher } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';

interface SalesViewProps {
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
  onOpenNewSale: (partyId?: string, isGst?: boolean) => void;
  onNavigateToCustomer?: (customerId: string) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  onSelectVoucherForPrint,
  onOpenNewSale,
  onNavigateToCustomer,
}) => {
  const { vouchers, ledgers, deleteVoucher } = useAccounting();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('ALL');
  const [selectedGstFilter, setSelectedGstFilter] = useState<'ALL' | 'WITH_GST' | 'WITHOUT_GST'>('ALL');
  const [selectedMode, setSelectedMode] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');

  // All sales transactions
  const salesVouchers = useMemo(() => {
    return vouchers.filter(v => v.type === 'SALE');
  }, [vouchers]);

  // List of customers (Sundry Debtors)
  const customers = useMemo(() => {
    return ledgers.filter(l => l.group === 'Sundry Debtors');
  }, [ledgers]);

  // Filtered sales
  const filteredSales = useMemo(() => {
    return salesVouchers.filter(v => {
      // GST Filter
      if (selectedGstFilter === 'WITH_GST' && !v.isGstBill) return false;
      if (selectedGstFilter === 'WITHOUT_GST' && v.isGstBill) return false;

      // Customer Filter
      if (selectedCustomerId !== 'ALL' && v.partyId !== selectedCustomerId) return false;

      // Mode Filter
      if (selectedMode !== 'ALL' && v.paymentMode !== selectedMode) return false;

      // Date Filter
      if (selectedDate && v.date !== selectedDate) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNo = v.voucherNo.toLowerCase().includes(q);
        const matchesParty = v.partyName?.toLowerCase().includes(q);
        const matchesNotes = v.notes?.toLowerCase().includes(q);
        const matchesItems = v.items?.some(it => it.name.toLowerCase().includes(q) || it.hsn.toLowerCase().includes(q));
        if (!matchesNo && !matchesParty && !matchesNotes && !matchesItems) return false;
      }

      return true;
    });
  }, [salesVouchers, selectedGstFilter, selectedCustomerId, selectedMode, selectedDate, searchQuery]);

  // Metrics
  const totalSalesAmount = useMemo(() => {
    return filteredSales.reduce((acc, v) => acc + v.grandTotal, 0);
  }, [filteredSales]);

  const gstSalesAmount = useMemo(() => {
    return filteredSales.filter(v => v.isGstBill).reduce((acc, v) => acc + v.grandTotal, 0);
  }, [filteredSales]);

  const nonGstSalesAmount = useMemo(() => {
    return filteredSales.filter(v => !v.isGstBill).reduce((acc, v) => acc + v.grandTotal, 0);
  }, [filteredSales]);

  const totalGstCollected = useMemo(() => {
    return filteredSales.reduce((acc, v) => acc + (v.cgstTotal + v.sgstTotal + v.igstTotal), 0);
  }, [filteredSales]);

  const totalReceivablesDue = useMemo(() => {
    return customers.reduce((acc, c) => acc + (c.currentBalance > 0 ? c.currentBalance : 0), 0);
  }, [customers]);

  const handleDelete = (id: string, no: string) => {
    if (confirm(`Are you sure you want to delete sales invoice ${no}? This will add items back to inventory stock.`)) {
      deleteVoucher(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header & Fast Creation Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span>Sales &amp; Customer Invoices</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete sale history with GST &amp; Non-GST invoices, inventory deduction, and customer dues tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenNewSale(undefined, false)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Non-GST Sale</span>
          </button>
          <button
            onClick={() => onOpenNewSale(undefined, true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>+ GST Tax Invoice</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Sales Revenue
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 truncate">
            {formatINR(totalSalesAmount)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {filteredSales.length} Total Bills &amp; Invoices
          </span>
        </div>

        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            With GST vs Non-GST
          </p>
          <div className="flex items-center justify-between text-xs font-mono font-bold mt-1">
            <span className="text-emerald-600">{formatINR(gstSalesAmount)}</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-amber-600">{formatINR(nonGstSalesAmount)}</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            GST (Tax Invoices) / Non-GST
          </span>
        </div>

        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            GST Tax Collected
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 truncate">
            {formatINR(totalGstCollected)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            CGST + SGST + IGST liability
          </span>
        </div>

        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Customer Receivables
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 truncate">
            {formatINR(totalReceivablesDue)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Outstanding pending payments
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice #, customer name, or item..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-hidden"
            />
          </div>

          {/* GST Filter Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
            <button
              onClick={() => setSelectedGstFilter('ALL')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                selectedGstFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All Invoices
            </button>
            <button
              onClick={() => setSelectedGstFilter('WITH_GST')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                selectedGstFilter === 'WITH_GST'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              With GST
            </button>
            <button
              onClick={() => setSelectedGstFilter('WITHOUT_GST')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                selectedGstFilter === 'WITHOUT_GST'
                  ? 'bg-amber-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Without GST (Non-GST)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Customer */}
            <select
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
            >
              <option value="ALL">All Customers</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Filter by Payment Mode */}
            <select
              value={selectedMode}
              onChange={e => setSelectedMode(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
            >
              <option value="ALL">All Payment Modes</option>
              <option value="CREDIT">Credit (On Account)</option>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank Transfer</option>
              <option value="UPI">UPI</option>
            </select>

            {/* Date filter */}
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-mono"
            />
          </div>

          {(selectedCustomerId !== 'ALL' || selectedGstFilter !== 'ALL' || selectedMode !== 'ALL' || selectedDate || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCustomerId('ALL');
                setSelectedGstFilter('ALL');
                setSelectedMode('ALL');
                setSelectedDate('');
                setSearchQuery('');
              }}
              className="text-xs text-blue-600 hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-4 w-24">Date</th>
                <th className="py-2.5 px-3 w-32">Invoice No</th>
                <th className="py-2.5 px-3 min-w-[180px]">Customer / Buyer</th>
                <th className="py-2.5 px-3 w-28 text-center">Tax Type</th>
                <th className="py-2.5 px-3 w-24">Mode</th>
                <th className="py-2.5 px-3 w-28 text-right">Taxable (₹)</th>
                <th className="py-2.5 px-3 w-24 text-right">GST (₹)</th>
                <th className="py-2.5 px-4 w-32 text-right font-bold text-slate-900 dark:text-slate-100">
                  Total (₹)
                </th>
                <th className="py-2.5 px-3 w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No sales invoices match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredSales.map(v => (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {v.date}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                      {v.voucherNo}
                    </td>
                    <td className="py-2.5 px-3">
                      {v.partyId && onNavigateToCustomer ? (
                        <button
                          onClick={() => onNavigateToCustomer(v.partyId!)}
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-left truncate max-w-[220px] block"
                        >
                          {v.partyName || 'Cash Sale Customer'}
                        </button>
                      ) : (
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[220px]">
                          {v.partyName || 'Cash Sale Customer'}
                        </p>
                      )}
                      {v.notes && (
                        <p className="text-[10px] text-slate-400 truncate max-w-[220px]">
                          {v.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {v.isGstBill ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          With GST
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          Non-GST
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                      {v.paymentMode}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatINR(v.subtotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                      {formatINR(v.cgstTotal + v.sgstTotal + v.igstTotal)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-950 dark:text-slate-100 whitespace-nowrap">
                      {formatINR(v.grandTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onSelectVoucherForPrint(v)}
                          title="Print A5 / A4 Invoice"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded min-w-[32px] min-h-[32px] flex items-center justify-center"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id, v.voucherNo)}
                          title="Delete Invoice"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded min-w-[32px] min-h-[32px] flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

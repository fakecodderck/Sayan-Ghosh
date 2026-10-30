import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Search,
  Plus,
  Printer,
  Trash2,
  Calendar,
  Building,
  CreditCard,
  Filter
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { TransactionVoucher } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';

interface PurchasesViewProps {
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
  onOpenNewPurchase: (partyId?: string) => void;
  onNavigateToCompany?: (companyId: string) => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  onSelectVoucherForPrint,
  onOpenNewPurchase,
  onNavigateToCompany,
}) => {
  const { vouchers, ledgers, deleteVoucher } = useAccounting();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('ALL');
  const [selectedMode, setSelectedMode] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // All purchase transactions
  const purchaseVouchers = useMemo(() => {
    return vouchers.filter(v => v.type === 'PURCHASE');
  }, [vouchers]);

  // List of supplier companies (Sundry Creditors)
  const companies = useMemo(() => {
    return ledgers.filter(l => l.group === 'Sundry Creditors');
  }, [ledgers]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return purchaseVouchers.filter(v => {
      if (selectedCompanyId !== 'ALL' && v.partyId !== selectedCompanyId) return false;
      if (selectedMode !== 'ALL' && v.paymentMode !== selectedMode) return false;
      if (startDate && v.date < startDate) return false;
      if (endDate && v.date > endDate) return false;

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
  }, [purchaseVouchers, selectedCompanyId, selectedMode, startDate, endDate, searchQuery]);

  // Metrics
  const totalPurchaseAmount = useMemo(() => {
    return filteredPurchases.reduce((acc, v) => acc + v.grandTotal, 0);
  }, [filteredPurchases]);

  const totalTaxable = useMemo(() => {
    return filteredPurchases.reduce((acc, v) => acc + v.subtotal, 0);
  }, [filteredPurchases]);

  const totalInputGst = useMemo(() => {
    return filteredPurchases.reduce((acc, v) => acc + (v.cgstTotal + v.sgstTotal + v.igstTotal), 0);
  }, [filteredPurchases]);

  const totalPayablesDue = useMemo(() => {
    return companies.reduce((acc, c) => acc + (c.currentBalance < 0 ? Math.abs(c.currentBalance) : 0), 0);
  }, [companies]);

  const handleDelete = (id: string, no: string) => {
    if (confirm(`Are you sure you want to delete purchase bill ${no}? This will reverse inventory addition.`)) {
      deleteVoucher(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <span>Purchases (Inward Invoices &amp; Bills)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Procurement from companies &amp; suppliers, automatic inventory stock additions, and payable balance tracking
          </p>
        </div>

        <button
          onClick={() => onOpenNewPurchase()}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create New Purchase Bill</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Purchases
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 truncate">
            {formatINR(totalPurchaseAmount)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {filteredPurchases.length} Inward Bills
          </span>
        </div>

        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Taxable Goods Value
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-1 truncate">
            {formatINR(totalTaxable)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Net procurement cost
          </span>
        </div>

        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Input Tax Credit (ITC)
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-teal-600 dark:text-teal-400 mt-1 truncate">
            {formatINR(totalInputGst)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Eligible GST credit
          </span>
        </div>

        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Supplier Payables
          </p>
          <p className="text-base sm:text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 truncate">
            {formatINR(totalPayablesDue)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Outstanding balance to pay
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
              placeholder="Search purchase bill #, company name, or item..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-hidden"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Company */}
            <select
              value={selectedCompanyId}
              onChange={e => setSelectedCompanyId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
            >
              <option value="ALL">All Companies / Suppliers</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Filter by Payment Mode */}
            <select
              value={selectedMode}
              onChange={e => setSelectedMode(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
            >
              <option value="ALL">All Payment Modes</option>
              <option value="CREDIT">Credit (On Account)</option>
              <option value="BANK">Bank Transfer</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
            </select>

            {/* Date Reset */}
            {(startDate || endDate || selectedCompanyId !== 'ALL' || selectedMode !== 'ALL' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedCompanyId('ALL');
                  setSelectedMode('ALL');
                  setStartDate('');
                  setEndDate('');
                  setSearchQuery('');
                }}
                className="text-xs text-blue-600 hover:underline px-2 py-1"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-4 w-24">Date</th>
                <th className="py-2.5 px-3 w-32">Bill / Inv No</th>
                <th className="py-2.5 px-3 min-w-[180px]">Company / Supplier</th>
                <th className="py-2.5 px-3 w-28">Items Count</th>
                <th className="py-2.5 px-3 w-24">Payment Mode</th>
                <th className="py-2.5 px-3 w-28 text-right">Taxable (₹)</th>
                <th className="py-2.5 px-3 w-24 text-right">GST (₹)</th>
                <th className="py-2.5 px-4 w-32 text-right font-bold text-slate-900 dark:text-slate-100">
                  Total Bill (₹)
                </th>
                <th className="py-2.5 px-3 w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No purchase bills match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map(v => (
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
                      {v.partyId && onNavigateToCompany ? (
                        <button
                          onClick={() => onNavigateToCompany(v.partyId!)}
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-left truncate max-w-[220px] block"
                        >
                          {v.partyName || 'Direct Vendor'}
                        </button>
                      ) : (
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[220px]">
                          {v.partyName || 'Direct Vendor'}
                        </p>
                      )}
                      {v.notes && (
                        <p className="text-[10px] text-slate-400 truncate max-w-[220px]">
                          {v.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {v.items?.length || 0} Products
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {v.paymentMode}
                      </span>
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
                          title="Print / View Purchase Bill"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded min-w-[32px] min-h-[32px] flex items-center justify-center"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id, v.voucherNo)}
                          title="Delete Bill"
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

import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Search,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Building,
  CreditCard,
  QrCode,
  DollarSign,
  Trash2
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { PaymentMode, TransactionVoucher } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';

interface PaymentsReceiptsViewProps {
  onOpenNewVoucher: (type?: 'PAYMENT' | 'RECEIPT', partyId?: string) => void;
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
}

export const PaymentsReceiptsView: React.FC<PaymentsReceiptsViewProps> = ({
  onOpenNewVoucher,
  onSelectVoucherForPrint,
}) => {
  const { vouchers, ledgers, deleteVoucher } = useAccounting();

  const [filterType, setFilterType] = useState<'ALL' | 'RECEIPT' | 'PAYMENT'>('ALL');
  const [filterMode, setFilterMode] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const vouchersList = useMemo(() => {
    return vouchers.filter(v => {
      if (v.type !== 'PAYMENT' && v.type !== 'RECEIPT') return false;
      if (filterType !== 'ALL' && v.type !== filterType) return false;
      if (filterMode !== 'ALL' && v.paymentMode !== filterMode) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          v.voucherNo.toLowerCase().includes(q) ||
          v.partyName?.toLowerCase().includes(q) ||
          v.referenceNo?.toLowerCase().includes(q) ||
          v.notes?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vouchers, filterType, filterMode, searchQuery]);

  const totalReceipts = vouchers
    .filter(v => v.type === 'RECEIPT')
    .reduce((acc, v) => acc + v.grandTotal, 0);

  const totalPayments = vouchers
    .filter(v => v.type === 'PAYMENT')
    .reduce((acc, v) => acc + v.grandTotal, 0);

  // Bank & Cash accounts balances
  const bankAccounts = ledgers.filter(
    l => l.group === 'Bank Accounts' || l.group === 'Cash-in-hand'
  );

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            <span>Payments &amp; Receipts (Cash / Bank / UPI)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record customer receipts (customer pays me) or company payments (I pay a vendor), auto-adjusting ledger balances
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenNewVoucher('RECEIPT')}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Customer Pays Me</span>
          </button>
          <button
            onClick={() => onOpenNewVoucher('PAYMENT')}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>+ I Pay a Company</span>
          </button>
        </div>
      </div>

      {/* Cash & Bank Balances Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Money Received (Receipts)
          </p>
          <p className="text-xl font-bold font-mono text-teal-600 dark:text-teal-400 mt-1">
            {formatINR(totalReceipts)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Customer Collections</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Money Paid (Payments)
          </p>
          <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {formatINR(totalPayments)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Vendor &amp; Expense Disbursals</span>
        </div>

        {bankAccounts.slice(0, 2).map(acc => (
          <div key={acc.id} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">
              {acc.name}
            </p>
            <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
              {formatINR(acc.currentBalance)}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {acc.group} Available
            </span>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[260px] max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search voucher #, party name, or UTR ref..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Nature filter */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 rounded-md transition-colors ${
                filterType === 'ALL'
                  ? 'bg-white dark:bg-slate-700 font-semibold text-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setFilterType('RECEIPT')}
              className={`px-3 py-1 rounded-md transition-colors ${
                filterType === 'RECEIPT'
                  ? 'bg-white dark:bg-slate-700 font-semibold text-teal-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Receipts (In)
            </button>
            <button
              onClick={() => setFilterType('PAYMENT')}
              className={`px-3 py-1 rounded-md transition-colors ${
                filterType === 'PAYMENT'
                  ? 'bg-white dark:bg-slate-700 font-semibold text-rose-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Payments (Out)
            </button>
          </div>

          {/* Mode filter */}
          <select
            value={filterMode}
            onChange={e => setFilterMode(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
          >
            <option value="ALL">All Payment Modes</option>
            <option value="UPI">UPI / QR Code</option>
            <option value="BANK">Bank NEFT/RTGS</option>
            <option value="CASH">Cash Counter</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-4 w-28">Date</th>
                <th className="py-2.5 px-3 w-32">Voucher No</th>
                <th className="py-2.5 px-3 w-28">Nature</th>
                <th className="py-2.5 px-3">Party Account / Particulars</th>
                <th className="py-2.5 px-3 w-28">Mode</th>
                <th className="py-2.5 px-3 w-36">Reference / UTR</th>
                <th className="py-2.5 px-4 w-36 text-right font-bold text-slate-900 dark:text-slate-100">
                  Amount (₹)
                </th>
                <th className="py-2.5 px-3 w-32 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {vouchersList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No payment or receipt vouchers found.
                  </td>
                </tr>
              ) : (
                vouchersList.map(v => (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {v.date}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-200">
                      {v.voucherNo}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          v.type === 'RECEIPT'
                            ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {v.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {v.partyName || 'Direct Expense / Petty Cash'}
                      </p>
                      {v.notes && (
                        <p className="text-[10px] text-slate-400 truncate max-w-sm">{v.notes}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                      {v.paymentMode}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                      {v.referenceNo || '-'}
                    </td>
                    <td className={`py-2.5 px-4 text-right font-mono font-bold text-sm ${v.type === 'RECEIPT' ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {formatINR(v.grandTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onSelectVoucherForPrint(v)}
                          title="Print Receipt Slip"
                          className="px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded font-medium border border-blue-200 dark:border-blue-900"
                        >
                          Slip
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete voucher ${v.voucherNo}? This will restore ledger balances.`)) {
                              deleteVoucher(v.id);
                            }
                          }}
                          title="Delete Voucher"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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

import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  ArrowLeft,
  Printer,
  Trash2,
  Edit2,
  Phone,
  Mail,
  MapPin,
  Building,
  CreditCard,
  Receipt,
  FileCheck2,
  X,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { LedgerAccount, TransactionVoucher } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';

interface CustomersViewProps {
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
  onOpenNewSale: (partyId: string, isGst?: boolean) => void;
  onOpenNewReceipt: (partyId: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  onSelectVoucherForPrint,
  onOpenNewSale,
  onOpenNewReceipt,
}) => {
  const {
    ledgers,
    vouchers,
    addLedger,
    updateLedger,
    deleteLedger
  } = useAccounting();

  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [stateCode, setStateCode] = useState('27');
  const [creditLimit, setCreditLimit] = useState(100000);
  const [openingBalance, setOpeningBalance] = useState(0);

  // Filter only Sundry Debtors (Customers)
  const customers = useMemo(() => {
    return ledgers.filter(l => l.group === 'Sundry Debtors');
  }, [ledgers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.contactPerson?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.gstin?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [customers, searchQuery]);

  // Overall metrics
  const totalReceivables = useMemo(() => {
    return customers.reduce((acc, c) => acc + (c.currentBalance > 0 ? c.currentBalance : 0), 0);
  }, [customers]);

  const activeCustomer = customers.find(c => c.id === activeCustomerId);

  // Customer transactions
  const customerSales = useMemo(() => {
    if (!activeCustomer) return [];
    return vouchers
      .filter(v => v.partyId === activeCustomer.id && v.type === 'SALE')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [vouchers, activeCustomer]);

  const customerReceipts = useMemo(() => {
    if (!activeCustomer) return [];
    return vouchers
      .filter(v => v.partyId === activeCustomer.id && v.type === 'RECEIPT')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [vouchers, activeCustomer]);

  const customerTotalBilled = useMemo(() => {
    return customerSales.reduce((acc, v) => acc + v.grandTotal, 0);
  }, [customerSales]);

  const customerTotalPaid = useMemo(() => {
    return customerReceipts.reduce((acc, v) => acc + v.grandTotal, 0);
  }, [customerReceipts]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await addLedger({
      name: name.trim(),
      group: 'Sundry Debtors',
      contactPerson: contactPerson.trim() || undefined,
      gstin: gstin.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      stateCode: stateCode.trim() || '27',
      creditLimit: Number(creditLimit) || 0,
      openingBalance: Number(openingBalance) || 0,
      currentBalance: Number(openingBalance) || 0,
    });

    setShowAddModal(false);
    resetForm();
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer || !name.trim()) return;

    await updateLedger({
      ...activeCustomer,
      name: name.trim(),
      contactPerson: contactPerson.trim() || undefined,
      gstin: gstin.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      stateCode: stateCode.trim() || '27',
      creditLimit: Number(creditLimit) || 0,
    });

    setShowEditModal(false);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (confirm('Are you sure you want to delete this customer account?')) {
      await deleteLedger(id);
      if (activeCustomerId === id) {
        setActiveCustomerId(null);
      }
    }
  };

  const resetForm = () => {
    setName('');
    setContactPerson('');
    setGstin('');
    setPhone('');
    setEmail('');
    setAddress('');
    setStateCode('27');
    setCreditLimit(100000);
    setOpeningBalance(0);
  };

  const openEdit = (c: LedgerAccount) => {
    setName(c.name);
    setContactPerson(c.contactPerson || '');
    setGstin(c.gstin || '');
    setPhone(c.phone || '');
    setEmail(c.email || '');
    setAddress(c.address || '');
    setStateCode(c.stateCode || '27');
    setCreditLimit(c.creditLimit || 100000);
    setShowEditModal(true);
  };

  // If a customer is selected, render their dedicated customer page
  if (activeCustomer) {
    return (
      <div className="space-y-6">
        {/* Back and Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveCustomerId(null)}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {activeCustomer.name}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                  Customer
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                {activeCustomer.gstin ? `GSTIN: ${activeCustomer.gstin}` : 'Unregistered (B2C)'} · State: {activeCustomer.stateCode || '27'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onOpenNewSale(activeCustomer.id, false)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all min-h-[38px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Non-GST Sale</span>
            </button>
            <button
              onClick={() => onOpenNewSale(activeCustomer.id, true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all min-h-[38px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ GST Invoice</span>
            </button>
            <button
              onClick={() => onOpenNewReceipt(activeCustomer.id)}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all min-h-[38px]"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>+ Record Payment</span>
            </button>
            <button
              onClick={() => openEdit(activeCustomer)}
              className="p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
              title="Edit Profile"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Customer Financial Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Invoiced (Billed)
            </p>
            <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
              {formatINR(customerTotalBilled)}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {customerSales.length} Total Sales Invoices
            </span>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Money Paid (Receipts)
            </p>
            <p className="text-xl font-bold font-mono text-teal-600 dark:text-teal-400 mt-1">
              {formatINR(customerTotalPaid)}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {customerReceipts.length} Payments Collected
            </span>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Current Balance Due
            </p>
            <p className={`text-xl font-bold font-mono mt-1 ${activeCustomer.currentBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
              {formatINR(Math.abs(activeCustomer.currentBalance))}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {activeCustomer.currentBalance > 0 ? 'Customer owes you' : 'Cleared / Advance'}
            </span>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Credit Limit
            </p>
            <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
              {formatINR(activeCustomer.creditLimit || 0)}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Authorized credit buffer
            </span>
          </div>
        </div>

        {/* Business Contact & Tax Info Card */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-2.5">
            <Phone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {activeCustomer.phone || 'No phone recorded'}
              </p>
              {activeCustomer.contactPerson && (
                <p className="text-slate-500 text-[11px]">Attn: {activeCustomer.contactPerson}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Billing Address</span>
              <p className="text-slate-700 dark:text-slate-300">
                {activeCustomer.address || 'Local address not specified'}
              </p>
              <p className="text-slate-500 text-[11px]">State Code: {activeCustomer.stateCode || '27'}</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Building className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Tax &amp; Legal</span>
              <p className="font-mono text-slate-800 dark:text-slate-200">
                GSTIN: {activeCustomer.gstin || 'Unregistered'}
              </p>
              {activeCustomer.email && (
                <p className="text-slate-500 text-[11px] truncate">{activeCustomer.email}</p>
              )}
            </div>
          </div>
        </div>

        {/* Order History (All Sales to this Customer) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Order &amp; Sale History ({customerSales.length})</span>
            </h3>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-4 w-24">Date</th>
                    <th className="py-2.5 px-3 w-32">Invoice No</th>
                    <th className="py-2.5 px-3 w-28 text-center">GST Type</th>
                    <th className="py-2.5 px-3">Items Summary</th>
                    <th className="py-2.5 px-3 w-24">Mode</th>
                    <th className="py-2.5 px-3 w-28 text-right">Taxable</th>
                    <th className="py-2.5 px-3 w-24 text-right">GST</th>
                    <th className="py-2.5 px-4 w-32 text-right font-bold text-slate-900 dark:text-slate-100">
                      Amount (₹)
                    </th>
                    <th className="py-2.5 px-3 w-20 text-center">Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {customerSales.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No sales invoices recorded for this customer yet.
                      </td>
                    </tr>
                  ) : (
                    customerSales.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {v.date}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                          {v.voucherNo}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {v.isGstBill ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              GST Tax Inv
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              Non-GST
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="text-slate-800 dark:text-slate-200 truncate max-w-xs font-medium">
                            {v.items?.map(it => `${it.qty} ${it.unit} ${it.name}`).join(', ') || 'Direct Sale'}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                          {v.paymentMode}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatINR(v.subtotal)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                          {formatINR(v.cgstTotal + v.sgstTotal + v.igstTotal)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatINR(v.grandTotal)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => onSelectVoucherForPrint(v)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                            title="Print A5 Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Payment History (All Receipts from this Customer) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4 text-teal-600" />
              <span>Payment &amp; Receipt History ({customerReceipts.length})</span>
            </h3>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-4 w-28">Date</th>
                    <th className="py-2.5 px-3 w-32">Receipt No</th>
                    <th className="py-2.5 px-3 w-28">Mode</th>
                    <th className="py-2.5 px-3 w-36">Reference / UTR</th>
                    <th className="py-2.5 px-3">Narration / Notes</th>
                    <th className="py-2.5 px-4 w-36 text-right font-bold text-teal-600 dark:text-teal-400">
                      Amount Received (₹)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {customerReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No payment receipts recorded for this customer yet.
                      </td>
                    </tr>
                  ) : (
                    customerReceipts.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {v.date}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                          {v.voucherNo}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {v.paymentMode}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                          {v.referenceNo || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {v.notes || 'Payment received on account'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                          {formatINR(v.grandTotal)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 space-y-4 my-8">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Edit Customer Profile
                </h3>
                <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateCustomer} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Customer / Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={e => setContactPerson(e.target.value)}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      value={gstin}
                      onChange={e => setGstin(e.target.value.toUpperCase())}
                      className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Credit Limit (₹)
                    </label>
                    <input
                      type="number"
                      value={creditLimit}
                      onChange={e => setCreditLimit(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Address
                  </label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-3.5 py-2 text-slate-600 bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Customer List Directory
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Customers (Sundry Debtors)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Customer directory with individual account pages, order history, dues, and payment statements
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add New Customer</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Customer Dues (Receivables)
          </p>
          <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {formatINR(totalReceivables)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Money to be collected from buyers
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Registered Customers
          </p>
          <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
            {customers.length} Accounts
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Wholesale buyers &amp; retail clients
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Pending Balance Accounts
          </p>
          <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {customers.filter(c => c.currentBalance > 0).length} Parties
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Parties with outstanding balances
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer name, phone, GSTIN, city..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-4 w-12 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[200px]">Customer / Business Name</th>
                <th className="py-2.5 px-3 w-32">Phone</th>
                <th className="py-2.5 px-3 w-36">GSTIN</th>
                <th className="py-2.5 px-3 w-32 text-right">Credit Limit</th>
                <th className="py-2.5 px-4 w-36 text-right font-bold text-slate-900 dark:text-slate-100">
                  Current Due (₹)
                </th>
                <th className="py-2.5 px-3 w-36 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No customers found matching your search.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, idx) => {
                  const isDue = c.currentBalance > 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => setActiveCustomerId(c.id)}
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-left block"
                        >
                          {c.name}
                        </button>
                        {c.contactPerson && (
                          <span className="text-[10px] text-slate-400 block">
                            Attn: {c.contactPerson}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {c.phone || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {c.gstin || 'Unregistered'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {formatINR(c.creditLimit || 0)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isDue ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}>
                          {formatINR(Math.abs(c.currentBalance))}
                        </span>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">
                          {isDue ? 'Due (Dr)' : 'Cleared'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setActiveCustomerId(c.id)}
                            className="px-2.5 py-1 text-[11px] bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded font-semibold border border-blue-200 dark:border-blue-800"
                          >
                            View Page
                          </button>
                          <button
                            onClick={() => onOpenNewSale(c.id)}
                            title="New Invoice"
                            className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(c.id)}
                            title="Delete Customer"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 space-y-4 my-8">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Register New Customer Account
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Customer / Business Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Electricals Pvt Ltd"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Shah"
                    value={contactPerson}
                    onChange={e => setContactPerson(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Phone / Mobile *
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98200 12345"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    GSTIN (For B2B Invoices)
                  </label>
                  <input
                    type="text"
                    placeholder="27ABCDE1234F1Z5"
                    value={gstin}
                    onChange={e => setGstin(e.target.value.toUpperCase())}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="billing@metroelec.in"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Billing &amp; Delivery Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Shop #, Street, Commercial Complex, City, Pincode"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Opening Receivable Balance (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={openingBalance}
                    onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    value={creditLimit}
                    onChange={e => setCreditLimit(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

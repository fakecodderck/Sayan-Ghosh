import React, { useState, useMemo } from 'react';
import {
  Building,
  Search,
  Plus,
  ArrowLeft,
  Printer,
  Trash2,
  Edit2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Receipt,
  FileCheck2,
  X,
  ShoppingCart,
  DollarSign
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { LedgerAccount, TransactionVoucher } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';

interface CompaniesViewProps {
  onSelectVoucherForPrint: (voucher: TransactionVoucher) => void;
  onOpenNewPurchase: (partyId: string) => void;
  onOpenNewPayment: (partyId: string) => void;
}

export const CompaniesView: React.FC<CompaniesViewProps> = ({
  onSelectVoucherForPrint,
  onOpenNewPurchase,
  onOpenNewPayment,
}) => {
  const {
    ledgers,
    vouchers,
    addLedger,
    updateLedger,
    deleteLedger
  } = useAccounting();

  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
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
  const [openingBalance, setOpeningBalance] = useState(0);
  const [companyError, setCompanyError] = useState<string | null>(null);

  // Filter only Sundry Creditors (Companies / Suppliers)
  const companies = useMemo(() => {
    return ledgers.filter(l => l.group === 'Sundry Creditors');
  }, [ledgers]);

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
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
  }, [companies, searchQuery]);

  // Overall metrics
  const totalPayables = useMemo(() => {
    return companies.reduce((acc, c) => acc + (c.currentBalance < 0 ? Math.abs(c.currentBalance) : 0), 0);
  }, [companies]);

  const activeCompany = companies.find(c => c.id === activeCompanyId);

  // Company transactions
  const companyPurchases = useMemo(() => {
    if (!activeCompany) return [];
    return vouchers
      .filter(v => v.partyId === activeCompany.id && v.type === 'PURCHASE')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [vouchers, activeCompany]);

  const companyPayments = useMemo(() => {
    if (!activeCompany) return [];
    return vouchers
      .filter(v => v.partyId === activeCompany.id && v.type === 'PAYMENT')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [vouchers, activeCompany]);

  const companyTotalPurchases = useMemo(() => {
    return companyPurchases.reduce((acc, v) => acc + v.grandTotal, 0);
  }, [companyPurchases]);

  const companyTotalPaid = useMemo(() => {
    return companyPayments.reduce((acc, v) => acc + v.grandTotal, 0);
  }, [companyPayments]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCompanyError(null);

    // In double entry, initial payable to supplier is negative
    const opBal = Number(openingBalance) || 0;
    const initialBal = opBal !== 0 ? -Math.abs(opBal) : 0;

    try {
      await addLedger({
        name: name.trim(),
        group: 'Sundry Creditors',
        contactPerson: contactPerson.trim() || undefined,
        gstin: gstin.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        stateCode: stateCode.trim() || '27',
        openingBalance: initialBal,
        currentBalance: initialBal,
      });

      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      setCompanyError(err.message || 'Failed to add company');
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany || !name.trim()) return;

    await updateLedger({
      ...activeCompany,
      name: name.trim(),
      contactPerson: contactPerson.trim() || undefined,
      gstin: gstin.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      stateCode: stateCode.trim() || '27',
    });

    setShowEditModal(false);
  };

  const handleDeleteCompany = async (id: string) => {
    if (confirm('Are you sure you want to delete this company account?')) {
      await deleteLedger(id);
      if (activeCompanyId === id) {
        setActiveCompanyId(null);
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
    setShowEditModal(true);
  };

  // If a company is selected, render their dedicated company page
  if (activeCompany) {
    return (
      <div className="space-y-6">
        {/* Back and Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveCompanyId(null)}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {activeCompany.name}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                  Company / Supplier
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                {activeCompany.gstin ? `GSTIN: ${activeCompany.gstin}` : 'Unregistered Supplier'} · State: {activeCompany.stateCode || '27'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onOpenNewPurchase(activeCompany.id)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all min-h-[38px]"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>+ Create Purchase</span>
            </button>
            <button
              onClick={() => onOpenNewPayment(activeCompany.id)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all min-h-[38px]"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>+ Pay Company</span>
            </button>
            <button
              onClick={() => openEdit(activeCompany)}
              className="p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
              title="Edit Profile"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Company Financial Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Purchases Billed
            </p>
            <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
              {formatINR(companyTotalPurchases)}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {companyPurchases.length} Purchase Inward Bills
            </span>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Amount Paid
            </p>
            <p className="text-xl font-bold font-mono text-teal-600 dark:text-teal-400 mt-1">
              {formatINR(companyTotalPaid)}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {companyPayments.length} Disbursals Made
            </span>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Current Payable Due
            </p>
            <p className={`text-xl font-bold font-mono mt-1 ${activeCompany.currentBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
              {formatINR(Math.abs(activeCompany.currentBalance))}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {activeCompany.currentBalance < 0 ? 'You owe this company' : 'Cleared / Advance paid'}
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
                {activeCompany.phone || 'No phone recorded'}
              </p>
              {activeCompany.contactPerson && (
                <p className="text-slate-500 text-[11px]">Representative: {activeCompany.contactPerson}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Vendor Address</span>
              <p className="text-slate-700 dark:text-slate-300">
                {activeCompany.address || 'Address not recorded'}
              </p>
              <p className="text-slate-500 text-[11px]">State Code: {activeCompany.stateCode || '27'}</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Building className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Tax &amp; Legal</span>
              <p className="font-mono text-slate-800 dark:text-slate-200">
                GSTIN: {activeCompany.gstin || 'Unregistered'}
              </p>
              {activeCompany.email && (
                <p className="text-slate-500 text-[11px] truncate">{activeCompany.email}</p>
              )}
            </div>
          </div>
        </div>

        {/* Purchase History (All Bills from this Company) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <span>Purchase History ({companyPurchases.length})</span>
            </h3>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-4 w-24">Date</th>
                    <th className="py-2.5 px-3 w-32">Bill / Inv No</th>
                    <th className="py-2.5 px-3">Purchased Items</th>
                    <th className="py-2.5 px-3 w-24">Payment Mode</th>
                    <th className="py-2.5 px-3 w-28 text-right">Taxable</th>
                    <th className="py-2.5 px-3 w-24 text-right">GST</th>
                    <th className="py-2.5 px-4 w-32 text-right font-bold text-slate-900 dark:text-slate-100">
                      Amount (₹)
                    </th>
                    <th className="py-2.5 px-3 w-20 text-center">Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {companyPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No purchase bills recorded from this company yet.
                      </td>
                    </tr>
                  ) : (
                    companyPurchases.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {v.date}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                          {v.voucherNo}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="text-slate-800 dark:text-slate-200 truncate max-w-xs font-medium">
                            {v.items?.map(it => `${it.qty} ${it.unit} ${it.name}`).join(', ') || 'Inward Purchase'}
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
                            title="Print / View Bill"
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

        {/* Payment History (All Payments Made to this Company) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-rose-600" />
              <span>Payments Disbursed to Company ({companyPayments.length})</span>
            </h3>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-4 w-28">Date</th>
                    <th className="py-2.5 px-3 w-32">Payment No</th>
                    <th className="py-2.5 px-3 w-28">Mode</th>
                    <th className="py-2.5 px-3 w-36">Reference / UTR</th>
                    <th className="py-2.5 px-3">Narration / Notes</th>
                    <th className="py-2.5 px-4 w-36 text-right font-bold text-rose-600 dark:text-rose-400">
                      Amount Paid (₹)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {companyPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No payments recorded for this company yet.
                      </td>
                    </tr>
                  ) : (
                    companyPayments.map(v => (
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
                          {v.notes || 'Disbursed on account'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
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
                  Edit Company Profile
                </h3>
                <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateCompany} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Company Name *
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
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
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

  // Company List Directory
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building className="w-5 h-5 text-purple-600" />
            <span>Companies &amp; Suppliers (Sundry Creditors)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Vendor companies directory with individual profile pages, purchase history, and payable balances
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
          <span>+ Add New Company</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Supplier Payables (We Owe)
          </p>
          <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {formatINR(totalPayables)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Pending disbursements to vendors
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Registered Vendor Companies
          </p>
          <p className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
            {companies.length} Companies
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Manufacturers &amp; distributors
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Active Payables
          </p>
          <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {companies.filter(c => c.currentBalance < 0).length} Companies
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Vendors awaiting payment
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search company name, phone, GSTIN, city..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-4 w-12 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[200px]">Company Name</th>
                <th className="py-2.5 px-3 w-32">Phone</th>
                <th className="py-2.5 px-3 w-36">GSTIN</th>
                <th className="py-2.5 px-4 w-36 text-right font-bold text-slate-900 dark:text-slate-100">
                  Balance Payable (₹)
                </th>
                <th className="py-2.5 px-3 w-36 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No companies found matching your search.
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((c, idx) => {
                  const isPayable = c.currentBalance < 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => setActiveCompanyId(c.id)}
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-left block"
                        >
                          {c.name}
                        </button>
                        {c.contactPerson && (
                          <span className="text-[10px] text-slate-400 block">
                            Contact: {c.contactPerson}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {c.phone || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {c.gstin || 'Unregistered'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isPayable ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}>
                          {formatINR(Math.abs(c.currentBalance))}
                        </span>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">
                          {isPayable ? 'Payable (Cr)' : 'Settled'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setActiveCompanyId(c.id)}
                            className="px-2.5 py-1 text-[11px] bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded font-semibold border border-blue-200 dark:border-blue-800"
                          >
                            View Page
                          </button>
                          <button
                            onClick={() => onOpenNewPurchase(c.id)}
                            title="New Purchase"
                            className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCompany(c.id)}
                            title="Delete Company"
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

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 space-y-4 my-8">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Register New Company / Supplier
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-4 text-xs">
              {companyError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-medium">
                  {companyError}
                </div>
              )}
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Havells India Cables Ltd"
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
                    placeholder="e.g. Sales Director / Manager"
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
                    placeholder="+91 22 2847 1000"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    placeholder="27AABCH1234F1Z8"
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
                    placeholder="orders@supplier.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Company / Factory Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Industrial Area, Sector, City, Pincode"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Opening Payable Balance (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="Amount you owe to company at start"
                  value={openingBalance}
                  onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
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
                  Save Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

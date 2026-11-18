import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  ArrowLeft,
  X,
  Edit2,
  Trash2
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { INDIAN_STATES, LedgerAccount, LedgerGroup } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';
import { SYSTEM_LEDGER_DEFINITIONS } from '../utils/doubleEntryEngine';

export const LedgersView: React.FC = () => {
  const { ledgers, vouchers, settings, addLedger, updateLedger, deleteLedger } = useAccounting();

  const defaultStateCode = settings.stateCode || '19';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [activeLedgerId, setActiveLedgerId] = useState<string>(ledgers[0]?.id || '');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Add / Edit Ledger Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingLedger, setEditingLedger] = useState<LedgerAccount | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [newLedgerName, setNewLedgerName] = useState('');
  const [newLedgerGroup, setNewLedgerGroup] = useState<LedgerGroup>('Sundry Debtors');
  const [newGstin, setNewGstin] = useState('');
  const [newStateCode, setNewStateCode] = useState(defaultStateCode);
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newOpeningBal, setNewOpeningBal] = useState(0);
  const [newCreditLimit, setNewCreditLimit] = useState(100000);

  useEffect(() => {
    if (!activeLedgerId && ledgers.length > 0) {
      setActiveLedgerId(ledgers[0].id);
    }
  }, [activeLedgerId, ledgers]);

  useEffect(() => {
    if (!showModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showModal]);

  const filteredLedgers = useMemo(() => {
    return ledgers.filter(l => {
      if (selectedGroup !== 'ALL' && l.group !== selectedGroup) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.group.toLowerCase().includes(q) ||
          l.gstin?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [ledgers, selectedGroup, searchQuery]);

  const activeLedger = ledgers.find(l => l.id === activeLedgerId) || filteredLedgers[0];

  // Transactions specifically affecting the active ledger
  const partyTransactions = useMemo(() => {
    if (!activeLedger) return [];
    return vouchers
      .filter(v => {
        if (v.journalEntries && v.journalEntries.length > 0) {
          return v.journalEntries.some(j => j.accountId === activeLedger.id);
        }
        return v.partyId === activeLedger.id;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [vouchers, activeLedger]);

  // Compute running balance ledger statement
  const statementRows = useMemo(() => {
    if (!activeLedger) return [];

    let running = activeLedger.openingBalance || 0;
    return partyTransactions.map(v => {
      let debit = 0;
      let credit = 0;

      const journalMatch = v.journalEntries?.find(j => j.accountId === activeLedger.id);
      if (journalMatch) {
        debit = journalMatch.debit;
        credit = journalMatch.credit;
      } else {
        if (v.type === 'SALE') {
          debit = v.grandTotal;
        } else if (v.type === 'RECEIPT') {
          credit = v.grandTotal;
        } else if (v.type === 'PURCHASE') {
          credit = v.grandTotal;
        } else if (v.type === 'PAYMENT') {
          debit = v.grandTotal;
        } else if (v.type === 'CREDIT_NOTE') {
          credit = v.grandTotal;
        } else if (v.type === 'DEBIT_NOTE') {
          debit = v.grandTotal;
        }
      }

      if (activeLedger.group === 'Sales Accounts' || (activeLedger.group === 'Duties & Taxes' && !activeLedger.name.toLowerCase().includes('input'))) {
        running = running + credit - debit;
      } else {
        running = running + debit - credit;
      }

      return {
        ...v,
        debit,
        credit,
        runningBalance: Number(running.toFixed(2)),
      };
    });
  }, [partyTransactions, activeLedger]);

  const handleSelectParty = (id: string) => {
    setActiveLedgerId(id);
    setConfirmDeleteId(null);
    setMobileView('detail');
  };

  const openCreateModal = () => {
    setEditingLedger(null);
    setLedgerError(null);
    setNewLedgerName('');
    setNewLedgerGroup('Sundry Debtors');
    setNewGstin('');
    setNewStateCode(defaultStateCode);
    setNewPhone('');
    setNewEmail('');
    setNewAddress('');
    setNewOpeningBal(0);
    setNewCreditLimit(100000);
    setShowModal(true);
  };

  const openEditModal = (ledger: LedgerAccount) => {
    setEditingLedger(ledger);
    setLedgerError(null);
    setNewLedgerName(ledger.name);
    setNewLedgerGroup(ledger.group);
    setNewGstin(ledger.gstin || '');
    setNewStateCode(ledger.stateCode || defaultStateCode);
    setNewPhone(ledger.phone || '');
    setNewEmail(ledger.email || '');
    setNewAddress(ledger.address || '');
    setNewOpeningBal(ledger.openingBalance || 0);
    setNewCreditLimit(ledger.creditLimit || 100000);
    setShowModal(true);
  };

  const handleSaveLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLedgerName.trim()) return;
    setLedgerError(null);

    try {
      if (editingLedger) {
        await updateLedger({
          ...editingLedger,
          name: newLedgerName.trim(),
          group: newLedgerGroup,
          gstin: newGstin.trim() || undefined,
          stateCode: newStateCode.trim() || undefined,
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
          address: newAddress.trim() || undefined,
          creditLimit: Number(newCreditLimit) || undefined,
        });
      } else {
        await addLedger({
          name: newLedgerName.trim(),
          group: newLedgerGroup,
          gstin: newGstin.trim() || undefined,
          stateCode: newStateCode.trim() || undefined,
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
          address: newAddress.trim() || undefined,
          openingBalance: Number(newOpeningBal) || 0,
          currentBalance: Number(newOpeningBal) || 0,
          creditLimit: Number(newCreditLimit) || undefined,
        });
      }
      setShowModal(false);
    } catch (err: any) {
      setLedgerError(err.message || 'Failed to save ledger account');
    }
  };

  const handleDeleteLedger = async (id: string) => {
    try {
      await deleteLedger(id);
      setConfirmDeleteId(null);
      if (activeLedgerId === id) {
        const next = ledgers.find(l => l.id !== id);
        setActiveLedgerId(next?.id || '');
      }
    } catch {
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Party &amp; Account Ledgers (Khata)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Party statements, running debit/credit balances, and master accounts directory
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 theme-bg theme-bg-hover active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          <span>Create Ledger Account</span>
        </button>
      </div>

      {/* Main Split Layout: Responsive for Desktop & Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Master Directory */}
        <div
          className={`lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col h-[650px] lg:h-[750px] overflow-hidden shadow-xs ${
            mobileView === 'detail' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Search & Group Filter */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50 dark:bg-slate-900/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search party name or GSTIN..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-hidden theme-ring"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1 text-[11px]">
              {['ALL', 'Sundry Debtors', 'Sundry Creditors', 'Bank Accounts', 'Direct Expenses'].map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGroup(g)}
                  className={`px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors min-h-[32px] ${
                    selectedGroup === g
                      ? 'theme-bg text-white font-medium'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {g === 'ALL' ? 'All' : g.replace('Sundry ', '')}
                </button>
              ))}
            </div>
          </div>

          {/* Ledger List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-1.5 space-y-0.5">
            {filteredLedgers.map(l => {
              const isSelected = l.id === activeLedger?.id;
              const isDebit = l.currentBalance >= 0;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => handleSelectParty(l.id)}
                  className={`w-full p-2.5 rounded-lg text-left transition-colors flex items-center justify-between min-h-[52px] ${
                    isSelected
                      ? 'theme-active-nav'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className={`text-xs font-semibold truncate ${isSelected ? 'theme-text' : 'text-slate-900 dark:text-slate-200'}`}>
                      {l.name}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {l.group} {l.gstin ? `· ${l.gstin}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-mono tabular-nums font-bold ${isDebit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {formatINR(Math.abs(l.currentBalance))}
                    </p>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      {isDebit ? 'Dr (Receivable)' : 'Cr (Payable)'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Party Account Statement */}
        <div
          className={`lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col h-[650px] lg:h-[750px] shadow-xs overflow-hidden ${
            mobileView === 'list' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {activeLedger ? (
            <>
              {/* Account Header Details */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40">
                {/* Mobile Back Button */}
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="lg:hidden flex items-center gap-1.5 text-xs theme-text font-semibold mb-3 py-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to All Accounts</span>
                </button>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {activeLedger.name}
                    </h3>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{activeLedger.group}</span>
                      {activeLedger.gstin && (
                        <span>
                          · GSTIN: <strong className="font-mono text-slate-700 dark:text-slate-300">{activeLedger.gstin}</strong>
                        </span>
                      )}
                      {activeLedger.phone && <span>· Ph: {activeLedger.phone}</span>}
                    </div>

                    {activeLedger.address && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        {activeLedger.address}
                      </p>
                    )}

                    {!SYSTEM_LEDGER_DEFINITIONS.some(s => s.id === activeLedger.id) && (
                      <div className="flex items-center gap-2 mt-2.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(activeLedger)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        {confirmDeleteId === activeLedger.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteLedger(activeLedger.id)}
                              className="px-2 py-1 text-[11px] font-bold bg-rose-600 text-white rounded-md"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(activeLedger.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-800"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Balance Display Card */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-lg text-left sm:text-right shrink-0 min-w-[150px]">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Net Closing Balance
                    </span>
                    <p className={`text-base font-bold font-mono tabular-nums mt-0.5 ${activeLedger.currentBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {formatINR(Math.abs(activeLedger.currentBalance))}
                    </p>
                    <span className="text-[10px] text-slate-500">
                      {activeLedger.currentBalance >= 0 ? 'Dr (Receivable)' : 'Cr (Payable)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statement Entries Table (Scrollable on small screens) */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] sticky top-0 border-b border-slate-200 dark:border-slate-800 z-10">
                    <tr>
                      <th className="py-2.5 px-4 w-24">Date</th>
                      <th className="py-2.5 px-3 w-32">Voucher No</th>
                      <th className="py-2.5 px-3 min-w-[120px]">Type</th>
                      <th className="py-2.5 px-3 w-24 text-right text-emerald-600">Debit (₹)</th>
                      <th className="py-2.5 px-3 w-24 text-right text-rose-600">Credit (₹)</th>
                      <th className="py-2.5 px-4 w-28 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {/* Opening Balance Row */}
                    <tr className="bg-slate-50/50 dark:bg-slate-900/20 font-semibold text-[11px]">
                      <td className="py-2 px-4 font-mono text-slate-500">01-Apr</td>
                      <td className="py-2 px-3 text-slate-500">OPENING</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">Opening Balance</td>
                      <td className="py-2 px-3 text-right font-mono">
                        {activeLedger.openingBalance >= 0 ? formatINR(activeLedger.openingBalance) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {activeLedger.openingBalance < 0 ? formatINR(Math.abs(activeLedger.openingBalance)) : '-'}
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatINR(activeLedger.openingBalance)}
                      </td>
                    </tr>

                    {statementRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          No transactions recorded for this ledger yet.
                        </td>
                      </tr>
                    ) : (
                      statementRows.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {row.date}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                            {row.voucherNo}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {row.type}
                            </span>
                            {row.notes && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-xs">
                                {row.notes}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {row.debit > 0 ? formatINR(row.debit) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {row.credit > 0 ? formatINR(row.credit) : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {formatINR(row.runningBalance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-400">
              Select a ledger from the list to view its complete financial statement.
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Ledger Modal */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden my-8"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                {editingLedger ? 'Edit Ledger Account' : 'Create New Ledger Account'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLedger} className="p-6 space-y-4 text-xs">
              {ledgerError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-medium">
                  {ledgerError}
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Account / Party Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Industries Ltd"
                  value={newLedgerName}
                  onChange={e => setNewLedgerName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 theme-ring"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Ledger Group *
                  </label>
                  <select
                    value={newLedgerGroup}
                    onChange={e => setNewLedgerGroup(e.target.value as LedgerGroup)}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 theme-ring"
                  >
                    <option value="Sundry Debtors">Sundry Debtors (Customer)</option>
                    <option value="Sundry Creditors">Sundry Creditors (Supplier)</option>
                    <option value="Bank Accounts">Bank Accounts</option>
                    <option value="Cash-in-hand">Cash-in-hand</option>
                    <option value="Direct Expenses">Direct Expenses</option>
                    <option value="Indirect Expenses">Indirect Expenses</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    GSTIN / UIN
                  </label>
                  <input
                    type="text"
                    placeholder="19AAACB1234F1Z8"
                    value={newGstin}
                    onChange={e => setNewGstin(e.target.value.toUpperCase())}
                    className="w-full p-2.5 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 theme-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 theme-ring"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    State Jurisdiction
                  </label>
                  <select
                    value={newStateCode}
                    onChange={e => setNewStateCode(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 theme-ring"
                  >
                    {INDIAN_STATES.map(st => (
                      <option key={st.code} value={st.code}>
                        {st.name} ({st.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Billing Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Street address, city, pin code..."
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 theme-ring"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!editingLedger && (
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Opening Balance (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newOpeningBal}
                      onChange={e => setNewOpeningBal(parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 theme-ring"
                    />
                  </div>
                )}

                <div className={editingLedger ? 'sm:col-span-2' : ''}>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    value={newCreditLimit}
                    onChange={e => setNewCreditLimit(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 theme-ring"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white theme-bg theme-bg-hover rounded-lg shadow-xs"
                >
                  {editingLedger ? 'Save Changes' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

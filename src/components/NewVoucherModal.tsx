import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  FileCheck,
  Building
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import {
  PaymentMode,
  TransactionVoucher,
  VoucherLineItem,
  VoucherType
} from '../types/accounting';
import {
  calculateLineItem,
  formatINR,
  isInterStateTransaction
} from '../utils/gstCalculations';

interface NewVoucherModalProps {
  initialType?: VoucherType;
  initialPartyId?: string;
  initialIsGstBill?: boolean;
  onClose: () => void;
  onSuccess?: (voucherId: string) => void;
}

export const NewVoucherModal: React.FC<NewVoucherModalProps> = ({
  initialType = 'SALE',
  initialPartyId = '',
  initialIsGstBill = true,
  onClose,
  onSuccess,
}) => {
  const {
    ledgers,
    inventory,
    settings,
    addVoucher,
    getLedgerById
  } = useAccounting();

  const [type, setType] = useState<VoucherType>(initialType);
  const [isGstBill, setIsGstBill] = useState<boolean>(initialIsGstBill);
  const [isGstInclusive, setIsGstInclusive] = useState<boolean>(false);
  const [voucherNo, setVoucherNo] = useState<string>(() => {
    const prefix = type === 'SALE' ? (initialIsGstBill ? 'INV' : 'BOS') : type === 'PURCHASE' ? 'BILL' : type === 'PAYMENT' ? 'PMT' : type === 'RECEIPT' ? 'REC' : type === 'CREDIT_NOTE' ? 'CN' : 'DN';
    return `${prefix}/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [partyId, setPartyId] = useState<string>(initialPartyId);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CREDIT');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [directAmount, setDirectAmount] = useState<number>(0);
  const [formError, setFormError] = useState<string | null>(null);

  // Line items for goods transactions
  const isGoodsTransaction = ['SALE', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(type);

  const [items, setItems] = useState<VoucherLineItem[]>([
    {
      itemId: inventory[0]?.id || `custom_${Date.now()}`,
      name: inventory[0]?.name || '',
      hsn: inventory[0]?.hsnCode || '',
      qty: 1,
      unit: inventory[0]?.unit || 'Pcs',
      rate: inventory[0] ? (type === 'PURCHASE' ? inventory[0].purchasePrice : inventory[0].sellingPrice) : 0,
      discount: 0,
      taxableAmount: 0,
      gstRate: inventory[0]?.gstRate || 18,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: 0,
    },
  ]);

  const selectedParty = partyId ? getLedgerById(partyId) : undefined;
  const isInterState = isInterStateTransaction(settings.stateCode, selectedParty?.stateCode);

  const eligibleParties = ledgers.filter(l => {
    if (type === 'SALE' || type === 'RECEIPT' || type === 'CREDIT_NOTE') {
      return l.group === 'Sundry Debtors' || l.group === 'Cash-in-hand';
    }
    if (type === 'PURCHASE' || type === 'PAYMENT' || type === 'DEBIT_NOTE') {
      return l.group === 'Sundry Creditors' || l.group === 'Direct Expenses' || l.group === 'Indirect Expenses';
    }
    return true;
  });

  const handleToggleGstBill = (val: boolean) => {
    setIsGstBill(val);
    if (type === 'SALE') {
      const prefix = val ? 'INV' : 'BOS';
      setVoucherNo(`${prefix}/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`);
    }
    setItems(prev =>
      prev.map(it => {
        const calc = calculateLineItem(
          Number(it.qty) || 0,
          Number(it.rate) || 0,
          Number(it.discount) || 0,
          Number(it.gstRate) || 0,
          isInterState,
          val,
          isGstInclusive
        );
        return {
          ...it,
          taxableAmount: calc.taxableAmount,
          cgst: calc.cgst,
          sgst: calc.sgst,
          igst: calc.igst,
          total: calc.total,
        };
      })
    );
  };

  const handleToggleGstInclusive = (val: boolean) => {
    setIsGstInclusive(val);
    setItems(prev =>
      prev.map(it => {
        const calc = calculateLineItem(
          Number(it.qty) || 0,
          Number(it.rate) || 0,
          Number(it.discount) || 0,
          Number(it.gstRate) || 0,
          isInterState,
          isGstBill,
          val
        );
        return {
          ...it,
          taxableAmount: calc.taxableAmount,
          cgst: calc.cgst,
          sgst: calc.sgst,
          igst: calc.igst,
          total: calc.total,
        };
      })
    );
  };

  const handleItemChange = (index: number, field: keyof VoucherLineItem, value: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };

    if (field === 'itemId') {
      const inv = inventory.find(i => i.id === value);
      if (inv) {
        current.name = inv.name;
        current.hsn = inv.hsnCode;
        current.unit = inv.unit;
        current.rate = type === 'PURCHASE' ? inv.purchasePrice : inv.sellingPrice;
        current.gstRate = inv.gstRate;
      }
    }

    const calc = calculateLineItem(
      Number(current.qty) || 0,
      Number(current.rate) || 0,
      Number(current.discount) || 0,
      Number(current.gstRate) || 0,
      isInterState,
      isGstBill,
      isGstInclusive
    );

    current.taxableAmount = calc.taxableAmount;
    current.cgst = calc.cgst;
    current.sgst = calc.sgst;
    current.igst = calc.igst;
    current.total = calc.total;

    updated[index] = current;
    setItems(updated);
  };

  const addItemRow = () => {
    const inv = inventory[0];
    const defaultRate = inv ? (type === 'PURCHASE' ? inv.purchasePrice : inv.sellingPrice) : 0;
    const defaultGst = inv ? inv.gstRate : 18;

    const calc = calculateLineItem(
      1,
      defaultRate,
      0,
      defaultGst,
      isInterState,
      isGstBill,
      isGstInclusive
    );

    setItems(prev => [
      ...prev,
      {
        itemId: inv?.id || `custom_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        name: inv?.name || '',
        hsn: inv?.hsnCode || '',
        qty: 1,
        unit: inv?.unit || 'Pcs',
        rate: defaultRate,
        discount: 0,
        taxableAmount: calc.taxableAmount,
        gstRate: defaultGst,
        cgst: calc.cgst,
        sgst: calc.sgst,
        igst: calc.igst,
        total: calc.total,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = isGoodsTransaction
    ? Number(items.reduce((acc, it) => acc + it.taxableAmount, 0).toFixed(2))
    : directAmount;

  const cgstTotal = isGoodsTransaction
    ? Number(items.reduce((acc, it) => acc + it.cgst, 0).toFixed(2))
    : 0;

  const sgstTotal = isGoodsTransaction
    ? Number(items.reduce((acc, it) => acc + it.sgst, 0).toFixed(2))
    : 0;

  const igstTotal = isGoodsTransaction
    ? Number(items.reduce((acc, it) => acc + it.igst, 0).toFixed(2))
    : 0;

  const grandTotal = isGoodsTransaction
    ? Number((subtotal + cgstTotal + sgstTotal + igstTotal).toFixed(2))
    : directAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isGoodsTransaction && items.length === 0) {
      setFormError('Please add at least one line item.');
      return;
    }

    if (!isGoodsTransaction && directAmount <= 0) {
      setFormError('Please enter a valid amount.');
      return;
    }

    if ((type === 'PAYMENT' || type === 'RECEIPT') && !partyId) {
      setFormError('Please select a party account for this transaction.');
      return;
    }

    const newVoucher: Omit<TransactionVoucher, 'id'> = {
      voucherNo,
      date,
      type,
      partyId: partyId || undefined,
      partyName: selectedParty?.name || undefined,
      isGstBill: isGoodsTransaction ? isGstBill : false,
      isGstInclusive: isGoodsTransaction ? isGstInclusive : false,
      paymentMode,
      referenceNo: referenceNo || undefined,
      subtotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      grandTotal,
      items: isGoodsTransaction ? items : [],
      notes,
    };

    try {
      const createdId = await addVoucher(newVoucher);
      if (onSuccess) onSuccess(createdId);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save voucher');
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 my-6 sm:my-8 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-lg shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                New Transaction Voucher
              </h3>
              <p className="text-[11px] text-slate-500">
                Double-Entry Posting &amp; Auto Inventory Balance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-medium">
              {formError}
            </div>
          )}
          {/* Voucher Type Tabs (Horizontal scrolling on mobile) */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Voucher Nature &amp; Account Type
            </label>
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto pb-1.5 sm:pb-1">
              {(
                [
                  { key: 'SALE', label: 'Sales (Invoice)' },
                  { key: 'PURCHASE', label: 'Purchase (Bill)' },
                  { key: 'PAYMENT', label: 'Payment' },
                  { key: 'RECEIPT', label: 'Receipt' },
                  { key: 'CREDIT_NOTE', label: 'Credit Note' },
                  { key: 'DEBIT_NOTE', label: 'Debit Note' },
                ] as const
              ).map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setType(tab.key);
                    const prefix = tab.key === 'SALE' ? 'INV' : tab.key === 'PURCHASE' ? 'BILL' : tab.key === 'PAYMENT' ? 'PMT' : tab.key === 'RECEIPT' ? 'REC' : tab.key === 'CREDIT_NOTE' ? 'CN' : 'DN';
                    setVoucherNo(`${prefix}/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap min-h-[32px] ${
                    type === tab.key
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* GST vs Non-GST Toggle & Rate Mode Toggle */}
          {isGoodsTransaction && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Tax Billing Type:
                  </span>
                  <span className="text-[11px] text-slate-500 ml-1.5">
                    {isGstBill ? 'Standard GST Tax Invoice (with CGST/SGST/IGST breakdown)' : 'Bill of Supply / Non-GST Sale (0% Tax)'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleToggleGstBill(true)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      isGstBill
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    ✓ With GST (Tax Invoice)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleGstBill(false)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      !isGstBill
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Without GST (Non-GST)
                  </button>
                </div>
              </div>

              {isGstBill && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Item Rate Mode:
                    </span>
                    <span className="text-[11px] text-slate-500 ml-1.5">
                      {isGstInclusive
                        ? 'Input rates are Inclusive of GST (Taxable amount & tax extracted automatically)'
                        : 'Input rates are Exclusive of GST (GST added on top of item rate)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleToggleGstInclusive(false)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        !isGstInclusive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Rate Excl. GST
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleGstInclusive(true)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        isGstInclusive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Rate Incl. GST
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Primary Meta Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Voucher / Inv No *
              </label>
              <input
                type="text"
                required
                value={voucherNo}
                onChange={e => setVoucherNo(e.target.value)}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Party / Account Ledger *
              </label>
              <select
                required
                value={partyId}
                onChange={e => setPartyId(e.target.value)}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
              >
                <option value="">Select Ledger Account...</option>
                {eligibleParties.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.group}) - Bal: {formatINR(l.currentBalance)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Place of supply notice */}
          {selectedParty && isGoodsTransaction && (
            <div className="flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-lg text-xs text-blue-800 dark:text-blue-300">
              <Building className="w-4 h-4 shrink-0" />
              <span>
                Place of Supply: <strong>State {selectedParty.stateCode || settings.stateCode}</strong> · Tax Mode:{' '}
                <strong>
                  {isInterState ? 'Inter-State (IGST 100%)' : 'Intra-State (CGST 50% + SGST 50%)'}
                </strong>
                {selectedParty.gstin && ` · GSTIN: ${selectedParty.gstin}`}
              </span>
            </div>
          )}

          {/* Goods Line Items Table */}
          {isGoodsTransaction ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Bill Particulars &amp; Items
                </h4>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-md transition-colors min-h-[32px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[620px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Item Name</th>
                      <th className="py-2 px-2 w-20">HSN</th>
                      <th className="py-2 px-2 w-20">Qty</th>
                      <th className="py-2 px-2 w-28">Rate (₹ {isGstInclusive ? 'Incl.' : 'Excl.'})</th>
                      <th className="py-2 px-2 w-16">Disc %</th>
                      <th className="py-2 px-2 w-20">GST %</th>
                      <th className="py-2 px-3 w-24 text-right">Taxable</th>
                      <th className="py-2 px-3 w-28 text-right">Total (₹)</th>
                      <th className="py-2 px-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-3">
                          {inventory.length > 0 ? (
                            <select
                              value={row.itemId}
                              onChange={e => handleItemChange(idx, 'itemId', e.target.value)}
                              className="w-full p-1.5 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 font-medium"
                            >
                              <option value="">Select Stock Item...</option>
                              {inventory.map(inv => (
                                <option key={inv.id} value={inv.id}>
                                  {inv.name} (Stock: {inv.currentStock} {inv.unit})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              placeholder="Item Name / Particulars..."
                              value={row.name}
                              onChange={e => handleItemChange(idx, 'name', e.target.value)}
                              className="w-full p-1.5 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 font-medium"
                            />
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={row.hsn}
                            onChange={e => handleItemChange(idx, 'hsn', e.target.value)}
                            className="w-full p-1.5 font-mono text-center border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={row.qty}
                            onChange={e => handleItemChange(idx, 'qty', parseFloat(e.target.value) || 0)}
                            className="w-full p-1.5 font-mono text-right border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.rate}
                            onChange={e => handleItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                            className="w-full p-1.5 font-mono text-right border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={row.discount}
                            onChange={e => handleItemChange(idx, 'discount', parseFloat(e.target.value) || 0)}
                            className="w-full p-1.5 font-mono text-right border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={row.gstRate}
                            onChange={e => handleItemChange(idx, 'gstRate', parseFloat(e.target.value) || 0)}
                            className="w-full p-1.5 font-mono text-center border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {row.taxableAmount.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {row.total.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            disabled={items.length <= 1}
                            className="text-slate-400 hover:text-red-500 disabled:opacity-30 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                Total Transaction Amount (₹) *
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-2.5 text-base font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="0.00"
                  value={directAmount || ''}
                  onChange={e => setDirectAmount(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-4 py-2 text-lg font-mono font-bold text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          )}

          {/* Payment Mode & Calculations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value as PaymentMode)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="CREDIT">Credit (On Account)</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI / QR Code</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    UTR / Cheque / Ref No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR1902838"
                    value={referenceNo}
                    onChange={e => setReferenceNo(e.target.value)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Narration / Notes
                </label>
                <input
                  type="text"
                  placeholder="Additional remarks or bill notes..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Calculations Card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Taxable Subtotal:</span>
                <span className="font-semibold">{formatINR(subtotal)}</span>
              </div>
              {cgstTotal > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>CGST:</span>
                  <span>{formatINR(cgstTotal)}</span>
                </div>
              )}
              {sgstTotal > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>SGST:</span>
                  <span>{formatINR(sgstTotal)}</span>
                </div>
              )}
              {igstTotal > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>IGST:</span>
                  <span>{formatINR(igstTotal)}</span>
                </div>
              )}
              <div className="border-t border-slate-300 dark:border-slate-700 pt-2 flex justify-between text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                <span>Grand Total:</span>
                <span className="text-blue-600 dark:text-blue-400">{formatINR(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg min-h-[38px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs min-h-[38px]"
            >
              Save &amp; Post Voucher
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

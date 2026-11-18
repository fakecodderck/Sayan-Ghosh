import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Building,
  UserPlus,
  UserCheck,
  User,
  Printer,
  Download,
  Save,
  CheckCircle2
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import {
  CustomerMode,
  INDIAN_STATES,
  PaymentMode,
  TransactionVoucher,
  UnitType,
  VoucherLineItem,
  VoucherType
} from '../types/accounting';
import {
  calculateLineItem,
  formatINR,
  isInterStateTransaction
} from '../utils/gstCalculations';
import { downloadInvoicePdf } from '../utils/invoicePdf';

interface VoucherCreatorFormProps {
  initialType?: VoucherType;
  initialPartyId?: string;
  initialIsGstBill?: boolean;
  hideTypeSelector?: boolean;
  onCancel?: () => void;
  onSuccess?: (voucher: TransactionVoucher, shouldPrint?: boolean) => void;
}

const getNextVoucherPrefix = (t: VoucherType, isGst: boolean) => {
  if (t === 'SALE') return isGst ? 'INV' : 'BOS';
  if (t === 'PURCHASE') return 'BILL';
  if (t === 'PAYMENT') return 'PMT';
  if (t === 'RECEIPT') return 'REC';
  if (t === 'CREDIT_NOTE') return 'CN';
  return 'DN';
};

export const VoucherCreatorForm: React.FC<VoucherCreatorFormProps> = ({
  initialType = 'SALE',
  initialPartyId = '',
  initialIsGstBill = true,
  hideTypeSelector = false,
  onCancel,
  onSuccess,
}) => {
  const { ledgers, inventory, settings, addVoucher, addLedger, getLedgerById } = useAccounting();

  const [type, setType] = useState<VoucherType>(initialType);
  const [isGstBill, setIsGstBill] = useState<boolean>(initialIsGstBill);
  const [isGstInclusive, setIsGstInclusive] = useState<boolean>(false);
  const [voucherNo, setVoucherNo] = useState<string>(() => {
    const prefix = getNextVoucherPrefix(initialType, initialIsGstBill);
    return `${prefix}/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Customer selection mode: Existing | New | Guest (default Existing)
  const [customerMode, setCustomerMode] = useState<CustomerMode>('existing');
  const [partyId, setPartyId] = useState<string>(initialPartyId);

  // New Customer inline creation fields
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustGstin, setNewCustGstin] = useState('');
  const [newCustStateCode, setNewCustStateCode] = useState(settings.stateCode || '19');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Guest / Walk-In Customer fields
  const [guestName, setGuestName] = useState('Walk-in Customer');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  const [guestGstin, setGuestGstin] = useState('');
  const [guestStateCode, setGuestStateCode] = useState(settings.stateCode || '19');

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CREDIT');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [directAmount, setDirectAmount] = useState<number>(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);
  const [lastSavedVoucher, setLastSavedVoucher] = useState<TransactionVoucher | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isGoodsTransaction = ['SALE', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(type);
  const supportsCustomerModes = type === 'SALE' || type === 'CREDIT_NOTE';

  const buildInitialItem = (overrideType: VoucherType = type, overrideGst: boolean = isGstBill): VoucherLineItem => {
    const first = inventory[0];
    const rate = first ? (overrideType === 'PURCHASE' ? first.purchasePrice : first.sellingPrice) : 0;
    const gstRate = first ? first.gstRate : 18;
    const calc = calculateLineItem(1, rate, 0, gstRate, false, overrideGst, false);
    return {
      itemId: first?.id || `manual_${Date.now()}`,
      name: first?.name || '',
      hsn: first?.hsnCode || '',
      qty: 1,
      unit: first?.unit || 'Pcs',
      rate,
      discount: 0,
      taxableAmount: calc.taxableAmount,
      gstRate,
      cgst: calc.cgst,
      sgst: calc.sgst,
      igst: calc.igst,
      total: calc.total,
    };
  };

  const [items, setItems] = useState<VoucherLineItem[]>(() => [buildInitialItem(initialType, initialIsGstBill)]);

  // Hydrate initial item once async Firestore inventory arrives if row is still pristine empty
  useEffect(() => {
    if (inventory.length === 0) return;
    setItems(prev => {
      if (prev.length === 1 && !prev[0].name.trim() && prev[0].rate === 0 && prev[0].itemId.startsWith('manual_')) {
        return [buildInitialItem(type, isGstBill)];
      }
      return prev;
    });
  }, [inventory.length]);

  // Sync default state codes when async settings arrive
  useEffect(() => {
    if (settings.stateCode) {
      setNewCustStateCode(prev => (prev === '19' || !prev ? settings.stateCode : prev));
      setGuestStateCode(prev => (prev === '19' || !prev ? settings.stateCode : prev));
    }
  }, [settings.stateCode]);

  const selectedParty = customerMode === 'existing' && partyId ? getLedgerById(partyId) : undefined;
  const effectivePartyStateCode =
    customerMode === 'new'
      ? newCustStateCode
      : customerMode === 'guest'
      ? guestStateCode
      : selectedParty?.stateCode;
  const effectivePartyGstin =
    customerMode === 'new'
      ? newCustGstin
      : customerMode === 'guest'
      ? guestGstin
      : selectedParty?.gstin;

  const isInterState = isInterStateTransaction(
    settings.stateCode,
    effectivePartyStateCode,
    effectivePartyGstin
  );

  // Recalculate all items when tax context changes (GST toggle, Inclusive toggle, or Inter-state change)
  useEffect(() => {
    setItems(prev =>
      prev.map(it => {
        const calc = calculateLineItem(
          Number(it.qty) || 0,
          Number(it.rate) || 0,
          Number(it.discount) || 0,
          Number(it.gstRate) || 0,
          isInterState,
          isGstBill,
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
  }, [isInterState, isGstBill, isGstInclusive]);

  // Prevent anonymous Guest Customer from defaulting to Credit on-account
  useEffect(() => {
    if (customerMode === 'guest' && paymentMode === 'CREDIT') {
      setPaymentMode('CASH');
    }
  }, [customerMode, paymentMode]);

  const eligibleParties = ledgers.filter(l => {
    if (type === 'SALE' || type === 'RECEIPT' || type === 'CREDIT_NOTE') {
      return l.group === 'Sundry Debtors';
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
  };

  const handleItemChange = (index: number, field: keyof VoucherLineItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };

      if (field === 'itemId') {
        if (value === '__MANUAL__') {
          current.itemId = `manual_${Date.now()}_${index}`;
          current.name = '';
          current.hsn = '';
          current.rate = 0;
        } else {
          const inv = inventory.find(i => i.id === value);
          if (inv) {
            current.name = inv.name;
            current.hsn = inv.hsnCode;
            current.unit = inv.unit;
            current.rate = type === 'PURCHASE' ? inv.purchasePrice : inv.sellingPrice;
            current.gstRate = inv.gstRate;
          }
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
      return updated;
    });
  };

  const addItemRow = (manual: boolean = false) => {
    const inv = !manual ? inventory[0] : undefined;
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
        itemId: inv?.id || `manual_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
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

  const submitVoucher = async (shouldPrint: boolean) => {
    setFormError(null);
    setSavedSuccessMsg(null);

    if (isGoodsTransaction) {
      if (items.length === 0) {
        setFormError('Please add at least one line item.');
        return;
      }
      if (items.some(it => !it.name.trim())) {
        setFormError('Every line item must have a product name.');
        return;
      }
    }

    if (!isGoodsTransaction && directAmount <= 0) {
      setFormError('Please enter a valid transaction amount.');
      return;
    }

    if ((type === 'PAYMENT' || type === 'RECEIPT') && !partyId) {
      setFormError('Please select a party account.');
      return;
    }

    if (supportsCustomerModes && customerMode === 'existing' && paymentMode === 'CREDIT' && !partyId) {
      setFormError('Please select an Existing Customer for Credit sales, or switch to Guest Customer.');
      return;
    }

    if (supportsCustomerModes && customerMode === 'new' && !newCustName.trim()) {
      setFormError('Please enter the New Customer Name.');
      return;
    }

    setIsSubmitting(true);
    try {
      let resolvedPartyId: string | undefined = partyId || undefined;
      let resolvedPartyName: string | undefined = selectedParty?.name;

      // Handle New Customer mode: create Sundry Debtors ledger automatically
      if (supportsCustomerModes && customerMode === 'new') {
        const createdLedgerId = await addLedger({
          name: newCustName.trim(),
          group: 'Sundry Debtors',
          phone: newCustPhone.trim() || undefined,
          gstin: newCustGstin.trim().toUpperCase() || undefined,
          stateCode: newCustStateCode || settings.stateCode || '19',
          address: newCustAddress.trim() || undefined,
          openingBalance: 0,
          currentBalance: 0,
        });
        resolvedPartyId = createdLedgerId;
        resolvedPartyName = newCustName.trim();
      } else if (supportsCustomerModes && customerMode === 'guest') {
        resolvedPartyId = undefined;
        resolvedPartyName = guestName.trim() || 'Walk-in Customer';
      }

      const newVoucherPayload: Omit<TransactionVoucher, 'id'> = {
        voucherNo: voucherNo.trim(),
        date,
        type,
        partyId: resolvedPartyId,
        partyName: resolvedPartyName,
        customerMode: supportsCustomerModes ? customerMode : 'existing',
        guestDetails:
          supportsCustomerModes && customerMode === 'guest'
            ? {
                name: guestName.trim() || 'Walk-in Customer',
                phone: guestPhone.trim() || undefined,
                address: guestAddress.trim() || undefined,
                gstin: guestGstin.trim().toUpperCase() || undefined,
                stateCode: guestStateCode || settings.stateCode,
              }
            : undefined,
        isGstBill: isGoodsTransaction ? isGstBill : false,
        isGstInclusive: isGoodsTransaction ? isGstInclusive : false,
        paymentMode,
        referenceNo: referenceNo.trim() || undefined,
        subtotal,
        cgstTotal,
        sgstTotal,
        igstTotal,
        grandTotal,
        items: isGoodsTransaction ? items : [],
        notes: notes.trim() || undefined,
      };

      const createdId = await addVoucher(newVoucherPayload);
      const createdVoucher: TransactionVoucher = {
        ...newVoucherPayload,
        id: createdId,
        createdAt: new Date().toISOString(),
      };

      setLastSavedVoucher(createdVoucher);
      setSavedSuccessMsg(`Saved ${createdVoucher.voucherNo} (${formatINR(createdVoucher.grandTotal)})`);

      // Prepare clean form & number for next voucher if user stays on page
      const prefix = getNextVoucherPrefix(type, isGstBill);
      setVoucherNo(`${prefix}/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`);
      setReferenceNo('');
      setNotes('');
      setDirectAmount(0);
      setItems([buildInitialItem(type, isGstBill)]);
      if (customerMode === 'new') {
        setCustomerMode('existing');
        setPartyId(resolvedPartyId || '');
        setNewCustName('');
        setNewCustPhone('');
        setNewCustGstin('');
        setNewCustAddress('');
      }

      if (onSuccess) onSuccess(createdVoucher, shouldPrint);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadSavedPdf = (target: TransactionVoucher) => {
    const targetParty = target.partyId ? getLedgerById(target.partyId) : undefined;
    downloadInvoicePdf({
      voucher: target,
      settings,
      party: targetParty,
      useCustomTemplate: Boolean(settings.invoiceTemplate?.useAsDefault && settings.invoiceTemplate?.blocks.length),
    });
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        submitVoucher(false);
      }}
      className="space-y-5 text-xs"
    >
      {formError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-medium">
          {formError}
        </div>
      )}

      {savedSuccessMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-medium flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedSuccessMsg}</span>
          </div>
          {lastSavedVoucher && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadSavedPdf(lastSavedVoucher)}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-[11px]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
              {onSuccess && (
                <button
                  type="button"
                  onClick={() => onSuccess(lastSavedVoucher, true)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded-md font-semibold text-[11px]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Preview &amp; Print</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Voucher Type Tabs */}
      {!hideTypeSelector && (
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Voucher Type
          </label>
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
            {(
              [
                { key: 'SALE', label: 'Sales Invoice' },
                { key: 'PURCHASE', label: 'Purchase Bill' },
                { key: 'RECEIPT', label: 'Receipt' },
                { key: 'PAYMENT', label: 'Payment' },
                { key: 'CREDIT_NOTE', label: 'Credit Note' },
                { key: 'DEBIT_NOTE', label: 'Debit Note' },
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setType(tab.key);
                  const prefix = getNextVoucherPrefix(tab.key, isGstBill);
                  setVoucherNo(`${prefix}/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`);
                  if (tab.key !== 'SALE' && tab.key !== 'CREDIT_NOTE') {
                    setCustomerMode('existing');
                  }
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap min-h-[32px] ${
                  type === tab.key
                    ? 'bg-white dark:bg-slate-700 theme-text shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tax Mode & Rate Mode */}
      {isGoodsTransaction && (
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">Tax Billing Type:</span>
              <span className="text-[11px] text-slate-500 ml-1.5">
                {isGstBill ? 'GST Tax Invoice (CGST / SGST / IGST)' : 'Non-GST Bill of Supply (0% Tax)'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleToggleGstBill(true)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  isGstBill
                    ? 'theme-bg text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                }`}
              >
                With GST
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
                Without GST
              </button>
            </div>
          </div>

          {isGstBill && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Item Rate Mode:</span>
                <span className="text-[11px] text-slate-500 ml-1.5">
                  {isGstInclusive ? 'GST included in item rate' : 'GST added on top of item rate'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsGstInclusive(false)}
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
                  onClick={() => setIsGstInclusive(true)}
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

      {/* Invoice No & Date + Customer Mode Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
            Invoice / Voucher No *
          </label>
          <input
            type="text"
            required
            value={voucherNo}
            onChange={e => setVoucherNo(e.target.value)}
            className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-mono"
          />
        </div>

        <div>
          <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
            Invoice Date *
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-mono"
          />
        </div>
      </div>

      {/* Customer Type / Party Selection */}
      {supportsCustomerModes ? (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="font-semibold text-slate-800 dark:text-slate-200">
              Customer Selection Type
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setCustomerMode('existing')}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                  customerMode === 'existing'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Existing Customer</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode('new')}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                  customerMode === 'new'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>New Customer</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode('guest')}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                  customerMode === 'guest'
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Guest Customer</span>
              </button>
            </div>
          </div>

          {customerMode === 'existing' && (
            <div>
              <select
                value={partyId}
                onChange={e => setPartyId(e.target.value)}
                className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
              >
                <option value="">
                  {eligibleParties.length > 0
                    ? 'Select Existing Customer Ledger...'
                    : 'No saved customers yet — switch to New Customer or Guest'}
                </option>
                {eligibleParties.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} {l.phone ? `(${l.phone})` : ''} · Bal: {formatINR(l.currentBalance)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {customerMode === 'new' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  New Customer Name * (Saved to Customers Directory)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sen Electricals"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="+91 98..."
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  State
                </label>
                <select
                  value={newCustStateCode}
                  onChange={e => setNewCustStateCode(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                >
                  {INDIAN_STATES.map(s => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  GSTIN (Optional)
                </label>
                <input
                  type="text"
                  placeholder="19ABCDE1234F1Z5"
                  value={newCustGstin}
                  onChange={e => setNewCustGstin(e.target.value.toUpperCase())}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-mono"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Billing Address (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Street, City, PIN"
                  value={newCustAddress}
                  onChange={e => setNewCustAddress(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          )}

          {customerMode === 'guest' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Guest / Walk-In Customer Name (One-time bill)
                </label>
                <input
                  type="text"
                  placeholder="Walk-in Customer"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="text"
                  placeholder="+91..."
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Supply State
                </label>
                <select
                  value={guestStateCode}
                  onChange={e => setGuestStateCode(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                >
                  {INDIAN_STATES.map(s => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Guest GSTIN (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Unregistered B2C"
                  value={guestGstin}
                  onChange={e => setGuestGstin(e.target.value.toUpperCase())}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-mono"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Address (Optional)
                </label>
                <input
                  type="text"
                  placeholder="City / Local Address"
                  value={guestAddress}
                  onChange={e => setGuestAddress(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
            {type === 'PURCHASE' || type === 'PAYMENT' || type === 'DEBIT_NOTE'
              ? 'Company / Supplier Account *'
              : 'Customer Ledger Account *'}
          </label>
          <select
            required
            value={partyId}
            onChange={e => setPartyId(e.target.value)}
            className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
          >
            <option value="">Select Ledger Account...</option>
            {eligibleParties.map(l => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.group}) - Bal: {formatINR(l.currentBalance)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Place of Supply Info Bar */}
      {isGoodsTransaction && (
        <div className="flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-lg text-xs text-blue-800 dark:text-blue-300">
          <Building className="w-4 h-4 shrink-0" />
          <span>
            Place of Supply: <strong>State {effectivePartyStateCode || settings.stateCode}</strong> · Tax Mode:{' '}
            <strong>
              {isInterState ? 'Inter-State (IGST 100%)' : 'Intra-State (CGST 50% + SGST 50%)'}
            </strong>
            {effectivePartyGstin && ` · GSTIN: ${effectivePartyGstin}`}
          </span>
        </div>
      )}

      {/* Line Items Table or Direct Settlement Input */}
      {isGoodsTransaction ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Bill Particulars &amp; Line Items
            </h4>
            <div className="flex items-center gap-2">
              {inventory.length > 0 && (
                <button
                  type="button"
                  onClick={() => addItemRow(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Manual Item</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => addItemRow(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Line Item</span>
              </button>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[660px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-2 px-3">Item Name</th>
                  <th className="py-2 px-2 w-20">HSN</th>
                  <th className="py-2 px-2 w-20">Qty</th>
                  <th className="py-2 px-2 w-20">Unit</th>
                  <th className="py-2 px-2 w-24">Rate (₹)</th>
                  <th className="py-2 px-2 w-16">Disc %</th>
                  <th className="py-2 px-2 w-20">GST %</th>
                  <th className="py-2 px-3 w-24 text-right">Taxable</th>
                  <th className="py-2 px-3 w-24 text-right">Total (₹)</th>
                  <th className="py-2 px-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((row, idx) => {
                  const isCatalogItem = inventory.some(i => i.id === row.itemId);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2 px-3 space-y-1">
                        {inventory.length > 0 && isCatalogItem ? (
                          <select
                            value={row.itemId}
                            onChange={e => handleItemChange(idx, 'itemId', e.target.value)}
                            className="w-full p-1.5 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 font-medium"
                          >
                            {inventory.map(inv => (
                              <option key={inv.id} value={inv.id}>
                                {inv.name} (Stock: {inv.currentStock} {inv.unit})
                              </option>
                            ))}
                            <option value="__MANUAL__">+ Enter Custom / Manual Item</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="Item Name / Description..."
                              value={row.name}
                              onChange={e => handleItemChange(idx, 'name', e.target.value)}
                              className="w-full p-1.5 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 font-medium"
                            />
                            {inventory.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleItemChange(idx, 'itemId', inventory[0].id)}
                                className="px-1.5 py-1 text-[10px] text-blue-600 hover:bg-blue-50 rounded shrink-0"
                                title="Switch back to catalog product"
                              >
                                Catalog
                              </button>
                            )}
                          </div>
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
                          min="0.01"
                          step="any"
                          value={row.qty}
                          onChange={e => handleItemChange(idx, 'qty', parseFloat(e.target.value) || 0)}
                          className="w-full p-1.5 font-mono text-right border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={row.unit}
                          onChange={e => handleItemChange(idx, 'unit', e.target.value as UnitType)}
                          className="w-full p-1.5 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800"
                        >
                          <option value="Pcs">Pcs</option>
                          <option value="Box">Box</option>
                          <option value="Kg">Kg</option>
                          <option value="Mtr">Mtr</option>
                          <option value="Ltr">Ltr</option>
                          <option value="Set">Set</option>
                          <option value="Bag">Bag</option>
                          <option value="Roll">Roll</option>
                        </select>
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
                  );
                })}
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
                {customerMode !== 'guest' && <option value="CREDIT">Credit (On Account)</option>}
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="BANK">Bank Transfer (NEFT/RTGS)</option>
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
              placeholder="Additional remarks or delivery notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
            />
          </div>
        </div>

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
            <span className="theme-text">{formatINR(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>Save Invoice</span>
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => submitVoucher(true)}
          className="theme-bg theme-bg-hover flex items-center gap-1.5 px-5 py-2.5 font-bold text-white rounded-lg shadow-xs disabled:opacity-50"
        >
          <Printer className="w-4 h-4" />
          <span>Save &amp; Print / Download</span>
        </button>
      </div>
    </form>
  );
};

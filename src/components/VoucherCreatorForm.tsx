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
  CheckCircle2,
  Edit2
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import {
  CustomerMode,
  INDIAN_STATES,
  InventoryItem,
  LedgerAccount,
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
import { AutocompleteInput } from './AutocompleteInput';
import { GstinLookupField } from './GstinLookupField';

interface VoucherCreatorFormProps {
  initialType?: VoucherType;
  initialPartyId?: string;
  initialIsGstBill?: boolean;
  editingVoucher?: TransactionVoucher;
  hideTypeSelector?: boolean;
  onCancel?: () => void;
  onSuccess?: (voucher: TransactionVoucher, shouldPrint?: boolean) => void;
  onEditVoucher?: (voucher: TransactionVoucher) => void;
}

const getNextVoucherPrefix = (t: VoucherType, isGst: boolean) => {
  if (t === 'SALE') return isGst ? 'INV' : 'BOS';
  if (t === 'PURCHASE') return 'BILL';
  if (t === 'PAYMENT') return 'PMT';
  if (t === 'RECEIPT') return 'REC';
  if (t === 'CREDIT_NOTE') return 'CN';
  return 'DN';
};

const getInitialCustomerMode = (voucher?: TransactionVoucher): CustomerMode => {
  if (!voucher) return 'existing';
  if (voucher.customerMode === 'guest' || (!voucher.partyId && voucher.guestDetails)) {
    return 'guest';
  }
  return 'existing';
};

export const VoucherCreatorForm: React.FC<VoucherCreatorFormProps> = ({
  initialType = 'SALE',
  initialPartyId = '',
  initialIsGstBill = true,
  editingVoucher,
  hideTypeSelector = false,
  onCancel,
  onSuccess,
  onEditVoucher,
}) => {
  const { ledgers, inventory, settings, addVoucher, updateVoucher, addLedger, getLedgerById } = useAccounting();
  const isEditMode = Boolean(editingVoucher);

  const [type, setType] = useState<VoucherType>(editingVoucher?.type ?? initialType);
  const [isGstBill, setIsGstBill] = useState<boolean>(
    editingVoucher ? Boolean(editingVoucher.isGstBill) : initialIsGstBill
  );
  const [isGstInclusive, setIsGstInclusive] = useState<boolean>(
    editingVoucher ? Boolean(editingVoucher.isGstInclusive) : false
  );
  const [voucherNo, setVoucherNo] = useState<string>(() => {
    if (editingVoucher?.voucherNo) return editingVoucher.voucherNo;
    const prefix = getNextVoucherPrefix(initialType, initialIsGstBill);
    return `${prefix}/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const [date, setDate] = useState<string>(
    editingVoucher?.date || new Date().toISOString().split('T')[0]
  );

  // Customer selection mode: Existing | New | Guest (default Existing)
  const [customerMode, setCustomerMode] = useState<CustomerMode>(() =>
    getInitialCustomerMode(editingVoucher)
  );
  const [partyId, setPartyId] = useState<string>(
    editingVoucher ? editingVoucher.partyId || '' : initialPartyId
  );
  const [partyQuery, setPartyQuery] = useState<string>(() => {
    const targetId = editingVoucher ? editingVoucher.partyId || '' : initialPartyId;
    if (targetId) {
      return ledgers.find(l => l.id === targetId)?.name || editingVoucher?.partyName || '';
    }
    return '';
  });

  // New Customer inline creation fields
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustGstin, setNewCustGstin] = useState('');
  const [newCustPan, setNewCustPan] = useState('');
  const [newCustStateCode, setNewCustStateCode] = useState(settings.stateCode || '19');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Guest / Walk-In Customer fields
  const [guestName, setGuestName] = useState(
    editingVoucher?.guestDetails?.name ||
      (editingVoucher && !editingVoucher.partyId && editingVoucher.partyName
        ? editingVoucher.partyName
        : 'Walk-in Customer')
  );
  const [guestPhone, setGuestPhone] = useState(editingVoucher?.guestDetails?.phone || '');
  const [guestAddress, setGuestAddress] = useState(editingVoucher?.guestDetails?.address || '');
  const [guestGstin, setGuestGstin] = useState(editingVoucher?.guestDetails?.gstin || '');
  const [guestStateCode, setGuestStateCode] = useState(
    editingVoucher?.guestDetails?.stateCode || settings.stateCode || '19'
  );

  const [paymentMode, setPaymentMode] = useState<PaymentMode>(
    editingVoucher?.paymentMode || 'CREDIT'
  );
  const [referenceNo, setReferenceNo] = useState<string>(editingVoucher?.referenceNo || '');
  const [notes, setNotes] = useState<string>(editingVoucher?.notes || '');
  const [directAmount, setDirectAmount] = useState<number>(() => {
    if (
      editingVoucher &&
      !['SALE', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(editingVoucher.type)
    ) {
      return editingVoucher.grandTotal || 0;
    }
    return 0;
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);
  const [lastSavedVoucher, setLastSavedVoucher] = useState<TransactionVoucher | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isGoodsTransaction = ['SALE', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(type);
  const supportsCustomerModes = type === 'SALE' || type === 'CREDIT_NOTE';

  const buildInitialItem = (overrideGst: boolean = isGstBill): VoucherLineItem => {
    const calc = calculateLineItem(1, 0, 0, 18, false, overrideGst, false);
    return {
      itemId: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      hsn: '',
      qty: 1,
      unit: 'Pcs',
      rate: 0,
      discount: 0,
      taxableAmount: calc.taxableAmount,
      gstRate: 18,
      cgst: calc.cgst,
      sgst: calc.sgst,
      igst: calc.igst,
      total: calc.total,
    };
  };

  const [items, setItems] = useState<VoucherLineItem[]>(() => {
    if (editingVoucher?.items && editingVoucher.items.length > 0) {
      return editingVoucher.items.map(it => ({ ...it }));
    }
    return [buildInitialItem(editingVoucher ? Boolean(editingVoucher.isGstBill) : initialIsGstBill)];
  });

  // Sync displayed party name when partyId is set programmatically or async ledgers arrive
  useEffect(() => {
    if (!partyId) return;
    const found = ledgers.find(l => l.id === partyId);
    if (found) {
      setPartyQuery(found.name);
    }
  }, [partyId, ledgers]);

  // Sync default state codes when async settings arrive (preserve edited guest state code)
  useEffect(() => {
    if (settings.stateCode) {
      setNewCustStateCode(prev => (prev === '19' || !prev ? settings.stateCode : prev));
      if (!editingVoucher?.guestDetails?.stateCode) {
        setGuestStateCode(prev => (prev === '19' || !prev ? settings.stateCode : prev));
      }
    }
  }, [settings.stateCode, editingVoucher?.guestDetails?.stateCode]);

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

  // Skip initial recalculation pass when editing so saved line totals are preserved until tax settings actually change
  const skipInitialTaxRecalcRef = React.useRef(isEditMode);

  // Recalculate all items when tax context changes (GST toggle, Inclusive toggle, or Inter-state change)
  useEffect(() => {
    if (skipInitialTaxRecalcRef.current) {
      skipInitialTaxRecalcRef.current = false;
      return;
    }
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

  const isPartyEligibleForType = (ledger: LedgerAccount, voucherType: VoucherType) => {
    if (voucherType === 'SALE' || voucherType === 'RECEIPT' || voucherType === 'CREDIT_NOTE') {
      return ledger.group === 'Sundry Debtors';
    }
    if (voucherType === 'PURCHASE' || voucherType === 'PAYMENT' || voucherType === 'DEBIT_NOTE') {
      return (
        ledger.group === 'Sundry Creditors' ||
        ledger.group === 'Direct Expenses' ||
        ledger.group === 'Indirect Expenses'
      );
    }
    return true;
  };

  const eligibleParties = ledgers.filter(l => isPartyEligibleForType(l, type));

  const filterParty = (ledger: LedgerAccount, q: string) =>
    ledger.name.toLowerCase().includes(q) ||
    (ledger.phone ? ledger.phone.toLowerCase().includes(q) : false) ||
    (ledger.gstin ? ledger.gstin.toLowerCase().includes(q) : false) ||
    ledger.group.toLowerCase().includes(q);

  const rankParty = (ledger: LedgerAccount, q: string) => {
    const name = ledger.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.includes(q)) return 1;
    return 2;
  };

  const handleSelectParty = (ledger: LedgerAccount) => {
    setPartyId(ledger.id);
    setPartyQuery(ledger.name);
  };

  const handlePartyQueryChange = (val: string) => {
    setPartyQuery(val);
    if (partyId) {
      const current = ledgers.find(l => l.id === partyId);
      if (!current || current.name !== val) {
        setPartyId('');
      }
    }
  };

  const handleClearParty = () => {
    setPartyId('');
    setPartyQuery('');
  };

  const filterInventoryItem = (inv: InventoryItem, q: string) =>
    inv.name.toLowerCase().includes(q) ||
    (inv.sku ? inv.sku.toLowerCase().includes(q) : false) ||
    (inv.hsnCode ? inv.hsnCode.toLowerCase().includes(q) : false) ||
    (inv.category ? inv.category.toLowerCase().includes(q) : false);

  const rankInventoryItem = (inv: InventoryItem, q: string) => {
    const name = inv.name.toLowerCase();
    const sku = (inv.sku || '').toLowerCase();
    if (name.startsWith(q)) return 0;
    if (sku && sku.startsWith(q)) return 1;
    if (name.includes(q)) return 2;
    return 3;
  };

  const handleToggleGstBill = (val: boolean) => {
    setIsGstBill(val);
    if (!isEditMode && type === 'SALE') {
      const prefix = val ? 'INV' : 'BOS';
      setVoucherNo(`${prefix}/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`);
    }
  };

  const handleItemChange = (index: number, field: keyof VoucherLineItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };

      if (field === 'name') {
        const linkedInv = inventory.find(i => i.id === current.itemId);
        if (linkedInv && linkedInv.name !== value) {
          current.itemId = `manual_${Date.now()}_${index}`;
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

  const handleSelectInventoryItem = (index: number, inv: InventoryItem) => {
    setItems(prev => {
      const updated = [...prev];
      const existing = updated[index];
      const rate = type === 'PURCHASE' ? inv.purchasePrice : inv.sellingPrice;
      const calc = calculateLineItem(
        Number(existing.qty) || 1,
        rate,
        Number(existing.discount) || 0,
        inv.gstRate,
        isInterState,
        isGstBill,
        isGstInclusive
      );

      updated[index] = {
        ...existing,
        itemId: inv.id,
        name: inv.name,
        hsn: inv.hsnCode,
        unit: inv.unit,
        rate,
        gstRate: inv.gstRate,
        taxableAmount: calc.taxableAmount,
        cgst: calc.cgst,
        sgst: calc.sgst,
        igst: calc.igst,
        total: calc.total,
      };
      return updated;
    });
  };

  const handleClearItemName = (index: number) => {
    setItems(prev => {
      const updated = [...prev];
      const existing = updated[index];
      const calc = calculateLineItem(
        Number(existing.qty) || 1,
        0,
        Number(existing.discount) || 0,
        18,
        isInterState,
        isGstBill,
        isGstInclusive
      );
      updated[index] = {
        ...existing,
        itemId: `manual_${Date.now()}_${index}`,
        name: '',
        hsn: '',
        rate: 0,
        gstRate: 18,
        taxableAmount: calc.taxableAmount,
        cgst: calc.cgst,
        sgst: calc.sgst,
        igst: calc.igst,
        total: calc.total,
      };
      return updated;
    });
  };

  const addItemRow = () => {
    const calc = calculateLineItem(1, 0, 0, 18, isInterState, isGstBill, isGstInclusive);
    setItems(prev => [
      ...prev,
      {
        itemId: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        name: '',
        hsn: '',
        qty: 1,
        unit: 'Pcs',
        rate: 0,
        discount: 0,
        taxableAmount: calc.taxableAmount,
        gstRate: 18,
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

    let matchedPartyId = partyId;
    let matchedPartyName = selectedParty?.name;

    if (!matchedPartyId && partyQuery.trim() && (!supportsCustomerModes || customerMode === 'existing')) {
      const exactMatch = eligibleParties.find(
        l => l.name.toLowerCase() === partyQuery.trim().toLowerCase()
      );
      if (exactMatch) {
        matchedPartyId = exactMatch.id;
        matchedPartyName = exactMatch.name;
      }
    }

    if (!supportsCustomerModes && !matchedPartyId) {
      setFormError(
        type === 'PURCHASE' || type === 'PAYMENT' || type === 'DEBIT_NOTE'
          ? 'Please select a company / supplier from suggestions.'
          : 'Please select a customer account from suggestions.'
      );
      return;
    }

    if (supportsCustomerModes && customerMode === 'existing' && partyQuery.trim() && !matchedPartyId) {
      setFormError('Please click a suggested customer from the list, or switch to New / Guest Customer.');
      return;
    }

    if (supportsCustomerModes && customerMode === 'existing' && paymentMode === 'CREDIT' && !matchedPartyId) {
      setFormError('Please select an Existing Customer for Credit sales, or switch to Guest Customer.');
      return;
    }

    if (supportsCustomerModes && customerMode === 'new' && !newCustName.trim()) {
      setFormError('Please enter the New Customer Name.');
      return;
    }

    setIsSubmitting(true);
    try {
      let resolvedPartyId: string | undefined = matchedPartyId || undefined;
      let resolvedPartyName: string | undefined = matchedPartyName;

      // Handle New Customer mode: create Sundry Debtors ledger automatically
      if (supportsCustomerModes && customerMode === 'new') {
        const createdLedgerId = await addLedger({
          name: newCustName.trim(),
          group: 'Sundry Debtors',
          phone: newCustPhone.trim() || undefined,
          gstin: newCustGstin.trim().toUpperCase() || undefined,
          pan: newCustPan.trim().toUpperCase() || undefined,
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

      const voucherPayload: Omit<TransactionVoucher, 'id'> = {
        voucherNo: voucherNo.trim(),
        date,
        type,
        partyId: resolvedPartyId,
        partyName: resolvedPartyName,
        customerMode: supportsCustomerModes
          ? customerMode === 'new'
            ? 'existing'
            : customerMode
          : 'existing',
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

      if (editingVoucher) {
        const updatedVoucher = await updateVoucher({
          ...editingVoucher,
          ...voucherPayload,
          id: editingVoucher.id,
          companyId: editingVoucher.companyId,
          createdAt: editingVoucher.createdAt,
        });

        setLastSavedVoucher(updatedVoucher);
        setSavedSuccessMsg(`Updated ${updatedVoucher.voucherNo} (${formatINR(updatedVoucher.grandTotal)})`);
        if (onSuccess) onSuccess(updatedVoucher, shouldPrint);
      } else {
        const createdId = await addVoucher(voucherPayload);
        const createdVoucher: TransactionVoucher = {
          ...voucherPayload,
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
        setItems([buildInitialItem(isGstBill)]);
        if (customerMode === 'new') {
          setCustomerMode('existing');
          setPartyId(resolvedPartyId || '');
          setPartyQuery(resolvedPartyName || '');
          setNewCustName('');
          setNewCustPhone('');
          setNewCustGstin('');
          setNewCustPan('');
          setNewCustAddress('');
        }

        if (onSuccess) onSuccess(createdVoucher, shouldPrint);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save invoice');
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
      className="space-y-4 text-xs"
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
            <div className="flex flex-wrap items-center gap-2">
              {onEditVoucher && (
                <button
                  type="button"
                  onClick={() => onEditVoucher(lastSavedVoucher)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded-md font-semibold text-[11px] whitespace-nowrap"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDownloadSavedPdf(lastSavedVoucher)}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-[11px] whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
              {onSuccess && (
                <button
                  type="button"
                  onClick={() => onSuccess(lastSavedVoucher, true)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded-md font-semibold text-[11px] whitespace-nowrap"
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
            Invoice Type
          </label>
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
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
                  if (!isEditMode) {
                    const prefix = getNextVoucherPrefix(tab.key, isGstBill);
                    setVoucherNo(`${prefix}/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`);
                  }
                  if (tab.key !== 'SALE' && tab.key !== 'CREDIT_NOTE') {
                    setCustomerMode('existing');
                  }
                  if (partyId) {
                    const currentParty = ledgers.find(l => l.id === partyId);
                    if (!currentParty || !isPartyEligibleForType(currentParty, tab.key)) {
                      setPartyId('');
                      setPartyQuery('');
                    }
                  } else {
                    setPartyQuery('');
                  }
                }}
                className={`h-8 px-3 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 inline-flex items-center justify-center ${
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
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleToggleGstBill(true)}
                className={`h-8 px-3 rounded-md text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center justify-center ${
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
                className={`h-8 px-3 rounded-md text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center justify-center ${
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
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsGstInclusive(false)}
                  className={`h-8 px-3 rounded-md text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center justify-center ${
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
                  className={`h-8 px-3 rounded-md text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center justify-center ${
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
            Invoice No *
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
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setCustomerMode('existing')}
                className={`flex-1 sm:flex-initial h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-md font-semibold transition-all whitespace-nowrap shrink-0 ${
                  customerMode === 'existing'
                    ? 'bg-white dark:bg-slate-700 theme-text shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Existing Customer</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode('new')}
                className={`flex-1 sm:flex-initial h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-md font-semibold transition-all whitespace-nowrap shrink-0 ${
                  customerMode === 'new'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" />
                <span>New Customer</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode('guest')}
                className={`flex-1 sm:flex-initial h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-md font-semibold transition-all whitespace-nowrap shrink-0 ${
                  customerMode === 'guest'
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span>Guest Customer</span>
              </button>
            </div>
          </div>

          {customerMode === 'existing' && (
            <div className="space-y-1.5">
              <AutocompleteInput<LedgerAccount>
                value={partyQuery}
                onChange={handlePartyQueryChange}
                items={eligibleParties}
                filterItem={filterParty}
                rankItem={rankParty}
                getItemKey={l => l.id}
                onSelect={handleSelectParty}
                onClear={handleClearParty}
                isSelected={Boolean(selectedParty)}
                selectedTitle="Saved customer ledger linked"
                showSearchIcon
                ariaLabel="Search existing customer"
                placeholder={
                  eligibleParties.length > 0
                    ? 'Start typing customer name, phone, or GSTIN...'
                    : 'No saved customers yet — switch to New Customer or Guest'
                }
                inputClassName="py-2.5 font-medium"
                renderItem={l => (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {l.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {[l.phone, l.gstin ? `GSTIN: ${l.gstin}` : ''].filter(Boolean).join(' · ') || l.group}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono tabular-nums text-[11px]">
                      <div className="text-slate-400 text-[10px]">Balance</div>
                      <div className="font-semibold text-slate-700 dark:text-slate-200">
                        {formatINR(l.currentBalance)}
                      </div>
                    </div>
                  </div>
                )}
                emptyState={
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1">
                    <span className="text-slate-500 dark:text-slate-400">
                      No saved customer matching &ldquo;{partyQuery.trim()}&rdquo;
                    </span>
                    <button
                      type="button"
                      onMouseDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        setNewCustName(partyQuery.trim());
                        setPartyId('');
                        setCustomerMode('new');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold theme-soft-badge hover:opacity-90 shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add as New Customer</span>
                    </button>
                  </div>
                }
              />
              {selectedParty && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    Selected: {selectedParty.name}
                  </span>
                  {selectedParty.phone && <span className="font-mono">{selectedParty.phone}</span>}
                  <span className="font-mono tabular-nums">
                    Bal: {formatINR(selectedParty.currentBalance)}
                  </span>
                </div>
              )}
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
              <div className="sm:col-span-2">
                <GstinLookupField
                  compact
                  label="GSTIN (Optional — Verify & Auto-fill)"
                  value={newCustGstin}
                  onChange={setNewCustGstin}
                  onApplyDetails={details => {
                    if (details.stateCode) setNewCustStateCode(details.stateCode);
                    if (details.pan) setNewCustPan(details.pan);
                    if (details.businessName) setNewCustName(details.businessName);
                    if (details.address) setNewCustAddress(details.address);
                  }}
                />
              </div>
              <div className="sm:col-span-2">
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
              <div className="sm:col-span-2">
                <GstinLookupField
                  compact
                  label="Guest GSTIN (Optional — Verify & Auto-fill)"
                  placeholder="Unregistered B2C"
                  value={guestGstin}
                  onChange={setGuestGstin}
                  onApplyDetails={details => {
                    if (details.stateCode) setGuestStateCode(details.stateCode);
                    if (details.businessName) setGuestName(details.businessName);
                    if (details.address) setGuestAddress(details.address);
                  }}
                />
              </div>
              <div className="sm:col-span-2">
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
        <div className="space-y-1.5">
          <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
            {type === 'PURCHASE' || type === 'PAYMENT' || type === 'DEBIT_NOTE'
              ? 'Company / Supplier Account *'
              : 'Customer Ledger Account *'}
          </label>
          <AutocompleteInput<LedgerAccount>
            value={partyQuery}
            onChange={handlePartyQueryChange}
            items={eligibleParties}
            filterItem={filterParty}
            rankItem={rankParty}
            getItemKey={l => l.id}
            onSelect={handleSelectParty}
            onClear={handleClearParty}
            isSelected={Boolean(selectedParty)}
            selectedTitle="Ledger account linked"
            showSearchIcon
            ariaLabel={
              type === 'PURCHASE' || type === 'PAYMENT' || type === 'DEBIT_NOTE'
                ? 'Search company or supplier account'
                : 'Search customer ledger account'
            }
            placeholder={
              type === 'PURCHASE' || type === 'PAYMENT' || type === 'DEBIT_NOTE'
                ? 'Start typing company / supplier name...'
                : 'Start typing customer name...'
            }
            inputClassName="py-2.5 font-medium"
            renderItem={l => (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {l.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {[l.group, l.phone].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="text-right shrink-0 font-mono tabular-nums text-[11px]">
                  <div className="text-slate-400 text-[10px]">Balance</div>
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    {formatINR(l.currentBalance)}
                  </div>
                </div>
              </div>
            )}
            emptyState={
              <span className="text-slate-500 dark:text-slate-400">
                No matching ledger account for &ldquo;{partyQuery.trim()}&rdquo;
              </span>
            }
          />
          {selectedParty && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 px-1">
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                Selected: {selectedParty.name} ({selectedParty.group})
              </span>
              <span className="font-mono tabular-nums">
                Bal: {formatINR(selectedParty.currentBalance)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Place of Supply Info Bar */}
      {isGoodsTransaction && (
        <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg text-xs text-slate-700 dark:text-slate-300">
          <Building className="w-4 h-4 shrink-0 theme-text" />
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
            <button
              type="button"
              onClick={addItemRow}
              className="h-8 inline-flex items-center justify-center gap-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Line Item</span>
            </button>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[680px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-2 px-3 min-w-[210px]">Item Name</th>
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
                      <td className="py-2 px-3">
                        <AutocompleteInput<InventoryItem>
                          value={row.name}
                          onChange={val => handleItemChange(idx, 'name', val)}
                          items={inventory}
                          filterItem={filterInventoryItem}
                          rankItem={rankInventoryItem}
                          getItemKey={inv => inv.id}
                          onSelect={inv => handleSelectInventoryItem(idx, inv)}
                          onClear={() => handleClearItemName(idx)}
                          isSelected={isCatalogItem}
                          selectedTitle="Linked to inventory catalog"
                          minDropdownWidth={340}
                          ariaLabel={`Product name for row ${idx + 1}`}
                          placeholder="Type product name or SKU..."
                          inputClassName="py-1.5 font-medium rounded-md border-slate-200 dark:border-slate-700"
                          renderItem={inv => {
                            const price =
                              type === 'PURCHASE' ? inv.purchasePrice : inv.sellingPrice;
                            const isLowStock = inv.currentStock <= inv.minStockAlert;
                            return (
                              <div className="space-y-0.5">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                    {inv.name}
                                  </span>
                                  <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200 shrink-0">
                                    {formatINR(price)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                  <span className="truncate font-mono">
                                    {[inv.sku, inv.hsnCode ? `HSN ${inv.hsnCode}` : '']
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                  <span
                                    className={`font-mono tabular-nums shrink-0 ${
                                      isLowStock
                                        ? 'text-amber-600 dark:text-amber-400 font-medium'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                    }`}
                                  >
                                    Stock: {inv.currentStock} {inv.unit}
                                  </span>
                                </div>
                              </div>
                            );
                          }}
                          emptyState={
                            <span className="text-slate-500 dark:text-slate-400">
                              No catalog match — will be billed as custom item &ldquo;{row.name.trim()}&rdquo;
                            </span>
                          }
                        />
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
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {row.taxableAmount.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {row.total.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length <= 1}
                          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-30 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 font-mono tabular-nums text-xs">
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
            className="h-9 px-4 inline-flex items-center justify-center text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-semibold whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-9 inline-flex items-center justify-center gap-1.5 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isEditMode ? 'Update Invoice' : 'Save Invoice'}</span>
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => submitVoucher(true)}
          className="theme-bg theme-bg-hover h-9 inline-flex items-center justify-center gap-1.5 px-4 text-xs font-bold text-white rounded-lg shadow-xs disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{isEditMode ? 'Update & Print / Download' : 'Save & Print / Download'}</span>
        </button>
      </div>
    </form>
  );
};

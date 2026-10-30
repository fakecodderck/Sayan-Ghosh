import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Boxes,
  Plus,
  Minus,
  Edit2,
  Trash2,
  Calendar,
  Search,
  Filter,
  AlertTriangle,
  PackageCheck,
  TrendingUp,
  TrendingDown,
  X,
  FileCheck
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { InventoryItem, UnitType } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';

interface StockItemRegisterViewProps {
  itemId: string;
  onBack: () => void;
  onOpenNewPurchase?: () => void;
  onOpenNewSale?: () => void;
}

export const StockItemRegisterView: React.FC<StockItemRegisterViewProps> = ({
  itemId,
  onBack,
  onOpenNewPurchase,
  onOpenNewSale,
}) => {
  const {
    inventory,
    vouchers,
    updateInventoryItem,
    deleteInventoryItem,
    updateStockQuantity
  } = useAccounting();

  const item = inventory.find(i => i.id === itemId);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('Stock Count Verification');

  // Edit form state
  const [editName, setEditName] = useState(item?.name || '');
  const [editSku, setEditSku] = useState(item?.sku || '');
  const [editHsn, setEditHsn] = useState(item?.hsnCode || '');
  const [editUnit, setEditUnit] = useState<UnitType>(item?.unit || 'Pcs');
  const [editCost, setEditCost] = useState(item?.purchasePrice || 0);
  const [editPrice, setEditPrice] = useState(item?.sellingPrice || 0);
  const [editGst, setEditGst] = useState(item?.gstRate || 18);
  const [editMinAlert, setEditMinAlert] = useState(item?.minStockAlert || 10);

  // Compute item ledger history by traversing vouchers
  const movementRows = useMemo(() => {
    if (!item) return [];

    // Filter all vouchers that have line items for this specific item
    const relatedVouchers = vouchers
      .filter(v => v.items && v.items.some(it => it.itemId === item.id))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute running balance
    // Start with a calculated baseline opening stock
    let runningQty = 0;
    const rows = [];

    for (const v of relatedVouchers) {
      const line = v.items.find(it => it.itemId === item.id);
      if (!line) continue;

      let inQty = 0;
      let outQty = 0;

      if (v.type === 'PURCHASE') {
        inQty = line.qty;
      } else if (v.type === 'SALE') {
        outQty = line.qty;
      } else if (v.type === 'CREDIT_NOTE') {
        // Customer return = goods back in stock
        inQty = line.qty;
      } else if (v.type === 'DEBIT_NOTE') {
        // Supplier return = goods returned out
        outQty = line.qty;
      }

      runningQty = runningQty + inQty - outQty;

      rows.push({
        id: v.id,
        date: v.date,
        voucherNo: v.voucherNo,
        type: v.type,
        partyName: v.partyName || 'Counter Transaction',
        rate: line.rate,
        inQty,
        outQty,
        runningBalance: runningQty,
        totalAmount: line.total,
        notes: v.notes,
      });
    }

    return rows;
  }, [vouchers, item]);

  const filteredMovements = useMemo(() => {
    return movementRows.filter(m => {
      if (filterType !== 'ALL' && m.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.voucherNo.toLowerCase().includes(q) ||
          m.partyName.toLowerCase().includes(q) ||
          m.notes?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [movementRows, filterType, searchQuery]);

  const totalInwardQty = useMemo(() => {
    return movementRows.reduce((acc, m) => acc + m.inQty, 0);
  }, [movementRows]);

  const totalOutwardQty = useMemo(() => {
    return movementRows.reduce((acc, m) => acc + m.outQty, 0);
  }, [movementRows]);

  if (!item) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-slate-500">Item not found or has been deleted.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg"
        >
          Back to Stock Registry
        </button>
      </div>
    );
  }

  const currentStock = item.currentStock || 0;
  const isLowStock = currentStock <= item.minStockAlert;
  const totalValuation = currentStock * (item.purchasePrice || 0);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateInventoryItem({
      ...item,
      name: editName.trim(),
      sku: editSku.trim(),
      hsnCode: editHsn.trim(),
      unit: editUnit,
      purchasePrice: Number(editCost) || 0,
      sellingPrice: Number(editPrice) || 0,
      gstRate: Number(editGst) || 18,
      minStockAlert: Number(editMinAlert) || 10,
    });
    setShowEditModal(false);
  };

  const handleDeleteItem = async () => {
    if (confirm(`Are you sure you want to delete ${item.name}? This action cannot be undone.`)) {
      await deleteInventoryItem(item.id);
      onBack();
    }
  };

  const handleApplyAdjustment = async () => {
    if (adjustQty === 0) return;
    await updateStockQuantity(item.id, adjustQty);
    setShowAdjustModal(false);
    setAdjustQty(0);
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {item.name}
              </h2>
              {isLowStock && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  Low Stock Alert
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              SKU: {item.sku} · HSN: {item.hsnCode} · GST: {item.gstRate}% · Unit: {item.unit}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAdjustModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors min-h-[38px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Stock Adjustment</span>
          </button>
          <button
            onClick={() => {
              setEditName(item.name);
              setEditSku(item.sku);
              setEditHsn(item.hsnCode);
              setEditUnit(item.unit);
              setEditCost(item.purchasePrice);
              setEditPrice(item.sellingPrice);
              setEditGst(item.gstRate);
              setEditMinAlert(item.minStockAlert);
              setShowEditModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-xs font-semibold rounded-lg transition-colors border border-blue-200 dark:border-blue-900 min-h-[38px]"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Product</span>
          </button>
          <button
            onClick={handleDeleteItem}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-semibold rounded-lg transition-colors border border-rose-200 dark:border-rose-900 min-h-[38px]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Current Stock On-Hand
          </p>
          <p className={`text-xl font-bold font-mono mt-1 ${isLowStock ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
            {currentStock} {item.unit}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Min safety alert: {item.minStockAlert} {item.unit}
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Stock Asset Valuation
          </p>
          <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
            {formatINR(totalValuation)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            At purchase cost: {formatINR(item.purchasePrice)}
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Inward Movement
          </p>
          <p className="text-xl font-bold font-mono text-teal-600 dark:text-teal-400 mt-1">
            +{totalInwardQty} {item.unit}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Purchases &amp; sales returns
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Outward Movement
          </p>
          <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            -{totalOutwardQty} {item.unit}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Sales &amp; vendor returns
          </span>
        </div>
      </div>

      {/* Specifications Strip */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Cost Price</span>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
            {formatINR(item.purchasePrice)}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Selling Price</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
            {formatINR(item.sellingPrice)}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Gross Margin</span>
          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
            {item.sellingPrice > 0 ? (((item.sellingPrice - item.purchasePrice) / item.sellingPrice) * 100).toFixed(1) : 0}%
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px] uppercase font-semibold">GST Rate Slab</span>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
            {item.gstRate}% GST
          </span>
        </div>
      </div>

      {/* Item Register (Stock Movement Ledger) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Stock Ledger &amp; Movement Register
            </h3>
            <span className="text-[11px] text-slate-400">
              ({filteredMovements.length} log entries)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search voucher or party..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
              />
            </div>

            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
            >
              <option value="ALL">All Movements</option>
              <option value="PURCHASE">Purchases (In)</option>
              <option value="SALE">Sales (Out)</option>
              <option value="CREDIT_NOTE">Sales Returns (In)</option>
              <option value="DEBIT_NOTE">Purchase Returns (Out)</option>
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-4 w-24">Date</th>
                  <th className="py-2.5 px-3 w-32">Voucher / Bill No</th>
                  <th className="py-2.5 px-3 w-28">Nature</th>
                  <th className="py-2.5 px-3 min-w-[160px]">Party Name / Narration</th>
                  <th className="py-2.5 px-3 w-24 text-right">Rate (₹)</th>
                  <th className="py-2.5 px-3 w-24 text-right text-teal-600 dark:text-teal-400">
                    Inward Qty
                  </th>
                  <th className="py-2.5 px-3 w-24 text-right text-rose-600 dark:text-rose-400">
                    Outward Qty
                  </th>
                  <th className="py-2.5 px-4 w-28 text-right font-bold text-slate-900 dark:text-slate-100">
                    Balance Qty
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No stock movement entries recorded for this product yet.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                        {row.voucherNo}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            row.type === 'PURCHASE' || row.type === 'CREDIT_NOTE'
                              ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {row.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-xs">
                          {row.partyName}
                        </p>
                        {row.notes && (
                          <p className="text-[10px] text-slate-400 truncate max-w-xs">{row.notes}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatINR(row.rate)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                        {row.inQty > 0 ? `+${row.inQty} ${item.unit}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {row.outQty > 0 ? `-${row.outQty} ${item.unit}` : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {row.runningBalance} {item.unit}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Adjust Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Adjust Physical Stock Count
              </h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
              <p className="text-slate-500 font-mono">
                Current Stock: <strong>{currentStock} {item.unit}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Quantity Delta (Add or Deduct)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="e.g. +20 or -5"
                  value={adjustQty || ''}
                  onChange={e => setAdjustQty(parseFloat(e.target.value) || 0)}
                  className="flex-1 p-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
                <span className="text-xs font-medium text-slate-600">{item.unit}</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Positive for incoming stock, negative for damaged/scrap.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Reason / Remark
              </label>
              <input
                type="text"
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
                className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAdjustModal(false)}
                className="px-3.5 py-2 text-xs text-slate-600 bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyAdjustment}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
              >
                Apply Stock Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 space-y-4 my-8">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Edit Product Details
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    required
                    value={editSku}
                    onChange={e => setEditSku(e.target.value)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    required
                    value={editHsn}
                    onChange={e => setEditHsn(e.target.value)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Unit
                  </label>
                  <select
                    value={editUnit}
                    onChange={e => setEditUnit(e.target.value as UnitType)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Box">Box</option>
                    <option value="Kg">Kg</option>
                    <option value="Mtr">Mtr</option>
                    <option value="Ltr">Ltr</option>
                    <option value="Set">Set</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editCost}
                    onChange={e => setEditCost(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editPrice}
                    onChange={e => setEditPrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    GST Rate
                  </label>
                  <select
                    value={editGst}
                    onChange={e => setEditGst(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Min Stock Alert Level
                </label>
                <input
                  type="number"
                  value={editMinAlert}
                  onChange={e => setEditMinAlert(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-2 text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
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
};

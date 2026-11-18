import React, { useState, useMemo, useEffect } from 'react';
import {
  Boxes,
  Search,
  Plus,
  AlertTriangle,
  X,
  BookOpen,
  Trash2,
  Edit2
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { InventoryItem, UnitType } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';
import { StockItemRegisterView } from './StockItemRegisterView';

interface InventoryViewProps {
  onNavigateToAddProduct?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onNavigateToAddProduct }) => {
  const {
    inventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    updateStockQuantity
  } = useAccounting();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAlertOnly, setFilterAlertOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Add / Edit Form State
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formHsn, setFormHsn] = useState('');
  const [formUnit, setFormUnit] = useState<UnitType>('Pcs');
  const [formPurchasePrice, setFormPurchasePrice] = useState(0);
  const [formSellingPrice, setFormSellingPrice] = useState(0);
  const [formGstRate, setFormGstRate] = useState(18);
  const [formMinStock, setFormMinStock] = useState(10);
  const [formInitialQty, setFormInitialQty] = useState(0);
  const [formCategory, setFormCategory] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const isLow = (item.currentStock || 0) <= item.minStockAlert;
      if (filterAlertOnly && !isLow) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.hsnCode.toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [inventory, filterAlertOnly, searchQuery]);

  const totalValuation = useMemo(() => {
    return inventory.reduce((total, item) => {
      const qty = item.currentStock || 0;
      return total + qty * (item.purchasePrice || 0);
    }, 0);
  }, [inventory]);

  const lowStockCount = useMemo(() => {
    return inventory.filter(item => (item.currentStock || 0) <= item.minStockAlert).length;
  }, [inventory]);

  const openAddModal = () => {
    if (onNavigateToAddProduct) {
      onNavigateToAddProduct();
      return;
    }
    setEditingItem(null);
    setFormName('');
    setFormSku('');
    setFormHsn('');
    setFormUnit('Pcs');
    setFormPurchasePrice(0);
    setFormSellingPrice(0);
    setFormGstRate(18);
    setFormMinStock(10);
    setFormInitialQty(0);
    setFormCategory('');
    setFormError(null);
    setShowAddModal(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormSku(item.sku);
    setFormHsn(item.hsnCode);
    setFormUnit(item.unit);
    setFormPurchasePrice(item.purchasePrice || 0);
    setFormSellingPrice(item.sellingPrice || 0);
    setFormGstRate(item.gstRate ?? 18);
    setFormMinStock(item.minStockAlert ?? 10);
    setFormInitialQty(item.currentStock || 0);
    setFormCategory(item.category || '');
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setFormError(null);

    try {
      if (editingItem) {
        await updateInventoryItem({
          ...editingItem,
          name: formName.trim(),
          sku: formSku.trim() || editingItem.sku,
          hsnCode: formHsn.trim() || '9999',
          unit: formUnit,
          purchasePrice: Number(formPurchasePrice) || 0,
          sellingPrice: Number(formSellingPrice) || 0,
          gstRate: Number(formGstRate) || 0,
          minStockAlert: Number(formMinStock) || 0,
          currentStock: Number(formInitialQty) || 0,
          category: formCategory.trim() || undefined,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await addInventoryItem({
          name: formName.trim(),
          sku: formSku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          hsnCode: formHsn.trim() || '9999',
          unit: formUnit,
          purchasePrice: Number(formPurchasePrice) || 0,
          sellingPrice: Number(formSellingPrice) || 0,
          gstRate: Number(formGstRate) || 0,
          minStockAlert: Number(formMinStock) || 0,
          currentStock: Number(formInitialQty) || 0,
          category: formCategory.trim() || undefined,
        });
      }
      setShowAddModal(false);
      setEditingItem(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product');
    }
  };

  const handleApplyAdjustment = async () => {
    if (!adjustItem || adjustQty === 0) return;
    await updateStockQuantity(adjustItem.id, adjustQty);
    setAdjustItem(null);
    setAdjustQty(0);
  };

  useEffect(() => {
    if (!showAddModal && !adjustItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddModal(false);
        setAdjustItem(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAddModal, adjustItem]);

  if (selectedItemId) {
    return (
      <StockItemRegisterView
        itemId={selectedItemId}
        onBack={() => setSelectedItemId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Stock &amp; Inventory Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            On-hand stock counts, edit product rates/HSN, stock adjustments, and item movement registers
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-4 py-2.5 theme-bg theme-bg-hover active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product / SKU</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Inventory Valuation (Cost)
          </p>
          <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {formatINR(totalValuation)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Cost of goods currently on-hand
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Active Catalog Items
          </p>
          <p className="text-lg sm:text-xl font-bold font-mono tabular-nums theme-text mt-1">
            {inventory.length} Products
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Configured with GST &amp; HSN codes
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Low Stock Alerts
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-lg sm:text-xl font-bold font-mono tabular-nums ${lowStockCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
              {lowStockCount} Items
            </p>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            At or below reorder threshold
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search product name, SKU, category, or HSN..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-hidden"
          />
        </div>

        <button
          type="button"
          onClick={() => setFilterAlertOnly(!filterAlertOnly)}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors min-h-[38px] ${
            filterAlertOnly
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Low Stock Only ({lowStockCount})</span>
        </button>
      </div>

      {/* Inventory Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-4 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[180px]">Item Description</th>
                <th className="py-2.5 px-3 w-28">SKU</th>
                <th className="py-2.5 px-3 w-20 text-center">HSN</th>
                <th className="py-2.5 px-3 w-24 text-right">Cost Price</th>
                <th className="py-2.5 px-3 w-24 text-right">Selling Price</th>
                <th className="py-2.5 px-3 w-16 text-center">GST</th>
                <th className="py-2.5 px-4 w-28 text-right font-bold text-slate-900 dark:text-slate-100">
                  Stock
                </th>
                <th className="py-2.5 px-3 w-44 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-blue-600 rounded-xl flex items-center justify-center">
                        <Boxes className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          No Inventory Products Found
                        </h4>
                        <p className="text-xs text-slate-500">
                          {searchQuery || filterAlertOnly
                            ? 'No products match your search query or low stock filter.'
                            : 'Add your first product to start tracking stock quantities, HSN codes, and margins.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={openAddModal}
                        className="mt-2 theme-bg text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs hover:opacity-90 transition-all flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add First Product</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item, idx) => {
                  const stock = item.currentStock || 0;
                  const isLow = stock <= item.minStockAlert;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        isLow ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 text-center text-slate-400 font-mono tabular-nums">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => setSelectedItemId(item.id)}
                          className="font-semibold theme-text hover:underline text-left block"
                        >
                          {item.name}
                        </button>
                        <span className="text-[10px] text-slate-400">
                          {item.category ? `${item.category} · ` : ''}Alert &le; {item.minStockAlert} {item.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">{item.sku}</td>
                      <td className="py-2.5 px-3 font-mono text-center text-slate-500">{item.hsnCode}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {formatINR(item.purchasePrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {formatINR(item.sellingPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {item.gstRate}%
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold">
                        <span className={isLow ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}>
                          {stock} {item.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedItemId(item.id)}
                            title="Item Stock Register"
                            className="p-1.5 theme-text hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            title="Edit Product"
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdjustItem(item)}
                            title="Adjust Stock"
                            className="px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium border border-slate-200 dark:border-slate-700"
                          >
                            +/- Stock
                          </button>
                          {confirmDeleteId === item.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  deleteInventoryItem(item.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 text-[10px] font-bold bg-rose-600 text-white rounded"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-1 text-[10px] text-slate-500 hover:text-slate-800"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              title="Delete Product"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Adjust Stock Modal */}
      {adjustItem && (
        <div
          onClick={() => setAdjustItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Adjust Physical Stock Quantity
              </h3>
              <button
                type="button"
                onClick={() => setAdjustItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{adjustItem.name}</p>
              <p className="text-slate-500 font-mono">
                SKU: {adjustItem.sku} · Current: <strong>{adjustItem.currentStock} {adjustItem.unit}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Adjustment Delta (Add or Deduct)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="e.g. +10 or -5"
                  value={adjustQty || ''}
                  onChange={e => setAdjustQty(parseFloat(e.target.value) || 0)}
                  className="flex-1 p-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 theme-ring"
                />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{adjustItem.unit}</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Use positive value for stock arrival, negative for damage or write-off.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAdjustItem(null)}
                className="px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyAdjustment}
                className="px-4 py-2 text-xs font-semibold text-white theme-bg theme-bg-hover rounded-lg shadow-xs"
              >
                Apply Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 space-y-4 my-8"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {editingItem ? 'Edit Inventory Product' : 'Register New Inventory Product'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-medium">
                  {formError}
                </div>
              )}
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Product / Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={e => setFormSku(e.target.value)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    HSN Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formHsn}
                    onChange={e => setFormHsn(e.target.value)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Unit
                  </label>
                  <select
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value as UnitType)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
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
                    value={formPurchasePrice}
                    onChange={e => setFormPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formSellingPrice}
                    onChange={e => setFormSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    GST Rate
                  </label>
                  <select
                    value={formGstRate}
                    onChange={e => setFormGstRate(parseFloat(e.target.value) || 0)}
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Min Stock Alert
                  </label>
                  <input
                    type="number"
                    value={formMinStock}
                    onChange={e => setFormMinStock(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Current Stock
                  </label>
                  <input
                    type="number"
                    value={formInitialQty}
                    onChange={e => setFormInitialQty(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white theme-bg theme-bg-hover rounded-lg"
                >
                  {editingItem ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

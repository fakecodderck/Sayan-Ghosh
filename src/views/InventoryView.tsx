import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Search,
  Plus,
  AlertTriangle,
  X,
  PackageCheck,
  TrendingDown,
  Layers,
  BookOpen,
  Trash2
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { InventoryItem, UnitType } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';
import { StockItemRegisterView } from './StockItemRegisterView';

export const InventoryView: React.FC = () => {
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
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);

  // New Item State
  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newHsn, setNewHsn] = useState('');
  const [newUnit, setNewUnit] = useState<UnitType>('Pcs');
  const [newPurchasePrice, setNewPurchasePrice] = useState(0);
  const [newSellingPrice, setNewSellingPrice] = useState(0);
  const [newGstRate, setNewGstRate] = useState(18);
  const [newMinStock, setNewMinStock] = useState(20);
  const [newInitialQty, setNewInitialQty] = useState(50);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const isLow = (item.currentStock || 0) <= item.minStockAlert;
      if (filterAlertOnly && !isLow) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.hsnCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [inventory, filterAlertOnly, searchQuery]);

  // Inventory valuation
  const totalValuation = useMemo(() => {
    return inventory.reduce((total, item) => {
      const qty = item.currentStock || 0;
      return total + qty * (item.purchasePrice || 0);
    }, 0);
  }, [inventory]);

  const lowStockCount = useMemo(() => {
    return inventory.filter(item => (item.currentStock || 0) <= item.minStockAlert).length;
  }, [inventory]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    await addInventoryItem({
      name: newName.trim(),
      sku: newSku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      hsnCode: newHsn.trim() || '8544',
      unit: newUnit,
      purchasePrice: Number(newPurchasePrice) || 0,
      sellingPrice: Number(newSellingPrice) || 0,
      gstRate: Number(newGstRate) || 18,
      minStockAlert: Number(newMinStock) || 10,
      currentStock: Number(newInitialQty) || 0,
    });

    setShowAddModal(false);
    setNewName('');
    setNewSku('');
    setNewHsn('');
    setNewPurchasePrice(0);
    setNewSellingPrice(0);
  };

  const handleApplyAdjustment = async () => {
    if (!adjustItem || adjustQty === 0) return;
    await updateStockQuantity(adjustItem.id, adjustQty);
    setAdjustItem(null);
    setAdjustQty(0);
  };

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
            Real-time on-hand stock counts, valuation, HSN codes, and low stock warnings
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Product / SKU</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Inventory Valuation (Cost)
          </p>
          <p className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
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
          <p className="text-lg sm:text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
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
            <p className={`text-lg sm:text-xl font-bold font-mono ${lowStockCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
              {lowStockCount} Items
            </p>
            {lowStockCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                Reorder
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Below safety buffer threshold
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search product name, SKU, or HSN code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-hidden"
          />
        </div>

        <button
          onClick={() => setFilterAlertOnly(!filterAlertOnly)}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors min-h-[40px] ${
            filterAlertOnly
              ? 'bg-amber-500 text-white border-amber-600'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Show Low Stock Only ({lowStockCount})</span>
        </button>
      </div>

      {/* High Density Inventory Table (Scrollable on mobile) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-4 w-12 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[180px]">Item Description</th>
                <th className="py-2.5 px-3 w-28">SKU</th>
                <th className="py-2.5 px-3 w-20 text-center">HSN</th>
                <th className="py-2.5 px-3 w-24 text-right">Cost Price</th>
                <th className="py-2.5 px-3 w-24 text-right">Selling Price</th>
                <th className="py-2.5 px-3 w-16 text-center">GST</th>
                <th className="py-2.5 px-4 w-32 text-right font-bold text-slate-900 dark:text-slate-100">
                  Current Stock
                </th>
                <th className="py-2.5 px-3 w-24 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center justify-center space-y-3">
                      <div className="w-14 h-14 bg-gradient-to-tr from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-md">
                        <Boxes className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          No Inventory Products Found
                        </h4>
                        <p className="text-xs text-slate-500">
                          {searchQuery || filterAlertOnly
                            ? 'No products match your search query or low stock filter.'
                            : 'Configure your stock registry items to track quantities, HSN codes, and margins.'}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="mt-2 theme-bg text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs hover:opacity-90 transition-all flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Register First Product</span>
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
                      <td className="py-2.5 px-4 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => setSelectedItemId(item.id)}
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-left block"
                        >
                          {item.name}
                        </button>
                        <span className="text-[10px] text-slate-400">
                          Unit: {item.unit} · Alert when &le; {item.minStockAlert} {item.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {item.sku}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-center text-slate-500">
                        {item.hsnCode}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatINR(item.purchasePrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                        {formatINR(item.sellingPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">
                          {item.gstRate}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                            isLow
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {stock} {item.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedItemId(item.id)}
                            title="Open Item Register Page"
                            className="px-2 py-1 text-[11px] bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded font-semibold flex items-center gap-1 border border-blue-200 dark:border-blue-800"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>Register</span>
                          </button>
                          <button
                            onClick={() => setAdjustItem(item)}
                            title="Adjust Stock"
                            className="px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium border border-slate-200 dark:border-slate-700"
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete ${item.name}?`)) {
                                deleteInventoryItem(item.id);
                              }
                            }}
                            title="Delete Item"
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

      {/* Adjust Stock Modal */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Adjust Physical Stock Quantity
              </h3>
              <button
                onClick={() => setAdjustItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{adjustItem.name}</p>
              <p className="text-slate-500 font-mono">SKU: {adjustItem.sku} · Current: <strong>{adjustItem.currentStock} {adjustItem.unit}</strong></p>
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
                  className="flex-1 p-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                />
                <span className="text-xs font-medium text-slate-600">
                  {adjustItem.unit}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Use positive value for stock arrival, negative for damage/shrinkage.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAdjustItem(null)}
                className="px-3.5 py-2 text-xs text-slate-600 bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyAdjustment}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
              >
                Apply Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 space-y-4 my-8">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Register New Inventory Product
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Product / Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Industrial Multi-Core Cable 4.0 sq mm"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
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
                    placeholder="CBL-4MM-100"
                    value={newSku}
                    onChange={e => setNewSku(e.target.value)}
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
                    placeholder="8544"
                    value={newHsn}
                    onChange={e => setNewHsn(e.target.value)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Unit
                  </label>
                  <select
                    value={newUnit}
                    onChange={e => setNewUnit(e.target.value as UnitType)}
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
                    value={newPurchasePrice}
                    onChange={e => setNewPurchasePrice(parseFloat(e.target.value) || 0)}
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
                    value={newSellingPrice}
                    onChange={e => setNewSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    GST Rate
                  </label>
                  <select
                    value={newGstRate}
                    onChange={e => setNewGstRate(parseFloat(e.target.value) || 0)}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Min Stock Alert Level
                  </label>
                  <input
                    type="number"
                    value={newMinStock}
                    onChange={e => setNewMinStock(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Initial Stock Count
                  </label>
                  <input
                    type="number"
                    value={newInitialQty}
                    onChange={e => setNewInitialQty(parseFloat(e.target.value) || 0)}
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
                  className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

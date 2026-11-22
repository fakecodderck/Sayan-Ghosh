import React, { useState } from 'react';
import { PackagePlus, CheckCircle2, ArrowRight, RefreshCw } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { UnitType } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';

interface AddProductViewProps {
  onNavigateToInventory: () => void;
}

export const AddProductView: React.FC<AddProductViewProps> = ({ onNavigateToInventory }) => {
  const { addInventoryItem, inventory } = useAccounting();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState<UnitType>('Pcs');
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [gstRate, setGstRate] = useState<number>(18);
  const [minStockAlert, setMinStockAlert] = useState<number>(10);
  const [openingStock, setOpeningStock] = useState<number>(0);
  const [description, setDescription] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [savedProductName, setSavedProductName] = useState<string | null>(null);

  const generateSku = () => {
    const clean = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 4);
    const num = Math.floor(100 + Math.random() * 900);
    setSku(`${clean || 'PRD'}-${num}`);
  };

  const marginPerUnit = Math.max(0, sellingPrice - purchasePrice);
  const marginPct = sellingPrice > 0 ? ((marginPerUnit / sellingPrice) * 100).toFixed(1) : '0.0';

  const handleSubmit = async (e: React.FormEvent, goToStock: boolean = false) => {
    e.preventDefault();
    setError(null);
    setSavedProductName(null);

    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }

    try {
      const addedName = name.trim();
      await addInventoryItem({
        name: addedName,
        sku: sku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        hsnCode: hsnCode.trim() || '9999',
        category: category.trim() || undefined,
        unit,
        purchasePrice: Number(purchasePrice) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        gstRate: Number(gstRate) || 0,
        minStockAlert: Number(minStockAlert) || 0,
        openingStock: Number(openingStock) || 0,
        currentStock: Number(openingStock) || 0,
        description: description.trim() || undefined,
      });

      if (goToStock) {
        onNavigateToInventory();
        return;
      }

      setSavedProductName(addedName);
      setName('');
      setSku('');
      setHsnCode('');
      setCategory('');
      setPurchasePrice(0);
      setSellingPrice(0);
      setOpeningStock(0);
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to add product.');
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <PackagePlus className="w-5 h-5 theme-text shrink-0" />
            <span>Add New Product / SKU</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Register a new item with HSN code, GST slab, purchase &amp; selling prices, and opening stock ({inventory.length} items currently in catalog)
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToInventory}
          className="h-9 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <span>View Stock Management</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {savedProductName && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Product <strong>{savedProductName}</strong> added to inventory! Ready to add another.
            </span>
          </div>
          <button
            type="button"
            onClick={onNavigateToInventory}
            className="font-bold underline shrink-0"
          >
            Go to Stock List
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <form
        onSubmit={e => handleSubmit(e, false)}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5 text-xs"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Product / Item Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Copper Armoured Cable 4-Core"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              SKU / Item Code *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                placeholder="e.g. CBL-4MM-01"
                value={sku}
                onChange={e => setSku(e.target.value.toUpperCase())}
                className="flex-1 h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
              <button
                type="button"
                onClick={generateSku}
                className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                title="Auto-generate SKU"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Auto</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                HSN / SAC Code *
              </label>
              <input
                type="text"
                required
                placeholder="8544"
                value={hsnCode}
                onChange={e => setHsnCode(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Unit
              </label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value as UnitType)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
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
        </div>

        {/* Pricing & Tax */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Purchase / Cost Price (₹)
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={purchasePrice || ''}
              onChange={e => setPurchasePrice(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Selling Price (₹) *
            </label>
            <input
              type="number"
              min="0"
              step="any"
              required
              value={sellingPrice || ''}
              onChange={e => setSellingPrice(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-semibold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              GST Slab (%)
            </label>
            <select
              value={gstRate}
              onChange={e => setGstRate(parseFloat(e.target.value) || 0)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
            >
              <option value="0">0% (Exempt)</option>
              <option value="5">5% GST</option>
              <option value="12">12% GST</option>
              <option value="18">18% GST</option>
              <option value="28">28% GST</option>
            </select>
          </div>
        </div>

        {/* Margin indicator bar */}
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-600 dark:text-slate-400">
            Estimated Margin: <strong className="font-mono text-slate-900 dark:text-slate-100">{formatINR(marginPerUnit)} / {unit}</strong> ({marginPct}%)
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400">
            Opening Valuation: <strong className="font-mono text-slate-900 dark:text-slate-100">{formatINR((openingStock || 0) * (purchasePrice || 0))}</strong>
          </div>
        </div>

        {/* Stock & Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Opening Stock Quantity
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={openingStock || ''}
              onChange={e => setOpeningStock(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Low Stock Alert Level
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={minStockAlert}
              onChange={e => setMinStockAlert(parseFloat(e.target.value) || 0)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Category (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Electrical, Hardware"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Product Notes / Description (Optional)
          </label>
          <input
            type="text"
            placeholder="Supplier brand, specification, pack size..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={e => handleSubmit(e, true)}
            className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold inline-flex items-center justify-center whitespace-nowrap shrink-0"
          >
            Save &amp; Open Stock List
          </button>
          <button
            type="submit"
            className="h-9 px-4 rounded-lg theme-bg theme-bg-hover text-white font-bold shadow-xs transition-all inline-flex items-center justify-center whitespace-nowrap shrink-0"
          >
            Save &amp; Add Another Product
          </button>
        </div>
      </form>
    </div>
  );
};

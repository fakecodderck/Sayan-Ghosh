import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Menu,
  X,
  Plus,
  Moon,
  Sun,
  Palette,
  Check,
  Search,
  Printer,
  Users,
  Building,
  Boxes,
  FileText
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { THEME_PRESETS, applyThemeColor, getThemePreset } from '../utils/theme';
import { ActiveModule } from './Sidebar';
import { ThemeColor, TransactionVoucher } from '../types/accounting';
import { formatINR } from '../utils/gstCalculations';

interface NavbarProps {
  onOpenNewVoucher: () => void;
  onNavigate?: (module: ActiveModule) => void;
  onSelectCustomer?: (customerId: string) => void;
  onSelectCompany?: (companyId: string) => void;
  onSelectVoucherForPrint?: (voucher: TransactionVoucher) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (val: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenNewVoucher,
  onNavigate,
  onSelectCustomer,
  onSelectCompany,
  onSelectVoucherForPrint,
  darkMode,
  setDarkMode,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}) => {
  const { settings, updateSettings, vouchers, ledgers, inventory } = useAccounting();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const currentPreset = getThemePreset(settings.themeColor || 'blue');
  const brandInitial = (settings.name || 'G').trim().charAt(0).toUpperCase();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowColorPicker(false);
        setSearchFocused(false);
        setShowMobileSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleSelectColor = async (colorId: ThemeColor) => {
    applyThemeColor(colorId);
    setShowColorPicker(false);
    try {
      await updateSettings({
        ...settings,
        themeColor: colorId,
      });
    } catch {
      // Context surfaces error banner if Firestore write fails
    }
  };

  const searchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return null;

    const matchingCustomers = ledgers
      .filter(l => l.group === 'Sundry Debtors' && (l.name.toLowerCase().includes(q) || (l.phone || '').includes(q)))
      .slice(0, 4);

    const matchingCompanies = ledgers
      .filter(l => l.group === 'Sundry Creditors' && (l.name.toLowerCase().includes(q) || (l.gstin || '').toLowerCase().includes(q)))
      .slice(0, 4);

    const matchingProducts = inventory
      .filter(i => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.hsnCode.includes(q))
      .slice(0, 4);

    const matchingVouchers = vouchers
      .filter(
        v =>
          (v.voucherNo || '').toLowerCase().includes(q) ||
          (v.partyName || '').toLowerCase().includes(q) ||
          (v.guestDetails?.name || '').toLowerCase().includes(q) ||
          Boolean(v.receiptEntries?.some(r => r.partyName.toLowerCase().includes(q)))
      )
      .slice(0, 5);

    return {
      customers: matchingCustomers,
      companies: matchingCompanies,
      products: matchingProducts,
      vouchers: matchingVouchers,
      hasAny:
        matchingCustomers.length > 0 ||
        matchingCompanies.length > 0 ||
        matchingProducts.length > 0 ||
        matchingVouchers.length > 0,
    };
  }, [globalSearch, ledgers, inventory, vouchers]);

  const renderSearchDropdown = () => {
    if (!searchFocused || !searchResults) return null;
    return (
      <div className="absolute left-0 right-0 top-11 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 max-h-96 overflow-y-auto text-xs space-y-2">
        {!searchResults.hasAny ? (
          <p className="p-3 text-center text-slate-400">No matching records for &ldquo;{globalSearch}&rdquo;</p>
        ) : (
          <>
            {searchResults.vouchers.length > 0 && (
              <div>
                <p className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                  Invoices
                </p>
                {searchResults.vouchers.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      setGlobalSearch('');
                      setShowMobileSearch(false);
                      setSearchFocused(false);
                      if (onSelectVoucherForPrint) onSelectVoucherForPrint(v);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 theme-text shrink-0" />
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {v.voucherNo || (v.type === 'RECEIPT' ? 'Receipt' : 'Invoice')}
                      </span>
                      <span className="text-slate-500 truncate">
                        {v.guestDetails?.name || v.partyName || 'Walk-in'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {formatINR(v.grandTotal)}
                      </span>
                      <Printer className="w-3 h-3 text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchResults.customers.length > 0 && (
              <div>
                <p className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">Customers</p>
                {searchResults.customers.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      setGlobalSearch('');
                      setShowMobileSearch(false);
                      setSearchFocused(false);
                      if (onSelectCustomer) onSelectCustomer(c.id);
                      else onNavigate && onNavigate('customers');
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{c.name}</span>
                    </div>
                    <span className="font-mono text-slate-500">{formatINR(c.currentBalance)}</span>
                  </button>
                ))}
              </div>
            )}

            {searchResults.companies.length > 0 && (
              <div>
                <p className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                  Companies / Suppliers
                </p>
                {searchResults.companies.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      setGlobalSearch('');
                      setShowMobileSearch(false);
                      setSearchFocused(false);
                      if (onSelectCompany) onSelectCompany(c.id);
                      else onNavigate && onNavigate('companies');
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{c.name}</span>
                    </div>
                    <span className="font-mono text-slate-500">{formatINR(Math.abs(c.currentBalance))}</span>
                  </button>
                ))}
              </div>
            )}

            {searchResults.products.length > 0 && (
              <div>
                <p className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                  Products &amp; Stock
                </p>
                {searchResults.products.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      setGlobalSearch('');
                      setShowMobileSearch(false);
                      setSearchFocused(false);
                      onNavigate && onNavigate('inventory');
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Boxes className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</span>
                    </div>
                    <span className="font-mono text-slate-500">
                      {p.currentStock} {p.unit}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <header className="no-print bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 w-full">
      <div className="h-14 sm:h-16 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Mobile Hamburger + Brand */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden w-9 h-9 -ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-flex items-center justify-center transition-colors shrink-0"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => onNavigate && onNavigate('dashboard')}
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group min-w-0"
            title="Go to Dashboard"
          >
            <div className="w-7 h-7 sm:w-9 sm:h-9 theme-bg text-white rounded-lg flex items-center justify-center font-bold text-sm sm:text-lg shadow-2xs shrink-0 transition-transform group-hover:scale-105">
              {brandInitial}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate max-w-[130px] sm:max-w-[220px] md:max-w-none">
                {settings.name || 'Ghosh Agency'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline leading-none truncate">
                {settings.gstin ? `GSTIN: ${settings.gstin}` : 'Personal Business Suite'}
              </span>
            </div>
          </div>
        </div>

        {/* Zone 2: Live Global Search (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-md lg:max-w-lg mx-2 lg:mx-4 relative">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={globalSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder="Search customers, companies, products, or invoice #..."
              className="w-full h-9 pl-9 pr-8 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 border border-transparent theme-ring rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 transition-all outline-hidden"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {renderSearchDropdown()}
        </div>

        {/* Zone 3: Actions + Theme */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowMobileSearch(prev => !prev)}
            className="md:hidden w-9 h-9 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center justify-center shrink-0"
            aria-label="Toggle search"
          >
            <Search className="w-4 h-4" />
          </button>

          <div className="relative hidden sm:block" ref={colorPickerRef}>
            <button
              type="button"
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="h-9 px-2.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 shrink-0"
              title="Customise UI Color Theme"
            >
              <Palette className="w-4 h-4" />
              <span
                className="w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900"
                style={{ backgroundColor: currentPreset.primaryHex }}
              />
            </button>

            {showColorPicker && (
              <div className="absolute right-0 top-11 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 z-50 space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Select UI Color Theme
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-1.5 max-h-60 overflow-y-auto">
                  {THEME_PRESETS.map(preset => {
                    const isSelected = (settings.themeColor || 'blue') === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectColor(preset.id)}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
                          isSelected
                            ? 'bg-slate-100 dark:bg-slate-800 font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full shadow-xs"
                            style={{ backgroundColor: preset.primaryHex }}
                          />
                          <span className="text-slate-800 dark:text-slate-200">{preset.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 theme-text" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="w-9 h-9 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center justify-center shrink-0"
            title="Toggle Dark / Light Theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          <button
            type="button"
            onClick={onOpenNewVoucher}
            className="theme-bg theme-bg-hover inline-flex items-center justify-center gap-1.5 w-9 sm:w-auto h-9 px-0 sm:px-3.5 text-white text-xs font-bold rounded-lg shadow-xs transition-all whitespace-nowrap active:scale-95 shrink-0"
            title="Quick New Invoice"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">New Invoice</span>
          </button>
        </div>
      </div>

      {/* Expandable Mobile Global Search */}
      {showMobileSearch && (
        <div className="md:hidden px-3 pb-3 relative">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={globalSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder="Search invoice, customer, company, product..."
              className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 theme-ring rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-hidden"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {renderSearchDropdown()}
        </div>
      )}
    </header>
  );
};

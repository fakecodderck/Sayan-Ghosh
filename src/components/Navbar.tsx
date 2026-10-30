import React, { useState } from 'react';
import {
  Menu,
  X,
  Plus,
  Moon,
  Sun,
  LogIn,
  LogOut,
  Palette,
  Check,
  Search,
  User as UserIcon
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { signInWithGoogle, logOut } from '../services/firebase';
import { THEME_PRESETS, applyThemeColor, getThemePreset } from '../utils/theme';
import { ActiveModule } from './Sidebar';

interface NavbarProps {
  onOpenNewVoucher: () => void;
  onNavigate?: (module: ActiveModule) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (val: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenNewVoucher,
  onNavigate,
  darkMode,
  setDarkMode,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}) => {
  const { user, settings, updateSettings } = useAccounting();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const currentPreset = getThemePreset(settings.themeColor || 'blue');

  const handleSelectColor = async (colorId: any) => {
    applyThemeColor(colorId);
    await updateSettings({
      ...settings,
      themeColor: colorId,
    });
    setShowColorPicker(false);
  };

  return (
    <header className="no-print h-14 sm:h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-40 w-full">
      {/* Zone 1: Mobile Hamburger + Brand Zone */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
        {/* Mobile Hamburger Drawer Toggle */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="lg:hidden p-1.5 -ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors shrink-0"
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Brand Logo & Name (Click to return to Dashboard) */}
        <div
          onClick={() => onNavigate && onNavigate('dashboard')}
          className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group min-w-0"
          title="Go to Dashboard Overview"
        >
          <div
            className="w-7 h-7 sm:w-9 sm:h-9 text-white rounded-lg flex items-center justify-center font-bold text-sm sm:text-lg shadow-2xs shrink-0 transition-transform group-hover:scale-105"
            style={{ backgroundColor: currentPreset.primaryHex }}
          >
            A
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate max-w-[120px] xs:max-w-[160px] sm:max-w-[220px] md:max-w-none">
              {settings.name || 'Apex Ledger'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline leading-none truncate">
              {settings.gstin ? `GSTIN: ${settings.gstin}` : 'Accounting & Inventory'}
            </span>
          </div>
        </div>
      </div>

      {/* Zone 2: Global Search Bar (Desktop / Tablet) */}
      <div className="hidden md:flex flex-1 max-w-md lg:max-w-lg mx-2 lg:mx-4">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            placeholder="Search anything... (Customers, Suppliers, Products, Vouchers)"
            className="w-full pl-9 pr-4 py-1.5 sm:py-2 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 border border-transparent focus:border-blue-500 dark:focus:border-blue-400 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 transition-all outline-hidden"
          />
        </div>
      </div>

      {/* Zone 3: Actions + Theme + Auth */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Quick UI Color Theme Picker (Hidden on small mobile, available in Settings) */}
        <div className="relative hidden sm:block">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center gap-1"
            title="Customise Website UI Theme Color"
          >
            <Palette className="w-4 h-4" />
            <span
              className="w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900"
              style={{ backgroundColor: currentPreset.primaryHex }}
            />
          </button>

          {showColorPicker && (
            <div className="absolute right-0 top-12 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 z-50 space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Select UI Color Theme
                </span>
                <button
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
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Dark/Light mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-w-[34px] sm:min-w-[38px] min-h-[34px] sm:min-h-[38px] flex items-center justify-center"
          title="Toggle Dark / Light Theme"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* User Auth */}
        {user ? (
          <div className="flex items-center gap-1">
            <span className="hidden xl:inline text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
              {user.displayName ? user.displayName.split(' ')[0] : 'Admin'}
            </span>
            <button
              onClick={() => logOut()}
              className="p-1.5 sm:p-2 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg min-w-[34px] sm:min-w-[38px] min-h-[34px] sm:min-h-[38px] flex items-center justify-center transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => signInWithGoogle()}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors min-h-[34px]"
            title="Sign in with Google"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}

        {/* Primary Action Button (Compact Plus icon on mobile, Full text on desktop) */}
        <button
          onClick={onOpenNewVoucher}
          className="flex items-center justify-center gap-1.5 p-2 sm:px-3.5 sm:py-2 text-white text-xs font-bold rounded-xl shadow-xs transition-all whitespace-nowrap min-w-[34px] sm:min-w-[auto] min-h-[34px] sm:min-h-[38px] hover:opacity-90 active:scale-95 shrink-0"
          style={{ backgroundColor: currentPreset.primaryHex }}
          title="Create New Transaction Voucher"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Voucher</span>
        </button>
      </div>
    </header>
  );
};

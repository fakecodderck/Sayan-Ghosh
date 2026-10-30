import React, { useState } from 'react';
import {
  Menu,
  X,
  Plus,
  Moon,
  Sun,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  Palette,
  Check
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { signInWithGoogle, logOut } from '../services/firebase';
import { THEME_PRESETS, applyThemeColor, getThemePreset } from '../utils/theme';

interface NavbarProps {
  onOpenNewVoucher: () => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (val: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenNewVoucher,
  darkMode,
  setDarkMode,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}) => {
  const { user, isSyncing, settings, updateSettings } = useAccounting();
  const [showColorPicker, setShowColorPicker] = useState(false);

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
    <header className="no-print h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-40">
      {/* Zone 1: Mobile Hamburger + Brand Zone */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="lg:hidden p-2 -ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center transition-colors"
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div
          className="w-8 h-8 sm:w-9 sm:h-9 text-white rounded-lg flex items-center justify-center font-bold text-base sm:text-lg shadow-xs shrink-0 transition-colors"
          style={{ backgroundColor: currentPreset.primaryHex }}
        >
          A
        </div>
        <div className="flex flex-col">
          <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            Apex Ledger
          </span>
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline leading-none">
            {settings.gstin ? `GSTIN: ${settings.gstin}` : 'Unregistered (B2C)'}
          </span>
        </div>
      </div>

      {/* Zone 2: Middle Status Indicators */}
      <div className="hidden md:flex items-center gap-4 text-xs">
        {user ? (
          <span className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-full text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <Cloud className="w-3.5 h-3.5" />
            <span>{isSyncing ? 'Syncing...' : 'Real-Time Cloud Sync'}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400 font-medium text-[11px]">
            <CloudOff className="w-3.5 h-3.5" />
            <span>Local Mode</span>
          </span>
        )}
      </div>

      {/* Zone 3: 1 Primary Action + Theme Toggle + Color Palette + User Auth */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Quick UI Color Theme Picker Popover */}
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center gap-1"
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
          className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
          title="Toggle Theme"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Auth */}
        {user ? (
          <div className="flex items-center gap-1.5">
            <span className="hidden xl:inline text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[110px]">
              {user.displayName || user.email}
            </span>
            <button
              onClick={() => logOut()}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => signInWithGoogle()}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}

        {/* Primary Action Button */}
        <button
          onClick={onOpenNewVoucher}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px] hover:opacity-90 active:scale-95"
          style={{ backgroundColor: currentPreset.primaryHex }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden xs:inline">+ New Voucher</span>
          <span className="xs:hidden">New</span>
        </button>
      </div>
    </header>
  );
};


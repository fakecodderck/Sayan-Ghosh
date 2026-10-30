import React from 'react';
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
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { signInWithGoogle, logOut } from '../services/firebase';

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
  const { user, isSyncing, settings } = useAccounting();

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

        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-base sm:text-lg shadow-xs shrink-0">
          A
        </div>
        <div className="flex flex-col">
          <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            Apex Ledger
          </span>
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline leading-none">
            GSTIN: {settings.gstin}
          </span>
        </div>
      </div>

      {/* Zone 2: Middle Status Indicators */}
      <div className="hidden md:flex items-center gap-4 text-xs">
        {user ? (
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <Cloud className="w-3.5 h-3.5" />
            <span>{isSyncing ? 'Syncing...' : 'Cloud Synced'}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-slate-500">
            <CloudOff className="w-3.5 h-3.5" />
            <span>Local Database</span>
          </span>
        )}
      </div>

      {/* Zone 3: 1 Primary Action + Theme Toggle + User Auth */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all whitespace-nowrap min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden xs:inline">+ New Voucher</span>
          <span className="xs:hidden">New</span>
        </button>
      </div>
    </header>
  );
};

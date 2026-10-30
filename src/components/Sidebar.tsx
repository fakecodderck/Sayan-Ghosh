import React from 'react';
import {
  BookOpen,
  Users,
  ShoppingCart,
  Boxes,
  Receipt,
  FileSpreadsheet,
  TrendingUp,
  Settings,
  FileCheck2,
  RotateCcw,
  Building,
  BarChart3,
  X
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { getThemePreset } from '../utils/theme';

export type ActiveModule =
  | 'daybook'
  | 'ledgers'
  | 'purchases'
  | 'sales'
  | 'inventory'
  | 'profit_loss'
  | 'payments'
  | 'customers'
  | 'companies'
  | 'gst_bill'
  | 'credit_debit'
  | 'gstr_reports'
  | 'settings';

interface SidebarProps {
  activeModule: ActiveModule;
  setActiveModule: (m: ActiveModule) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  setActiveModule,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}) => {
  const { inventory, settings } = useAccounting();
  const currentPreset = getThemePreset(settings.themeColor || 'blue');

  // Low stock badge count
  const lowStockCount = inventory.filter(item => {
    return (item.currentStock || 0) <= item.minStockAlert;
  }).length;

  const navSections: {
    sectionTitle: string;
    items: { id: ActiveModule; label: string; icon: React.ElementType; badge?: number }[];
  }[] = [
    {
      sectionTitle: 'CORE REGISTERS',
      items: [
        { id: 'daybook', label: 'Day Book (Journal)', icon: BookOpen },
        { id: 'ledgers', label: 'Ledger Master Accounts', icon: BarChart3 },
        { id: 'inventory', label: 'Stock & Inventory Catalog', icon: Boxes, badge: lowStockCount > 0 ? lowStockCount : undefined },
      ],
    },
    {
      sectionTitle: 'COMMERCIAL TRANSACTIONS',
      items: [
        { id: 'sales', label: 'Sale (GST / Non-GST)', icon: TrendingUp },
        { id: 'purchases', label: 'Purchase Invoices', icon: ShoppingCart },
        { id: 'payments', label: 'Payment & Receipt Vouchers', icon: Receipt },
        { id: 'credit_debit', label: 'Credit / Debit Notes', icon: RotateCcw },
      ],
    },
    {
      sectionTitle: 'PARTY DIRECTORIES',
      items: [
        { id: 'customers', label: 'Customers (Debtors)', icon: Users },
        { id: 'companies', label: 'Companies (Creditors)', icon: Building },
      ],
    },
    {
      sectionTitle: 'BILLING & STATEMENTS',
      items: [
        { id: 'gst_bill', label: 'GST Invoice Generator', icon: FileCheck2 },
        { id: 'profit_loss', label: 'Profit & Loss Statement', icon: FileSpreadsheet },
        { id: 'settings', label: 'Business Profile & Settings', icon: Settings },
      ],
    },
  ];

  const handleSelect = (id: ActiveModule) => {
    setActiveModule(id);
    setIsMobileMenuOpen(false);
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full text-xs">
      <div className="p-3 space-y-4 overflow-y-auto">
        {navSections.map((sec, secIdx) => (
          <div key={secIdx} className="space-y-1">
            <div className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              {sec.sectionTitle}
            </div>
            {sec.items.map(item => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  style={
                    isActive
                      ? {
                          backgroundColor: currentPreset.lightHex,
                          color: currentPreset.primaryHex,
                        }
                      : undefined
                  }
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left min-h-[40px] ${
                    isActive
                      ? 'font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className="w-4 h-4 shrink-0 transition-colors"
                      style={{ color: isActive ? currentPreset.primaryHex : undefined }}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 space-y-1 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="flex items-center justify-between">
          <span>Currency:</span>
          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">INR (₹)</span>
        </div>
        <div className="flex items-center justify-between">
          <span>GST System:</span>
          <span className="font-mono text-slate-700 dark:text-slate-300">Intra / Inter-State</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="no-print hidden lg:flex w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col justify-between h-[calc(100vh-64px)] sticky top-16">
        {navContent}
      </aside>

      {/* Mobile Drawer (visible when isMobileMenuOpen is true) */}
      {isMobileMenuOpen && (
        <div className="no-print lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[80vw] bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Menu &amp; Navigation
              </span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {navContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

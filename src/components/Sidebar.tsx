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
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  PackagePlus,
  LayoutTemplate,
  ClipboardList,
  X
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';

export type ActiveModule =
  | 'dashboard'
  | 'create_invoice'
  | 'daybook'
  | 'ledgers'
  | 'all_invoices'
  | 'purchases'
  | 'sales'
  | 'add_product'
  | 'inventory'
  | 'stock_report'
  | 'profit_loss'
  | 'payments'
  | 'customers'
  | 'companies'
  | 'invoice_builder'
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

  const lowStockCount = inventory.filter(item => (item.currentStock || 0) <= item.minStockAlert).length;

  const [openCategories, setOpenCategories] = React.useState<Record<string, boolean>>(() => ({
    'BILLING & DAILY OPS': ['dashboard', 'create_invoice', 'daybook', 'all_invoices'].includes(activeModule),
    'PRODUCTS & STOCK': ['add_product', 'inventory', 'stock_report'].includes(activeModule),
    'CUSTOMERS & COMPANIES': ['customers', 'companies', 'ledgers'].includes(activeModule),
    'INVOICE REGISTERS': ['sales', 'purchases', 'payments', 'credit_debit'].includes(activeModule),
    'PRINT, FORMATS & REPORTS': ['invoice_builder', 'gst_bill', 'gstr_reports', 'profit_loss', 'settings'].includes(activeModule),
  }));

  const toggleCategory = (title: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const navSections: {
    sectionTitle: string;
    items: { id: ActiveModule; label: string; icon: React.ElementType; badge?: number }[];
  }[] = [
    {
      sectionTitle: 'BILLING & DAILY OPS',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'create_invoice', label: 'Create Invoice', icon: FilePlus2 },
        { id: 'daybook', label: 'Day Book', icon: BookOpen },
        { id: 'all_invoices', label: 'All Invoices', icon: FileCheck2 },
      ],
    },
    {
      sectionTitle: 'PRODUCTS & STOCK',
      items: [
        { id: 'add_product', label: 'Add Product', icon: PackagePlus },
        {
          id: 'inventory',
          label: 'Stock Management',
          icon: Boxes,
          badge: lowStockCount > 0 ? lowStockCount : undefined,
        },
        { id: 'stock_report', label: 'Stock Report', icon: ClipboardList },
      ],
    },
    {
      sectionTitle: 'CUSTOMERS & COMPANIES',
      items: [
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'companies', label: 'Companies (Suppliers)', icon: Building },
        { id: 'ledgers', label: 'All Ledgers', icon: BarChart3 },
      ],
    },
    {
      sectionTitle: 'INVOICE REGISTERS',
      items: [
        { id: 'sales', label: 'Sales Register', icon: TrendingUp },
        { id: 'purchases', label: 'Purchase Register', icon: ShoppingCart },
        { id: 'payments', label: 'Payments & Receipts', icon: Receipt },
        { id: 'credit_debit', label: 'Credit / Debit Notes', icon: RotateCcw },
      ],
    },
    {
      sectionTitle: 'PRINT, FORMATS & REPORTS',
      items: [
        { id: 'invoice_builder', label: 'Invoice Format Builder', icon: LayoutTemplate },
        { id: 'gst_bill', label: 'Print Invoice Station', icon: FileCheck2 },
        { id: 'gstr_reports', label: 'GSTR-1 & 3B Returns', icon: FileSpreadsheet },
        { id: 'profit_loss', label: 'Profit & Loss', icon: TrendingUp },
        { id: 'settings', label: 'Business Settings', icon: Settings },
      ],
    },
  ];

  React.useEffect(() => {
    const activeSec = navSections.find(sec => sec.items.some(it => it.id === activeModule));
    if (activeSec) {
      setOpenCategories(prev => (prev[activeSec.sectionTitle] ? prev : { ...prev, [activeSec.sectionTitle]: true }));
    }
  }, [activeModule]);

  const handleSelect = (id: ActiveModule) => {
    setActiveModule(id);
    setIsMobileMenuOpen(false);
  };

  const renderNavContent = (isMobile: boolean = false) => (
    <div className="flex flex-col justify-between h-full text-xs">
      <div className="p-3 space-y-4 overflow-y-auto">
        {navSections.map((sec, secIdx) => {
          const isOpen = isMobile ? Boolean(openCategories[sec.sectionTitle]) : true;
          const hasActiveChild = sec.items.some(it => it.id === activeModule);

          return (
            <div key={secIdx} className="space-y-1">
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => toggleCategory(sec.sectionTitle)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                    isOpen
                      ? 'bg-slate-100/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                      : 'bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800'
                  }`}
                >
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      hasActiveChild ? 'theme-text' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {sec.sectionTitle}
                  </span>
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>
              ) : (
                <div className="px-2.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {sec.sectionTitle}
                </div>
              )}

              {isOpen && (
                <div className={`space-y-0.5 ${isMobile ? 'pl-2 my-1' : ''}`}>
                  {sec.items.map(item => {
                    const Icon = item.icon;
                    const isActive = activeModule === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left min-h-[36px] ${
                          isActive
                            ? 'theme-active-nav font-semibold'
                            : 'font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'theme-text' : ''}`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge !== undefined && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Clean Footer Info */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 space-y-1 bg-slate-50/70 dark:bg-slate-900/40 shrink-0">
        <div className="flex items-center justify-between">
          <span>Currency</span>
          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">INR (₹)</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Tax Regime</span>
          <span className="font-mono text-slate-700 dark:text-slate-300">India GST</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col justify-between h-[calc(100vh-64px)] sticky top-16">
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="no-print lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <div className="relative w-72 max-w-[82vw] bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {settings.name || 'Ghosh Agency'} Menu
              </span>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{renderNavContent(true)}</div>
          </div>
        </div>
      )}
    </>
  );
};

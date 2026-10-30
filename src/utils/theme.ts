import { ThemeColor } from '../types/accounting';

export interface ThemePreset {
  id: ThemeColor;
  name: string;
  description: string;
  primaryHex: string;
  hoverHex: string;
  lightHex: string;
  borderHex: string;
  ringHex: string;
  bgClass: string;
  hoverClass: string;
  textClass: string;
  borderClass: string;
  badgeClass: string;
  lightBgClass: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'blue',
    name: 'Corporate Blue',
    description: 'Classic professional blue for finance & ledger apps',
    primaryHex: '#2563eb',
    hoverHex: '#1d4ed8',
    lightHex: '#eff6ff',
    borderHex: '#bfdbfe',
    ringHex: 'rgba(37, 99, 235, 0.3)',
    bgClass: 'bg-blue-600',
    hoverClass: 'hover:bg-blue-700',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-600',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    lightBgClass: 'bg-blue-50 dark:bg-blue-950/40',
  },
  {
    id: 'emerald',
    name: 'Emerald Forest',
    description: 'Fresh vibrant green symbolizing wealth & growth',
    primaryHex: '#059669',
    hoverHex: '#047857',
    lightHex: '#ecfdf5',
    borderHex: '#a7f3d0',
    ringHex: 'rgba(5, 150, 105, 0.3)',
    bgClass: 'bg-emerald-600',
    hoverClass: 'hover:bg-emerald-700',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-600',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
    lightBgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    id: 'indigo',
    name: 'Royal Indigo',
    primaryHex: '#4f46e5',
    hoverHex: '#4338ca',
    lightHex: '#eef2ff',
    borderHex: '#c7d2fe',
    ringHex: 'rgba(79, 70, 229, 0.3)',
    description: 'Modern, high-contrast tech accent theme',
    bgClass: 'bg-indigo-600',
    hoverClass: 'hover:bg-indigo-700',
    textClass: 'text-indigo-600 dark:text-indigo-400',
    borderClass: 'border-indigo-600',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
    lightBgClass: 'bg-indigo-50 dark:bg-indigo-950/40',
  },
  {
    id: 'amber',
    name: 'Amber Gold',
    description: 'Warm energetic commercial gold theme',
    primaryHex: '#d97706',
    hoverHex: '#b45309',
    lightHex: '#fffbeb',
    borderHex: '#fde68a',
    ringHex: 'rgba(217, 119, 6, 0.3)',
    bgClass: 'bg-amber-600',
    hoverClass: 'hover:bg-amber-700',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-600',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    lightBgClass: 'bg-amber-50 dark:bg-amber-950/40',
  },
  {
    id: 'rose',
    name: 'Crimson Rose',
    description: 'Bold, high-visibility executive crimson red',
    primaryHex: '#e11d48',
    hoverHex: '#be123c',
    lightHex: '#fff1f2',
    borderHex: '#fecdd3',
    ringHex: 'rgba(225, 29, 72, 0.3)',
    bgClass: 'bg-rose-600',
    hoverClass: 'hover:bg-rose-700',
    textClass: 'text-rose-600 dark:text-rose-400',
    borderClass: 'border-rose-600',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
    lightBgClass: 'bg-rose-50 dark:bg-rose-950/40',
  },
  {
    id: 'purple',
    name: 'Vibrant Purple',
    description: 'Creative and premium violet palette',
    primaryHex: '#9333ea',
    hoverHex: '#7e22ce',
    lightHex: '#faf5ff',
    borderHex: '#e9d5ff',
    ringHex: 'rgba(147, 51, 234, 0.3)',
    bgClass: 'bg-purple-600',
    hoverClass: 'hover:bg-purple-700',
    textClass: 'text-purple-600 dark:text-purple-400',
    borderClass: 'border-purple-600',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    lightBgClass: 'bg-purple-50 dark:bg-purple-950/40',
  },
  {
    id: 'slate',
    name: 'Slate Monochrome',
    description: 'Minimalist industrial graphite & slate theme',
    primaryHex: '#334155',
    hoverHex: '#1e293b',
    lightHex: '#f8fafc',
    borderHex: '#cbd5e1',
    ringHex: 'rgba(51, 65, 85, 0.3)',
    bgClass: 'bg-slate-700',
    hoverClass: 'hover:bg-slate-800',
    textClass: 'text-slate-700 dark:text-slate-300',
    borderClass: 'border-slate-700',
    badgeClass: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    lightBgClass: 'bg-slate-100 dark:bg-slate-800/80',
  },
];

export function applyThemeColor(colorId: ThemeColor = 'blue') {
  const preset = THEME_PRESETS.find(p => p.id === colorId) || THEME_PRESETS[0];
  const root = document.documentElement;

  root.setAttribute('data-theme', preset.id);
  root.style.setProperty('--theme-primary', preset.primaryHex);
  root.style.setProperty('--theme-primary-hover', preset.hoverHex);
  root.style.setProperty('--theme-primary-light', preset.lightHex);
  root.style.setProperty('--theme-primary-border', preset.borderHex);
  root.style.setProperty('--theme-primary-ring', preset.ringHex);
}

export function getThemePreset(colorId: ThemeColor = 'blue'): ThemePreset {
  return THEME_PRESETS.find(p => p.id === colorId) || THEME_PRESETS[0];
}

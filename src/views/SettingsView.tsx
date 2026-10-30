import React, { useState } from 'react';
import {
  Settings,
  Building,
  CreditCard,
  FileText,
  Save,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Palette,
  Check
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { CompanySettings, INDIAN_STATES, ThemeColor } from '../types/accounting';
import { THEME_PRESETS, applyThemeColor, getThemePreset } from '../utils/theme';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, resetToSampleData } = useAccounting();

  const [form, setForm] = useState<CompanySettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings(form);
    applyThemeColor(form.themeColor || 'blue');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleStateChange = (stateName: string) => {
    const found = INDIAN_STATES.find(s => s.name === stateName);
    setForm(prev => ({
      ...prev,
      state: stateName,
      stateCode: found ? found.code : prev.stateCode,
    }));
  };

  const handleReset = () => {
    if (confirm('Reset all ledger data, stock, and vouchers back to default demo records?')) {
      resetToSampleData();
      alert('Application reset to initial wholesale & distribution demo data.');
    }
  };

  const currentPreset = getThemePreset(form.themeColor || 'blue');

  return (
    <div className="space-y-6 max-w-4xl">
      {/* View Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Business Profile, Theme &amp; GST Configuration
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Customise website UI color theme, master company GSTIN, banking details, and invoice terms
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Configuration and UI Theme saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* UI Color Theme Customization */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Palette className="w-4 h-4 text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Website UI Color Theme &amp; Brand Accent
              </h3>
              <p className="text-[11px] text-slate-500">
                Choose your preferred accent color for buttons, active navigation, badges, and headers
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
            {THEME_PRESETS.map(preset => {
              const isSelected = (form.themeColor || 'blue') === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setForm(prev => ({ ...prev, themeColor: preset.id }));
                    applyThemeColor(preset.id);
                  }}
                  className={`p-3 rounded-xl border-2 text-left transition-all relative flex flex-col gap-2 min-h-[90px] ${
                    isSelected
                      ? 'border-blue-600 dark:border-blue-400 bg-slate-50 dark:bg-slate-800/80 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className="w-6 h-6 rounded-full shadow-xs flex items-center justify-center text-white"
                      style={{ backgroundColor: preset.primaryHex }}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                    {isSelected && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-600 text-white">
                        Active
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                      {preset.name}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-tight line-clamp-1">
                      {preset.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Theme Live Preview Banner */}
          <div className="mt-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg text-white font-bold flex items-center justify-center shadow-xs text-sm"
                style={{ backgroundColor: currentPreset.primaryHex }}
              >
                A
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  Active Preset: {currentPreset.name}
                </span>
                <span className="text-[11px] text-slate-500">
                  Hex Code: <code className="font-mono">{currentPreset.primaryHex}</code>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="px-2.5 py-1 rounded text-xs font-bold text-white shadow-xs"
                style={{ backgroundColor: currentPreset.primaryHex }}
              >
                Sample Button
              </span>
              <span
                className="px-2.5 py-1 rounded text-xs font-semibold"
                style={{
                  backgroundColor: currentPreset.lightHex,
                  color: currentPreset.primaryHex,
                }}
              >
                Active Badge
              </span>
            </div>
          </div>
        </div>
        {/* Business Legal Identity */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Building className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Company &amp; Statutory GST Details
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Legal Entity / Trade Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                GSTIN / UIN Number (15 Digits) *
              </label>
              <input
                type="text"
                required
                value={form.gstin}
                onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                className="w-full p-2.5 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                State Jurisdiction *
              </label>
              <select
                value={form.state}
                onChange={e => handleStateChange(e.target.value)}
                className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
              >
                {INDIAN_STATES.map(s => (
                  <option key={s.code} value={s.name}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                GST State Code
              </label>
              <input
                type="text"
                readOnly
                value={form.stateCode}
                className="w-full p-2.5 font-mono border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Official Phone Number
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
              Registered Head Office / Warehouse Address
            </label>
            <textarea
              rows={2}
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
            />
          </div>
        </div>

        {/* Banking and Digital UPI Details */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Banking &amp; UPI QR Code Details (For Customer Invoices)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={form.bankName}
                onChange={e => setForm({ ...form, bankName: e.target.value })}
                className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={form.accountNo}
                onChange={e => setForm({ ...form, accountNo: e.target.value })}
                className="w-full p-2.5 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                IFSC Code
              </label>
              <input
                type="text"
                value={form.ifsc}
                onChange={e => setForm({ ...form, ifsc: e.target.value.toUpperCase() })}
                className="w-full p-2.5 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Bank Branch
              </label>
              <input
                type="text"
                value={form.branch}
                onChange={e => setForm({ ...form, branch: e.target.value })}
                className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                UPI ID (Virtual Payment Address)
              </label>
              <input
                type="text"
                value={form.upiId}
                onChange={e => setForm({ ...form, upiId: e.target.value })}
                className="w-full p-2.5 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Invoice Terms & Signatory */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <FileText className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Invoice Terms, Conditions &amp; Signatory
            </h3>
          </div>

          <div>
            <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
              Terms &amp; Conditions (Printed on A5/A4 Bills)
            </label>
            <textarea
              rows={3}
              value={form.invoiceTerms}
              onChange={e => setForm({ ...form, invoiceTerms: e.target.value })}
              className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
              Authorized Signatory Title
            </label>
            <input
              type="text"
              value={form.authorizedSignatoryTitle}
              onChange={e => setForm({ ...form, authorizedSignatoryTitle: e.target.value })}
              className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg font-medium border border-rose-200 dark:border-rose-900 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Records</span>
          </button>

          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors text-xs"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};

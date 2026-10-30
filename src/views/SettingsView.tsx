import React, { useState } from 'react';
import {
  Settings,
  Building,
  CreditCard,
  FileText,
  Save,
  RotateCcw,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { CompanySettings, INDIAN_STATES } from '../types/accounting';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, resetToSampleData } = useAccounting();

  const [form, setForm] = useState<CompanySettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings(form);
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

  return (
    <div className="space-y-6 max-w-4xl">
      {/* View Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Business Profile &amp; GST Configuration
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Master company GSTIN, legal jurisdiction, banking details, and invoice declaration terms
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Business configuration saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 text-xs">
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

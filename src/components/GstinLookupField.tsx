import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import {
  GstinLookupResult,
  lookupGstinDetails,
  normalizeGstin,
  validateGstin
} from '../utils/gstinValidator';

export interface GstinAutoFillPayload {
  gstin: string;
  stateCode?: string;
  stateName?: string;
  pan?: string;
  entityType?: string;
  businessName?: string;
  legalName?: string;
  tradeName?: string;
  address?: string;
  status?: string;
}

interface GstinLookupFieldProps {
  value: string;
  onChange: (normalizedGstin: string) => void;
  onApplyDetails: (details: GstinAutoFillPayload) => void;
  label?: string;
  placeholder?: string;
  compact?: boolean;
}

export const GstinLookupField: React.FC<GstinLookupFieldProps> = ({
  value,
  onChange,
  onApplyDetails,
  label = 'GSTIN (Optional)',
  placeholder = '19ABCDE1234F1Z5',
  compact = false,
}) => {
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<GstinLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const lastAutoExtractedRef = useRef<string>('');
  const onApplyDetailsRef = useRef(onApplyDetails);
  onApplyDetailsRef.current = onApplyDetails;

  const validation = useMemo(() => validateGstin(value), [value]);

  // Automatically sync State & PAN as soon as a valid 15-character GSTIN is typed
  useEffect(() => {
    if (
      validation.isValid &&
      validation.stateCode &&
      validation.pan &&
      lastAutoExtractedRef.current !== validation.normalized
    ) {
      lastAutoExtractedRef.current = validation.normalized;
      onApplyDetailsRef.current({
        gstin: validation.normalized,
        stateCode: validation.stateCode,
        stateName: validation.stateName,
        pan: validation.pan,
        entityType: validation.entityType,
      });
    }
    if (!validation.isValid) {
      lastAutoExtractedRef.current = '';
      setLookupResult(null);
      setLookupError(null);
    }
  }, [
    validation.isValid,
    validation.normalized,
    validation.stateCode,
    validation.stateName,
    validation.pan,
    validation.entityType,
  ]);

  const handleVerifyFetch = async () => {
    if (!validation.isValid || isLookingUp) return;
    setIsLookingUp(true);
    setLookupError(null);
    try {
      const result = await lookupGstinDetails(validation.normalized);
      setLookupResult(result);
      onApplyDetails({
        gstin: result.gstin,
        stateCode: result.stateCode,
        stateName: result.stateName,
        pan: result.pan,
        entityType: result.entityType,
        businessName: result.businessName,
        legalName: result.legalName,
        tradeName: result.tradeName,
        address: result.address,
        status: result.status,
      });
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'GSTIN verification failed.');
      setLookupResult(null);
    } finally {
      setIsLookingUp(false);
    }
  };

  const isStatusActive = lookupResult?.status?.toLowerCase() === 'active';

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label className="block font-medium text-slate-600 dark:text-slate-400">
            {label}
          </label>
          {value.length > 0 && value.length < 15 && (
            <span className="text-[10px] font-mono tabular-nums text-slate-400">
              {value.length}/15
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <input
          type="text"
          maxLength={15}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(normalizeGstin(e.target.value))}
          className={`flex-1 min-w-0 h-9 px-2.5 font-mono uppercase text-xs border rounded-lg bg-white dark:bg-slate-800 theme-ring transition-colors ${
            value.length === 15 && !validation.isValid
              ? 'border-rose-400 dark:border-rose-600'
              : validation.isValid
              ? 'border-emerald-400 dark:border-emerald-700'
              : 'border-slate-300 dark:border-slate-700'
          }`}
        />

        <button
          type="button"
          onClick={handleVerifyFetch}
          disabled={!validation.isValid || isLookingUp}
          title="Verify GSTIN checksum and fetch taxpayer details"
          className="h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold theme-soft-badge hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity whitespace-nowrap shrink-0"
        >
          {isLookingUp ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" />
          )}
          <span>{isLookingUp ? 'Checking...' : 'Verify'}</span>
        </button>
      </div>

      {/* Inline validation error when 15 chars are entered with invalid format/checksum */}
      {value.length === 15 && !validation.isValid && validation.error && (
        <p className="flex items-start gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{validation.error}</span>
        </p>
      )}

      {/* Offline checksum verified feedback before live fetch */}
      {validation.isValid && !lookupResult && !lookupError && (
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>
              Valid · {validation.stateName} ({validation.stateCode}) · PAN{' '}
              <span className="font-mono">{validation.pan}</span> ({validation.entityType})
            </span>
          </span>
        </div>
      )}

      {lookupError && (
        <p className="flex items-start gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{lookupError}</span>
        </p>
      )}

      {/* Result card after clicking Verify */}
      {lookupResult && (
        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-[11px] space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{lookupResult.liveLookup ? 'GSTN Details Fetched' : 'GSTIN Checksum Verified'}</span>
            </span>
            {lookupResult.status && (
              <span
                className={`font-semibold ${
                  isStatusActive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                Status: {lookupResult.status}
              </span>
            )}
          </div>

          {lookupResult.liveLookup ? (
            <div className="space-y-0.5 text-slate-600 dark:text-slate-300">
              {lookupResult.tradeName && (
                <div>
                  Trade Name: <strong className="text-slate-900 dark:text-slate-100">{lookupResult.tradeName}</strong>
                </div>
              )}
              {lookupResult.legalName && lookupResult.legalName !== lookupResult.tradeName && (
                <div>
                  Legal Name: <strong className="text-slate-900 dark:text-slate-100">{lookupResult.legalName}</strong>
                </div>
              )}
              <div>
                PAN: <span className="font-mono">{lookupResult.pan}</span> · {lookupResult.entityType} ·{' '}
                {lookupResult.stateName} ({lookupResult.stateCode})
              </div>
              {lookupResult.address && (
                <div className="text-slate-500 dark:text-slate-400 line-clamp-2">
                  Address: {lookupResult.address}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1 text-slate-600 dark:text-slate-300">
              <div>
                State: <strong>{lookupResult.stateName} ({lookupResult.stateCode})</strong> · PAN:{' '}
                <span className="font-mono font-semibold">{lookupResult.pan}</span> · {lookupResult.entityType}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                <span>{lookupResult.message}</span>
                <a
                  href="https://services.gst.gov.in/services/searchtp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold theme-text hover:underline shrink-0"
                >
                  <span>GST Portal</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

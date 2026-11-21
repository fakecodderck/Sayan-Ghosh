import { INDIAN_STATES } from '../types/accounting';

const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const PAN_ENTITY_TYPES: Record<string, string> = {
  P: 'Individual / Proprietor',
  C: 'Company',
  H: 'Hindu Undivided Family (HUF)',
  F: 'Partnership Firm / LLP',
  A: 'Association of Persons (AOP)',
  T: 'Trust',
  B: 'Body of Individuals (BOI)',
  L: 'Local Authority',
  J: 'Artificial Juridical Person',
  G: 'Government',
};

export interface GstinValidationResult {
  normalized: string;
  isEmpty: boolean;
  isValidFormat: boolean;
  isValidChecksum: boolean;
  isValid: boolean;
  error?: string;
  stateCode?: string;
  stateName?: string;
  pan?: string;
  entityType?: string;
}

export interface GstinLookupResult {
  verified: boolean;
  liveLookup: boolean;
  providerConfigured: boolean;
  gstin: string;
  stateCode: string;
  stateName: string;
  pan: string;
  entityType: string;
  businessName?: string;
  legalName?: string;
  tradeName?: string;
  address?: string;
  status?: string;
  taxpayerType?: string;
  registrationDate?: string;
  message: string;
}

export function normalizeGstin(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase().slice(0, 15);
}

export function computeGstinCheckDigit(first14: string): string | null {
  if (first14.length !== 14) return null;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const codePoint = GSTIN_CHARSET.indexOf(first14[i]);
    if (codePoint === -1) return null;
    const factor = i % 2 === 0 ? 1 : 2;
    const product = codePoint * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checkIndex = (36 - (sum % 36)) % 36;
  return GSTIN_CHARSET[checkIndex];
}

export function validateGstin(raw: string): GstinValidationResult {
  const normalized = normalizeGstin(raw);
  if (!normalized) {
    return {
      normalized: '',
      isEmpty: true,
      isValidFormat: false,
      isValidChecksum: false,
      isValid: false,
    };
  }

  if (normalized.length < 15) {
    return {
      normalized,
      isEmpty: false,
      isValidFormat: false,
      isValidChecksum: false,
      isValid: false,
      error: `GSTIN must be 15 characters (${normalized.length}/15 entered).`,
    };
  }

  if (!GSTIN_PATTERN.test(normalized)) {
    return {
      normalized,
      isEmpty: false,
      isValidFormat: false,
      isValidChecksum: false,
      isValid: false,
      error: 'Invalid GSTIN format. Expected 2-digit state + 10-char PAN + entity + Z + check digit.',
    };
  }

  const stateCode = normalized.slice(0, 2);
  const stateInfo = INDIAN_STATES.find(s => s.code === stateCode);
  if (!stateInfo) {
    return {
      normalized,
      isEmpty: false,
      isValidFormat: false,
      isValidChecksum: false,
      isValid: false,
      error: `Unknown GST state code "${stateCode}".`,
    };
  }

  const expectedCheck = computeGstinCheckDigit(normalized.slice(0, 14));
  const isValidChecksum = expectedCheck === normalized[14];
  const pan = normalized.slice(2, 12);
  const entityType = PAN_ENTITY_TYPES[pan[3]] || 'Business Entity';

  if (!isValidChecksum) {
    return {
      normalized,
      isEmpty: false,
      isValidFormat: true,
      isValidChecksum: false,
      isValid: false,
      stateCode,
      stateName: stateInfo.name,
      pan,
      entityType,
      error: 'Invalid GSTIN checksum digit — please check for a typo.',
    };
  }

  return {
    normalized,
    isEmpty: false,
    isValidFormat: true,
    isValidChecksum: true,
    isValid: true,
    stateCode,
    stateName: stateInfo.name,
    pan,
    entityType,
  };
}

export async function lookupGstinDetails(rawGstin: string): Promise<GstinLookupResult> {
  const local = validateGstin(rawGstin);
  if (!local.isValid || !local.stateCode || !local.stateName || !local.pan || !local.entityType) {
    throw new Error(local.error || 'Please enter a valid 15-character GSTIN first.');
  }

  try {
    const res = await fetch(`/api/gst-lookup?gstin=${encodeURIComponent(local.normalized)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        verified: true,
        liveLookup: false,
        providerConfigured: false,
        gstin: local.normalized,
        stateCode: local.stateCode,
        stateName: local.stateName,
        pan: local.pan,
        entityType: local.entityType,
        message: 'GSTIN checksum verified locally. State & PAN auto-filled.',
      };
    }

    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload?.error || 'Could not verify GSTIN at this time.');
    }

    return payload as GstinLookupResult;
  } catch (err) {
    if (err instanceof Error && err.message && !err.message.includes('Failed to fetch')) {
      throw err;
    }
    // Offline/static fallback: still return verified local extraction
    return {
      verified: true,
      liveLookup: false,
      providerConfigured: false,
      gstin: local.normalized,
      stateCode: local.stateCode,
      stateName: local.stateName,
      pan: local.pan,
      entityType: local.entityType,
      message: 'GSTIN checksum verified offline. State & PAN auto-filled.',
    };
  }
}

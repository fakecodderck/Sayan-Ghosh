import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const GST_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Pre-2014)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

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

function cleanStr(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function formatGstAddress(addrObj: unknown): string {
  if (typeof addrObj === 'string') return cleanStr(addrObj, 300);
  if (!addrObj || typeof addrObj !== 'object') return '';
  const a = addrObj as Record<string, unknown>;
  const nested = (a.addr && typeof a.addr === 'object' ? a.addr : a) as Record<string, unknown>;
  const parts = [
    nested.bno,
    nested.flno,
    nested.bnm,
    nested.st,
    nested.loc,
    nested.city,
    nested.dst,
    nested.stcd,
    nested.pncd,
  ]
    .map(p => (typeof p === 'string' || typeof p === 'number' ? String(p).trim() : ''))
    .filter(Boolean);
  return cleanStr(parts.join(', '), 300);
}

function validateGstinServer(raw: string) {
  const gstin = raw.replace(/\s+/g, '').toUpperCase();
  if (!GSTIN_PATTERN.test(gstin)) {
    return { valid: false as const, error: 'Invalid GSTIN format. Must be 15 alphanumeric characters.' };
  }
  const stateCode = gstin.slice(0, 2);
  const stateName = GST_STATES[stateCode];
  if (!stateName) {
    return { valid: false as const, error: `Unknown GST state code "${stateCode}".` };
  }

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const codePoint = GSTIN_CHARSET.indexOf(gstin[i]);
    const factor = i % 2 === 0 ? 1 : 2;
    const product = codePoint * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const expectedChar = GSTIN_CHARSET[(36 - (sum % 36)) % 36];
  if (gstin[14] !== expectedChar) {
    return { valid: false as const, error: 'Invalid GSTIN checksum digit — please check for a typo.' };
  }

  const pan = gstin.slice(2, 12);
  const entityType = PAN_ENTITY_TYPES[pan[3]] || 'Business Entity';

  return {
    valid: true as const,
    gstin,
    stateCode,
    stateName,
    pan,
    entityType,
  };
}

interface LiveGstDetails {
  legalName?: string;
  tradeName?: string;
  businessName?: string;
  address?: string;
  status?: string;
  taxpayerType?: string;
  registrationDate?: string;
}

async function fetchFromGstinCheck(gstin: string, apiKey: string): Promise<LiveGstDetails | null> {
  const url = `https://sheet.gstincheck.co.in/check/${encodeURIComponent(apiKey)}/${encodeURIComponent(gstin)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const json = (await res.json()) as Record<string, unknown>;
  if (!json || json.flag !== true || !json.data || typeof json.data !== 'object') {
    return null;
  }
  const d = json.data as Record<string, unknown>;
  const legalName = cleanStr(d.lgnm, 120);
  const tradeName = cleanStr(d.tradeNam, 120);
  const address = formatGstAddress(d.pradr) || cleanStr(d.adr, 300);
  return {
    legalName: legalName || undefined,
    tradeName: tradeName || undefined,
    businessName: tradeName || legalName || undefined,
    address: address || undefined,
    status: cleanStr(d.sts, 40) || undefined,
    taxpayerType: cleanStr(d.dty, 60) || undefined,
    registrationDate: cleanStr(d.rgdt, 30) || undefined,
  };
}

async function fetchFromAppyFlow(gstin: string, keySecret: string): Promise<LiveGstDetails | null> {
  const params = new URLSearchParams({ gstNo: gstin, key_secret: keySecret });
  const url = `https://appyflow.in/api/verifyGST?${params.toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const json = (await res.json()) as Record<string, unknown>;
  if (!json || json.error === true || !json.taxpayerInfo || typeof json.taxpayerInfo !== 'object') {
    return null;
  }
  const d = json.taxpayerInfo as Record<string, unknown>;
  const legalName = cleanStr(d.lgnm, 120);
  const tradeName = cleanStr(d.tradeNam, 120);
  const address = formatGstAddress(d.pradr);
  return {
    legalName: legalName || undefined,
    tradeName: tradeName || undefined,
    businessName: tradeName || legalName || undefined,
    address: address || undefined,
    status: cleanStr(d.sts, 40) || undefined,
    taxpayerType: cleanStr(d.dty, 60) || undefined,
    registrationDate: cleanStr(d.rgdt, 30) || undefined,
  };
}

async function fetchFromSandbox(
  gstin: string,
  apiKey: string,
  apiSecret: string
): Promise<LiveGstDetails | null> {
  const authRes = await fetch('https://api.sandbox.co.in/authenticate', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'x-api-secret': apiSecret,
      'x-api-version': '1.0',
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!authRes.ok) return null;
  const authJson = (await authRes.json()) as Record<string, unknown>;
  const accessToken = typeof authJson.access_token === 'string' ? authJson.access_token : '';
  if (!accessToken) return null;

  const lookupRes = await fetch(
    `https://api.sandbox.co.in/gsp/public/gstin/${encodeURIComponent(gstin)}`,
    {
      method: 'GET',
      headers: {
        Authorization: accessToken,
        'x-api-key': apiKey,
        'x-api-version': '1.0',
      },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!lookupRes.ok) return null;
  const lookupJson = (await lookupRes.json()) as Record<string, unknown>;
  const d = (lookupJson.data && typeof lookupJson.data === 'object'
    ? lookupJson.data
    : null) as Record<string, unknown> | null;
  if (!d) return null;

  const legalName = cleanStr(d.lgnm, 120);
  const tradeName = cleanStr(d.tradeNam, 120);
  const address = formatGstAddress(d.pradr);
  return {
    legalName: legalName || undefined,
    tradeName: tradeName || undefined,
    businessName: tradeName || legalName || undefined,
    address: address || undefined,
    status: cleanStr(d.sts, 40) || undefined,
    taxpayerType: cleanStr(d.dty, 60) || undefined,
    registrationDate: cleanStr(d.rgdt, 30) || undefined,
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/gst-lookup', async (req, res) => {
    const rawGstin = typeof req.query.gstin === 'string' ? req.query.gstin : '';
    const check = validateGstinServer(rawGstin);

    if (!check.valid) {
      res.status(400).json({ error: check.error });
      return;
    }

    const basePayload = {
      verified: true,
      gstin: check.gstin,
      stateCode: check.stateCode,
      stateName: check.stateName,
      pan: check.pan,
      entityType: check.entityType,
    };

    const gstinCheckKey = process.env.GSTIN_CHECK_API_KEY?.trim();
    const appyFlowKey = process.env.APPYFLOW_GST_KEY_SECRET?.trim();
    const sandboxKey = process.env.SANDBOX_GST_API_KEY?.trim();
    const sandboxSecret = process.env.SANDBOX_GST_API_SECRET?.trim();

    const hasProvider = Boolean(gstinCheckKey || appyFlowKey || (sandboxKey && sandboxSecret));

    if (!hasProvider) {
      res.json({
        ...basePayload,
        liveLookup: false,
        providerConfigured: false,
        message:
          'GSTIN checksum verified. State & PAN auto-filled. Add a GST lookup API key in Secrets to also auto-fetch Legal Name & Address.',
      });
      return;
    }

    try {
      let details: LiveGstDetails | null = null;
      if (gstinCheckKey) {
        details = await fetchFromGstinCheck(check.gstin, gstinCheckKey);
      } else if (appyFlowKey) {
        details = await fetchFromAppyFlow(check.gstin, appyFlowKey);
      } else if (sandboxKey && sandboxSecret) {
        details = await fetchFromSandbox(check.gstin, sandboxKey, sandboxSecret);
      }

      if (!details) {
        res.json({
          ...basePayload,
          liveLookup: false,
          providerConfigured: true,
          message:
            'GSTIN checksum is valid, but live taxpayer details were not returned by the GST API provider.',
        });
        return;
      }

      res.json({
        ...basePayload,
        ...details,
        liveLookup: true,
        providerConfigured: true,
        message: details.status
          ? `Verified with GSTN (${details.status}). Customer details auto-filled.`
          : 'Verified with GSTN. Customer details auto-filled.',
      });
    } catch {
      res.json({
        ...basePayload,
        liveLookup: false,
        providerConfigured: true,
        message:
          'GSTIN checksum verified (State & PAN auto-filled), but the live GST lookup timed out. Please try again.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ghosh Agency server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

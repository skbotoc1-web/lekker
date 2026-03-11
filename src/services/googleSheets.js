import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const FEEDS_DIR = path.resolve('data/feeds');

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function ensureFeedsDir() {
  fs.mkdirSync(FEEDS_DIR, { recursive: true });
}

function appendLocal(tab, rows) {
  ensureFeedsDir();

  const jsonlPath = path.join(FEEDS_DIR, `${tab}.jsonl`);
  const csvPath = path.join(FEEDS_DIR, `${tab}.csv`);

  const jsonl = rows.map(r => JSON.stringify({ ts: new Date().toISOString(), tab, row: r })).join('\n') + '\n';
  fs.appendFileSync(jsonlPath, jsonl, 'utf8');

  const csvLines = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
  fs.appendFileSync(csvPath, csvLines, 'utf8');

  return { sink: 'local', tab, inserted: rows.length, jsonlPath, csvPath };
}

function loadServiceAccount() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH) {
    return JSON.parse(fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH, 'utf8'));
  }
  throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_JSON_PATH');
}

async function getAccessToken() {
  const sa = loadServiceAccount();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: SHEETS_SCOPE,
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    exp,
    iat
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(sa.private_key, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const assertion = `${unsigned}.${signature}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!res.ok) throw new Error(`Google token error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.access_token;
}

async function appendGoogle(tab, rows) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error('Missing GOOGLE_SHEET_ID');

  const accessToken = await getAccessToken();
  const range = `${tab}!A1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: rows })
  });

  if (!res.ok) throw new Error(`Sheets append ${tab} failed ${res.status}: ${await res.text()}`);
  const out = await res.json();
  return { sink: 'google', tab, inserted: rows.length, out };
}

export async function appendRows(tab, rows) {
  if (!rows.length) return { sink: 'none', tab, inserted: 0 };

  const sinkMode = (process.env.DATA_SINK || 'local').toLowerCase();
  const allowFallback = (process.env.SINK_FALLBACK_TO_LOCAL || 'true') === 'true';

  if (sinkMode === 'local') return appendLocal(tab, rows);

  if (sinkMode === 'google') {
    try {
      return await appendGoogle(tab, rows);
    } catch (error) {
      if (!allowFallback) throw error;
      const fallback = appendLocal(tab, rows);
      return { ...fallback, warning: `google_failed_fallback_local: ${error.message}` };
    }
  }

  return appendLocal(tab, rows);
}

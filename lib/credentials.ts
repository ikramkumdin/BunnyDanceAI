export type ServiceAccountJson = {
  client_email?: string;
  private_key?: string;
  project_id?: string;
  [key: string]: any;
};

function tryReadJsonFile(path: string): ServiceAccountJson | undefined {
  try {
    const fs = require('fs');
    if (!fs.existsSync(path)) return undefined;
    const raw = fs.readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as ServiceAccountJson;
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function looksLikeJsonObjectString(s: string): boolean {
  const t = s.trim();
  return t.startsWith('{') && t.endsWith('}');
}

function looksLikeBase64(s: string): boolean {
  const t = s.trim();
  // crude heuristic: base64 usually contains only these chars and is reasonably long
  return /^[A-Za-z0-9+/=]+$/.test(t) && t.length > 40 && !t.includes('{') && !t.includes('}');
}

export function parseServiceAccountFromEnv(): ServiceAccountJson | undefined {
  // First: allow pointing at a JSON file on disk (best for local dev).
  // - GOOGLE_APPLICATION_CREDENTIALS is a standard env used by Google libraries.
  // - GCP_SERVICE_ACCOUNT_KEY_FILE is our convenience env.
  const filePath =
    process.env.GCP_SERVICE_ACCOUNT_KEY_FILE ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    '';
  if (filePath) {
    const fromFile = tryReadJsonFile(filePath);
    if (fromFile) return fromFile;
  }

  const raw =
    process.env.GCP_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64 ||
    '';

  if (!raw) return undefined;

  const trimmed = raw.trim();

  const candidates: string[] = [];

  // raw JSON
  if (looksLikeJsonObjectString(trimmed)) candidates.push(trimmed);

  // quoted JSON (common in .env)
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const unquoted = trimmed.slice(1, -1);
    if (looksLikeJsonObjectString(unquoted)) candidates.push(unquoted);
  }

  // base64 JSON
  if (looksLikeBase64(trimmed)) {
    try {
      candidates.push(Buffer.from(trimmed, 'base64').toString('utf8'));
    } catch {
      // ignore
    }
  }

  // prefixed base64: base64:...
  if (trimmed.toLowerCase().startsWith('base64:')) {
    const b64 = trimmed.slice('base64:'.length);
    try {
      candidates.push(Buffer.from(b64, 'base64').toString('utf8'));
    } catch {
      // ignore
    }
  }

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c) as ServiceAccountJson;
      // Must have signing fields to be useful for GCS signed URLs
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // continue
    }
  }

  throw new Error(
    'Failed to parse service account credentials. Fix by setting ONE of: (1) GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json, (2) GCP_SERVICE_ACCOUNT_KEY_FILE=/path/to/service-account.json, (3) GOOGLE_APPLICATION_CREDENTIALS_BASE64=<base64(json)>, (4) GCP_SERVICE_ACCOUNT_KEY=<one-line json>.'
  );
}



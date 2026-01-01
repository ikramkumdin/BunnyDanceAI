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
  // Remove all whitespace (including newlines)
  const t = s.replace(/\s/g, '');
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

  // Handle multi-line JSON (common in .env files where JSON spans multiple lines)
  // Replace newlines with spaces and clean up
  let trimmed = raw.trim();

  // SANITIZE: Remove any whitespace from the string if we suspect it's base64
  // This handles copy-pasting base64 that refers to newlines
  const cleanBase64 = raw.replace(/\s/g, '');

  const candidates: string[] = [];

  // raw JSON
  if (looksLikeJsonObjectString(trimmed)) candidates.push(trimmed);

  // quoted JSON (common in .env)
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const unquoted = trimmed.slice(1, -1);
    if (looksLikeJsonObjectString(unquoted)) candidates.push(unquoted);
  }

  // base64 JSON
  if (looksLikeBase64(cleanBase64)) {
    try {
      candidates.push(Buffer.from(cleanBase64, 'base64').toString('utf8'));
    } catch {
      // ignore
    }
  }

  // prefixed base64: base64:...
  if (trimmed.toLowerCase().startsWith('base64:')) {
    const b64 = trimmed.slice('base64:'.length).replace(/\s/g, '');
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
      if (parsed && typeof parsed === 'object') {
        // Validate required fields
        if (!parsed.client_email || !parsed.private_key) {
          console.warn('⚠️  Service account JSON missing required fields (client_email or private_key)');
          continue;
        }
        return parsed;
      }
    } catch (parseError) {
      // continue to next candidate
      console.warn('⚠️  Failed to parse JSON candidate:', parseError instanceof Error ? parseError.message : String(parseError));
    }
  }

  // If we have raw data but couldn't parse it, provide helpful error
  if (raw) {
    const preview = raw.length > 200 ? raw.substring(0, 200) + '...' : raw;
    const firstChar = raw.trim().charAt(0);
    const lastChar = raw.trim().charAt(raw.trim().length - 1);

    let specificIssue = '';
    if (firstChar === '{' && lastChar !== '}') {
      specificIssue = 'JSON appears incomplete (starts with { but doesn\'t end with }). This usually means the JSON is spread across multiple lines in .env.local. ';
    } else if (!raw.includes('client_email')) {
      specificIssue = 'JSON appears to be missing required fields. ';
    }

    throw new Error(
      `Failed to parse service account credentials. ${specificIssue}Raw value preview: "${preview}". ` +
      `\n\n💡 SOLUTION: Use ONE of these methods:\n` +
      `\n1. Base64 encoding (RECOMMENDED for multi-line JSON):\n` +
      `   GOOGLE_APPLICATION_CREDENTIALS_BASE64=$(cat service-account.json | base64)\n` +
      `\n2. File path:\n` +
      `   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json\n` +
      `\n3. Single-line JSON (escape quotes):\n` +
      `   GCP_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'\n` +
      `\n⚠️  Note: .env.local files don't support multi-line JSON values. Use base64 or file path instead.`
    );
  }

  // No raw data found, return undefined (not an error)
  return undefined;
}



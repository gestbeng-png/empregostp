#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const firebaseClientPath = path.join(root, 'lib', 'firebase.js');
const serviceAccountPath = path.join(root, 'lib', 'firebase-admin-credentials.json');

function parseClientDefaults(src) {
  const get = (key) => {
    // Matches: key: process.env.* || "value"
    const re = new RegExp(`${key}:[^\n]*?\|\|\s*"([^"]+)"`);
    const m = src.match(re);
    return m ? m[1] : '';
  };
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: get('apiKey'),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: get('authDomain'),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: get('projectId'),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: get('storageBucket'),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: get('messagingSenderId'),
    NEXT_PUBLIC_FIREBASE_APP_ID: get('appId'),
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: get('measurementId'),
  };
}

function readServiceAccount() {
  if (!fs.existsSync(serviceAccountPath)) return {};
  try {
    const json = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    return {
      FIREBASE_PROJECT_ID: json.project_id || '',
      FIREBASE_CLIENT_EMAIL: json.client_email || '',
      FIREBASE_PRIVATE_KEY: json.private_key || '',
    };
  } catch (e) {
    return {};
  }
}

function toEnvFile(vars) {
  return Object.entries(vars)
    .filter(([_, v]) => v !== undefined && v !== null && String(v).length > 0)
    .map(([k, v]) => {
      if (k === 'FIREBASE_PRIVATE_KEY') {
        // Keep multiline with proper escaping for .env
        const escaped = String(v).replace(/\n/g, '\\n');
        return `${k}="${escaped}"`;
      }
      return `${k}=${v}`;
    })
    .join('\n') + '\n';
}

try {
  const clientSrc = fs.readFileSync(firebaseClientPath, 'utf8');
  const clientVars = parseClientDefaults(clientSrc);
  const adminVars = readServiceAccount();

  const envLocalPath = path.join(root, '.env.local');
  const vercelOutPath = path.join(root, '.env.vercel.generated');

  const combined = { ...clientVars, ...adminVars };
  const envLocal = toEnvFile(combined);
  fs.writeFileSync(envLocalPath, envLocal, 'utf8');

  // Also create a helper file with ready-to-use values
  const vercelBlock = [
    '# Copy these into Vercel Project Settings → Environment Variables',
    toEnvFile(clientVars).trim(),
    toEnvFile(adminVars).trim(),
    ''
  ].join('\n\n');
  fs.writeFileSync(vercelOutPath, vercelBlock, 'utf8');

  console.log('Generated .env.local and .env.vercel.generated successfully.');
  console.log('Open .env.vercel.generated to copy values into Vercel or use the CI workflow.');
} catch (e) {
  console.error('Failed to generate env files:', e);
  process.exit(1);
}













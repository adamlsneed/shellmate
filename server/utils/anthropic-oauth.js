// server/utils/anthropic-oauth.js
/**
 * Anthropic OAuth flow for Claude Pro/Max/Team subscriptions.
 * Uses PKCE (Proof Key for Code Exchange) — no client secret needed.
 * Token exchange and refresh via Anthropic's OAuth endpoints.
 */

import crypto from 'crypto';
import { readConfig, writeConfig, backupConfig } from './config.js';

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
const SCOPES = 'org:create_api_key user:profile user:inference';

// In-memory PKCE verifier storage (per session, keyed by state)
const pendingVerifiers = new Map();

/**
 * Generate PKCE code verifier and challenge.
 */
async function generatePKCE() {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64urlEncode(verifierBytes);

  const data = new TextEncoder().encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const challenge = base64urlEncode(new Uint8Array(hashBuffer));

  return { verifier, challenge };
}

function base64urlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Start the OAuth flow. Returns the authorization URL to open in the browser.
 * The PKCE verifier is stored in memory, keyed by the state parameter.
 */
export async function startOAuthFlow() {
  const { verifier, challenge } = await generatePKCE();

  const authParams = new URLSearchParams({
    code: 'true',
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: verifier,
  });

  const authUrl = `${AUTHORIZE_URL}?${authParams.toString()}`;

  // Store verifier for later exchange
  pendingVerifiers.set(verifier, { verifier, createdAt: Date.now() });

  // Clean up old verifiers (older than 10 minutes)
  for (const [key, val] of pendingVerifiers) {
    if (Date.now() - val.createdAt > 10 * 60 * 1000) pendingVerifiers.delete(key);
  }

  return { authUrl, state: verifier };
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * @param {string} authCode - The code pasted by the user (format: "code#state" or just "code")
 * @param {string} state - The state/verifier from startOAuthFlow (optional if embedded in authCode)
 */
export async function exchangeCodeForTokens(authCode) {
  // The auth code from Anthropic's callback page is in format: code#state
  const parts = authCode.split('#');
  const code = parts[0];
  const state = parts[1];

  if (!state) {
    throw new Error('Invalid authorization code format. Expected format: code#state');
  }

  // Look up the PKCE verifier
  const pending = pendingVerifiers.get(state);
  if (!pending) {
    throw new Error('Authorization session expired. Please start the sign-in process again.');
  }
  pendingVerifiers.delete(state);

  // Exchange code for tokens
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      state,
      redirect_uri: REDIRECT_URI,
      code_verifier: pending.verifier,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed: ${errText}`);
  }

  const data = await res.json();
  const expiresAt = Date.now() + data.expires_in * 1000 - 5 * 60 * 1000; // 5 min buffer

  const credentials = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };

  // Persist to shellmate.json
  saveOAuthCredentials(credentials);

  return credentials;
}

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token refresh failed: ${errText}`);
  }

  const data = await res.json();
  const expiresAt = Date.now() + data.expires_in * 1000 - 5 * 60 * 1000;

  const credentials = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };

  saveOAuthCredentials(credentials);

  return credentials;
}

/**
 * Get a valid access token — refreshes automatically if expired.
 * Returns the access token string, or null if no credentials are saved.
 */
export async function getValidAccessToken() {
  const creds = loadOAuthCredentials();
  if (!creds) return null;

  // If token is still valid, return it
  if (Date.now() < creds.expiresAt) {
    return creds.accessToken;
  }

  // Token expired — try to refresh
  if (!creds.refreshToken) return null;

  try {
    const refreshed = await refreshAccessToken(creds.refreshToken);
    return refreshed.accessToken;
  } catch {
    return null;
  }
}

/**
 * Save OAuth credentials to shellmate.json.
 */
function saveOAuthCredentials(credentials) {
  const cfg = readConfig();
  backupConfig();
  cfg.ai = {
    ...(cfg.ai || {}),
    provider: 'anthropic',
    model: cfg.ai?.model || 'claude-haiku-4-5-20251001',
    configured: true,
    envKey: false,
    oauth: {
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiresAt: credentials.expiresAt,
    },
  };
  writeConfig(cfg);
}

/**
 * Load OAuth credentials from shellmate.json.
 */
export function loadOAuthCredentials() {
  const cfg = readConfig();
  const oauth = cfg.ai?.oauth;
  if (!oauth?.accessToken) return null;
  return {
    accessToken: oauth.accessToken,
    refreshToken: oauth.refreshToken,
    expiresAt: oauth.expiresAt || 0,
  };
}

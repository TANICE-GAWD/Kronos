// Centralized backend endpoint configuration.
//
// Resolution order:
//   1. VITE_API_URL env var (e.g. set on Vercel) — wins if present.
//   2. Vite dev server (`npm run dev`) — local backend on :8080.
//   3. Production build — the deployed Railway backend.
//
// WS_URL is derived from API_BASE_URL so http->ws and https->wss stay in sync.

const PROD_API_URL = 'https://kronos-production-c81f.up.railway.app';

const envUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '');

export const API_BASE_URL =
  envUrl || (import.meta.env.DEV ? 'http://localhost:8080' : PROD_API_URL);

// 'http(s)://host' -> 'ws(s)://host/ws'
export const WS_URL = `${API_BASE_URL.replace(/^http/, 'ws')}/ws`;

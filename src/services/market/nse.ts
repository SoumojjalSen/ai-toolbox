// NSE blocks requests without a browser User-Agent; the archives and /api endpoints need nothing else
const NSE_HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36" }
const FETCH_TIMEOUT_MS = 20_000

export async function fetchNse(url: string): Promise<Response> {
  return fetch(url, { headers: NSE_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
}

// Optional extras — callers treat undefined as "lens unavailable today", never as an error
export async function fetchNseJson<T>(path: string): Promise<T | undefined> {
  const response = await fetchNse(`https://www.nseindia.com/api/${path}`).catch(() => undefined)
  return response?.ok ? ((await response.json().catch(() => undefined)) as T | undefined) : undefined
}

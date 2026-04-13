/**
 * Resolves API base URL from the backend config.json (driven by backend/.env BASE_URL + API_PATH).
 * Optional: <meta name="api-origin" content="http://127.0.0.1:8000"> — base used to try config URLs.
 * Optional: <meta name="api-path" content="/api"> — try {origin}{api-path}/config.json first.
 * Optional: window.__API_BASE_URL__ = 'https://example.com/api' to override.
 */
let _apiBaseCache = null;

function trimSlash(u) {
  return String(u || "").replace(/\/+$/, "");
}

/** Ordered candidate URLs for config.json for one origin (meta api-path, then root, then /api). */
function configJsonUrlsForOrigin(origin) {
  const o = trimSlash(origin);
  if (!o) {
    return [];
  }
  const urls = [];
  const metaPath = document.querySelector('meta[name="api-path"]');
  if (metaPath && metaPath.content) {
    let p = metaPath.content.trim();
    if (!p.startsWith("/")) {
      p = "/" + p;
    }
    p = p.replace(/\/+$/, "");
    urls.push(`${o}${p}/config.json`);
  }
  urls.push(`${o}/config.json`);
  urls.push(`${o}/api/config.json`);
  const seen = new Set();
  return urls.filter((u) => {
    if (seen.has(u)) {
      return false;
    }
    seen.add(u);
    return true;
  });
}

async function tryFetchApiBaseFromConfigUrls(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: "omit" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.apiBaseUrl) {
          return trimSlash(data.apiBaseUrl);
        }
      }
    } catch (_) {
      /* try next */
    }
  }
  return null;
}

async function resolveApiBaseUrl() {
  if (_apiBaseCache) {
    return _apiBaseCache;
  }
  if (typeof window.__API_BASE_URL__ === "string" && window.__API_BASE_URL__.trim()) {
    _apiBaseCache = trimSlash(window.__API_BASE_URL__);
    return _apiBaseCache;
  }
  const meta = document.querySelector('meta[name="api-origin"]');
  const origins = [];
  if (meta && meta.content) {
    origins.push(trimSlash(meta.content));
  }
  origins.push(trimSlash(window.location.origin));

  for (const origin of origins) {
    if (!origin) {
      continue;
    }
    const base = await tryFetchApiBaseFromConfigUrls(configJsonUrlsForOrigin(origin));
    if (base) {
      _apiBaseCache = base;
      return _apiBaseCache;
    }
  }

  _apiBaseCache = trimSlash(window.location.origin);
  return _apiBaseCache;
}

/** category label -> hub URL with ?filter= (see backend config HUB_FILTERS) */
async function fetchHubManifest() {
  try {
    const base = await resolveApiBaseUrl();
    const r = await fetch(`${base}/hub-manifest/`, { credentials: "omit" });
    if (!r.ok) return { byCategory: {}, excluded: [] };
    return await r.json();
  } catch (_) {
    return { byCategory: {}, excluded: [] };
  }
}

async function fetchTagHubManifest() {
  const j = await fetchHubManifest();
  return j.byCategory || {};
}

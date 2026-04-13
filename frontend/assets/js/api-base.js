/**
 * Resolves API base URL from the backend /config.json (driven by backend/.env).
 * Optional: <meta name="api-origin" content="http://127.0.0.1:8000"> when the HTML
 * is served from another host/port (e.g. Live Server) so /config.json is fetched from the API.
 * Optional: window.__API_BASE_URL__ = 'http://127.0.0.1:8000/api' to override.
 */
let _apiBaseCache = null;

function trimSlash(u) {
  return String(u || "").replace(/\/+$/, "");
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
    try {
      const res = await fetch(`${origin}/config.json`, { credentials: "omit" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.apiBaseUrl) {
          _apiBaseCache = trimSlash(data.apiBaseUrl);
          return _apiBaseCache;
        }
      }
    } catch (_) {
      /* try next origin */
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

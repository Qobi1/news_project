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

/** Strip irk.ru widgets / schedule blocks; return plain text for card excerpts. */
function stripEventDescriptionHtml(html) {
  if (!html || typeof html !== "string") return "";
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const root = doc.body;
    root.querySelectorAll("script, style").forEach((el) => el.remove());
    root
      .querySelectorAll(
        "section.calendar-wrapper, section.j-calendar-wrapper, .calendar-wrapper.j-calendar-wrapper"
      )
      .forEach((el) => el.remove());
    root
      .querySelectorAll(
        "#schedule-event, .cinemashedule, .cinemashedule__item, .times, .owl-nav, .owl-dots"
      )
      .forEach((el) => el.remove());
    const prefer = root.querySelector(
      ".cinema__desc__content p, .event__attention__desc, .cinema__desc p, p"
    );
    if (prefer) {
      const t = (prefer.textContent || "").replace(/\s+/g, " ").trim();
      if (t.length >= 8) return t;
    }
    return (root.textContent || "").replace(/\s+/g, " ").trim();
  } catch {
    return String(html)
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

function truncateWords(text, wordCount) {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  return words.length > wordCount
    ? words.slice(0, wordCount).join(" ") + "…"
    : words.join(" ");
}

/** Short plain-text blurb for home / search / hub cards (always non-empty). */
function buildCardExcerpt(api, wordCount = 14) {
  const plain = stripEventDescriptionHtml(api.description);
  if (plain.length >= 8) {
    return truncateWords(plain, wordCount);
  }
  const title = (api.title || "").trim();
  const loc = (api.location || "").trim();
  const cat = (api.category || "").trim();
  if (loc && cat) return truncateWords(`${cat}: ${loc}`, wordCount);
  if (loc) return truncateWords(loc, wordCount);
  if (cat && title) return truncateWords(`${cat} — ${title}`, wordCount);
  if (title) return truncateWords(title, wordCount);
  return "Событие в Иркутске";
}

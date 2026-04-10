// Global variables
let currentArticle = null;
let recommendedArticles = [];

// API Configuration
const BACKEND_URL = "https://afisha.bestjourneymap.com/api";

// Icon configuration
const ICONS = {
  BRAND: "bi bi-newspaper",
  CALENDAR: "bi bi-calendar3",
  PERSON: "bi bi-person",
  CLOCK: "bi bi-clock",
  BACK: "bi bi-arrow-left",
  FORWARD: "bi bi-arrow-right",
  DOWN: "bi bi-arrow-down",
  SEARCH: "bi bi-search",
  NEWS: "bi bi-newspaper",
};

// Utility functions
function getIconClass(iconType, size = "SM", variant) {
  const baseClass = ICONS[iconType] || "bi bi-question-circle";
  const sizeClass =
    size === "XS"
      ? "fs-6"
      : size === "SM"
      ? "fs-5"
      : size === "MD"
      ? "fs-4"
      : size === "LG"
      ? "fs-3"
      : size === "DISPLAY"
      ? "fs-1"
      : "fs-5";
  const variantClass = variant === "MUTED" ? "text-muted" : "";

  return `${baseClass} ${sizeClass} ${variantClass}`.trim();
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateSafe(dateString) {
  if (!dateString) return "";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (error) {
    return dateString;
  }
}

function wrapImagesScrollable(html) {
  // Match consecutive <img ... /> tags at the end of the content
  const imgGroupRegex = /((<img[^>]+>\s*){2,})$/;
  return html.replace(imgGroupRegex, (match) => {
    return `<div style="display: flex; overflow-x: auto; gap: 16px; padding: 12px 0; border-radius: 12px; background: #f8f9fa;">${match}</div>`;
  });
}

// API functions
async function fetchNewsById(id) {
  try {
    const response = await fetch(`${BACKEND_URL}/news/${id}`);
    if (!response.ok) {
      throw new Error("Article not found");
    }
    const data = await response.json();
    return {
      ...data,
      datetime_str: data.datetime_iso || data.datetime_str,
    };
  } catch (error) {
    console.error("Error fetching news by ID:", error);
    throw error;
  }
}

async function fetchNews() {
  try {
    const response = await fetch(`${BACKEND_URL}/news/`);
    if (!response.ok) {
      throw new Error("Failed to fetch news");
    }
    const data = await response.json();
    return data.map((article) => ({
      id: article.id,
      title: article.title,
      excerpt: article.description,
      content: article.description,
      image: article.image_url,
      category: article.category,
      date: article.datetime_str,
      author: article.location,
    }));
  } catch (error) {
    console.error("Error fetching news:", error);
    throw error;
  }
}

async function fetchRandomNews() {
  try {
    const response = await fetch(`${BACKEND_URL}/random-news/`);
    if (!response.ok) {
      throw new Error("Failed to fetch random news");
    }
    const data = await response.json();
    return data.map((article) => ({
      id: article.id,
      title: article.title,
      excerpt: article.description,
      content: article.description,
      image: article.image_url,
      category: article.category,
      date: article.datetime_str,
      author: article.location,
    }));
  } catch (error) {
    console.error("Error fetching random news:", error);
    throw error;
  }
}

// SEO functions
// helper: ставим meta, а если тега нет — создаём
function setMeta(selector, attr, value) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    // распознаём property=... или name=...
    const m = selector.match(/meta\[(property|name)=\"([^\"]+)\"\]/);
    if (m) el.setAttribute(m[1], m[2]);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

// helper: создать <link rel="preload" as="image" ...> если нет
function ensurePreloadImage(href) {
  if (!href) return;
  const q = `link[rel="preload"][as="image"][href="${href}"]`;
  if (!document.querySelector(q)) {
    const l = document.createElement("link");
    l.rel = "preload";
    l.as = "image";
    l.href = href;
    document.head.appendChild(l);
  }
}

function updateMetaTags(article) {
  const baseUrl = window.location.origin;
  const pageUrl = `${baseUrl}/article.html?id=${article.id}`;
  // ОБЯЗАТЕЛЬНО: крупный баннер 1200×630 для этой статьи
  // если сервер генерит его — клади сюда реальный handleSmoothScroll
  const ogImage =
    article.og_image_1200 ||
    article.image_url ||
    `${baseUrl}/assets/images/og-image.png`;
  const desc = (article.description || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 200)
    .trim();

  // <title> и description
  document.title = article.title;
  setMeta('meta[name="description"]', "content", desc);

  // canonical
  let can = document.querySelector('link[rel="canonical"]');
  if (!can) {
    can = document.createElement("link");
    can.rel = "canonical";
    document.head.appendChild(can);
  }
  can.href = pageUrl;

  // Open Graph
  setMeta('meta[property="og:title"]', "content", article.title);
  setMeta('meta[property="og:description"]', "content", desc);
  setMeta('meta[property="og:type"]', "content", "article"); // ок для event-страницы
  setMeta('meta[property="og:url"]', "content", pageUrl);
  setMeta('meta[property="og:image"]', "content", ogImage);
  setMeta('meta[property="og:image:width"]', "content", "1200");
  setMeta('meta[property="og:image:height"]', "content", "630");
  setMeta('meta[property="og:image:alt"]', "content", `${article.title}`);

  // Twitter
  setMeta('meta[name="twitter:card"]', "content", "summary_large_image");
  setMeta('meta[name="twitter:title"]', "content", article.title);
  setMeta('meta[name="twitter:description"]', "content", desc);
  setMeta('meta[name="twitter:image"]', "content", ogImage);

  // Прелоад баннера для LCP
  ensurePreloadImage(ogImage);
}

function generateJSONLD(article) {
  const baseUrl = window.location.origin;
  const desc = (article.description || "")
    .replace(/<[^>]*>/g, "")
    .slice(0, 200);

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: article.title,
    description: desc,
    startDate: article.datetime_iso, // ISO с тайм-зоной
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: article.location || "Иркутск",
      address: {
        "@type": "PostalAddress",
        streetAddress: article.location || "",
        addressLocality: "Иркутск",
        addressRegion: "Иркутская область",
        addressCountry: "RU",
      },
    },
    image: [
      {
        "@type": "ImageObject",
        url: article.og_image_1200 || article.image_url,
        width: 1200,
        height: 630,
      },
    ],
    organizer: {
      "@type": "Organization",
      name: "Афиша Иркутска",
      url: baseUrl,
    },
    offers: {
      "@type": "Offer",
      url: `${baseUrl}/article.html?id=${article.id}`,
      price: article.price || "0",
      priceCurrency: "RUB",
      availability: "https://schema.org/InStock",
    },
    inLanguage: "ru",
    isAccessibleForFree: true,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${baseUrl}/article.html?id=${article.id}`,
    },
  };
}

function generateBreadcrumbJSONLD(article) {
  const baseUrl = window.location.origin;
  const breadcrumbs = [
    { name: "Главная", url: baseUrl },
    {
      name: article.category,
      url: `${baseUrl}/?category=${encodeURIComponent(article.category)}`,
    },
    { name: article.title, url: `${baseUrl}/article.html?id=${article.id}` },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return jsonLd;
}

// UI functions
function showLoading() {
  document.getElementById("loadingSpinner").style.display = "block";
  document.getElementById("errorMessage").style.display = "none";
  document.getElementById("articleContent").style.display = "none";
  document.getElementById("breadcrumbs").style.display = "none";
  document.getElementById("recommendedNews").style.display = "none";
}

function hideLoading() {
  document.getElementById("loadingSpinner").style.display = "none";
}

function showError() {
  document.getElementById("errorMessage").style.display = "block";
  document.getElementById("loadingSpinner").style.display = "none";
  document.getElementById("articleContent").style.display = "none";
  document.getElementById("breadcrumbs").style.display = "none";
  document.getElementById("recommendedNews").style.display = "none";
}

function showArticle(article) {
  // Update meta tags
  updateMetaTags(article);
  if (article.datetime_iso) {
    setMeta(
      'meta[property="article:published_time"]',
      "content",
      article.datetime_iso
    );
    setMeta(
      'meta[property="og:updated_time"]',
      "content",
      article.datetime_iso
    );
    setMeta(
      'meta[property="article:modified_time"]',
      "content",
      article.datetime_iso
    );
  }

  // Add JSON-LD structured data
  const jsonLd = generateJSONLD(article);
  const breadcrumbJsonLd = generateBreadcrumbJSONLD(article);

  // Remove existing JSON-LD scripts - переделываем в Не удаляй чужие JSON-LD (Organization/WebSite)
  // const existingScripts = document.querySelectorAll(
  //  'script[type="application/ld+json"]'
  // );
  // existingScripts.forEach((script) => script.remove());
  // делаем так:
  document
    .querySelectorAll('script[type="application/ld+json"][data-dynamic-ld]')
    .forEach((s) => s.remove());

  const jsonLdScript = document.createElement("script");
  jsonLdScript.type = "application/ld+json";
  jsonLdScript.setAttribute("data-dynamic-ld", "event");
  jsonLdScript.textContent = JSON.stringify(jsonLd);
  document.head.appendChild(jsonLdScript);

  const breadcrumbScript = document.createElement("script");
  breadcrumbScript.type = "application/ld+json";
  breadcrumbScript.setAttribute("data-dynamic-ld", "breadcrumbs");
  breadcrumbScript.textContent = JSON.stringify(breadcrumbJsonLd);
  document.head.appendChild(breadcrumbScript);

  // Update breadcrumbs
  document.getElementById("categoryLink").textContent = article.category;
  document.getElementById(
    "categoryLink"
  ).href = `/?category=${encodeURIComponent(article.category)}`;
  document.getElementById("articleTitleBreadcrumb").textContent = article.title;

  // Update article content
  document.getElementById("articleCategory").textContent = article.category;
  document.getElementById("articleTitle").textContent = article.title;
  document.getElementById("articleDate").textContent = formatDate(
    article.datetime_str
  );
  document.getElementById("articleLocation").textContent = article.location;
  document.getElementById("articleDescription").innerHTML =
    wrapImagesScrollable(article.description);
  const container = document.getElementById("articleDescription");
  container.querySelectorAll("img").forEach((img) => {
    img.loading = "lazy";
    img.decoding = "async";
    if (!img.getAttribute("width")) img.setAttribute("width", "620");
    if (!img.getAttribute("height")) img.setAttribute("height", "400");
    if (!img.alt) img.alt = article.title || "Изображение события";
  });

  // Show elements
  document.getElementById("breadcrumbs").style.display = "block";
  document.getElementById("articleContent").style.display = "block";

  // Load recommended articles
  loadRecommendedArticles(article);
}

function renderRecommendedArticles(articles) {
  const recommendedNewsGrid = document.getElementById("recommendedNewsGrid");

  if (articles.length === 0) {
    document.getElementById("recommendedNews").style.display = "none";
    return;
  }

  recommendedNewsGrid.innerHTML = articles
    .map(
      (article, index) => `
    <div class="col-lg-3 col-md-6 mb-4">
      <article class="card h-100 shadow-sm border-0 recommended-card">
        <img src="${article.image}" 
             alt="${article.title}" 
             class="card-img-top recommended-image" loading="lazy" decoding="async" width="280" height="190">
        <div class="card-body">
          <span class="badge bg-primary recommended-badge">
            ${article.category}
          </span>
          <h6 class="card-title recommended-title">
            ${article.title}
          </h6>
          <div class="card-text text-muted recommended-excerpt">
            ${article.excerpt}
          </div>
          <div class="mt-auto">
            <div class="recommended-date">
              <i class="${getIconClass("CALENDAR", "XS")} me-2 text-muted"></i>
              <small class="text-muted">${formatDateSafe(article.date)}</small>
            </div>
            <a href="article.html?id=${article.id}" 
               class="btn btn-primary btn-sm recommended-btn">
              Читать <i class="bi bi-arrow-right ms-1"></i>
            </a>
          </div>
        </div>
      </article>
    </div>
  `
    )
    .join("");

  document.getElementById("recommendedNews").style.display = "block";
}

async function loadRecommendedArticles(currentArticle) {
  try {
    const randomArticles = await fetchRandomNews();

    const uniq = new Map();
    randomArticles.forEach((a) => {
      if (a.id !== currentArticle.id && !uniq.has(a.id)) uniq.set(a.id, a);
    });

    recommendedArticles = Array.from(uniq.values()).slice(0, 4);
    renderRecommendedArticles(recommendedArticles);
  } catch (error) {
    console.error("Error loading recommended articles:", error);
    document.getElementById("recommendedNews").style.display = "none";
  }
}

// Initialize the article page
async function initArticle() {
  try {
    showLoading();

    // Get article ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get("id");

    if (!articleId) {
      throw new Error("No article ID provided");
    }

    // Fetch article data
    const article = await fetchNewsById(parseInt(articleId, 10));
    currentArticle = article;

    // Show article
    showArticle(article);
  } catch (error) {
    console.error("Error loading article:", error);
    showError();
  } finally {
    hideLoading();
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initArticle);

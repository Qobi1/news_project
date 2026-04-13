// Global variables
let allNewsData = [];
let categories = ['Все'];
let currentResults = [];
let isSearching = false;
let hasSearched = false;
let currentSearchQuery = '';
let hubLinkByCategory = {};
let hubExcludedLower = new Set();

// Icon configuration
const ICONS = {
  BRAND: 'bi bi-newspaper',
  CALENDAR: 'bi bi-calendar3',
  PERSON: 'bi bi-person',
  CLOCK: 'bi bi-clock',
  BACK: 'bi bi-arrow-left',
  FORWARD: 'bi bi-arrow-right',
  DOWN: 'bi bi-arrow-down',
  SEARCH: 'bi bi-search',
  NEWS: 'bi bi-newspaper'
};

// Utility functions
function getIconClass(iconType, size = 'SM', variant) {
  const baseClass = ICONS[iconType] || 'bi bi-question-circle';
  const sizeClass = size === 'XS' ? 'fs-6' : 
                   size === 'SM' ? 'fs-5' : 
                   size === 'MD' ? 'fs-4' : 
                   size === 'LG' ? 'fs-3' : 
                   size === 'DISPLAY' ? 'fs-1' : 'fs-5';
  const variantClass = variant === 'MUTED' ? 'text-muted' : '';
  
  return `${baseClass} ${sizeClass} ${variantClass}`.trim();
}

function formatDateSafe(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString('ru-RU', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch (error) {
    return dateString;
  }
}

function getShortDescription(text, wordCount = 20) {
  if (!text) return '';
  
  // Strip HTML tags for consistent word counting
  const plainText = text.replace(/<[^>]*>/g, '');
  const words = plainText.split(' ');
  return words.length > wordCount ? words.slice(0, wordCount).join(' ') + '...' : plainText;
}

// API functions
function mapApiNewsToArticle(apiNews) {
  return {
    id: apiNews.id,
    title: apiNews.title,
    excerpt: apiNews.description,
    content: apiNews.description,
    image: apiNews.image_url,
    category: apiNews.category,
    date: apiNews.datetime_str,
    author: apiNews.location
  };
}

async function fetchNews() {
  try {
    const base = await resolveApiBaseUrl();
    const response = await fetch(`${base}/news/`);
    if (!response.ok) {
      throw new Error('Failed to fetch news');
    }
    const data = await response.json();
    return data.map(mapApiNewsToArticle);
  } catch (error) {
    console.error('Error fetching news:', error);
    throw error;
  }
}

async function fetchCategories() {
  try {
    const base = await resolveApiBaseUrl();
    const response = await fetch(`${base}/categories/`);
    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }
    const data = await response.json();
    return ['Все', ...data];
  } catch (error) {
    console.error('Error fetching categories:', error);
    return ['Все'];
  }
}

function searchNewsLocally(query, allNews) {
  if (!query.trim()) {
    return allNews;
  }

  const searchTerm = query.toLowerCase().trim();
  
  return allNews.filter(article => {
    // Search in title, excerpt, content, and category
    const title = article.title.toLowerCase();
    const excerpt = article.excerpt.toLowerCase();
    const content = article.content.toLowerCase();
    const category = article.category.toLowerCase();
    const author = article.author.toLowerCase();
    
    return title.includes(searchTerm) ||
           excerpt.includes(searchTerm) ||
           content.includes(searchTerm) ||
           category.includes(searchTerm) ||
           author.includes(searchTerm);
  });
}

// UI functions
function renderSearchResults(results) {
  const searchResultsGrid = document.getElementById('searchResultsGrid');
  const searchResultsSection = document.getElementById('searchResultsSection');
  const searchResultsTitle = document.getElementById('searchResultsTitle');
  const searchResultsDescription = document.getElementById('searchResultsDescription');
  
  if (results.length === 0) {
    searchResultsGrid.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="${getIconClass('SEARCH', 'DISPLAY', 'MUTED')}"></i>
        <h3 class="mt-3 text-muted">По вашему запросу ничего не найдено</h3>
        <p class="text-muted">
          Попробуйте изменить поисковый запрос или 
          <button class="btn btn-link p-0 text-decoration-none" onclick="clearSearch()" style="color: #007bff;">
            очистить поиск
          </button>
        </p>
        <div class="mt-4">
          <button class="btn btn-outline-primary" onclick="clearSearch()">
            <i class="${getIconClass('BACK', 'SM')} me-2"></i>Показать все новости
          </button>
        </div>
      </div>
    `;
  } else {
    searchResultsGrid.innerHTML = results.map((article, index) => `
      <div class="col-lg-4 col-md-6 mb-4">
        <article class="card h-100 shadow-sm border-0 hover-card">
          <img src="${article.image}" 
               alt="${article.title}" 
               class="card-img-top news-image rounded-top">
          <div class="card-body d-flex flex-column">
            <div class="mb-2">
              <span class="badge bg-primary mb-2 px-2 py-1 rounded-pill text-white" 
                    style="font-size: 0.8rem;">
                ${article.category}
              </span>
            </div>
            <h5 class="card-title fw-bold mb-2">
              ${article.title}
            </h5>
            <div class="card-text text-muted flex-grow-1 mb-2">
              <span>${getShortDescription(article.excerpt, 20)}</span>
            </div>
            <div class="mt-auto">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <small class="text-muted">
                  <i class="${getIconClass('CALENDAR', 'XS')} me-1"></i>
                  ${formatDateSafe(article.date)}
                </small>
                <small class="text-muted">
                  <i class="${getIconClass('PERSON', 'XS')} me-1"></i>
                  ${article.author || 'Афиша Иркутска'}
                </small>
              </div>
              <a href="article.html?id=${article.id}" 
                 class="btn btn-primary w-100 rounded-pill fw-bold">
                Подробнее о событии <i class="${getIconClass('FORWARD', 'XS')} ms-1"></i>
              </a>
            </div>
          </div>
        </article>
      </div>
    `).join('');
  }
  
  // Update search results info
  searchResultsTitle.textContent = isSearching ? 'Поиск...' : 
    `Результаты поиска${currentSearchQuery ? ` по запросу "${currentSearchQuery}"` : ''}`;
  searchResultsDescription.textContent = isSearching ? 
    'Поиск...' : 
    (results.length === 0 ? 
      'Ничего не найдено. Попробуйте другой запрос (например: «концерты», «театр», «кино», «выставки»)'
      : `Найдено: ${results.length}`);
  
  searchResultsSection.style.display = 'block';
}

function renderCategoryButtons() {
  const categoryButtons = document.getElementById('categoryButtons');

  const buttonsHTML = categories
    .filter(cat => cat !== 'Все')
    .map(category => {
      const key = category.trim().toLowerCase();
      if (hubExcludedLower.has(key)) {
        return `
      <a href="/" class="btn btn-outline-secondary btn-sm rounded-pill">${category}</a>`;
      }
      const hubHref = hubLinkByCategory[key];
      if (hubHref) {
        return `
      <a href="${hubHref}" class="btn btn-outline-secondary btn-sm rounded-pill">${category}</a>`;
      }
      return `
      <a href="/?category=${encodeURIComponent(category)}"
         class="btn btn-outline-secondary btn-sm rounded-pill">
        ${category}
      </a>`;
    })
    .join('');

  categoryButtons.innerHTML = buttonsHTML;
}

// Event handlers
function handleSmoothScroll(sectionId) {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
}

function handleSearch(event) {
  event.preventDefault();
  const query = document.getElementById('searchInput').value.trim();
  
  if (!query) {
    clearSearch();
    return;
  }

  isSearching = true;
  hasSearched = true;
  currentSearchQuery = query;
  
  // Update search button
  const searchBtn = document.getElementById('searchBtn');
  searchBtn.disabled = true;
  searchBtn.innerHTML = '<span class="loading-spinner me-2"></span>Поиск...';
  
  try {
    // Use local search with the current news data
    const searchResults = searchNewsLocally(query, allNewsData);
    currentResults = searchResults;
    
    // Update UI
    renderSearchResults(searchResults);
    updateSearchStatus(searchResults.length);
    
    // Update page title and meta tags
    updatePageMeta(query, searchResults.length);
    
  } catch (error) {
    console.error('Search error:', error);
    currentResults = [];
    renderSearchResults(currentResults);
  } finally {
    isSearching = false;
    searchBtn.disabled = false;
    searchBtn.innerHTML = '<i class="bi bi-search me-2"></i>Найти';
  }
}

function clearSearch() {
  hasSearched = false;
  currentResults = [];
  currentSearchQuery = '';
  
  // Clear search input
  document.getElementById('searchInput').value = '';
  document.getElementById('searchBtn').disabled = true;
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('searchResultsSection').style.display = 'none';
  
  // Reset page title
  document.title = 'Поиск по афише — Афиша Иркутска';
}

function updateSearchStatus(count) {
  const searchResults = document.getElementById('searchResults');
  const searchStatus = document.getElementById('searchStatus');
  
  searchStatus.textContent = `Найдено результатов: ${count}`;
  searchResults.style.display = 'block';
}

function updatePageMeta(query, count) {
  const pageTitle = `Результаты поиска: "${query}" — Афиша Иркутска`;
  const pageDescription = `Найдено ${count} результатов по запросу "${query}". Найдите события Иркутска: концерты, театр, кино, выставки, детские мероприятия.`;
  
  document.title = pageTitle;
  document.querySelector('meta[name="description"]').content = pageDescription;
  document.querySelector('meta[property="og:title"]').content = pageTitle;
  document.querySelector('meta[property="og:description"]').content = pageDescription;
  document.querySelector('meta[name="twitter:title"]').content = pageTitle;
  document.querySelector('meta[name="twitter:description"]').content = pageDescription;
  
  // Update canonical URL
  const canonicalUrl = `${window.location.origin}/search?q=${encodeURIComponent(query)}`;
  document.querySelector('link[rel="canonical"]').href = canonicalUrl;
  document.querySelector('meta[property="og:url"]').content = canonicalUrl;
  
  // Add JSON-LD structured data for search results
  addSearchJSONLD(query, count);
}

function addSearchJSONLD(query, count) {
  // Remove existing search JSON-LD
  const existingScript = document.querySelector('script[data-type="search-jsonld"]');
  if (existingScript) {
    existingScript.remove();
  }
  
  const baseUrl = window.location.origin;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SearchResultsPage",
    "name": `Search results for "${query}"`,
    "description": `Search results for "${query}" on News Irkutsk`,
    "url": `${baseUrl}/search?q=${encodeURIComponent(query)}`,
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": count,
      "itemListElement": currentResults.map((article, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "NewsArticle",
          "headline": article.title,
          "description": article.excerpt,
          "url": `${baseUrl}/article.html?id=${article.id}`,
          "datePublished": article.date,
          "author": {
            "@type": "Organization",
            "name": "Афиша Иркутска",
          },
        },
      })),
    },
  };
  
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-type', 'search-jsonld');
  script.textContent = JSON.stringify(jsonLd);
  document.head.appendChild(script);
}

// Search input handling
function handleSearchInput() {
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  
  searchBtn.disabled = !searchInput.value.trim();
  
  // Clear search if input is empty
  if (!searchInput.value.trim() && hasSearched) {
    clearSearch();
  }
}

// Initialize the search page
async function initSearch() {
  try {
    // Get search query from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    
    const [newsData, categoriesData, manifest] = await Promise.all([
      fetchNews(),
      fetchCategories(),
      fetchHubManifest(),
    ]);

    hubLinkByCategory = manifest.byCategory || {};
    hubExcludedLower = new Set(
      (manifest.excluded || []).map((x) => String(x).toLowerCase())
    );
    allNewsData = newsData;
    categories = categoriesData;
    
    // Render category buttons
    renderCategoryButtons();
    
    // Set up search input listener
    document.getElementById('searchInput').addEventListener('input', handleSearchInput);
    
    // If there's a search query in URL, perform search
    if (searchQuery) {
      document.getElementById('searchInput').value = searchQuery;
      document.getElementById('searchBtn').disabled = false;
      handleSearch({ preventDefault: () => {} });
    }
    
  } catch (error) {
    console.error('Error initializing search page:', error);
    document.getElementById('searchResultsSection').style.display = 'block';
    document.getElementById('searchResultsGrid').innerHTML = `
      <div class="col-12 text-center py-5">
        <h3 class="text-muted">Ошибка загрузки данных</h3>
        <p class="text-muted">Попробуйте обновить страницу</p>
      </div>
    `;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initSearch);

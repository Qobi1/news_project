// Global variables
let currentNewsData = [];
let allNewsData = [];
let categories = ['Все'];
let selectedCategory = 'Все';
let articlesToShow = 8;
let isSearching = false;
let hasSearched = false;
let currentSearchResults = [];
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

function stripHtmlToPlain(html) {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    const root = doc.body;
    root.querySelectorAll('script, style').forEach((el) => el.remove());
    root
      .querySelectorAll(
        'section.calendar-wrapper, section.j-calendar-wrapper, .calendar-wrapper.j-calendar-wrapper'
      )
      .forEach((el) => el.remove());
    return (root.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

function isCalendarNoisePlain(plain) {
  const words = plain.split(/\s+/).filter(Boolean);
  if (words.length < 10) return false;
  const dayAbbrevs = new Set(['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']);
  const noise = words.filter(
    (w) => /^\d{1,2}$/.test(w) || dayAbbrevs.has(w.toLowerCase())
  ).length;
  return noise / words.length > 0.35;
}

function getShortDescription(text, wordCount = 20) {
  const plainText = stripHtmlToPlain(text);
  if (!plainText) return '';
  const words = plainText.split(' ').filter(Boolean);
  if (!words.length) return '';
  return words.length > wordCount ? words.slice(0, wordCount).join(' ') + '...' : plainText;
}

function excerptForCard(api) {
  const plain = stripHtmlToPlain(api.description);
  if (plain.length >= 15 && !isCalendarNoisePlain(plain)) {
    return plain;
  }

  const loc = (api.location || '').trim();
  const cat = (api.category || '').trim();
  const orig = (api.original_title || '').trim();
  const title = (api.title || '').trim();
  const bits = [];

  if (plain.length >= 15 && isCalendarNoisePlain(plain)) {
    const sentences = plain.split(/(?<=[.!?…])\s+/).filter((s) => !isCalendarNoisePlain(s));
    if (sentences.length && sentences[0].trim().length >= 15) {
      return sentences[0].trim();
    }
  }

  if (loc) bits.push(loc);
  if (cat) bits.push(cat);
  if (orig && orig !== title) bits.push(orig);
  if (bits.length) return bits.join(' · ');

  if (title) return `Анонс: ${title}. Подробности на странице события.`;
  return 'Подробности мероприятия на странице события.';
}

function wrapImagesScrollable(html) {
  // Match consecutive <img ... /> tags at the end of the content
  const imgGroupRegex = /((<img[^>]+>\s*){2,})$/;
  return html.replace(imgGroupRegex, (match) => {
    return `<div style="display: flex; overflow-x: auto; gap: 16px; padding: 12px 0; border-radius: 12px; background: #f8f9fa;">${match}</div>`;
  });
}

// API functions
function mapApiNewsToArticle(apiNews) {
  const excerpt = excerptForCard(apiNews);
  return {
    id: apiNews.id,
    title: apiNews.title,
    excerpt,
    content: apiNews.description || excerpt,
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

async function fetchNewsByCategory(category) {
  try {
    const base = await resolveApiBaseUrl();
    const response = await fetch(`${base}/filter/?category=${encodeURIComponent(category)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch news by category');
    }
    const data = await response.json();
    return data.map(mapApiNewsToArticle);
  } catch (error) {
    console.error('Error fetching news by category:', error);
    throw error;
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
function showLoading() {
  document.getElementById('loadingSpinner').style.display = 'block';
  document.getElementById('newsGrid').innerHTML = '';
}

function hideLoading() {
  document.getElementById('loadingSpinner').style.display = 'none';
}

function renderNewsGrid(newsData) {
  EventGrid.renderNewsGrid({
    newsData,
    articlesToShow,
    hasSearched,
    emptyVariant: "default",
    getIconClass,
    formatDateSafe,
    getShortDescription,
  });
}

function renderCategoryButtons() {
  const categoryButtons = document.getElementById('categoryButtons');
  
  let buttonsHTML = '';
  
  // Add search category if we have search results
  if (hasSearched) {
    buttonsHTML += `
      <button class="btn btn-outline-primary btn-sm rounded-pill ${selectedCategory === 'Поиск' ? 'active' : ''}"
              style="background: ${selectedCategory === 'Поиск' ? '#007bff' : ''}; 
                     color: ${selectedCategory === 'Поиск' ? 'white' : '#007bff'}; 
                     font-weight: ${selectedCategory === 'Поиск' ? 'bold' : 'normal'};"
              onclick="handleCategoryClick('Поиск')">
        <i class="${getIconClass('SEARCH', 'SM')} me-1"></i>
        Поиск (${currentSearchResults.length})
      </button>
    `;
  }

  // Categories: <a> to SEO hub /hub/?filter=…, excluded → home, else fallback to /city/?filter=<raw category>
  categories.forEach(cat => {
    if (cat === 'Все') {
      const isActive = selectedCategory === 'Все';
      buttonsHTML += `
      <a href="/"
         class="btn btn-outline-secondary btn-sm rounded-pill ${isActive ? 'active' : ''}"
         style="background: ${isActive ? '#6c757d' : ''};
                color: ${isActive ? 'white' : '#6c757d'};
                font-weight: ${isActive ? 'bold' : 'normal'};">
        ${cat}
      </a>`;
      return;
    }
    const key = cat.trim().toLowerCase();
    if (hubExcludedLower.has(key)) {
      buttonsHTML += `
      <a href="/" class="btn btn-outline-secondary btn-sm rounded-pill">${cat}</a>`;
      return;
    }
    const hubHref = hubLinkByCategory[key];
    if (hubHref) {
      buttonsHTML += `
      <a href="${hubHref}" class="btn btn-outline-secondary btn-sm rounded-pill">${cat}</a>`;
    } else {
      const isActive = selectedCategory === cat;
      buttonsHTML += `
      <a href="/city/?filter=${encodeURIComponent(cat)}"
         class="btn btn-outline-secondary btn-sm rounded-pill ${isActive ? 'active' : ''}"
         style="background: ${isActive ? '#6c757d' : ''};
                color: ${isActive ? 'white' : '#6c757d'};
                font-weight: ${isActive ? 'bold' : 'normal'};">
        ${cat}
      </a>`;
    }
  });

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
  
  // Update search button
  const searchBtn = document.getElementById('searchBtn');
  searchBtn.disabled = true;
  searchBtn.innerHTML = '<span class="loading-spinner me-2"></span>Поиск...';
  
  try {
    // Use local search with the current news data
    const searchResults = searchNewsLocally(query, allNewsData);
    currentSearchResults = searchResults;
    currentNewsData = searchResults;
    selectedCategory = 'Поиск';
    
    // Update UI
    renderNewsGrid(currentNewsData);
    renderCategoryButtons();
    updateSearchStatus(searchResults.length);
    
  } catch (error) {
    console.error('Search error:', error);
  } finally {
    isSearching = false;
    searchBtn.disabled = false;
    searchBtn.innerHTML = '<i class="bi bi-search me-2"></i>Найти';
  }
}

function clearSearch() {
  hasSearched = false;
  currentSearchResults = [];
  selectedCategory = 'Все';
  
  // Clear search input
  document.getElementById('searchInput').value = '';
  document.getElementById('searchBtn').disabled = true;
  document.getElementById('searchResults').style.display = 'none';
  
  // Reset to all news
  handleCategoryClick('Все');
}

function updateSearchStatus(count) {
  const searchResults = document.getElementById('searchResults');
  const searchStatus = document.getElementById('searchStatus');
  
  searchStatus.textContent = `Найдено результатов: ${count}`;
  searchResults.style.display = 'block';
}

async function handleCategoryClick(category) {
  selectedCategory = category;
  articlesToShow = 8;
  
  showLoading();
  
  try {
    if (category === 'Все') {
      currentNewsData = allNewsData;
    } else if (category === 'Поиск') {
      currentNewsData = currentSearchResults;
    } else {
      const categoryNews = await fetchNewsByCategory(category);
      currentNewsData = categoryNews;
    }
    
    renderNewsGrid(currentNewsData);
    renderCategoryButtons();
    
  } catch (error) {
    console.error('Error fetching category news:', error);
    currentNewsData = [];
    renderNewsGrid(currentNewsData);
  } finally {
    hideLoading();
  }
}

function loadMoreArticles() {
  articlesToShow += 4;
  renderNewsGrid(currentNewsData);
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

// Initialize the app
async function initApp() {
  try {
    showLoading();

    const [newsData, categoriesData, manifest] = await Promise.all([
      fetchNews(),
      fetchCategories(),
      fetchHubManifest(),
    ]);

    hubLinkByCategory = manifest.byCategory || {};
    hubExcludedLower = new Set(
      (manifest.excluded || []).map((x) => String(x).toLowerCase())
    );

    const params = new URLSearchParams(window.location.search);
    const qCat = params.get("category");
    if (qCat) {
      const k = qCat.trim().toLowerCase();
      if (hubLinkByCategory[k]) {
        hideLoading();
        window.location.replace(hubLinkByCategory[k]);
        return;
      }
    }

    allNewsData = newsData;
    currentNewsData = newsData;
    categories = categoriesData;

    // Render initial content
    renderNewsGrid(currentNewsData);
    renderCategoryButtons();
    
    // Set up search input listener
    document.getElementById('searchInput').addEventListener('input', handleSearchInput);
    
  } catch (error) {
    console.error('Error initializing app:', error);
    document.getElementById('newsGrid').innerHTML = `
      <div class="col-12 text-center py-5">
        <h3 class="text-muted">Ошибка загрузки данных</h3>
        <p class="text-muted">Попробуйте обновить страницу</p>
      </div>
    `;
  } finally {
    hideLoading();
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Global variables
let currentNewsData = [];
let allNewsData = [];
let categories = ['Все'];
let selectedCategory = 'Все';
let articlesToShow = 8;
let isSearching = false;
let hasSearched = false;
let currentSearchResults = [];

// API Configuration
const BACKEND_URL = 'https://afisha.bestjourneymap.com/api/';

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

function wrapImagesScrollable(html) {
  // Match consecutive <img ... /> tags at the end of the content
  const imgGroupRegex = /((<img[^>]+>\s*){2,})$/;
  return html.replace(imgGroupRegex, (match) => {
    return `<div style="display: flex; overflow-x: auto; gap: 16px; padding: 12px 0; border-radius: 12px; background: #f8f9fa;">${match}</div>`;
  });
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
    const response = await fetch(`${BACKEND_URL}/news/`);
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
    const response = await fetch(`${BACKEND_URL}/categories/`);
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
    const response = await fetch(`${BACKEND_URL}/filter/?category=${encodeURIComponent(category)}`);
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
  const newsGrid = document.getElementById('newsGrid');
  const loadMoreContainer = document.getElementById('loadMoreContainer');
  
  if (newsData.length === 0) {
    newsGrid.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="${getIconClass(hasSearched ? 'SEARCH' : 'NEWS', 'DISPLAY', 'MUTED')}"></i>
        <h3 class="mt-3 text-muted">
          ${hasSearched ? 'По вашему запросу ничего не найдено' : 'Статьи не найдены'}
        </h3>
        <p class="text-muted">
          ${hasSearched ? 
            'Попробуйте изменить поисковый запрос или <button class="btn btn-link p-0 text-decoration-none" onclick="clearSearch()" style="color: #007bff;">очистить поиск</button>' : 
            'Попробуйте изменить критерии поиска.'
          }
        </p>
        ${hasSearched ? `
          <div class="mt-4">
            <button class="btn btn-outline-primary" onclick="clearSearch()">
              <i class="${getIconClass('BACK', 'SM')} me-2"></i>Показать все новости
            </button>
          </div>
        ` : ''}
      </div>
    `;
    loadMoreContainer.style.display = 'none';
    return;
  }

  const articlesToRender = newsData.slice(0, articlesToShow);
  
  newsGrid.innerHTML = articlesToRender.map((article, index) => `
    <div class="col-lg-3 col-md-6 mb-4">
      <article class="card h-100 shadow-lg border-0 hover-card fade-in-article" 
               style="animation-delay: ${index * 0.1}s">
        <img src="${article.image}" 
             alt="${article.title}" 
             class="card-img-top news-image rounded-top">
        <div class="card-body d-flex flex-column">
          <div class="mb-2">
            <span class="badge bg-gradient mb-2 px-3 py-2 rounded-pill text-white" 
                  style="font-size: 0.9rem;">
              ${article.category}
            </span>
          </div>
          <h5 class="card-title fw-bold mb-2 news-title">${article.title}</h5>
          <div class="card-text text-muted flex-grow-1 mb-2 news-excerpt" 
               style="overflow: hidden; text-overflow: ellipsis;">
            <span>${getShortDescription(article.excerpt, 20)}</span>
          </div>
          <div class="mt-auto">
            <div class="d-flex justify-content-between align-items-center mb-3 news-meta">
              <small class="text-muted">
                <i class="${getIconClass('CALENDAR', 'XS')} me-1"></i>
                ${formatDateSafe(article.date)}
              </small>
              <small class="text-muted">
                <i class="${getIconClass('PERSON', 'XS')} me-1"></i>
                ${article.author || 'Новости Иркутска'}
              </small>
            </div>
            <a href="article.html?id=${article.id}" 
               class="btn btn-primary w-100 rounded-pill fw-bold">
              Читать далее <i class="${getIconClass('FORWARD', 'XS')} ms-1"></i>
            </a>
          </div>
        </div>
      </article>
    </div>
  `).join('');

  // Show/hide load more button
  if (articlesToShow < newsData.length) {
    loadMoreContainer.style.display = 'block';
  } else {
    loadMoreContainer.style.display = 'none';
  }
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

  // Regular categories
  categories.forEach(cat => {
    buttonsHTML += `
      <button class="btn btn-outline-secondary btn-sm rounded-pill ${selectedCategory === cat ? 'active' : ''}"
              style="background: ${selectedCategory === cat ? '#6c757d' : ''}; 
                     color: ${selectedCategory === cat ? 'white' : '#6c757d'}; 
                     font-weight: ${selectedCategory === cat ? 'bold' : 'normal'};"
              onclick="handleCategoryClick('${cat}')">
        ${cat}
      </button>
    `;
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
    
    // Fetch initial data
    const [newsData, categoriesData] = await Promise.all([
      fetchNews(),
      fetchCategories()
    ]);
    
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

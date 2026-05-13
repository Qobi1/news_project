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

function getShortDescription(text, wordCount = 20) {
  if (!text) return '';
  const plainText = String(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plainText) return '';
  const words = plainText.split(' ').filter(Boolean);
  if (!words.length) return '';
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
  const excerpt = buildCardExcerpt(apiNews, 14);
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


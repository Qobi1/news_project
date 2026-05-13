/**
 * Shared home / tag-hub event card grid rendering.
 * Uses script.js helpers when present; otherwise defines minimal fallbacks for tag-hub pages.
 */
(function (global) {
  const FALLBACK_ICONS = {
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

  function fallbackGetIconClass(iconType, size = "SM", variant) {
    const baseClass = FALLBACK_ICONS[iconType] || "bi bi-question-circle";
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

  function fallbackFormatDateSafe(dateString) {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (e) {
      return dateString;
    }
  }

  function fallbackStripHtmlToPlain(html) {
    if (!html) return "";
    try {
      const doc = new DOMParser().parseFromString(String(html), "text/html");
      const root = doc.body;
      root.querySelectorAll("script, style").forEach((el) => el.remove());
      root
        .querySelectorAll(
          "section.calendar-wrapper, section.j-calendar-wrapper, .calendar-wrapper.j-calendar-wrapper"
        )
        .forEach((el) => el.remove());
      return (root.textContent || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      return String(html)
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  function fallbackGetShortDescription(text, wordCount = 20) {
    const strip =
      typeof global.stripHtmlToPlain === "function"
        ? global.stripHtmlToPlain.bind(global)
        : fallbackStripHtmlToPlain;
    const plainText = strip(text);
    if (!plainText) return "";
    const words = plainText.split(" ").filter(Boolean);
    if (!words.length) return "";
    return words.length > wordCount
      ? words.slice(0, wordCount).join(" ") + "..."
      : plainText;
  }

  function cardExcerptLine(article, shortFn) {
    const line = shortFn(article.excerpt, 20);
    if (line) return line;
    if (article.title) {
      const fromTitle = shortFn(`Анонс: ${article.title}`, 20);
      if (fromTitle) return fromTitle;
    }
    if (article.category && article.author) {
      return `${article.category} · ${article.author}`;
    }
    if (article.category) return article.category;
    if (article.author) return article.author;
    return "Подробности мероприятия на странице события.";
  }

  function resolveHelper(name, fallback) {
    return typeof global[name] === "function" ? global[name].bind(global) : fallback;
  }

  function renderArticleCardsInner(articles, articlesToShow, options) {
    const getIcon = options.getIconClass || resolveHelper("getIconClass", fallbackGetIconClass);
    const fmt = options.formatDateSafe || resolveHelper("formatDateSafe", fallbackFormatDateSafe);
    const short = options.getShortDescription || resolveHelper("getShortDescription", fallbackGetShortDescription);
    const articlesToRender = articles.slice(0, articlesToShow);
    return articlesToRender
      .map(
        (article, index) => `
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
            <span>${cardExcerptLine(article, short)}</span>
          </div>
          <div class="mt-auto">
            <div class="d-flex justify-content-between align-items-center mb-3 news-meta">
              <small class="text-muted">
                <i class="${getIcon("CALENDAR", "XS")} me-1"></i>
                ${fmt(article.date)}
              </small>
              <small class="text-muted">
                <i class="${getIcon("PERSON", "XS")} me-1"></i>
                ${article.author || "Новости Иркутска"}
              </small>
            </div>
            <a href="/article.html?id=${article.id}"
               class="btn btn-primary w-100 rounded-pill fw-bold">
              Читать далее <i class="${getIcon("FORWARD", "XS")} ms-1"></i>
            </a>
          </div>
        </div>
      </article>
    </div>
  `
      )
      .join("");
  }

  function renderNewsGrid(options) {
    const {
      newsGridId = "newsGrid",
      loadMoreContainerId = "loadMoreContainer",
      newsData,
      articlesToShow,
      hasSearched = false,
      emptyVariant = "default",
      getIconClass: gic,
      formatDateSafe: fds,
      getShortDescription: gsd,
    } = options;

    const newsGrid = document.getElementById(newsGridId);
    const loadMoreContainer = document.getElementById(loadMoreContainerId);
    if (!newsGrid) return;

    const helpers = {
      getIconClass: gic || resolveHelper("getIconClass", fallbackGetIconClass),
      formatDateSafe: fds || resolveHelper("formatDateSafe", fallbackFormatDateSafe),
      getShortDescription: gsd || resolveHelper("getShortDescription", fallbackGetShortDescription),
    };

    if (newsData.length === 0) {
      if (emptyVariant === "tag") {
        newsGrid.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="${helpers.getIconClass("NEWS", "DISPLAY", "MUTED")}"></i>
        <p class="mt-3 text-muted lead mb-4">Сейчас нет активных событий, но посмотрите архив или другие рубрики</p>
        <a href="/" class="btn btn-outline-primary me-2 rounded-pill">На главную</a>
        <a href="/calendar/irkutsk-2026" class="btn btn-outline-secondary rounded-pill">Календарь</a>
      </div>`;
      } else if (hasSearched) {
        newsGrid.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="${helpers.getIconClass("SEARCH", "DISPLAY", "MUTED")}"></i>
        <h3 class="mt-3 text-muted">По вашему запросу ничего не найдено</h3>
        <p class="text-muted">
          Попробуйте изменить поисковый запрос или <button class="btn btn-link p-0 text-decoration-none" onclick="clearSearch()" style="color: #007bff;">очистить поиск</button>
        </p>
        <div class="mt-4">
          <button class="btn btn-outline-primary" onclick="clearSearch()">
            <i class="${helpers.getIconClass("BACK", "SM")} me-2"></i>Показать все новости
          </button>
        </div>
      </div>`;
      } else {
        newsGrid.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="${helpers.getIconClass("NEWS", "DISPLAY", "MUTED")}"></i>
        <h3 class="mt-3 text-muted">Статьи не найдены</h3>
        <p class="text-muted">Попробуйте изменить критерии поиска.</p>
      </div>`;
      }
      if (loadMoreContainer) loadMoreContainer.style.display = "none";
      return;
    }

    newsGrid.innerHTML = renderArticleCardsInner(newsData, articlesToShow, helpers);

    if (loadMoreContainer) {
      loadMoreContainer.style.display =
        articlesToShow < newsData.length ? "block" : "none";
    }
  }

  global.EventGrid = { renderNewsGrid, renderArticleCardsInner };
})(typeof window !== "undefined" ? window : globalThis);

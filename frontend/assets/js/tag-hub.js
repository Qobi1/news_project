/**
 * SEO hub page: loads events via /hub-events/{hub}/?filter=slug (canonical = /{hub}/)
 */
(function () {
  let articlesToShow = 8;
  let cachedArticles = [];

  function mapApiNewsToArticle(apiNews) {
    return {
      id: apiNews.id,
      title: apiNews.title,
      excerpt: apiNews.description,
      content: apiNews.description,
      image: apiNews.image_url,
      category: apiNews.category,
      date: apiNews.datetime_str,
      author: apiNews.location,
    };
  }

  function showTagLoading(show) {
    const el = document.getElementById("tagHubLoading");
    if (el) el.style.display = show ? "block" : "none";
  }

  function renderTagGrid() {
    EventGrid.renderNewsGrid({
      newsGridId: "tagHubNewsGrid",
      loadMoreContainerId: "tagHubLoadMore",
      newsData: cachedArticles,
      articlesToShow,
      hasSearched: false,
      emptyVariant: "tag",
    });
    const btn = document.getElementById("tagHubLoadMoreBtn");
    if (btn) {
      btn.onclick = function () {
        articlesToShow += 4;
        renderTagGrid();
      };
    }
  }

  async function initTagHub() {
    const root =
      document.getElementById("hub-page-root") ||
      document.getElementById("tag-hub-root");
    if (!root) return;

    const hub = root.dataset.hub;
    if (!hub) return;

    const filter = (root.dataset.filter || "").trim();

    showTagLoading(true);
    try {
      const base = await resolveApiBaseUrl();
      let url = `${base}/hub-events/${hub}/`;
      if (filter) {
        url += `?filter=${encodeURIComponent(filter)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("hub-events failed");
      const data = await res.json();
      cachedArticles = data.map(mapApiNewsToArticle);
      articlesToShow = 8;
      renderTagGrid();
    } catch (e) {
      console.error(e);
      cachedArticles = [];
      renderTagGrid();
    } finally {
      showTagLoading(false);
    }
  }

  document.addEventListener("DOMContentLoaded", initTagHub);
})();

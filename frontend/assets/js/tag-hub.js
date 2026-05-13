/**
 * SEO hub page: loads events via /hub-events/{hub}/?filter=slug (canonical = /{hub}/)
 */
(function () {
  let articlesToShow = 8;
  let cachedArticles = [];

  function stripHtmlToPlain(html) {
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

  function isCalendarNoisePlain(plain) {
    const words = plain.split(/\s+/).filter(Boolean);
    if (words.length < 10) return false;
    const dayAbbrevs = new Set(["пн", "вт", "ср", "чт", "пт", "сб", "вс"]);
    const noise = words.filter(
      (w) => /^\d{1,2}$/.test(w) || dayAbbrevs.has(w.toLowerCase())
    ).length;
    return noise / words.length > 0.35;
  }

  function excerptForCard(api) {
    const plain = stripHtmlToPlain(api.description);
    if (plain.length >= 15 && !isCalendarNoisePlain(plain)) {
      return plain;
    }

    const loc = (api.location || "").trim();
    const cat = (api.category || "").trim();
    const orig = (api.original_title || "").trim();
    const title = (api.title || "").trim();
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
    if (bits.length) return bits.join(" · ");

    if (title) return `Анонс: ${title}. Подробности на странице события.`;
    return "Подробности мероприятия на странице события.";
  }

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

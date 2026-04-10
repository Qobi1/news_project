import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import time
import datetime
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from db.sql import save_events_to_db

BASE = "https://ircity.ru"

# --- Configure session with retries ---
session = requests.Session()
retries = Retry(
    total=5,                # total retry attempts
    backoff_factor=2,       # wait time between retries: 1s, 2s, 4s, 8s...
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["HEAD", "GET", "OPTIONS"]
)
adapter = HTTPAdapter(max_retries=retries)
session.mount("https://", adapter)
session.mount("http://", adapter)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

def fetch_html(url):
    """Fetch HTML safely with timeout, retries, and headers."""
    try:
        resp = session.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        resp.encoding = "utf-8"
        return resp.text
    except requests.exceptions.Timeout:
        print(f"⚠️ Timeout while connecting to {url}")
        return ""
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching {url}: {e}")
        return ""


def parse_all_events_page(html):
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.find_all("div", class_="eventBlockCard_6e5UD")
    events = []
    for card in cards:
        a = card.find("a", class_="eventCardLink_6e5UD")
        if not a or not a.get("href"):
            continue
        link = urljoin(BASE, a["href"])
        title_tag = card.find("span", class_="text_M7VvV")
        title = title_tag.text.strip() if title_tag else None
        rating_tag = card.find("span", class_="rating_M7VvV")
        rating = rating_tag.text.strip() if rating_tag else None

        age = None
        genres = None
        genre_div = card.find("div", class_="cardGenre_6e5UD")
        if genre_div:
            spans = [sp.text.strip() for sp in genre_div.find_all("span") if sp.text.strip()]
            if spans:
                age = spans[0]
            if len(spans) > 1:
                genres = ", ".join(sp for sp in spans[1:] if sp != "•")

        img_tag = card.find("img", class_="image_jQVQ9")
        image = img_tag["src"] if img_tag else None
        events.append({
            "title": title,
            "rating": rating,
            "age": age,
            "genres": genres,
            "image": image,
            "link": link,
        })
    return events


def parse_detail_page(html):
    soup = BeautifulSoup(html, "html.parser")
    data = {}
    h1 = soup.select_one("h1.eventsPageHeader_GcdpZ")
    data["title"] = h1.text.strip() if h1 else None
    data["tags"] = [t.text.strip() for t in soup.select(".eventTags_EBAV8 .text_rtUTQ")]

    rating_div = soup.find("div", class_="mt-6 text-style-title-4")
    if rating_div and "Рейтинг" in rating_div.text:
        parts = rating_div.text.split(":")
        data["rating"] = parts[1].strip() if len(parts) > 1 else None
    else:
        data["rating"] = None

    img = soup.select_one(".image_8k3Lo img")
    data["image"] = urljoin(BASE, img["src"]) if (img and img.has_attr("src")) else None

    description_block = soup.select_one(".eventDescription_VjDcs")
    if description_block:
        p = description_block.find("p")
        data["description"] = p.get_text(strip=True) if p else None
    else:
        data["description"] = None

    attributes = {}
    for row in soup.select(".eventBlockAttributes_GRBoh .attributeRow_GRBoh"):
        key_el = row.select_one(".attributeCategory_GRBoh")
        val_el = row.select_one(".attributeCategoryValue_GRBoh")
        if key_el and val_el:
            key = key_el.get_text(strip=True).replace(":", "")
            val = val_el.get_text(strip=True)
            attributes[key] = val
    data["attributes"] = attributes

    schedule = []
    for place in soup.select(".placeWrapper_kaBm6"):
        cinema = place.select_one(".text-style-title-4")
        address = place.select_one(".text-style-ui-caption-4")
        cinema_name = cinema.text.strip() if cinema else None
        address_str = address.text.strip() if address else None
        times = [s.text.strip() for s in place.select(".seanceItem_kaBm6")]
        schedule.append({
            "cinema": cinema_name,
            "address": address_str,
            "times": times
        })
    data["schedule"] = schedule

    gallery_images = []
    for img_tag in soup.select(".articleBlockSliderTiles_aF7A9 img.image_jQVQ9"):
        src = img_tag.get("src")
        if src:
            full_url = urljoin(BASE, src)
            gallery_images.append(full_url)

    data["gallery_images"] = gallery_images
    return data


def scrape_all(start_date):
    url = f"{BASE}/afisha/all-events/?startedAtGte={start_date}"
    print("Fetching main events page:", url)
    all_html = fetch_html(url)
    if not all_html:
        print("⚠️ Skipping date due to failed fetch.")
        return []
    events = parse_all_events_page(all_html)
    print("Found", len(events), "events on master page")

    full_data = []
    for idx, ev in enumerate(events, 1):
        print(f"[{idx}/{len(events)}] Fetching detail for: {ev['title']}")
        detail_html = fetch_html(ev["link"])
        if not detail_html:
            print("⚠️ Skipping due to empty detail page.")
            continue
        try:
            detail_info = parse_detail_page(detail_html)
            merged = {**ev, **detail_info, "date": start_date}
            full_data.append(merged)
        except Exception as e:
            print("❌ Error parsing", ev["link"], ":", e)
        time.sleep(0.5)
    return full_data


def calendar_parsing():
    all_results = []
    today = datetime.date.today()
    for i in range(21):  # next 21 days including today
        day = today + datetime.timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        print("\n📅 Parsing date:", day_str)
        results = scrape_all(day_str)
        if results:
            save_events_to_db(results)
            all_results.extend(results)
        time.sleep(1)

    print("\n✅ Finished scraping", len(all_results), "total events.")





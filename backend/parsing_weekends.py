import os
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

from slugify import slugify

from db.sql import insert_weekend_data


def parse_weekends_data():
    BASE_URL = "https://gorodzovet.ru"
    url = f"{BASE_URL}/irkutsk/weekend/"

    response = requests.get(url)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    os.makedirs("images", exist_ok=True)
    events = []

    for idx, event_div in enumerate(soup.select(".row.event"), start=1):
        title_tag = event_div.select_one(".event-name")
        image_tag = event_div.select_one(".event-image")
        desc_tag = event_div.select_one(".event-description")
        date_tag = event_div.select_one(".weekend-event-tags span")
        badge_tag = event_div.select_one(".badge")

        # Image URL
        img_url = None
        if image_tag:
            img_url = image_tag.get("data-src") or image_tag.get("src")

        # Download image
        image_path = None
        if img_url:
            parsed = urlparse(img_url)
            img_name = os.path.basename(parsed.path.strip("/"))
            if not img_name:
                img_name = f"event_{idx}.jpg"
            image_path = os.path.join("images", img_name)
            try:
                img_resp = requests.get(img_url, timeout=10)
                img_resp.raise_for_status()
                with open(image_path, "wb") as f:
                    f.write(img_resp.content)
            except Exception as e:
                print(f"⚠️ Failed to download image {img_url}: {e}")
                image_path = None

        # Event URL + slug
        event_url = f"{BASE_URL}{title_tag['href']}" if title_tag and title_tag.has_attr("href") else None
        if title_tag and title_tag.has_attr("href"):
            href = title_tag["href"].strip()
            slug = "event/" + href.split("/")[-1]
        else:
            title_text = title_tag.get_text(strip=True) if title_tag else str(uuid.uuid4())[:8]
            slug = 'event/' + slugify(title_text)

        # Fetch full description and details
        full_description_html = None
        schedules_html = None
        price = None
        place = None

        if event_url:
            try:
                detail_resp = requests.get(event_url)
                detail_resp.raise_for_status()
                detail_soup = BeautifulSoup(detail_resp.text, "html.parser")

                # Full description
                text_block = (
                    detail_soup.select_one(".eventText .container.container--padding")
                    or detail_soup.select_one(".eventText")
                    or detail_soup.select_one(".container.container--padding")
                )
                if text_block:
                    full_description_html = str(text_block)

                # Schedules
                schedule_container = detail_soup.select_one(".eventPreview__info")
                if schedule_container:
                    schedules_html = str(schedule_container)

                # ✅ Price
                price_block = detail_soup.select_one(".data:has(.dataLabel:-soup-contains('Стоимость'))")
                if price_block:
                    # remove label text, strip SVG and spaces
                    price = price_block.get_text(" ", strip=True).replace("Стоимость", "").strip()

                # ✅ Place
                place_block = detail_soup.select_one(".data:has(.dataLabel:-soup-contains('Место'))")
                if place_block:
                    place = place_block.get_text(" ", strip=True).replace("Место", "").strip()

            except Exception as e:
                print(f"⚠️ Failed to fetch details for {event_url}: {e}")

            time.sleep(1)

        event = {
            "title": title_tag.get_text(strip=True) if title_tag else None,
            "image_path": image_path,
            "description": desc_tag.get_text(" ", strip=True).split("…")[0] if desc_tag else None,
            "full_description_html": full_description_html,
            "schedules_html": schedules_html,
            "date": date_tag.get_text(strip=True) if date_tag else None,
            "day": badge_tag.get_text(strip=True) if badge_tag else None,
            "slug": slug,
            "price": price,
            "place": place,
        }
        
        insert_weekend_data(event)
        events.append(event)
        


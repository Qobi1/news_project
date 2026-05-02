import os, time, re
import requests
import schedule
from bs4 import BeautifulSoup
import pytz
from datetime import datetime
from db.sql import insert_event
from openai import OpenAI
from urllib.parse import urljoin
from config import BASE_URL as PUBLIC_BASE_URL
from parsing_weekends import parse_weekends_data
from parsing_calendar import calendar_parsing


ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)?)?$")
def to_iso_or_empty(s: str) -> str:
    if not isinstance(s, str):
        return ""
    s = s.strip()
    return s if ISO_RE.match(s) else ""

USE_LLM = os.getenv("USE_LLM", "0") == "1"

IRK_RU_BASE = "https://www.irk.ru"
MOSCOW_TZ = pytz.timezone("Europe/Moscow")
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
client = OpenAI(api_key=OPENAI_API_KEY)

def get_unique_title(text):
    prompt = f"Перепиши заголовок события так, чтобы он оставался информативным и привлекательным, сохранив смысл и ключевые факты. Используй другие слова и выражения, сделай текст естественным для чтения на русском языке: {text}"
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": prompt}],
        temperature=0.7
    )
    return response.choices[0].message.content


def get_unique_description(text):
    prompt = (
        "Перепиши текст описания события, сохранив смысл, контекст и все ключевые факты "
        "(дата, место, имена, события). Используй разные формулировки, сделай текст более "
        "плавным и интересным для чтения на русском языке.\n\n"
        "Важно:\n"
        "1. Все HTML-теги (<p>, <a>, <strong>, <img> и т.д.) должны остаться на месте.\n"
        "2. Удали все ссылки и атрибуты, кроме <img src> (оставь только изображения).\n"
        "3. Полностью убери все кнопки с ссылками (например, элементы <a> или <button>, ведущие "
        "на соцсети, рекламные сайты, внешние ресурсы).\n"
        "4. Не добавляй новой информации, только перефразируй текст внутри тегов.\n"
        "5. **НЕ добавляй ```html``` или любые кодовые блоки, возвращай только HTML контент без обрамляющих символов.**\n\n"
        f"Текст для обработки:\n{text}"
    )

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": prompt}],
        temperature=0.7
    )
    return response.choices[0].message.content


def parse_event_detail(url):
    res = requests.get(url)
    res.encoding = "utf-8"
    soup = BeautifulSoup(res.text, "html.parser")

    # Main article
    desc_el = soup.select_one(".event__content") or soup.find("article") or soup.find("main")
    if desc_el:
        # Replace all <img> in the article
        for img in desc_el.select("img"):
            src = img.get("src")
            if src:
                saved_url = download_image(urljoin(url, src))
                if saved_url:
                    img["src"] = saved_url

        description = str(desc_el)
    else:
        description = ""

    # Gallery images
    gallery_imgs = soup.select(".event-gallery__item img")
    for img in gallery_imgs:
        src = img.get("src")
        if src:
            saved_url = download_image(urljoin(url, src))
            if saved_url:
                description += f'<img src="{saved_url}" />'

    # Place
    place_name = soup.select_one("#schedule-events .schedule-event__place-name")
    place_addr = soup.select_one("#schedule-events .schedule-event__place-address")
    place = " — ".join([
        place_name.get_text(strip=True) if place_name else "",
        place_addr.get_text(strip=True) if place_addr else ""
    ]).strip(" —")

    return place, description


def download_image(image_url: str) -> str | None:
    IMAGES_FOLDER = "images"
    os.makedirs(IMAGES_FOLDER, exist_ok=True)
    try:
        original_name = image_url.split("/")[-1]
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{timestamp}_{original_name}"
        filepath = os.path.join(IMAGES_FOLDER, filename)

        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(image_url, headers=headers, timeout=10)

        if response.status_code == 200:
            with open(filepath, "wb") as f:
                f.write(response.content)
            print(f"Image saved to {filepath}")

            # Return full URL instead of backend path
            file_url = f"{PUBLIC_BASE_URL}/images/{filename}"
            return file_url
        else:
            print(f"Failed to download image, status code: {response.status_code}")
            return None
    except Exception as e:
        print(f"Error downloading image: {e}")
        return None

def parse_listing():
    url = IRK_RU_BASE + "/afisha/"
    res = requests.get(url)
    res.encoding = "utf-8"
    soup = BeautifulSoup(res.text, "html.parser")

    events = []

    for card in soup.select("div.cards__item article.afisha-article__article"):
        title = card.select_one("h4.afisha-article__title > a.afisha-article__title-link").get_text(strip=True)

        # Дата и время
        date_el = card.select_one(".afisha-article__date time")
        date_time = date_el.get("datetime") if date_el else None
        date_text = date_el.get_text(strip=True) if date_el else None

        # Категория
        category = card.select_one(".afisha-article__genre")
        category = category.get_text(strip=True) if category else None

        # Картинка
        img = card.select_one(".afisha-article__figure img")
        img_url = img["src"] if img else None

        # Ссылка
        link_tag = card.select_one(".afisha-article__link") or card.select_one("a.g-all-block-link")
        link_url = IRK_RU_BASE + link_tag["href"] if link_tag else None

        # 👉 Переходим на страницу события
        place, description = (None, None)
        if link_url:
            try:
                place, description = parse_event_detail(link_url)
            except Exception as e:
                print(f"Ошибка при парсинге {link_url}: {e}")

        if any(x is None for x in [title, date_text, description, img_url, category, link_url]):
            continue

        original_title = title
        title = get_unique_title(title)
        description = get_unique_description(description)
        link = download_image(image_url=img_url)        

        event_data = {
            "original_title": original_title,
            "title": title,
            "datetime_str": date_text or "",
            "datetime_iso": to_iso_or_empty(date_time),
            "location": place or "",
            "description": description or "",
            "image_url": img_url or "",
            "category": (category or "").strip(),
            "link": link_url or "",
            "created_at": datetime.now(MOSCOW_TZ).isoformat()  # ← строка ISO
        }
        if date_text is None or date_time is None:
            break

        # 👇 insert after parsing each event
        if not event_data["datetime_iso"]:
            event_data["datetime_iso"] = None  # пустые/невалидные — в NULL
        insert_event(event_data)
        events.append(event_data)
    return events


def job():
    now = datetime.now(MOSCOW_TZ)
    print(f"\n⏰ Running parser at {now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    data = parse_listing()
    calendar_parsing_data = calendar_parsing()
    parsing_weekend_data = parse_weekends_data()


def run_at_moscow_10():
    now = datetime.now(MOSCOW_TZ)
    if now.hour == 7 and now.minute == 17:
        job()

if __name__ == "__main__":
    # Run check every minute
    schedule.every().minute.do(run_at_moscow_10)

    while True:
        schedule.run_pending()
        time.sleep(1)

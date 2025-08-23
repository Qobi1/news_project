import requests
from bs4 import BeautifulSoup
import schedule
import time
import pytz
from datetime import datetime

from db.sql import insert_event

BASE_URL = "https://www.irk.ru"
MOSCOW_TZ = pytz.timezone("Asia/Tashkent")


def parse_event_detail(url):
    res = requests.get(url)
    res.encoding = "utf-8"
    soup = BeautifulSoup(res.text, "html.parser")

    # Описание (весь текст статьи)
    desc_el = soup.select_one("section.afisha-section article.event-article")
    description = desc_el.get_text(" ", strip=True) if desc_el else None

    # Место (3-я колонка в таблице)
    place_el = soup.select_one(".schedule-table__tr td:nth-of-type(3)")
    place = place_el.get_text(strip=True) if place_el else None

    return place, description


def parse_listing():
    url = BASE_URL + "/afisha/"
    res = requests.get(url)
    res.encoding = "utf-8"
    soup = BeautifulSoup(res.text, "html.parser")

    events = []

    for card in soup.select("li.grid-list__item article"):
        title = card.select_one(".afisha-article__title a").get_text(strip=True)

        # Дата и время
        date_el = card.select_one(".afisha-article__date time")
        date_time = date_el.get("datetime") if date_el else None
        date_text = date_el.get_text(strip=True) if date_el else None

        # Категория
        category = card.select_one(".afisha-article__event")
        category = category.get_text(strip=True) if category else None

        # Картинка
        img = card.select_one(".afisha-article__figure img")
        img_url = img["src"] if img else None

        # Ссылка
        link_tag = card.select_one(".afisha-article__link")
        link_url = BASE_URL + link_tag["href"] if link_tag else None

        # 👉 Переходим на страницу события
        place, description = (None, None)
        if link_url:
            try:
                place, description = parse_event_detail(link_url)
            except Exception as e:
                print(f"Ошибка при парсинге {link_url}: {e}")

        event_data = {
            "title": title,
            "datetime_str": date_text,
            "datetime_iso": date_time,
            "location": place,
            "description": description,
            "image_url": img_url,
            "category": category,
            "link": link_url,
        }
        if date_text is None or date_time is None:
            break

        # 👇 insert after parsing each event
        insert_event(event_data)
        events.append(event_data)

    return events



def job():
    now = datetime.now(MOSCOW_TZ)
    print(f"\n⏰ Running parser at {now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    data = parse_listing()
    for e in data[:5]:  # печатаем первые 5
        print(e)



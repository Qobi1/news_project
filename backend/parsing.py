import requests
from bs4 import BeautifulSoup
import pytz
from datetime import datetime
from db.sql import insert_event
from openai import OpenAI
import os
from dotenv import load_dotenv
load_dotenv()


BASE_URL = "https://www.irk.ru"
MOSCOW_TZ = pytz.timezone("Asia/Tashkent")
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
print(OPENAI_API_KEY)
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
    prompt = f"""Перепиши текст описания события, сохранив смысл, контекст и все ключевые факты (дата, место, имена, события). Используй разные формулировки, сделай текст более плавным и интересным для чтения на русском языке.
Важно: все HTML-теги (<p>, <a>, <strong> и т.д.) должны остаться на месте, не изменяй и не удаляй их. Не добавляй новой информации, только перефразируй текст внутри тегов: {text}"""
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

    # Описание с HTML
    desc_el = soup.select_one("section.afisha-section article.event-article")
    description = str(desc_el) if desc_el else None

    # Добавляем картинки из галереи (content-slider)
    gallery_imgs = []
    for img in soup.select(".content-slider__item img"):
        gallery_imgs.append(img["src"])
    # Можно вставить в описание или хранить отдельно
    if gallery_imgs:
        description += "".join([f'<img src="{src}" />' for src in gallery_imgs])

    # Место
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

        title = get_unique_title(title)
        description = get_unique_description(description)

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



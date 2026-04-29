import hashlib
import os
from datetime import datetime
import json
import requests
from db.model import Event, Session, WeekendData, CalendarData




# Insert function
def _to_datetime_or_none(value):
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        v = value.strip()
        if not v:
            return None
        try:
            return datetime.fromisoformat(v.rstrip("Z"))  # на всякий убираем 'Z'
        except Exception:
            return None
    return None

def insert_event(event_data: dict):
    """Вставка одного события в БД с безопасной нормализацией дат."""
    session = Session()
    try:
        # created_at → всегда datetime
        ca = event_data.get("created_at")
        if isinstance(ca, str):
            try:
                event_data["created_at"] = datetime.fromisoformat(ca.rstrip("Z"))
            except Exception:
                event_data["created_at"] = datetime.utcnow()
        elif not isinstance(ca, datetime):
            event_data["created_at"] = datetime.utcnow()

        # datetime_iso → сначала парсим, если строка...
        dt = _to_datetime_or_none(event_data.get("datetime_iso"))
        # ...если не получилось — подставляем created_at (чтобы API не падало)
        event_data["datetime_iso"] = dt or event_data["created_at"]

        ev = Event(**event_data)
        session.add(ev)
        session.commit()
        return ev.id
    except Exception as e:
        session.rollback()
        print("❌ Error inserting event:", e)
    finally:
        session.close()


def insert_weekend_data(data: dict):
    """Insert a single WeekendData record into the database."""
    session = Session()
    try:
        # Rename `date` → `date_str` if passed
        if "date" in data:
            data["date_str"] = str(data.pop("date"))

        # Ensure date_str is a string
        if "date_str" in data and not isinstance(data["date_str"], str):
            data["date_str"] = str(data["date_str"])

        weekend = WeekendData(**data)
        session.add(weekend)
        session.commit()
        print("saved")
        return weekend.id

    except Exception as e:
        session.rollback()
        print("❌ Error inserting weekend data:", e)
        return None
    finally:
        session.close()


# Directory for media storage
MEDIA_DIR = os.path.join(os.path.dirname(__file__), "..", "images")
os.makedirs(MEDIA_DIR, exist_ok=True)
_download_cache = {}
def download_image(url, prefix=None):
    """Download an image once and return the local relative path."""
    try:
        if not url or not url.startswith("http"):
            return None

        # If we already downloaded this URL, reuse it
        if url in _download_cache:
            return _download_cache[url]

        # Create a unique filename
        ext = os.path.splitext(url.split("?")[0])[1] or ".jpg"
        hashed = hashlib.md5(url.encode()).hexdigest()[:10]
        if prefix:
            filename = f"{prefix}_{hashed}{ext}"
        else:
            filename = f"{hashed}{ext}"

        local_path = os.path.join(MEDIA_DIR, filename)
        rel_path = f"images/{filename}"

        # If file already exists locally, reuse it
        if os.path.exists(local_path):
            _download_cache[url] = rel_path
            return rel_path

        # Otherwise download it
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            with open(local_path, "wb") as f:
                f.write(resp.content)
            print("🖼️ Saved:", filename)
        else:
            print("⚠️ Failed to download:", url)

        _download_cache[url] = rel_path
        return rel_path

    except Exception as e:
        print("❌ Error downloading", url, ":", e)
        return None



def save_events_to_db(events):
    session = Session()

    print(len(events))
    # try:
    for ev in events:
        existing = (
            session.query(CalendarData)
            .filter(
                CalendarData.title == ev["title"],
                CalendarData.date == datetime.fromisoformat(ev["date"]).date()
            )
            .first()
        )
        if existing:
            continue

        main_image_path = download_image(ev.get("image"), prefix="main")

        gallery_urls = ev.get("gallery_images") or []
        local_gallery = []
        for idx, url in enumerate(gallery_urls):
            local_path = download_image(url, prefix=f"gallery_{idx}")
            if local_path:
                local_gallery.append(local_path)

        e = CalendarData(
            title=ev.get("title"),
            rating=ev.get("rating"),
            age=ev.get("age"),
            genres=ev.get("genres"),
            image=main_image_path,
            description=ev.get("description"),

            # Save readable Cyrillic JSON
            tags=json.dumps(ev.get("tags") or [], ensure_ascii=False),
            attributes=json.dumps(ev.get("attributes") or {}, ensure_ascii=False),
            schedule=json.dumps(ev.get("schedule") or [], ensure_ascii=False),
            gallery_images=json.dumps(local_gallery, ensure_ascii=False),

            date=datetime.fromisoformat(ev["date"]).date(),
        )

        session.add(e)
    
    session.commit()
    print("✅ Data saved successfully")












import json
import random
import calendar
from datetime import datetime, date, timedelta, timezone, time	
from typing import List, Optional
from starlette.responses import HTMLResponse
from starlette.templating import Jinja2Templates
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, distinct
from db.model import Event, WeekendData, CalendarData
from db.model import Session
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from fastapi.responses import Response
from sqlalchemy import func, and_, extract


app = FastAPI()

app.mount("/images", StaticFiles(directory="images"), name="images")
app.mount("/assets", StaticFiles(directory="../frontend/assets"), name="assets")
app.mount("/docs", StaticFiles(directory="../frontend/docs"), name="docs")
templates = Jinja2Templates(directory="../frontend")


# 👇 Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allow all headers
)
app.mount("/images", StaticFiles(directory='images'), name="images")

# --- Pydantic schema ---
class NewsBase(BaseModel):
    id: int
    original_title: str
    title: str
    datetime_str: str
    datetime_iso: Optional[datetime] = None
    location: str
    description: str
    image_url: Optional[str] = None
    category: Optional[str] = None
    # link: str

    class Config:
        from_attributes = True


class Weekend_data(BaseModel):
    id: int
    title: Optional[str] = None
    image_path: Optional[str] = None
    description: Optional[str] = None
    full_description_html: Optional[str] = None
    schedules_html: Optional[str] = None
    date_str: Optional[str] = None
    day: Optional[str] = None

    class Config:
        orm_mode = True




# --- Dependency to get DB session ---
def get_db():
    db = Session()
    try:
        yield db
    finally:
        db.close()


# --- Endpoints ---
@app.get("/news/", response_model=List[NewsBase])
def get_news(db: Session = Depends(get_db)):
    today = date.today()
    print("inside news")
    # Subquery: latest event id per original_title
    subq = (
        db.query(
            Event.original_title,
            func.max(Event.id).label("max_id")
        )
        .filter(func.date(Event.created_at) == today)
        .group_by(Event.original_title)
        .subquery()
    )

    # Join back to events to get full rows
    events = (
        db.query(Event)
        .join(subq, Event.id == subq.c.max_id)
        .order_by(Event.id.desc())
        .limit(20)
        .all()
    )

    if not events:
        yesterday = today - timedelta(days=1)
        subq = (
            db.query(
                Event.original_title,
                func.max(Event.id).label("max_id")
            )
            .filter(func.date(Event.created_at) == yesterday)
            .group_by(Event.original_title)
            .subquery()
        )

        events = (
            db.query(Event)
            .join(subq, Event.id == subq.c.max_id)
            .order_by(Event.id.desc())
            .limit(20)
            .all()
        )

    return events



@app.get("/news/{id}", response_model=NewsBase)
def get_news_detail(id: int, db: Session = Depends(get_db)):
    news = db.query(Event).filter(Event.id == id).first()
    if not news:
        raise HTTPException(status_code=404, detail="News not found")
    return news


@app.get("/random-news/", response_model=List[NewsBase])
def get_random_news(db: Session = Depends(get_db)):
    today = date.today()

    # Query today's events
    events = (
        db.query(Event)
        .filter(func.date(Event.created_at) == today)
        .all()
    )

    # If none, get yesterday’s events
    if not events:
        yesterday = today - timedelta(days=1)
        events = (
            db.query(Event)
            .filter(func.date(Event.created_at) == yesterday)
            .all()
        )

    # Pick up to 4 random events (if fewer exist, just return all)
    return random.sample(events, min(len(events), 4))



@app.get("/filter/", response_model=List[NewsBase])
def filter_news_by_category(
    category: Optional[str] = Query(None, description="Category to filter by"),
    db: Session = Depends(get_db)
):
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)

    # subquery to get latest created_at per original_title
    subquery = (
        db.query(
            Event.original_title,
            func.max(Event.created_at).label("max_created_at")
        )
        .filter(Event.created_at >= thirty_days_ago)
        .group_by(Event.original_title)
        .subquery()
    )

    # join back to get full Event rows
    query = (
        db.query(Event)
        .join(
            subquery,
            (Event.original_title == subquery.c.original_title) &
            (Event.created_at == subquery.c.max_created_at)
        )
    )

    if category:
        query = query.filter(Event.category == category)

    events = query.order_by(Event.created_at.desc()).all()
    return events


@app.get("/categories/", response_model=List[str])
def get_categories_last_30_days(db: Session = Depends(get_db)):
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)

    results = (
        db.query(distinct(Event.category))
        .filter(Event.created_at >= thirty_days_ago)
        .all()
    )

    # results is a list of tuples like [('sport',), ('politics',)]
    categories = [r[0] for r in results]
    return categories



@app.get("/sitemap.xml", response_class=Response)
def generate_sitemap(request: Request, db: Session = Depends(get_db)):
    """
    Generate sitemap.xml including:
    - Homepage
    - Event pages
    - CalendarData pages
    - WeekendData pages
    """
    base_url = "https://afisha.bestjourneymap.com"
    now = datetime.utcnow()

    events = db.query(Event).all()
    calendar_items = db.query(CalendarData).all()
    weekend_items = db.query(WeekendData).all()

    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]

    # Homepage
    xml_lines.append("  <url>")
    xml_lines.append(f"    <loc>{base_url}/</loc>")
    xml_lines.append(f"    <lastmod>{now.strftime('%Y-%m-%d')}</lastmod>")
    xml_lines.append("    <changefreq>daily</changefreq>")
    xml_lines.append("    <priority>1.0</priority>")
    xml_lines.append("  </url>")

    # Event pages
    for event in events:
        event_url = f"{base_url}/article.html?id={event.id}"
        lastmod = event.created_at or now
        xml_lines.append("  <url>")
        xml_lines.append(f"    <loc>{event_url}</loc>")
        xml_lines.append(f"    <lastmod>{lastmod.strftime('%Y-%m-%d')}</lastmod>")
        xml_lines.append("    <changefreq>daily</changefreq>")
        xml_lines.append("    <priority>0.8</priority>")
        xml_lines.append("  </url>")

    # CalendarData pages
    for item in calendar_items:
        calendar_url = f"{base_url}/calendar/event/{item.id}"
        lastmod = item.created_at or now
        xml_lines.append("  <url>")
        xml_lines.append(f"    <loc>{calendar_url}</loc>")
        xml_lines.append(f"    <lastmod>{lastmod.strftime('%Y-%m-%d')}</lastmod>")
        xml_lines.append("    <changefreq>daily</changefreq>")
        xml_lines.append("    <priority>0.8</priority>")
        xml_lines.append("  </url>")

    # WeekendData pages
    for weekend in weekend_items:
        if weekend.slug:
            weekend_url = f"{base_url}/{weekend.slug}"
            lastmod = weekend.created_at or now
            xml_lines.append("  <url>")
            xml_lines.append(f"    <loc>{weekend_url}</loc>")
            xml_lines.append(f"    <lastmod>{lastmod.strftime('%Y-%m-%d')}</lastmod>")
            xml_lines.append("    <changefreq>daily</changefreq>")
            xml_lines.append("    <priority>0.8</priority>")
            xml_lines.append("  </url>")

    xml_lines.append("</urlset>")
    xml_content = "\n".join(xml_lines)

    return Response(content=xml_content, media_type="application/xml")



@app.get("/weekend/irkutsk-{year}-{month}/", response_class=HTMLResponse)
def get_weekend_data_by_month(
    request: Request,
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    # ✅ Validate month number
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Invalid month (must be 1–12)")

    # Step 1: Get the latest datetime entry for that month/year
    last_datetime_in_db = (
        db.query(func.max(WeekendData.created_at))
        .filter(
            and_(
                extract('year', WeekendData.created_at) == year,
                extract('month', WeekendData.created_at) == month
            )
        )
        .scalar()
    )

    # Step 2: If no data found, return empty list
    if not last_datetime_in_db:
        data = []
    else:
        # Extract only the date portion (ignore time)
        last_date_in_db = last_datetime_in_db.date()
        # Step 3: Query all records from that exact date (using range to avoid timezone issues)
        start_of_day = datetime.combine(last_date_in_db, datetime.min.time(), tzinfo=timezone.utc)
        end_of_day = start_of_day + timedelta(days=1)

        data = (
            db.query(WeekendData)
            .filter(
                WeekendData.created_at >= start_of_day,
                WeekendData.created_at < end_of_day
            )
            .all()
        )
    # Step 4: Convert relative image paths to absolute URLs
    result = []
    for item in data:
        obj = item.__dict__.copy()
        image_path = obj.get("image_path")
        if image_path:
            obj["image_path"] = f"{request.base_url}{image_path}".replace("\\", "/")
        result.append(obj)

    # Step 5: Render the HTML template
    return templates.TemplateResponse(
        "weekend.html",
        {
            "request": request,
            "data": result,
            "year": year,
            "month": month
        }
    )


@app.get("/event/{slug}", response_class=HTMLResponse)
def event_detail(slug: str, request: Request, db: Session = Depends(get_db)):
    event = db.query(WeekendData).filter(WeekendData.slug == f"event/{slug}").first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return templates.TemplateResponse("weekend-details.html", {"request": request, "event": event})





@app.get("/calendar/irkutsk-{year}", response_class=HTMLResponse)
async def calendar_irkutsk(
    request: Request,
    year: int,
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Renders calendar.html for today's events in Irkutsk for given year.
    Example: /calendar/irkutsk-2025
    """
    # If date range is provided, filter by CalendarData.date between start and end (inclusive)
    if start and end:
        try:
            start_date = date.fromisoformat(start)
            end_date = date.fromisoformat(end)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD for 'start' and 'end'")

        if start_date > end_date:
            start_date, end_date = end_date, start_date

        # Deduplicate by title within range, keeping the latest created_at per title
        latest_per_title_subq = (
            db.query(
                CalendarData.title,
                func.max(CalendarData.created_at).label("latest")
            )
            .filter(and_(CalendarData.date >= start_date, CalendarData.date <= end_date))
            .group_by(CalendarData.title)
            .subquery()
        )

        events_raw = (
            db.query(CalendarData)
            .join(
                latest_per_title_subq,
                (CalendarData.title == latest_per_title_subq.c.title)
                & (CalendarData.created_at == latest_per_title_subq.c.latest)
            )
            .order_by(CalendarData.created_at.desc())
            .all()
        )

        # Normalize image paths to be root-relative (avoid /calendar/ prefix due to relative resolution)
        events = []
        for item in events_raw:
            obj = item.__dict__.copy()
            image_path = obj.get("image")
            if image_path:
                if not (str(image_path).startswith("http://") or str(image_path).startswith("https://")):
                    obj["image"] = "/" + str(image_path).lstrip("/")
            events.append(obj)

        return templates.TemplateResponse(
            "calendar.html",
            {
                "request": request,
                "year": year,
                "city": "Иркутск",
                "events": events,
                "start": start,
                "end": end,
            },
        )

    # Default: show yesterday's latest entries grouped by latest created_at per title
    yesterday = date.today() - timedelta(days=1)
    start_of_day = datetime.combine(yesterday, time.min)
    end_of_day = datetime.combine(yesterday, time.max)

    subq = (
        db.query(
            CalendarData.title,
            func.max(CalendarData.created_at).label("latest")
        )
        .filter(and_(CalendarData.created_at >= start_of_day, CalendarData.created_at <= end_of_day))
        .group_by(CalendarData.title)
        .subquery()
    )

    events_raw = (
        db.query(CalendarData)
        .join(subq, (CalendarData.title == subq.c.title) & (CalendarData.created_at == subq.c.latest))
        .order_by(CalendarData.created_at.desc())
        .all()
    )

    # Normalize image paths (root-relative)
    events = []
    for item in events_raw:
        obj = item.__dict__.copy()
        image_path = obj.get("image")
        if image_path:
            if not (str(image_path).startswith("http://") or str(image_path).startswith("https://")):
                obj["image"] = "/" + str(image_path).lstrip("/")
        events.append(obj)

    return templates.TemplateResponse(
        "calendar.html",
        {
            "request": request,
            "year": year,
            "city": "Иркутск",
            "events": events,
            "start": yesterday.isoformat(),
        },
    )


@app.get("/calendar/event/{id}", response_class=HTMLResponse)
def calendar_event_detail(id: int, request: Request, db: Session = Depends(get_db)):
    event = db.query(CalendarData).filter(CalendarData.id == id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Normalize image paths to root-relative for safe rendering
    event_obj = event.__dict__.copy()
    image_path = event_obj.get("image")
    if image_path and not (str(image_path).startswith("http://") or str(image_path).startswith("https://")):
        event_obj["image"] = "/" + str(image_path).lstrip("/")

    # Normalize gallery images if present
    gallery = event_obj.get("gallery_images")
    # Parse gallery if stored as JSON string
    if isinstance(gallery, str):
        try:
            parsed_gallery = json.loads(gallery)
        except Exception:
            parsed_gallery = None
        if parsed_gallery is not None:
            gallery = parsed_gallery
    # If gallery is a dict, try common keys
    if isinstance(gallery, dict):
        if "images" in gallery and isinstance(gallery["images"], list):
            gallery = gallery["images"]
        elif "urls" in gallery and isinstance(gallery["urls"], list):
            gallery = gallery["urls"]
        else:
            gallery = list(gallery.values())
    # Normalize to list of strings
    norm_gallery = []
    if isinstance(gallery, list):
        for item in gallery:
            url = None
            if isinstance(item, str):
                url = item
            elif isinstance(item, dict):
                # Try common fields
                for key in ("url", "src", "image", "path"):
                    if key in item and isinstance(item[key], str):
                        url = item[key]
                        break
            if url:
                if not (url.startswith("http://") or url.startswith("https://")):
                    url = "/" + url.lstrip("/")
                norm_gallery.append(url)
    event_obj["gallery_images"] = norm_gallery

    # Normalize attributes into a human-readable list of strings
    attr_items = []
    raw_attrs = event_obj.get("attributes")
    if raw_attrs is not None:
        parsed = raw_attrs
        if isinstance(raw_attrs, str):
            try:
                parsed = json.loads(raw_attrs)
            except Exception:
                parsed = raw_attrs
        if isinstance(parsed, list):
            for it in parsed:
                try:
                    text = str(it).strip()
                    if text:
                        attr_items.append(text)
                except Exception:
                    pass
        elif isinstance(parsed, dict):
            for k, v in parsed.items():
                try:
                    text = f"{k}: {v}"
                    if text.strip():
                        attr_items.append(text)
                except Exception:
                    pass
        elif isinstance(parsed, str):
            s = parsed.strip()
            if s:
                # Strip outer quotes if present
                if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
                    s = s[1:-1]
                attr_items.append(s)

    # Deduplicate while preserving order
    seen = set()
    attributes_list = []
    for x in attr_items:
        if x not in seen:
            seen.add(x)
            attributes_list.append(x)
    event_obj["attributes_list"] = attributes_list

    # Normalize schedule to a list of entries with cinema, address, times[]
    schedule_norm = []
    raw_schedule = event_obj.get("schedule")
    if raw_schedule is not None:
        parsed = raw_schedule
        if isinstance(raw_schedule, str):
            try:
                parsed = json.loads(raw_schedule)
            except Exception:
                parsed = raw_schedule
        if isinstance(parsed, list):
            for entry in parsed:
                if isinstance(entry, dict):
                    cinema = entry.get("cinema") or entry.get("name") or entry.get("theater")
                    address = entry.get("address") or entry.get("addr")
                    times = entry.get("times") or entry.get("showtimes") or []
                    # coerce times to list of strings
                    norm_times = []
                    if isinstance(times, list):
                        for t in times:
                            try:
                                s = str(t).strip()
                                if s:
                                    norm_times.append(s)
                            except Exception:
                                pass
                    elif isinstance(times, str):
                        # split by commas
                        norm_times = [s.strip() for s in times.split(',') if s.strip()]
                    if cinema or address or norm_times:
                        schedule_norm.append({
                            "cinema": cinema or "",
                            "address": address or "",
                            "times": norm_times,
                        })
        elif isinstance(parsed, dict):
            # single entry dict
            cinema = parsed.get("cinema") or parsed.get("name") or parsed.get("theater")
            address = parsed.get("address") or parsed.get("addr")
            times = parsed.get("times") or parsed.get("showtimes") or []
            norm_times = times if isinstance(times, list) else [times]
            norm_times = [str(t).strip() for t in norm_times if str(t).strip()]
            if cinema or address or norm_times:
                schedule_norm.append({
                    "cinema": cinema or "",
                    "address": address or "",
                    "times": norm_times,
                })
    # Deduplicate schedule entries by cinema+address and merge times
    if schedule_norm:
        merged = {}
        for entry in schedule_norm:
            cinema_val = (entry.get("cinema") or "").strip()
            address_val = (entry.get("address") or "").strip()
            key = (cinema_val.lower(), address_val.lower())
            if key not in merged:
                merged[key] = {
                    "cinema": cinema_val,
                    "address": address_val,
                    "times": set(),
                }
            for t in entry.get("times", []):
                if isinstance(t, str):
                    s = t.strip()
                    if s:
                        merged[key]["times"].add(s)
        # Build final list with sorted times
        schedule_list = []
        for _, v in merged.items():
            times_sorted = sorted(v["times"])  # HH:MM strings sort correctly when zero-padded
            schedule_list.append({
                "cinema": v["cinema"],
                "address": v["address"],
                "times": times_sorted,
            })
        event_obj["schedule_list"] = schedule_list
    else:
        event_obj["schedule_list"] = []

    return templates.TemplateResponse(
        "calendar-event.html",
        {
            "request": request,
            "event": event_obj,
        },
    )

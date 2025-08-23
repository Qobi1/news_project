from datetime import datetime
from typing import List
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from db.model import Event
from db.model import Session
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()


# 👇 Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allow all headers
)



# --- Pydantic schema ---
class NewsBase(BaseModel):
    id: int
    title: str
    datetime_str: str
    datetime_iso: datetime
    location: str
    description: str
    image_url: str
    category: str
    link: str

    class Config:
        from_attributes = True


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
    return db.query(Event).order_by(Event.id.desc()).limit(20).all()


@app.get("/news/{id}", response_model=NewsBase)
def get_news_detail(id: int, db: Session = Depends(get_db)):
    news = db.query(Event).filter(Event.id == id).first()
    if not news:
        raise HTTPException(status_code=404, detail="News not found")
    return news

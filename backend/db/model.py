from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, func, JSON, Date
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime


Base = declarative_base()

# Define your table/model with English column names
class Event(Base):
    __tablename__ = 'events'

    id = Column(Integer, primary_key=True, autoincrement=True)
    original_title = Column(String(1024))
    title = Column(String(255))
    datetime_str = Column(String(255))   # original 'дата/время'
    datetime_iso = Column(DateTime)      # original 'дата_iso'
    location = Column(String(255))       # original 'место'
    description = Column(Text)           # original 'описание'
    image_url = Column(String(500))      # original 'изображение'
    category = Column(String(100))       # original 'категория'
    link = Column(String(500))           # original 'ссылка'
    created_at = Column(DateTime)


class WeekendData(Base):
    __tablename__ = 'weekend_data'
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(1024))
    image_path = Column(String(1024))
    description = Column(Text)
    full_description_html = Column(Text)
    schedules_html = Column(Text)
    date_str = Column(String(1024))
    day = Column(String(1024))
    created_at = Column(DateTime, default=datetime.utcnow)
    slug = Column(String(1024))
    price = Column(String(1024))
    place = Column(String(1024))



class CalendarData(Base):
    __tablename__ = "calendar_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255))
    rating = Column(String(50))
    age = Column(String(50))
    genres = Column(String(255))
    image = Column(Text)
    description = Column(Text)
    tags = Column(JSON)
    attributes = Column(JSON)
    schedule = Column(JSON)
    gallery_images = Column(JSON)
    date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<CalendarData(title={self.title}, date={self.date})>"



# Connect to the database (SQLite example)
engine = create_engine('sqlite:///../backend/events.db', echo=False) # server
# engine = create_engine('sqlite:///../backend/events.db', echo=False)
Base.metadata.create_all(engine)

Session = sessionmaker(bind=engine)
session = Session()




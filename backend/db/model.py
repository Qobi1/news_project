from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

Base = declarative_base()

# Define your table/model with English column names
class Event(Base):
    __tablename__ = 'events'

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255))
    datetime_str = Column(String(255))   # original 'дата/время'
    datetime_iso = Column(DateTime)      # original 'дата_iso'
    location = Column(String(255))       # original 'место'
    description = Column(Text)           # original 'описание'
    image_url = Column(String(500))      # original 'изображение'
    category = Column(String(100))       # original 'категория'
    link = Column(String(500))           # original 'ссылка'
    created_at = Column(DateTime)

# Connect to the database (SQLite example)
engine = create_engine('sqlite:///events.db', echo=True)
Base.metadata.create_all(engine)

Session = sessionmaker(bind=engine)
session = Session()



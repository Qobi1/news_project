from datetime import datetime
from db.model import Event, Session


# Insert function
def insert_event(event_data: dict):
    """Insert a single event into the database."""
    session = Session()
    try:
        # convert ISO date string if exists
        if "datetime_iso" in event_data and isinstance(event_data["datetime_iso"], str):
            event_data["datetime_iso"] = datetime.fromisoformat(event_data["datetime_iso"])

        event = Event(**event_data)
        session.add(event)
        session.commit()
        return event.id
    except Exception as e:
        session.rollback()
        print("❌ Error inserting event:", e)
    finally:
        session.close()




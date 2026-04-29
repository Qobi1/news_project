import os
import requests
from telegram import Bot
from dotenv import load_dotenv

load_dotenv()
token = os.getenv("TELEGRAM_BOT_TOKEN")
channel = os.getenv('TG_CHANNEL_ID')

bot = Bot(token)

def download_image(url):
    response = requests.get(url)
    with open("bot/image.jpg", "wb") as f:
        f.write(response.content)
    return path


async def tg_message(db_data):
    description = db_data.description
    title = db_data.title
    message = f"{title}\n\n{description}"
    await bot.send_photo(chat_id=channel, caption=message, photo=open('images/', 'rb'))
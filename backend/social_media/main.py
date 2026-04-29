import os
from telegram import Update, Bot
from telegram.ext import CallbackContext, Application, MessageHandler
from dotenv import load_dotenv

load_dotenv()
tg_channel_id = os.getenv('TG_CHANNEL_ID')
token = os.getenv('TELEGRAM_BOT_TOKEN')

async def tg_message(message):
    bot = Bot(token)
    await bot.send_message(chat_id=tg_channel_id, text=message)




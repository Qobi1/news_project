# run.py
import subprocess
import threading
import time
import schedule
from parsing import job   # <-- rename parser_file.py to the actual filename

def run_api():
    subprocess.run(["uvicorn", "api:app", "--reload"])

def run_parser():
    # schedule the parser
    schedule.every().day.at("23:31").do(job)

    print("📌 Parser scheduler started.")
    while True:
        schedule.run_pending()
        time.sleep(30)

if __name__ == "__main__":
    # Run parser in background thread
    threading.Thread(target=run_parser, daemon=True).start()
    # Run FastAPI server in main thread
    run_api()




# Natural Disaster Tracker — Local Setup Guide

This guide walks through setting up the project from scratch on a Windows, macOS, or Linux machine. Follow the steps in order.

---

## What you need before starting

- PostgreSQL 14 or higher
- PostGIS 3.x (spatial extension for PostgreSQL)
- Python 3.10 or higher
- A modern web browser (Chrome, Firefox, Edge)
- About 3 GB of free disk space for the datasets and database

---

## Step 1 — Install PostgreSQL and PostGIS

### Windows

1. Download the PostgreSQL installer from https://www.postgresql.org/download/windows/
2. Run the installer. When it asks which components to install, make sure **Stack Builder** is selected.
3. After the main installation finishes, Stack Builder will open automatically. Use it to install the **PostGIS** bundle (under "Spatial Extensions").
4. If Stack Builder doesn't open, you can install PostGIS separately from https://postgis.net/windows_downloads/

### macOS

```bash
brew install postgresql@14
brew install postgis
brew services start postgresql@14
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib postgis
sudo systemctl start postgresql
```

---

## Step 2 — Download the datasets

You need two files.

### 2a. IBTrACS cyclone dataset

1. Go to https://www.ncei.noaa.gov/products/international-best-track-archive
2. Under "Data Access", click on the CSV download link for **ibtracs.ALL.list.v04r01.csv**
   Direct link: https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.ALL.list.v04r01.csv
3. Save the file as `ibtracs.ALL.list.v04r01.csv` inside the project folder (same folder as `api_server.py`)

This file is about 200 MB and contains ~700,000 storm observations.

### 2b. NOAA Tsunami dataset

You can also download the dataset given in the repo (Preferable), but for customizable dataset follow below:

1. Go to https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-search
2. Leave all filters blank (to download everything) or set min year and click **Search**
3. Click **Download TSV** to export the results
4. You will get a file named something like `tsunamis-2026-XX-XX_XX-XX-XX.tsv`
5. Place this file anywhere on your machine and note the full path — you will need it in Step 7

---

## Step 3 — Install Python dependencies by enabling virtual environment

### 1️⃣ Create a Virtual Environment

Run this in your project directory:

```bash
python -m venv idp
```
This creates a folder named idp containing the environment.

---

### 2️⃣ Activate the Virtual Environment

#### ▶️ Windows (Command Prompt / PowerShell)

```bash
idp\Scripts\activate
```

#### ▶️ macOS / Linux

```bash
source venv/bin/activate
```

---

### 3️⃣ Verify Activation

After activation, your terminal should look like:

```bash
(venv) your-project-path>
```

---

### 4️⃣ Install Dependencies

`requirements.txt` file is given in repo with all the required libraries to run the application.

```bash
pip install -r requirements.txt
```

---

### 5️⃣ For Deactivate the Virtual Environment (when the work is completed)

```bash
deactivate
```

---


## Step 4 — Create the database

Open a terminal (or Command Prompt on Windows) and run:

```bash
psql -U postgres -c "CREATE DATABASE hazard_tracker;"
```

If prompted for a password, enter the password you set during PostgreSQL installation.

Then load the schema and all functions in one command:

```bash
psql -U postgres -d hazard_tracker -f setup_database.sql
```

You should see several `CREATE TABLE`, `CREATE INDEX`, and `CREATE FUNCTION` lines printed with no errors. If PostGIS is not installed correctly, this step will fail — go back to Step 1.

---


## Step 5 — Update database credentials in the Python files

Open each of the following files and update the `DB_CONFIG` block with your PostgreSQL username and password:

- `api_server.py`
- `import_data.py`
- `import_tsunami_data.py`

The block looks like this in each file:

```python
DB_CONFIG = {
    'dbname': 'hazard_tracker',
    'user': 'postgres',       # your PostgreSQL username
    'password': 'your_password_here',
    'host': 'localhost',
    'port': '5432'
}
```

---

## Step 6 — Import the cyclone data

Make sure `ibtracs.ALL.list.v04r01.csv` is in the project folder, then run:

```bash
python import_data.py
```

This reads the CSV, cleans the data, inserts all observations into `cyclone_points`, and builds the `cyclone_tracks` table with LineString geometries.

Expected time: 10–20 minutes depending on your machine.  
Expected output: confirmation of ~700,000 rows imported and ~14,000 tracks created.

---

## Step 7 — Import the tsunami data

Open `import_tsunami_data.py` and update the `TSV_FILE` path near the top of the file to point to the TSV file you downloaded in Step 2b:

```python
TSV_FILE = r'C:\full\path\to\your\tsunamis-file.tsv'   # Windows example
# TSV_FILE = '/Users/you/Downloads/tsunamis-file.tsv'  # macOS/Linux example
```

Then run:

```bash
python import_tsunami_data.py
```

Expected time: under a minute.  
Expected output: confirmation of several thousand tsunami events imported.

---

## Step 8 — Start the API server

```bash
python api_server.py
```

You should see output like:

```
CYCLONE TRACKER API SERVER
Starting server...
  - API URL: http://localhost:8000
  - API Docs: http://localhost:8000/docs
```

Leave this terminal open — the server needs to keep running while you use the app.

To verify it is working, open http://localhost:8000/health in your browser. You should see a JSON response with `"status": "healthy"` and counts of cyclones and tsunamis in the database.

---

## Step 9 — Open the frontend

Open a second terminal, go into the `frontend` folder, and start a simple HTTP server:

```bash
cd frontend
python -m http.server 8080
```

Then open http://localhost:8080 in your browser.

> Do not open `index.html` directly as a file (`file://...`). Some browsers block API calls when the page is loaded that way. Always use the local HTTP server.

---

## How to use the app

- Click anywhere on the world map to search for historical events near that point
- Use the **radius dropdown** (top left) to adjust the search area
- Switch between **Cyclones** and **Tsunamis** using the tabs on the left panel
- Click any row in the results table to highlight and zoom to that event's track on the map
- Use the **year filter** and **sort options** to narrow results
- Click **Download CSV** to export the current results

---

## Troubleshooting

**psql: command not found**  
On Windows, add the PostgreSQL `bin` folder to your system PATH (e.g. `C:\Program Files\PostgreSQL\14\bin`).

**PostGIS extension error when running setup_database.sql**  
PostGIS was not installed correctly. On Windows, re-run Stack Builder and install the PostGIS bundle. On Linux: `sudo apt install postgis postgresql-14-postgis-3`.

**import_data.py fails with connection error**  
Check that PostgreSQL is running and that the username/password in `DB_CONFIG` matches your installation.

**import_data.py fails with "column not found" or similar**  
Make sure the CSV file is the correct one (`ibtracs.ALL.list.v04r01.csv`) and that you placed it in the project root folder, not inside `frontend/`.

**API server starts but the frontend shows no results**  
Open the browser developer console (F12 → Console tab) and check for errors. The most common cause is the API server not running — confirm http://localhost:8000/health returns a healthy response.

**Wind risk analysis shows "insufficient data"**  
Try a larger search radius (200 km or 500 km). Some regions have sparse storm records.

---

## Project file overview

```
Code/
├── idp       — virtual enviroment folder
├── setup_database.sql       — run once to create all tables and functions
├── import_data.py           — imports IBTrACS cyclone data into the database
├── import_tsunami_data.py   — imports NOAA tsunami data into the database
├── api_server.py            — FastAPI backend, run this to start the server
├── requirements.txt         — Python dependencies
├── frontend/
│   ├── index.html           — main page
│   ├── style.css            — styles
│   └── script.js            — all frontend logic
└── tsu/
    └── tsunami_api.py       — tsunami API routes (auto-loaded by api_server.py)
```

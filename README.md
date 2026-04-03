# 🌀 Cyclone Tracker - Historical Cyclone Path Viewer

An interactive web application to visualize historical cyclone tracks and find all cyclones that passed through any location on Earth.

## 📋 Features

- **Interactive Map**: Click anywhere to find cyclones that passed through that location
- **Configurable Search Radius**: 50km to 500km
- **Visual Track Display**: See actual cyclone paths on the map
- **Detailed Information**: View cyclone names, dates, wind speeds, pressures, and more
- **Historical Data**: Complete IBTrACS dataset from 1842 to present

## 🏗️ Architecture

- **Frontend**: Plain HTML/CSS/JavaScript with Leaflet.js
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL with PostGIS extension
- **Data Source**: IBTrACS (International Best Track Archive for Climate Stewardship)

## 📦 Prerequisites

1. **PostgreSQL** (version 12 or higher)
2. **PostGIS extension** for PostgreSQL
3. **Python** (version 3.8 or higher)
4. **pip** (Python package manager)

## 🚀 Installation & Setup

### Step 1: Install Python Dependencies

```bash
pip install -r requirements.txt
```

### Step 2: Setup Database

1. Open PostgreSQL command line or pgAdmin

2. Create database:
```sql
CREATE DATABASE cyclone_tracker;
```

3. Connect to the database and run the setup script:
```bash
psql -U postgres -d cyclone_tracker -f database_setup.sql
```

Or manually copy and paste the SQL from `database_setup.sql`

### Step 3: Configure Database Connection

Edit both `import_data.py` and `api_server.py` and update the database credentials:

```python
DB_CONFIG = {
    'dbname': 'cyclone_tracker',
    'user': 'postgres',           # Your PostgreSQL username
    'password': 'your_password',  # Your PostgreSQL password
    'host': 'localhost',
    'port': '5432'
}
```

### Step 4: Import Cyclone Data

Run the data import script:

```bash
python import_data.py
```

This will:
- Read the IBTrACS CSV file
- Clean and validate the data
- Import ~700,000+ cyclone observations
- Generate LineString tracks for ~14,000+ cyclones
- Create spatial indexes

**Expected time**: 5-15 minutes depending on your system

### Step 5: Start the API Server

```bash
python api_server.py
```

The API will be available at:
- API Base: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

### Step 6: Open the Frontend

Simply open `frontend/index.html` in your web browser.

Or use a local server:
```bash
cd frontend
python -m http.server 8080
```

Then open: http://localhost:8080

## 📖 Usage

1. **Click on the Map**: Click anywhere on the world map
2. **View Results**: The right panel shows all cyclones found within the search radius
3. **Click on Cyclone Cards**: Click any cyclone to highlight its track on the map
4. **Adjust Search Radius**: Use the dropdown to change the search distance
5. **Clear Results**: Click "Clear All" to reset

## 📊 API Endpoints

### GET /api/cyclones-near
Find cyclones near a point

**Parameters:**
- `lat` (float): Latitude (-90 to 90)
- `lon` (float): Longitude (-180 to 180)
- `distance` (int): Search radius in meters (default: 100000)

**Example:**
```
http://localhost:8000/api/cyclones-near?lat=19.0760&lon=72.8777&distance=100000
```

### GET /api/track/{storm_id}
Get the track geometry for a specific cyclone

**Example:**
```
http://localhost:8000/api/track/2020296N27083
```

### GET /api/stats
Get database statistics

### GET /health
Health check endpoint

## 🗂️ Project Structure

```
Code/
├── database_setup.sql          # Database schema and functions
├── import_data.py             # Data import script
├── api_server.py              # FastAPI backend server
├── requirements.txt           # Python dependencies
├── ibtracs.ALL.list.v04r01.csv  # IBTrACS data
├── frontend/
│   ├── index.html            # Main HTML page
│   ├── style.css             # Styles
│   └── script.js             # Frontend logic
└── README.md                  # This file
```

## 🔧 Troubleshooting

### Database Connection Error
- Verify PostgreSQL is running
- Check username/password in DB_CONFIG
- Ensure database `cyclone_tracker` exists

### PostGIS Not Found
```sql
CREATE EXTENSION postgis;
```

### Import Fails
- Check CSV file path is correct
- Ensure you have enough disk space (~2GB)
- Check PostgreSQL logs for errors

### API Server Won't Start
- Ensure port 8000 is not in use
- Check Python dependencies are installed
- Verify database connection

### Frontend Can't Connect to API
- Ensure API server is running
- Check browser console for CORS errors
- Try using a local server instead of opening HTML directly

## 📈 Database Performance

The system uses:
- **GIST spatial index** on cyclone tracks for fast geographic queries
- **PostGIS geography type** for accurate distance calculations
- **Optimized queries** with proper indexing

Expected query performance:
- Search query: 50-200ms for 100km radius
- Track retrieval: 10-50ms per track

## 🌍 Data Source

**IBTrACS (International Best Track Archive for Climate Stewardship)**
- Website: https://www.ncei.noaa.gov/products/international-best-track-archive
- Version: v04r01
- Coverage: 1842 - Present
- Observations: 700,000+
- Unique Cyclones: 14,000+

## 🤝 Contributing

Feel free to improve this project:
- Add filters (by year, basin, intensity)
- Add heatmaps
- Export functionality
- Mobile optimization
- Additional data sources (tsunamis, earthquakes)

## 📄 License

This project uses public domain data from IBTrACS/NOAA.

## 👨‍💻 Author

Created for IDP Project - Semester 8

## 🙏 Acknowledgments

- NOAA for IBTrACS data
- PostGIS team for spatial database capabilities
- Leaflet.js for mapping library

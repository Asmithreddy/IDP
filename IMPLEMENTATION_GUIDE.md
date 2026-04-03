# 🚀 STEP-BY-STEP IMPLEMENTATION GUIDE

Follow these steps carefully to build your cyclone tracker from scratch.

---

## ✅ PHASE 1: VERIFY PREREQUISITES

### Step 1.1: Check PostgreSQL Installation

Open PowerShell and run:
```powershell
psql --version
```

You should see something like: `psql (PostgreSQL) 15.x`

If not installed, download from: https://www.postgresql.org/download/windows/

### Step 1.2: Verify PostGIS

Open PostgreSQL:
```powershell
psql -U postgres
```

Check PostGIS:
```sql
SELECT postgis_version();
```

If you get an error, install PostGIS extension from Application Stack Builder (comes with PostgreSQL installer).

---

## ✅ PHASE 2: DATABASE SETUP (10 minutes)

### Step 2.1: Create Database

In PostgreSQL (psql):
```sql
CREATE DATABASE cyclone_tracker;
\c cyclone_tracker
CREATE EXTENSION postgis;
SELECT PostGIS_Version();
```

**Expected Output:** Version number like `3.x.x`

### Step 2.2: Run Setup Script

Exit psql (`\q`), then in PowerShell:
```powershell
cd "c:\Users\asmit\Downloads\Semester 8\IDP\Code"
psql -U postgres -d cyclone_tracker -f database_setup.sql
```

**What this does:**
- Creates `cyclone_points` table (raw data)
- Creates `cyclone_tracks` table (LineStrings)
- Creates spatial indexes
- Creates query functions

**Verify tables created:**
```sql
psql -U postgres -d cyclone_tracker
\dt
```

You should see: `cyclone_points` and `cyclone_tracks`

---

## ✅ PHASE 3: PYTHON SETUP (5 minutes)

### Step 3.1: Install Python Packages

In PowerShell:
```powershell
cd "c:\Users\asmit\Downloads\Semester 8\IDP\Code"
pip install -r requirements.txt
```

**Packages installed:**
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `psycopg2-binary` - PostgreSQL adapter
- `pandas` - Data manipulation

### Step 3.2: Configure Database Credentials

**IMPORTANT:** Edit these two files with your PostgreSQL password:

1. Open `import_data.py` (line 15-21):
```python
DB_CONFIG = {
    'dbname': 'cyclone_tracker',
    'user': 'postgres',           # Your username
    'password': 'YOUR_PASSWORD',  # ← CHANGE THIS
    'host': 'localhost',
    'port': '5432'
}
```

2. Open `api_server.py` (line 13-19) and update the same:
```python
DB_CONFIG = {
    'dbname': 'cyclone_tracker',
    'user': 'postgres',           # Your username
    'password': 'YOUR_PASSWORD',  # ← CHANGE THIS
    'host': 'localhost',
    'port': '5432'
}
```

---

## ✅ PHASE 4: IMPORT DATA (10-15 minutes)

### Step 4.1: Run Import Script

```powershell
python import_data.py
```

**What happens:**
1. Reads CSV (722,986 rows)
2. Cleans data (removes invalid coordinates)
3. Imports to `cyclone_points` table
4. Generates LineStrings in `cyclone_tracks` table
5. Creates spatial indexes
6. Runs verification

**Expected Output:**
```
============================================================
CYCLONE DATA IMPORT SCRIPT
============================================================

✓ Connected to database successfully

📂 Reading CSV file: ibtracs.ALL.list.v04r01.csv
✓ Read 722,985 rows from CSV
✓ Cleaned data: 700,000+ valid rows
✓ Unique cyclones: 14,000+
✓ Year range: 1842 to 2024

📥 Importing data to database...
  Clearing existing data...
  Preparing data...
  Inserting 700,000+ records...
✓ Successfully imported records

🗺️  Generating cyclone tracks (LineStrings)...
✓ Successfully created 14,000+ cyclone tracks

✅ Verification:
  - Total points: 700,000+
  - Unique cyclones: 14,000+
  - Tracks created: 14,000+
  - Found X cyclones near Mumbai

============================================================
✓ IMPORT COMPLETED SUCCESSFULLY!
============================================================
```

**If you get errors:**
- Check database credentials
- Ensure CSV file exists
- Check PostgreSQL is running

### Step 4.2: Verify Data Manually

```sql
psql -U postgres -d cyclone_tracker

-- Count records
SELECT COUNT(*) FROM cyclone_points;  -- Should be ~700,000+
SELECT COUNT(*) FROM cyclone_tracks;  -- Should be ~14,000+

-- View sample track
SELECT sid, name, season, point_count, start_time 
FROM cyclone_tracks 
ORDER BY season DESC 
LIMIT 5;

-- Test query near Mumbai
SELECT * FROM find_cyclones_near_point(19.0760, 72.8777, 100000);
```

---

## ✅ PHASE 5: START BACKEND API (2 minutes)

### Step 5.1: Run API Server

Open a **NEW PowerShell window**:
```powershell
cd "c:\Users\asmit\Downloads\Semester 8\IDP\Code"
python api_server.py
```

**Expected Output:**
```
============================================================
CYCLONE TRACKER API SERVER
============================================================

Starting server...
  - API URL: http://localhost:8000
  - API Docs: http://localhost:8000/docs
  - Health Check: http://localhost:8000/health

Press Ctrl+C to stop

INFO:     Started server process [12345]
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 5.2: Test API

Open browser and visit:
- http://localhost:8000/health
- http://localhost:8000/docs (Interactive API documentation)

**Test a query:**
http://localhost:8000/api/cyclones-near?lat=19.0760&lon=72.8777&distance=100000

You should see JSON response with cyclone data.

---

## ✅ PHASE 6: OPEN FRONTEND (1 minute)

### Step 6.1: Open in Browser

**Option A:** Direct File (may have CORS issues)
```
File → Open → Navigate to:
c:\Users\asmit\Downloads\Semester 8\IDP\Code\frontend\index.html
```

**Option B:** Local Server (Recommended)
Open a **THIRD PowerShell window**:
```powershell
cd "c:\Users\asmit\Downloads\Semester 8\IDP\Code\frontend"
python -m http.server 8080
```

Then open browser: http://localhost:8080

### Step 6.2: Test the Interface

1. **You should see:** A world map with a header "Cyclone Tracker"
2. **Click anywhere** on the map
3. **Wait 2-3 seconds**
4. **Results appear** in the right panel
5. **Click on a cyclone card** to highlight its track
6. **Cyclone path appears** on the map as a colored line

---

## ✅ TESTING LOCATIONS

Try clicking these locations to see results:

### 🌀 High Activity Areas:

1. **Bay of Bengal (India)**
   - Click: `19.0760° N, 72.8777° E` (Mumbai)
   - Expected: Many cyclones

2. **North Atlantic (USA)**
   - Click: `29.9511° N, -90.0715° W` (New Orleans)
   - Expected: Hurricanes

3. **Northwest Pacific (Philippines)**
   - Click: `14.5995° N, 120.9842° E` (Manila)
   - Expected: Typhoons

4. **South Indian Ocean**
   - Click: `-20.1609° S, 57.5012° E` (Mauritius)
   - Expected: Tropical cyclones

5. **North Pacific (Mexico)**
   - Click: `16.8531° N, -99.8237° W` (Acapulco)
   - Expected: Hurricanes

---

## 🎯 EXPECTED RESULTS

### What You Should See:

1. **Click on map** → Red dot appears with search circle
2. **Results panel** shows:
   - Number of cyclones found
   - Search location coordinates
   - List of cyclone cards
3. **Map shows** colored lines (cyclone tracks)
4. **Click cyclone card** → Track highlights
5. **Change distance** → Different results

### Performance:
- Query time: 50-200ms
- Track loading: 1-3 seconds for 10+ cyclones
- Smooth map interactions

---

## 🔧 TROUBLESHOOTING

### Problem: "Database connection failed"
**Solution:**
- Check PostgreSQL is running: `pg_ctl status`
- Verify credentials in `api_server.py`
- Test connection: `psql -U postgres -d cyclone_tracker`

### Problem: "No module named 'fastapi'"
**Solution:**
```powershell
pip install -r requirements.txt
```

### Problem: "Table cyclone_tracks does not exist"
**Solution:**
```powershell
python import_data.py
```

### Problem: "API server can't start - port in use"
**Solution:**
```powershell
# Find process using port 8000
netstat -ano | findstr :8000

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or use different port in api_server.py (line 282):
uvicorn.run(app, host="0.0.0.0", port=8001)
```

### Problem: "Frontend shows no cyclones"
**Solution:**
- Check API is running: http://localhost:8000/health
- Open browser console (F12) → Check for errors
- Verify CORS: Use local server instead of opening HTML directly

### Problem: "Map not loading"
**Solution:**
- Check internet connection (Leaflet loads from CDN)
- Check browser console for errors
- Try different browser

---

## 📊 PERFORMANCE OPTIMIZATION

If queries are slow:

```sql
-- Verify indexes exist
\d cyclone_tracks

-- Rebuild spatial index
REINDEX INDEX idx_cyclone_path_gist;

-- Analyze tables
ANALYZE cyclone_points;
ANALYZE cyclone_tracks;

-- Check query performance
EXPLAIN ANALYZE 
SELECT * FROM find_cyclones_near_point(19.0760, 72.8777, 100000);
```

---

## 🎓 UNDERSTANDING THE SYSTEM

### How It Works:

1. **User clicks map** → Sends lat/lon to API
2. **API queries PostgreSQL** → Uses PostGIS spatial functions
3. **PostGIS finds tracks** → Uses `ST_DWithin` on LineStrings
4. **API returns results** → JSON with cyclone data
5. **Frontend displays** → Draws tracks on map

### Key Technologies:

- **PostGIS `ST_MakeLine`**: Converts points → LineString
- **PostGIS `ST_DWithin`**: Finds geometries within distance
- **GIST Index**: Spatial index for fast queries
- **Geography Type**: Accurate Earth distance calculations
- **Leaflet.js**: Interactive map rendering

---

## 📈 NEXT STEPS

### Enhancements You Can Add:

1. **Filters**
   - Filter by year range
   - Filter by basin (Atlantic, Pacific, etc.)
   - Filter by intensity (wind speed)

2. **Visualizations**
   - Heatmap of cyclone activity
   - Animation of cyclone movement
   - Intensity color coding

3. **Export**
   - Download results as CSV
   - Generate report PDF
   - Share search URL

4. **Advanced Features**
   - Multi-point selection
   - Path prediction
   - Climate analysis

---

## ✅ VERIFICATION CHECKLIST

- [ ] PostgreSQL installed and running
- [ ] PostGIS extension enabled
- [ ] Database `cyclone_tracker` created
- [ ] Python packages installed
- [ ] Data imported successfully (~700K points, ~14K tracks)
- [ ] API server running on port 8000
- [ ] API health check returns "healthy"
- [ ] Frontend loads in browser
- [ ] Map displays correctly
- [ ] Clicking map shows cyclones
- [ ] Cyclone tracks appear on map
- [ ] Clicking cards highlights tracks

---

## 🆘 GETTING HELP

If you're stuck:

1. **Check logs**: Look at terminal output for error messages
2. **Test each component**: Database → API → Frontend
3. **Verify versions**: Python 3.8+, PostgreSQL 12+, PostGIS 3+
4. **Check ports**: Ensure 8000 and 8080 are available
5. **Browser console**: F12 → Console tab for frontend errors

---

## 🎉 SUCCESS!

If everything works, you should be able to:
✓ Click anywhere on the world map
✓ See historical cyclones that passed through that location
✓ View detailed cyclone information
✓ See the actual cyclone paths on the map
✓ Adjust search radius
✓ Highlight specific cyclones

**You've successfully built a full-stack geospatial application!**

---

## 📝 NOTES

- Import takes 10-15 minutes (one-time only)
- Database size: ~2GB after import
- Query performance: 50-200ms typical
- Supports 700,000+ cyclone observations
- Data covers 1842 to present

Good luck with your project! 🚀

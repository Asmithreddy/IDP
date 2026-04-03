# 🔄 UPDATE INSTRUCTIONS - New Features Added

I've added the following features to your Cyclone Tracker:

## ✨ NEW FEATURES:

1. **📊 Table View** - Results displayed in a clean, sortable table
2. **🔄 Sorting Options:**
   - Distance (Near to Far) - Default
   - Wind Speed (High to Low) - N/A values at the end
   - Year (Recent to Old)
3. **📅 Year Range Filter** - Filter cyclones by year (e.g., 2000-2020)
4. **💾 CSV Download** - Download results as CSV file
5. **🎯 Click to Zoom** - Clicking table row highlights and zooms to cyclone track
6. **🎨 Color Coding** - Wind speeds color-coded (Red=High, Yellow=Medium, Green=Low)

---

## 🚀 HOW TO UPDATE YOUR SYSTEM

### STEP 1: Fix Database Function (CRITICAL)

Open PostgreSQL:
```powershell
psql -U postgres -d cyclone_tracker
```

Copy and paste this entire block:

```sql
DROP FUNCTION IF EXISTS find_cyclones_near_point(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);

CREATE OR REPLACE FUNCTION find_cyclones_near_point(
    clicked_lat DOUBLE PRECISION,
    clicked_lon DOUBLE PRECISION,
    distance_meters INTEGER DEFAULT 100000
)
RETURNS TABLE (
    storm_id TEXT,
    cyclone_name TEXT,
    year INTEGER,
    basin TEXT,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    distance_km DOUBLE PRECISION,
    num_observations INT,
    max_wind_speed INT,
    min_pressure INT,
    duration_hours DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ct.sid,
        COALESCE(ct.name, 'UNNAMED') as cyclone_name,
        ct.season,
        ct.basin,
        ct.start_time,
        ct.end_time,
        CAST(
            ROUND(
                CAST(
                    ST_Distance(
                        ct.path::geography,
                        ST_SetSRID(ST_MakePoint(clicked_lon, clicked_lat), 4326)::geography
                    ) / 1000.0 AS numeric
                ),
                2
            ) AS DOUBLE PRECISION
        ) as distance_km,
        ct.point_count,
        COALESCE(ct.max_wind, 0) as max_wind,
        COALESCE(ct.min_pressure, 0) as min_pressure,
        COALESCE(ct.duration_hours, 0.0) as duration_hours
    FROM cyclone_tracks ct
    WHERE ct.path IS NOT NULL
      AND ST_DWithin(
        ct.path::geography,
        ST_SetSRID(ST_MakePoint(clicked_lon, clicked_lat), 4326)::geography,
        distance_meters
    )
    ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;
```

**OR** simply run:
```powershell
psql -U postgres -d cyclone_tracker -f FINAL_FIX.sql
```

Expected output:
```
DROP FUNCTION
CREATE FUNCTION
Testing Mumbai...
 cyclones_near_mumbai 
----------------------
                   XX
Function fixed successfully!
```

### STEP 2: Restart API Server

1. Go to terminal where `python api_server.py` is running
2. Press **Ctrl+C** to stop
3. Run: `python api_server.py`

### STEP 3: Refresh Browser

Simply refresh the page: http://localhost:8080

**No need to restart the frontend server!**

---

## 🎯 HOW TO USE NEW FEATURES

### 1. **Sort Results**

After clicking on the map, use the dropdown:
- **Distance**: Shows nearest cyclones first (default)
- **Wind Speed**: Shows strongest cyclones first, N/A at bottom
- **Year**: Shows most recent cyclones first (2026 → 1842)

### 2. **Filter by Year Range**

Example: Only show cyclones from 2000-2020
- Type `2000` in "From" field
- Type `2020` in "To" field
- Click **Apply** button
- Table updates instantly

You can also:
- Leave "From" empty = no minimum year
- Leave "To" empty = no maximum year
- Both empty = show all years

### 3. **Download CSV**

Click the **📥 Download CSV** button:
- Downloads all currently displayed results (after filters)
- Filename: `cyclones_YYYY-MM-DD.csv`
- Opens in Excel/Google Sheets

CSV includes:
- Name
- Year
- Distance (km)
- Wind Speed (kts)
- Pressure (mb)
- Start Date
- End Date

### 4. **Table Interactions**

- **Click any row** → Highlights cyclone track on map
- **Zooms to track** automatically
- **Active row** has blue background
- **Hover row** shows subtle highlight

---

## 🎨 VISUAL IMPROVEMENTS

### Table Features:
- ✅ Sticky header (stays visible while scrolling)
- ✅ Sortable columns
- ✅ Color-coded wind speeds:
  - 🔴 Red: >= 64 knots (Hurricane/Typhoon)
  - 🟡 Yellow: 34-63 knots (Tropical Storm)
  - 🟢 Green: < 34 knots (Tropical Depression)
- ✅ Right-aligned numbers for better readability
- ✅ Professional styling

---

## ✅ VERIFICATION CHECKLIST

After updating, verify:

- [ ] Database function updated (run FINAL_FIX.sql)
- [ ] API server restarted
- [ ] Browser refreshed
- [ ] Click on map → See table (not cards)
- [ ] Sort dropdown works
- [ ] Year filter works
- [ ] CSV download works
- [ ] Clicking table row highlights track
- [ ] Wind speeds show "N/A" when missing
- [ ] No 500 errors in any location

---

## 🐛 TROUBLESHOOTING

### Table not showing?
- Check browser console (F12 → Console)
- Refresh page (Ctrl+F5)
- Clear browser cache

### CSV download not working?
- Check browser download settings
- Ensure popup blocker is disabled

### Year filter not working?
- Enter valid years (1842-2026)
- Click "Apply" button after entering values

### Still getting 500 errors?
- Ensure you ran FINAL_FIX.sql
- Restart API server
- Check API terminal for error messages

---

## 📊 EXAMPLE USAGE

**Scenario 1: Find strongest cyclones near Mumbai since 2000**
1. Click Mumbai on map (approx 19°N, 73°E)
2. Select "Wind Speed" in sort dropdown
3. Enter "2000" in year From field
4. Click Apply
5. Table shows strongest cyclones first

**Scenario 2: Download all cyclones in Atlantic 2020-2024**
1. Click in Atlantic Ocean
2. Set year filter: 2020 to 2024
3. Click Apply
4. Click Download CSV

**Scenario 3: View oldest cyclones**
1. Click any location
2. Select "Year (Recent to Old)" in sort
3. Scroll to bottom of table = oldest cyclones

---

## 📝 WHAT CHANGED IN FILES

### Updated Files:
- ✅ `frontend/index.html` - Added filters UI and table structure
- ✅ `frontend/style.css` - Added table styles and filter styles
- ✅ `frontend/script.js` - Added sorting, filtering, CSV download logic
- ✅ `database_setup.sql` - Fixed ROUND function and NULL handling
- ✅ `api_server.py` - Better error handling

### New Files:
- ✅ `FINAL_FIX.sql` - Quick fix script for database

---

## 🎉 YOU'RE DONE!

After completing Step 1-3 above, your Cyclone Tracker will have:
- Professional table view
- Multiple sorting options
- Year range filtering
- CSV export functionality
- Better error handling
- Color-coded wind speeds

Everything works correctly and handles edge cases! 🚀

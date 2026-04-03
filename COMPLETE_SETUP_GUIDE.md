# 🌍 COMPLETE SETUP GUIDE - Natural Disaster Tracker

## 🎉 YOU NOW HAVE A UNIFIED INTERFACE!

**Two disaster types in ONE application:**
- 🌀 **Cyclones** - Track-based analysis with wind speed distribution
- 🌊 **Tsunamis** - Point-based events with water height data

---

## 📋 CURRENT STATUS:

✅ **COMPLETED:**
- Cyclone database setup
- Cyclone data imported (13,457 tracks, 712,554 points)
- Cyclone API working
- Frontend with tabs created

⚠️ **TODO:**
- Setup tsunami database
- Import tsunami data
- Test integrated interface

---

## 🚀 SETUP TSUNAMI (15 minutes)

### **STEP 1: Setup Tsunami Database Tables**

Open psql:
```powershell
psql -U postgres -d cyclone_tracker
```

Copy and paste entire content from `tsu\database_tsunami_setup.sql` OR run:
```powershell
psql -U postgres -d cyclone_tracker -f "c:\Users\asmit\Downloads\Semester 8\IDP\Code\tsu\database_tsunami_setup.sql"
```

**Verify:**
```sql
\dt tsunami_events
SELECT COUNT(*) FROM tsunami_events;  -- Should be 0 (empty)
```

### **STEP 2: Import Tsunami Data**

```powershell
cd "c:\Users\asmit\Downloads\Semester 8\IDP\Code\tsu"
python import_tsunami_data.py
```

**Expected output:**
```
============================================================
TSUNAMI DATA IMPORT
============================================================
✓ Connected to database
📂 Reading TSV file...
✓ Read 795 tsunami events
✓ Cleaned data: XXX valid rows
📥 Importing to database...
✓ Successfully imported XXX tsunami events
✅ Verification: XXX tsunamis in database
```

**Takes:** ~2 minutes

### **STEP 3: Restart API Server**

Go to terminal with API server, press Ctrl+C:
```powershell
cd "c:\Users\asmit\Downloads\Semester 8\IDP\Code"
python api_server.py
```

**MUST SEE:**
```
✓ Tsunami API router mounted successfully
```

If you don't see this, check:
- `tsu\tsunami_api.py` exists
- No syntax errors

### **STEP 4: Restart Frontend Server**

Go to terminal with frontend, press Ctrl+C:
```powershell
cd "c:\Users\asmit\Downloads\Semester 8\IDP\Code\frontend"
python -m http.server 8080
```

### **STEP 5: Open in Incognito Mode**

**Critical:** Use Incognito to avoid cache!

- Press **Ctrl+Shift+N** (Chrome/Edge)
- Go to: http://localhost:8080

---

## ✅ WHAT YOU'LL SEE:

### **Header:**
```
🌍 Natural Disaster Tracker
Click anywhere on the map to find historical cyclones and tsunamis

[🌀 Cyclones]  [🌊 Tsunamis]  ← Two tabs
```

### **Map Controls:**
```
Mode: Cyclones    Search Radius: [100 km ▼]  [Clear All]
```

### **When You Click Cyclones Tab:**
- Radius changes to: 50km, 100km, 200km, 500km
- Shows "Mode: Cyclones"
- Results show table with wind speeds
- Wind speed distribution histogram appears
- Cyclone tracks (lines) on map

### **When You Click Tsunamis Tab:**
- Radius changes to: 200km, 500km, 1000km, 2000km
- Shows "Mode: Tsunamis"
- Results show table with water heights, deaths, damage
- NO histogram (as requested)
- Circular markers on map (colored by intensity)

---

## 🎨 TSUNAMI MARKER LEGEND:

| Color | Size | Water Height | Severity |
|-------|------|--------------|----------|
| 🔴 Red | Large (20px) | 10+ meters | Catastrophic |
| 🟠 Orange | Medium (16px) | 5-10 meters | Major |
| 🟡 Yellow | Small (13px) | 2-5 meters | Moderate |
| 🟢 Green | Tiny (10px) | 0-2 meters | Minor |

---

## 🧪 COMPLETE TESTING WORKFLOW:

### **Test 1: Cyclone Mode**
1. Open http://localhost:8080 (Incognito)
2. Click **🌀 Cyclones** tab
3. Click near India (19°N, 73°E)
4. Should see:
   - Wind speed histogram
   - Table with cyclone data
   - Colored line tracks on map
5. Sort by "Wind Speed" → Strongest first
6. Filter: 2000-2024 → Histogram updates
7. Download CSV → File downloads

### **Test 2: Tsunami Mode**
1. Click **🌊 Tsunamis** tab
2. Notice: Radius changed to 500km
3. Click near Japan (35°N, 140°E)
4. Should see:
   - NO histogram (just table)
   - Table with tsunami data
   - Circular colored markers on map
5. Sort by "Water Height" → Highest first
6. Filter: 2000-2024 → Table updates
7. Download CSV → File downloads

### **Test 3: Switch Between Modes**
1. Click Cyclones tab → Search → See results
2. Click Tsunamis tab → Search clears
3. Click new location → See tsunami markers
4. Click Cyclones tab → Back to cyclones mode
5. All data persists correctly

---

## 📊 COMPARISON TABLE:

| Feature | Cyclones | Tsunamis |
|---------|----------|----------|
| **Visual** | Line tracks | Circle markers |
| **Default Radius** | 100 km | 500 km |
| **Table Shows** | Wind, Pressure, Dates | Water Height, Deaths, Damage |
| **Distribution Chart** | ✅ Yes (Wind Speed) | ❌ No (as requested) |
| **Sort Options** | Distance, Wind Speed, Year | Distance, Water Height, Year |
| **Click Behavior** | Highlight track + zoom | Zoom to marker + popup |
| **Data Count** | ~13,457 tracks | ~795 events |
| **Time Range** | 1842-2026 | 1970-2026 |

---

## 🗂️ PROJECT STRUCTURE:

```
Code/
├── database_setup.sql          # Cyclone DB schema
├── import_data.py             # Cyclone data import
├── api_server.py              # UNIFIED API (cyclones + tsunamis)
├── requirements.txt           # Python dependencies
├── ibtracs.ALL.list.v04r01.csv  # Cyclone data
│
├── tsu/
│   ├── database_tsunami_setup.sql     # Tsunami DB schema
│   ├── import_tsunami_data.py        # Tsunami data import
│   ├── tsunami_api.py                # Tsunami API router
│   └── tsunamis-2026-03-05...tsv     # Tsunami data
│
└── frontend/
    ├── index.html            # UNIFIED interface with tabs
    ├── style.css             # Styles for both modes
    └── script.js             # Logic for both modes
```

---

## 🔧 API ENDPOINTS:

### **Cyclones:**
- GET `/api/cyclones-near?lat=X&lon=Y&distance=Z`
- GET `/api/track/{storm_id}`
- GET `/api/stats`

### **Tsunamis:**
- GET `/api/tsunamis-near?lat=X&lon=Y&distance=Z`
- GET `/api/tsunami/{event_id}`
- GET `/api/tsunami-stats`

### **Health:**
- GET `/health` - Shows counts for both

---

## 📈 FOR YOUR IDP PROJECT:

### **Use Cases:**

**1. Coastal Infrastructure Design**
- Search location near coast
- View cyclones: Check max wind speeds for structural loads
- View tsunamis: Check max water heights for elevation requirements
- Download both CSVs for detailed analysis

**2. Risk Assessment**
- Compare cyclone frequency vs tsunami frequency
- Analyze trends with year filters
- Identify high-risk areas

**3. Climate Analysis**
- Filter recent decades (2000-2024)
- Compare historical patterns (1970-2000 vs 2000-2024)
- Study intensity changes over time

---

## ✅ FINAL CHECKLIST:

After setup:

- [ ] Tsunami database created
- [ ] Tsunami data imported (~795 events)
- [ ] API server shows "Tsunami API router mounted"
- [ ] Frontend has two tabs visible
- [ ] Clicking Cyclones tab works
- [ ] Clicking Tsunamis tab works
- [ ] Radius options change per mode
- [ ] Cyclones show lines
- [ ] Tsunamis show circles
- [ ] Sorting works for both
- [ ] Year filter works for both
- [ ] CSV download works for both

---

## 🎉 SUCCESS CRITERIA:

You'll know it's working when:

✅ Two tabs in header  
✅ Switch tabs → Radius options change  
✅ Cyclones → Lines with histogram  
✅ Tsunamis → Circles without histogram  
✅ Click table row → Zooms appropriately  
✅ Filters update both table and chart  
✅ Download CSV works for both modes  

---

Follow **SETUP_TSUNAMI.md** for detailed step-by-step instructions!

Good luck! 🚀

# 🌊 TSUNAMI INTEGRATION SETUP

## 📋 WHAT'S NEW:

Your interface now has **TWO TABS**:
- 🌀 **Cyclones** - Shows cyclone tracks (lines)
- 🌊 **Tsunamis** - Shows tsunami events (circular markers)

---

## 🚀 SETUP STEPS

### **STEP 1: Setup Tsunami Database**

Open psql:
```powershell
psql -U postgres -d cyclone_tracker
```

Run the tsunami setup script by copying from:
`tsu\database_tsunami_setup.sql`

Or run directly:
```powershell
psql -U postgres -d cyclone_tracker -f "tsu\database_tsunami_setup.sql"
```

**Expected output:**
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE FUNCTION
```

### **STEP 2: Import Tsunami Data**

```powershell
cd "c:\Users\asmit\Downloads\Semester 8\IDP\Code\tsu"
python import_tsunami_data.py
```

**Expected:**
- Reads TSV file with ~795 tsunami events
- Imports to `tsunami_events` table
- Creates spatial points
- Takes 1-2 minutes

### **STEP 3: Restart API Server**

Stop current server (Ctrl+C) and restart:
```powershell
cd "c:\Users\asmit\Downloads\Semester 8\IDP\Code"
python api_server.py
```

You should see:
```
✓ Tsunami API router mounted successfully
```

### **STEP 4: Restart Frontend Server**

Stop (Ctrl+C) and restart:
```powershell
cd "c:\Users\asmit\Downloads\Semester 8\IDP\Code\frontend"
python -m http.server 8080
```

### **STEP 5: Open in Browser**

**Use Incognito mode** to avoid cache:
- Press **Ctrl+Shift+N**
- Go to: http://localhost:8080

---

## ✨ NEW INTERFACE FEATURES:

### **1. TABS (Top of page)**
- Click **🌀 Cyclones** to search for cyclone tracks
- Click **🌊 Tsunamis** to search for tsunami events

### **2. MODE-SPECIFIC BEHAVIOR:**

**Cyclones Mode:**
- Default radius: 100 km
- Options: 50km, 100km, 200km, 500km
- Shows: Colored line tracks
- Table: Name, Year, Distance, Max Wind Speed, Pressure, Dates
- Chart: Wind Speed Distribution

**Tsunamis Mode:**
- Default radius: 500 km (tsunamis affect wider areas)
- Options: 200km, 500km, 1000km, 2000km
- Shows: Circular markers (color/size by water height)
- Table: Location, Year, Distance, Max Water Height, Earthquake Mag, Deaths, Damage
- No chart (as requested)

### **3. TSUNAMI MARKERS:**

**Color & Size by Water Height:**
- 🔴 **Large Red** (10+ m) - Catastrophic
- 🟠 **Medium Orange** (5-10 m) - Major
- 🟡 **Small Yellow** (2-5 m) - Moderate
- 🟢 **Tiny Green** (0-2 m) - Minor
- 🔵 **Blue** (N/A) - Unknown height

### **4. SORTING OPTIONS:**

**Cyclones:**
- Distance
- Wind Speed
- Year

**Tsunamis:**
- Distance
- Water Height (Max Water Height)
- Year

### **5. YEAR FILTER:**
Works for both modes!

---

## 🧪 TESTING:

### **Test Cyclones (Bay of Bengal)**
1. Click **🌀 Cyclones** tab
2. Click near India (19°N, 73°E)
3. See cyclone tracks with wind speed histogram
4. Change sort to "Wind Speed"
5. Apply year filter: 2010-2024
6. Download CSV

### **Test Tsunamis (Pacific Ocean)**
1. Click **🌊 Tsunamis** tab
2. Click near Japan (35°N, 140°E)
3. See circular markers (different sizes/colors)
4. Click table row → Zooms to marker
5. Sort by "Water Height"
6. Download CSV

---

## 📊 DATABASE STRUCTURE:

After setup, you'll have:
- `cyclone_points` - Raw cyclone data
- `cyclone_tracks` - LineString tracks
- `tsunami_events` - Tsunami point events (NEW)

---

## ✅ VERIFICATION:

After completing steps 1-5:

- [ ] Two tabs visible in header
- [ ] "Mode: Cyclones" or "Mode: Tsunamis" in map controls
- [ ] Clicking Cyclones tab → Shows cyclone options
- [ ] Clicking Tsunamis tab → Shows tsunami options (500km default)
- [ ] Cyclones show lines on map
- [ ] Tsunamis show circular markers
- [ ] Sorting works for both modes
- [ ] Year filter works for both modes
- [ ] CSV download works for both modes

---

## 🎯 KEY DIFFERENCES:

| Feature | Cyclones | Tsunamis |
|---------|----------|----------|
| Visual | Line tracks | Circle markers |
| Default Radius | 100 km | 500 km |
| Table Columns | Wind, Pressure | Water Height, Deaths, Damage |
| Distribution Chart | Yes (Wind Speed) | No |
| Sort Options | Distance, Wind, Year | Distance, Water Height, Year |
| Data Type | Tracks over time | Point events |

---

## 🆘 TROUBLESHOOTING:

### "Tsunami API not loaded"
→ Check `tsunami_api.py` exists in `tsu` folder
→ Ensure API server restarted

### "No tsunamis found"
→ Check tsunami data imported: `SELECT COUNT(*) FROM tsunami_events;`
→ Try larger radius (1000km)

### "Still seeing old interface"
→ Use Incognito mode
→ Hard refresh (Ctrl+Shift+R)

---

## 📝 FILES UPDATED:

- ✅ `api_server.py` - Integrated tsunami router
- ✅ `frontend/index.html` - Added tabs
- ✅ `frontend/style.css` - Tab styling
- ✅ `frontend/script.js` - Dual mode logic
- ✅ `tsu/import_tsunami_data.py` - Fixed file path

---

Ready to set up! Follow steps 1-5 above. 🚀

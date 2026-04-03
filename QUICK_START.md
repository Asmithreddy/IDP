# ⚡ QUICK START - Natural Disaster Tracker

## 🎯 TO ADD TSUNAMI SUPPORT (5 Commands):

```powershell
# 1. Setup tsunami database
psql -U postgres -d cyclone_tracker -f "tsu\database_tsunami_setup.sql"

# 2. Import tsunami data
cd tsu
python import_tsunami_data.py

# 3. Restart API (Ctrl+C first, then run)
cd ..
python api_server.py

# 4. Restart frontend (Ctrl+C first, then run)
cd frontend
python -m http.server 8080

# 5. Open in Incognito: http://localhost:8080
```

---

## ✨ WHAT YOU GET:

### **TWO TABS:**
- **🌀 Cyclones** - Shows line tracks with wind speed histogram
- **🌊 Tsunamis** - Shows circular markers (no chart)

### **TAB-SPECIFIC:**

**Cyclones:**
- Radius: 50-500 km (default 100km)
- Visual: Colored line tracks
- Table: Name, Year, Distance, Max Wind Speed, Pressure, Dates
- Chart: Wind Speed Distribution Histogram
- Sort: Distance, Wind Speed, Year

**Tsunamis:**
- Radius: 200-2000 km (default 500km)  
- Visual: Colored circle markers (by water height)
- Table: Location, Year, Distance, Max Water Height, Earthquake Mag, Deaths, Damage
- Chart: None (as requested)
- Sort: Distance, Water Height, Year

### **BOTH MODES:**
- ✅ Year range filter
- ✅ CSV download
- ✅ Click table row to highlight/zoom
- ✅ Real-time updates

---

## 🎨 VISUAL GUIDE:

**Cyclones:**
```
Map: ──────────── (colored lines)
```

**Tsunamis:**
```
Map: ●  ●  ●  ● (colored circles, size by intensity)
     🔴 🟠 🟡 🟢
```

---

## ✅ VERIFY IT WORKS:

Open http://localhost:8080 in **Incognito** (Ctrl+Shift+N)

You should see:
- Two tabs: [🌀 Cyclones] [🌊 Tsunamis]
- Click Cyclones → Map shows lines
- Click Tsunamis → Map shows circles
- Both have sortable tables
- Both have year filters
- Both have CSV download

---

## 🐛 IF ISSUES:

**Not seeing tabs?**
→ Open in Incognito mode (Ctrl+Shift+N)

**Tsunami router not mounted?**
→ Check tsu\tsunami_api.py exists
→ Restart API server

**Old interface still showing?**
→ Clear all browser cache
→ Use Incognito mode

---

That's it! 5 commands and you have a complete dual-disaster tracking system! 🚀

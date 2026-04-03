// ===============================================
// TSUNAMI TRACKER - JAVASCRIPT
// Separate from cyclone logic - does not touch cyclone variables
// ===============================================

const TSUNAMI_CONFIG = {
    API_BASE_URL: 'http://localhost:8000/api',
    DEFAULT_DISTANCE: 500000,  // 500km default (tsunamis travel far)
};

// Tsunami-specific globals (separate from cyclone globals)
let tsunamiLayers = [];
let tsunamiClickMarker = null;
let tsunamiSearchCircle = null;
let currentTsunamis = [];
let tsunamiActive = false;  // is tsunami tab active?

// Cause code labels
const CAUSE_LABELS = {
    1: 'Earthquake',
    2: 'Earthquake + Landslide',
    3: 'Earthquake + Volcano',
    4: 'Earthquake + Landslide + Volcano',
    5: 'Volcano',
    6: 'Volcano + Earthquake',
    7: 'Volcano + Landslide',
    8: 'Landslide',
    9: 'Meteorological',
    10: 'Explosion',
    11: 'Astronomical Tide'
};

// Validity labels
const VALIDITY_LABELS = {
    1: 'Very Doubtful',
    2: 'Questionable',
    3: 'Probable',
    4: 'Definite'
};

// ===============================================
// INIT - called from index.html after map is ready
// ===============================================
function initTsunamiTracker() {
    console.log('🌊 Tsunami tracker initialized');
    loadTsunamiStats();
}

// ===============================================
// TAB SWITCHING
// ===============================================
function switchToTsunami() {
    tsunamiActive = true;
    document.getElementById('tab-cyclone').classList.remove('active');
    document.getElementById('tab-tsunami').classList.add('active');
    document.getElementById('cyclone-panel').style.display = 'none';
    document.getElementById('tsunami-panel').style.display = 'flex';
    document.getElementById('map-instruction').textContent =
        '🌊 Click anywhere on the map to find nearby historical tsunamis';
}

function switchToCyclone() {
    tsunamiActive = false;
    document.getElementById('tab-tsunami').classList.remove('active');
    document.getElementById('tab-cyclone').classList.add('active');
    document.getElementById('tsunami-panel').style.display = 'none';
    document.getElementById('cyclone-panel').style.display = 'flex';
    document.getElementById('map-instruction').textContent =
        '🌀 Click anywhere on the map to find nearby historical cyclones';
    clearTsunamiLayers();
}

// ===============================================
// MAP CLICK HANDLER (called from main script.js)
// ===============================================
function handleTsunamiMapClick(lat, lon) {
    if (!tsunamiActive) return;

    const distance = parseInt(document.getElementById('tsunami-distance-select')?.value)
        || TSUNAMI_CONFIG.DEFAULT_DISTANCE;

    // Clear previous tsunami markers
    clearTsunamiLayers();

    // Add click marker
    tsunamiClickMarker = L.marker([lat, lon], {
        icon: L.divIcon({
            className: 'tsunami-click-marker',
            html: '🌊',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        })
    }).addTo(map);

    // Add search circle
    tsunamiSearchCircle = L.circle([lat, lon], {
        radius: distance,
        color: '#0ea5e9',
        fillColor: '#0ea5e9',
        fillOpacity: 0.05,
        weight: 2,
        dashArray: '6,4'
    }).addTo(map);

    // Show loading
    showTsunamiLoading(lat, lon);

    // Call API
    searchTsunamis(lat, lon, distance);
}

// ===============================================
// API CALL
// ===============================================
async function searchTsunamis(lat, lon, distance) {
    try {
        const url = `${TSUNAMI_CONFIG.API_BASE_URL}/tsunamis-near?lat=${lat}&lon=${lon}&distance=${distance}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        currentTsunamis = data.events;

        displayTsunamiResults(data);
        plotTsunamiMarkers(data.events);

    } catch (err) {
        showTsunamiError(err.message);
        console.error('Tsunami search error:', err);
    }
}

// ===============================================
// PLOT MARKERS ON MAP
// ===============================================
function plotTsunamiMarkers(events) {
    events.forEach((event, index) => {
        if (!event.latitude || !event.longitude) return;

        const color = getTsunamiColor(event.max_water_height);
        const radius = getTsunamiRadius(event.max_water_height);

        const circle = L.circleMarker([event.latitude, event.longitude], {
            radius: radius,
            fillColor: color,
            color: '#fff',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.8
        });

        // Popup
        const dateStr = formatTsunamiDate(event.year, event.month, event.day);
        const heightStr = event.max_water_height ? `${event.max_water_height}m` : 'Unknown';
        const deathsStr = event.total_deaths ? event.total_deaths.toLocaleString() : '0';
        const causeStr = CAUSE_LABELS[event.cause_code] || 'Unknown';

        circle.bindPopup(`
            <div class="tsunami-popup">
                <h4>🌊 ${event.location_name || 'Unknown Location'}</h4>
                <p><strong>📅 Date:</strong> ${dateStr}</p>
                <p><strong>🌍 Country:</strong> ${event.country || 'Unknown'}</p>
                <p><strong>💧 Max Water Height:</strong> ${heightStr}</p>
                <p><strong>⚡ Cause:</strong> ${causeStr}</p>
                <p><strong>📏 Magnitude:</strong> ${event.earthquake_magnitude || 'N/A'}</p>
                <p><strong>💀 Total Deaths:</strong> ${deathsStr}</p>
                <p><strong>📍 Distance:</strong> ${event.distance_km} km away</p>
            </div>
        `);

        // Highlight result card on hover
        circle.on('mouseover', () => {
            highlightTsunamiCard(event.id);
            circle.setStyle({ weight: 3, radius: radius + 3 });
        });
        circle.on('mouseout', () => {
            circle.setStyle({ weight: 1.5, radius: radius });
        });

        circle.addTo(map);
        tsunamiLayers.push(circle);
    });
}

// ===============================================
// COLOR + SIZE BY WATER HEIGHT
// ===============================================
function getTsunamiColor(height) {
    if (!height) return '#94a3b8';       // grey = unknown
    if (height >= 30) return '#7f1d1d';  // dark red = catastrophic
    if (height >= 10) return '#dc2626';  // red = severe
    if (height >= 5)  return '#f97316';  // orange = major
    if (height >= 2)  return '#facc15';  // yellow = moderate
    return '#4ade80';                    // green = minor
}

function getTsunamiRadius(height) {
    if (!height) return 6;
    if (height >= 30) return 16;
    if (height >= 10) return 13;
    if (height >= 5)  return 10;
    if (height >= 2)  return 8;
    return 6;
}

// ===============================================
// DISPLAY RESULTS PANEL
// ===============================================
function displayTsunamiResults(data) {
    const panel = document.getElementById('tsunami-results');
    const countEl = document.getElementById('tsunami-count');

    if (countEl) countEl.textContent = data.count;

    if (!data.events || data.events.length === 0) {
        panel.innerHTML = `
            <div class="no-results">
                <p>🌊 No tsunamis found within ${data.distance_km} km</p>
                <p>Try increasing the search radius</p>
            </div>`;
        return;
    }

    panel.innerHTML = data.events.map((event, i) => {
        const dateStr = formatTsunamiDate(event.year, event.month, event.day);
        const heightStr = event.max_water_height ? `${event.max_water_height}m` : '—';
        const deathsStr = event.total_deaths ? event.total_deaths.toLocaleString() : '0';
        const causeStr = CAUSE_LABELS[event.cause_code] || '—';
        const validityStr = VALIDITY_LABELS[event.event_validity] || '—';
        const color = getTsunamiColor(event.max_water_height);
        const damageStr = event.total_damage_mil ? `$${event.total_damage_mil}M` : '—';

        return `
            <div class="tsunami-card" id="tsunami-card-${event.id}"
                 onclick="focusTsunamiEvent(${event.latitude}, ${event.longitude}, ${event.id})">
                <div class="tsunami-card-header">
                    <span class="tsunami-dot" style="background:${color}"></span>
                    <span class="tsunami-location">${event.location_name || 'Unknown'}</span>
                    <span class="tsunami-distance">${event.distance_km} km</span>
                </div>
                <div class="tsunami-card-body">
                    <div class="tsunami-meta">
                        <span>📅 ${dateStr}</span>
                        <span>🌍 ${event.country || '—'}</span>
                    </div>
                    <div class="tsunami-stats-row">
                        <span class="tsunami-stat">
                            <label>Height</label>
                            <value>${heightStr}</value>
                        </span>
                        <span class="tsunami-stat">
                            <label>Magnitude</label>
                            <value>${event.earthquake_magnitude || '—'}</value>
                        </span>
                        <span class="tsunami-stat">
                            <label>Deaths</label>
                            <value>${deathsStr}</value>
                        </span>
                        <span class="tsunami-stat">
                            <label>Damage</label>
                            <value>${damageStr}</value>
                        </span>
                    </div>
                    <div class="tsunami-tags">
                        <span class="tag tag-cause">${causeStr}</span>
                        <span class="tag tag-validity">${validityStr}</span>
                        ${event.num_runups ? `<span class="tag">${event.num_runups} runups</span>` : ''}
                    </div>
                </div>
            </div>`;
    }).join('');
}

// ===============================================
// STATS PANEL
// ===============================================
async function loadTsunamiStats() {
    try {
        const response = await fetch(`${TSUNAMI_CONFIG.API_BASE_URL}/tsunami-stats`);
        const stats = await response.json();

        const el = document.getElementById('tsunami-stats-summary');
        if (!el) return;

        el.innerHTML = `
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-number">${stats.total_events}</div>
                    <div class="stat-label">Total Events</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats.year_min}–${stats.year_max}</div>
                    <div class="stat-label">Year Range</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats.max_water_height}m</div>
                    <div class="stat-label">Max Wave Height</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats.total_deaths ? stats.total_deaths.toLocaleString() : '0'}</div>
                    <div class="stat-label">Total Deaths</div>
                </div>
            </div>`;
    } catch (err) {
        console.error('Could not load tsunami stats:', err);
    }
}

// ===============================================
// HELPERS
// ===============================================
function formatTsunamiDate(year, month, day) {
    if (!year) return 'Unknown';
    const months = ['Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'];
    const m = month ? months[month - 1] : '';
    const d = day ? day : '';
    return [d, m, year].filter(Boolean).join(' ');
}

function highlightTsunamiCard(id) {
    document.querySelectorAll('.tsunami-card').forEach(c => c.classList.remove('highlighted'));
    const card = document.getElementById(`tsunami-card-${id}`);
    if (card) {
        card.classList.add('highlighted');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function focusTsunamiEvent(lat, lon, id) {
    map.setView([lat, lon], 7);
    highlightTsunamiCard(id);
}

function clearTsunamiLayers() {
    tsunamiLayers.forEach(layer => map.removeLayer(layer));
    tsunamiLayers = [];
    if (tsunamiClickMarker) { map.removeLayer(tsunamiClickMarker); tsunamiClickMarker = null; }
    if (tsunamiSearchCircle) { map.removeLayer(tsunamiSearchCircle); tsunamiSearchCircle = null; }
}

function showTsunamiLoading(lat, lon) {
    const panel = document.getElementById('tsunami-results');
    if (panel) panel.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Searching tsunamis near ${lat.toFixed(2)}, ${lon.toFixed(2)}...</p>
        </div>`;
}

function showTsunamiError(msg) {
    const panel = document.getElementById('tsunami-results');
    if (panel) panel.innerHTML = `
        <div class="error">
            <p>❌ Error: ${msg}</p>
        </div>`;
}
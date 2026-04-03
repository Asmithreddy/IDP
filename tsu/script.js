// ===============================================
// CYCLONE TRACKER - JAVASCRIPT
// ===============================================

// Configuration
const CONFIG = {
    API_BASE_URL: 'http://localhost:8000/api',
    DEFAULT_DISTANCE: 100000, // 100km in meters
    MAP_CENTER: [20, 0],
    MAP_ZOOM: 2
};

// Global variables
let map;
let cycloneLayers = [];
let clickMarker = null;
let searchCircle = null;
let currentCyclones = [];

// ===============================================
// INITIALIZE MAP
// ===============================================

function initMap() {
    // Create map
    map = L.map('map').setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Add click event
    map.on('click', onMapClick);
    
    console.log('Map initialized');
}

// ===============================================
// MAP CLICK HANDLER
// ===============================================

async function onMapClick(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    // Route to tsunami handler if tsunami tab is active
    if (typeof tsunamiActive !== 'undefined' && tsunamiActive) {
        handleTsunamiMapClick(lat, lon);
        return;
    }

    // CYCLONE LOGIC RESTORED
    const distance = parseInt(document.getElementById('distance-select').value);

    // Clear previous results
    clearMap();

    // Add click marker
    clickMarker = L.marker([lat, lon]).addTo(map);

    // Add search circle
    searchCircle = L.circle([lat, lon], {
        radius: distance,
        color: '#ff6b6b',
        fillColor: '#ff6b6b',
        fillOpacity: 0.1,
        weight: 2
    }).addTo(map);

    // Show loading
    showLoading(true);

    try {
        await searchCyclones(lat, lon, distance);
    } catch (error) {
        console.error('Search failed:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

// ===============================================
// SEARCH CYCLONES
// ===============================================

async function searchCyclones(lat, lon, distance) {
    const url = `${CONFIG.API_BASE_URL}/cyclones-near?lat=${lat}&lon=${lon}&distance=${distance}`;
    
    console.log('Fetching:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log(`Found ${data.cyclones_found} cyclones`);
    
    currentCyclones = data.cyclones;
    
    // Update results panel
    updateResultsPanel(data);
    
    // Load and display cyclone tracks
    if (data.cyclones.length > 0) {
        await loadCycloneTracks(data.cyclones);
    }
}

// ===============================================
// LOAD CYCLONE TRACKS
// ===============================================

async function loadCycloneTracks(cyclones) {
    console.log(`Loading tracks for ${cyclones.length} cyclones...`);
    
    for (const cyclone of cyclones) {
        try {
            const track = await fetchCycloneTrack(cyclone.storm_id);
            if (track) {
                displayCycloneTrack(track, cyclone);
            }
        } catch (error) {
            console.error(`Error loading track for ${cyclone.storm_id}:`, error);
        }
    }
}

// ===============================================
// FETCH CYCLONE TRACK
// ===============================================

async function fetchCycloneTrack(stormId) {
    const url = `${CONFIG.API_BASE_URL}/track/${stormId}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        console.error(`Failed to fetch track for ${stormId}`);
        return null;
    }
    
    return await response.json();
}

// ===============================================
// DISPLAY CYCLONE TRACK
// ===============================================

function displayCycloneTrack(track, cyclone) {
    // Convert GeoJSON coordinates to Leaflet format
    const coordinates = track.geometry.coordinates.map(coord => [coord[1], coord[0]]);
    
    // Generate color based on storm_id (for variety)
    const color = getColorForCyclone(track.storm_id);
    
    // Create polyline
    const polyline = L.polyline(coordinates, {
        color: color,
        weight: 3,
        opacity: 0.7,
        className: `cyclone-track-${track.storm_id}`
    }).addTo(map);
    
    // Add popup
    polyline.bindPopup(`
        <div class="popup-content">
            <h3>${track.cyclone_name}</h3>
            <p><strong>Year:</strong> ${track.year}</p>
            <p><strong>Storm ID:</strong> ${track.storm_id}</p>
            <p><strong>Distance:</strong> ${cyclone.distance_km} km</p>
            <p><strong>Max Wind:</strong> ${cyclone.max_wind_speed || 'N/A'} knots</p>
            <p><strong>Duration:</strong> ${cyclone.duration_hours ? cyclone.duration_hours.toFixed(1) + ' hours' : 'N/A'}</p>
        </div>
    `);
    
    // Store layer
    cycloneLayers.push({
        stormId: track.storm_id,
        layer: polyline,
        color: color
    });
}

// ===============================================
// UPDATE RESULTS PANEL
// ===============================================

function updateResultsPanel(data) {
    const resultsHeader = document.getElementById('results-header');
    const resultsContent = document.getElementById('results-content');
    
    // Update header
    resultsHeader.innerHTML = `
        <h2>Results (${data.cyclones_found})</h2>
        <p class="subtitle">Found within ${data.distance_km} km</p>
    `;
    
    // Clear content
    resultsContent.innerHTML = '';
    
    if (data.cyclones_found === 0) {
        resultsContent.innerHTML = `
            <div class="no-results">
                <p>😕 No cyclones found</p>
                <p class="info-text">Try increasing the search radius or clicking a different location</p>
            </div>
        `;
        return;
    }
    
    // Add search info
    const searchInfo = document.createElement('div');
    searchInfo.className = 'search-info';
    searchInfo.innerHTML = `
        <h3>📍 Search Location</h3>
        <p class="coordinate">Lat: ${data.clicked_lat.toFixed(4)}°, Lon: ${data.clicked_lon.toFixed(4)}°</p>
        <p>Radius: ${data.distance_km} km</p>
    `;
    resultsContent.appendChild(searchInfo);
    
    // Add cyclone cards
    data.cyclones.forEach((cyclone, index) => {
        const card = createCycloneCard(cyclone, index);
        resultsContent.appendChild(card);
    });
}

// ===============================================
// CREATE CYCLONE CARD
// ===============================================

function createCycloneCard(cyclone, index) {
    const card = document.createElement('div');
    card.className = 'cyclone-card';
    card.dataset.stormId = cyclone.storm_id;
    
    const startDate = new Date(cyclone.start_date).toLocaleDateString();
    const endDate = new Date(cyclone.end_date).toLocaleDateString();
    
    card.innerHTML = `
        <div class="cyclone-header">
            <div class="cyclone-name">${cyclone.cyclone_name}</div>
            <div class="cyclone-year">${cyclone.year}</div>
        </div>
        <div class="cyclone-details">
            <p><strong>Basin:</strong> ${cyclone.basin}</p>
            <p><strong>Period:</strong> ${startDate} - ${endDate}</p>
            <p><strong>Observations:</strong> ${cyclone.num_observations} points</p>
            ${cyclone.max_wind_speed ? `<p><strong>Max Wind:</strong> ${cyclone.max_wind_speed} knots</p>` : ''}
            ${cyclone.min_pressure ? `<p><strong>Min Pressure:</strong> ${cyclone.min_pressure} mb</p>` : ''}
            ${cyclone.duration_hours ? `<p><strong>Duration:</strong> ${cyclone.duration_hours.toFixed(1)} hours</p>` : ''}
        </div>
        <div class="distance-badge">${cyclone.distance_km} km away</div>
    `;
    
    // Add click event to highlight track
    card.addEventListener('click', () => highlightCycloneTrack(cyclone.storm_id));
    
    return card;
}

// ===============================================
// HIGHLIGHT CYCLONE TRACK
// ===============================================

function highlightCycloneTrack(stormId) {
    // Remove active class from all cards
    document.querySelectorAll('.cyclone-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // Add active class to clicked card
    const card = document.querySelector(`[data-storm-id="${stormId}"]`);
    if (card) {
        card.classList.add('active');
    }
    
    // Reset all tracks to normal
    cycloneLayers.forEach(item => {
        item.layer.setStyle({
            weight: 3,
            opacity: 0.7
        });
    });
    
    // Highlight selected track
    const selectedTrack = cycloneLayers.find(item => item.stormId === stormId);
    if (selectedTrack) {
        selectedTrack.layer.setStyle({
            weight: 5,
            opacity: 1
        });
        selectedTrack.layer.bringToFront();
        
        // Fit bounds to track
        map.fitBounds(selectedTrack.layer.getBounds(), { padding: [50, 50] });
    }
}

// ===============================================
// UTILITY FUNCTIONS
// ===============================================

function getColorForCyclone(stormId) {
    // Generate consistent color based on storm ID
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
    ];
    
    let hash = 0;
    for (let i = 0; i < stormId.length; i++) {
        hash = stormId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

function showError(message) {
    const resultsContent = document.getElementById('results-content');
    resultsContent.innerHTML = `
        <div class="no-results">
            <p>❌ Error</p>
            <p class="info-text">${message}</p>
        </div>
    `;
}

function clearMap() {
    // Remove click marker
    if (clickMarker) {
        map.removeLayer(clickMarker);
        clickMarker = null;
    }
    
    // Remove search circle
    if (searchCircle) {
        map.removeLayer(searchCircle);
        searchCircle = null;
    }
    
    // Remove all cyclone tracks
    cycloneLayers.forEach(item => {
        map.removeLayer(item.layer);
    });
    cycloneLayers = [];
    
    // Reset results
    currentCyclones = [];
}

// ===============================================
// EVENT LISTENERS
// ===============================================

document.getElementById('clear-btn').addEventListener('click', () => {
    clearMap();

    // ← ADD THIS LINE
    if (typeof clearTsunamiLayers !== 'undefined') clearTsunamiLayers();

    // Reset results panel
    document.getElementById('results-header').innerHTML = `
        <h2>Results</h2>
        <p class="subtitle">Click on the map to start searching</p>
    `;
    
    document.getElementById('results-content').innerHTML = `
        <div class="welcome-message">
            <p>👈 Click anywhere on the map to find cyclones</p>
            <p class="info-text">
                The system will search for all historical cyclones that passed 
                within your selected radius of the clicked point.
            </p>
        </div>
    `;
});

// ===============================================
// INITIALIZE ON PAGE LOAD
// ===============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Cyclone Tracker...');
    initMap();
    initTsunamiTracker();   // ← always call directly, no typeof check needed
    console.log('Ready! Click on the map to search.');
});

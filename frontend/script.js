// ===============================================
// CYCLONE TRACKER - JAVASCRIPT
// ===============================================

// Configuration
const CONFIG = {
    API_BASE_URL: 'http://localhost:8000/api',
    CYCLONE_DEFAULT_DISTANCE: 100000, // 100km in meters
    TSUNAMI_DEFAULT_DISTANCE: 500000, // 500km in meters
    MAP_CENTER: [20, 0],
    MAP_ZOOM: 2
};

// Global variables
let map;
let cycloneLayers = [];
let tsunamiMarkers = [];
let clickMarker = null;
let searchCircle = null;
let currentCyclones = [];
let currentTsunamis = [];
let filteredCyclones = [];
let filteredTsunamis = [];
let currentSearchData = null;
let windSpeedChart = null;
let activeMode = 'cyclones'; // 'cyclones' or 'tsunamis'

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
    const distance = parseInt(document.getElementById('distance-select').value);
    
    console.log(`Map clicked at: ${lat.toFixed(4)}, ${lon.toFixed(4)} [Mode: ${activeMode}]`);
    
    // Clear previous results
    clearMap();
    
    // Add click marker
    clickMarker = L.marker([lat, lon], {
        icon: L.divIcon({
            className: 'click-marker',
            html: '<div style="background-color: red; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
            iconSize: [12, 12]
        })
    }).addTo(map);
    
    // Add search circle
    searchCircle = L.circle([lat, lon], {
        radius: distance,
        color: activeMode === 'cyclones' ? '#667eea' : '#20c997',
        fillColor: activeMode === 'cyclones' ? '#667eea' : '#20c997',
        fillOpacity: 0.1,
        weight: 2
    }).addTo(map);
    
    // Show loading
    showLoading(true);
    
    // Search based on active mode
    try {
        if (activeMode === 'cyclones') {
            await searchCyclones(lat, lon, distance);
        } else {
            await searchTsunamis(lat, lon, distance);
        }
    } catch (error) {
        console.error(`Error searching ${activeMode}:`, error);
        showError(`Failed to search for ${activeMode}. Please check if the API server is running.`);
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
    filteredCyclones = [...data.cyclones];
    currentSearchData = data;
    
    // Show filters
    document.getElementById('filters-section').classList.remove('hidden');
    
    // Reset filters and update sort options for cyclones
    document.getElementById('sort-select').innerHTML = `
        <option value="distance">Distance (Near to Far)</option>
        <option value="windspeed">Wind Speed (High to Low)</option>
        <option value="year">Year (Recent to Old)</option>
    `;
    document.getElementById('year-from').value = '';
    document.getElementById('year-to').value = '';
    
    // Update results panel
    updateResultsPanel(data);
    
    // Load and display cyclone tracks
    if (data.cyclones.length > 0) {
        await loadCycloneTracks(data.cyclones);
    }
}

// ===============================================
// SEARCH TSUNAMIS
// ===============================================

async function searchTsunamis(lat, lon, distance) {
    const url = `${CONFIG.API_BASE_URL}/tsunamis-near?lat=${lat}&lon=${lon}&distance=${distance}`;
    
    console.log('Fetching:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log(`Found ${data.count} tsunamis`);
    
    currentTsunamis = data.events;
    filteredTsunamis = [...data.events];
    currentSearchData = {
        clicked_lat: data.latitude,
        clicked_lon: data.longitude,
        distance_km: data.distance_km,
        events_found: data.count
    };
    
    // Show filters
    document.getElementById('filters-section').classList.remove('hidden');
    
    // Reset filters
    document.getElementById('sort-select').innerHTML = `
        <option value="distance">Distance (Near to Far)</option>
        <option value="year">Year (Recent to Old)</option>
        <option value="magnitude">Water Height (High to Low)</option>
    `;
    document.getElementById('year-from').value = '';
    document.getElementById('year-to').value = '';
    
    // Update results panel
    updateTsunamiResultsPanel(currentSearchData);
    
    // Display tsunami markers
    if (data.events.length > 0) {
        displayTsunamiMarkers(data.events);
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
// DISPLAY TSUNAMI MARKERS
// ===============================================

function displayTsunamiMarkers(tsunamis) {
    console.log(`Displaying ${tsunamis.length} tsunami markers...`);
    
    tsunamis.forEach(tsunami => {
        if (!tsunami.latitude || !tsunami.longitude) return;
        
        // Determine marker size and color based on water height
        let markerSize = 10;
        let markerColor = '#20c997';
        
        if (tsunami.max_water_height) {
            if (tsunami.max_water_height >= 10) {
                markerSize = 20;
                markerColor = '#dc3545'; // Red - Catastrophic
            } else if (tsunami.max_water_height >= 5) {
                markerSize = 16;
                markerColor = '#fd7e14'; // Orange - Major
            } else if (tsunami.max_water_height >= 2) {
                markerSize = 13;
                markerColor = '#ffc107'; // Yellow - Moderate
            } else {
                markerSize = 10;
                markerColor = '#20c997'; // Green - Minor
            }
        }
        
        const marker = L.circleMarker([tsunami.latitude, tsunami.longitude], {
            radius: markerSize / 2,
            fillColor: markerColor,
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.7
        }).addTo(map);
        
        // Create popup
        const dateStr = tsunami.year ? 
            `${tsunami.year}${tsunami.month ? '-' + String(tsunami.month).padStart(2, '0') : ''}${tsunami.day ? '-' + String(tsunami.day).padStart(2, '0') : ''}` 
            : 'Unknown';
        
        marker.bindPopup(`
            <div class="popup-content">
                <h3>🌊 ${tsunami.location_name || 'Unknown Location'}</h3>
                <p><strong>Date:</strong> ${dateStr}</p>
                <p><strong>Country:</strong> ${tsunami.country || 'N/A'}</p>
                <p><strong>Max Water Height:</strong> ${tsunami.max_water_height ? tsunami.max_water_height + ' m' : 'N/A'}</p>
                <p><strong>Earthquake Mag:</strong> ${tsunami.earthquake_magnitude || 'N/A'}</p>
                <p><strong>Deaths:</strong> ${tsunami.total_deaths || tsunami.deaths || 'N/A'}</p>
                <p><strong>Distance:</strong> ${tsunami.distance_km ? tsunami.distance_km.toFixed(2) + ' km' : 'N/A'}</p>
            </div>
        `);
        
        tsunamiMarkers.push({
            id: tsunami.id,
            marker: marker,
            data: tsunami
        });
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
        <h2>Results (${filteredCyclones.length}${filteredCyclones.length !== data.cyclones_found ? ' of ' + data.cyclones_found : ''})</h2>
        <p class="subtitle">Found within ${data.distance_km} km</p>
    `;
    
    // Clear content
    resultsContent.innerHTML = '';
    
    if (filteredCyclones.length === 0) {
        resultsContent.innerHTML = `
            <div class="no-results">
                <p>😕 No cyclones found</p>
                <p class="info-text">Try adjusting filters or increasing the search radius</p>
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
    
    // Add wind speed distribution chart
    const chartContainer = createWindSpeedChart(filteredCyclones);
    resultsContent.appendChild(chartContainer);
    
    // Create table
    const table = createResultsTable(filteredCyclones);
    resultsContent.appendChild(table);
}

// ===============================================
// UPDATE TSUNAMI RESULTS PANEL
// ===============================================

function updateTsunamiResultsPanel(data) {
    const resultsHeader = document.getElementById('results-header');
    const resultsContent = document.getElementById('results-content');
    
    // Update header
    resultsHeader.innerHTML = `
        <h2>Results (${filteredTsunamis.length}${filteredTsunamis.length !== data.events_found ? ' of ' + data.events_found : ''})</h2>
        <p class="subtitle">Found within ${data.distance_km} km</p>
    `;
    
    // Clear content
    resultsContent.innerHTML = '';
    
    if (filteredTsunamis.length === 0) {
        resultsContent.innerHTML = `
            <div class="no-results">
                <p>😕 No tsunamis found</p>
                <p class="info-text">Try adjusting filters or increasing the search radius</p>
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
    
    // Create tsunami table
    const table = createTsunamiTable(filteredTsunamis);
    resultsContent.appendChild(table);
}

// ===============================================
// CREATE WIND SPEED DISTRIBUTION CHART
// ===============================================

function createWindSpeedChart(cyclones) {
    const container = document.createElement('div');
    container.className = 'chart-container';
    
    // Create canvas
    const canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'chart-canvas-wrapper';
    
    const canvas = document.createElement('canvas');
    canvas.id = 'windSpeedChart';
    canvasWrapper.appendChild(canvas);
    
    container.innerHTML = `
        <h3>🌪️ Maximum Wind Speed Distribution</h3>
    `;
    container.appendChild(canvasWrapper);
    
    // Calculate distribution
    const distribution = calculateWindSpeedDistribution(cyclones);
    
    // Destroy previous chart if exists
    if (windSpeedChart) {
        windSpeedChart.destroy();
    }
    
    // Create chart
    const ctx = canvas.getContext('2d');
    windSpeedChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [
                'Weak\n(0-33 kts)',
                'Moderate\n(34-63 kts)',
                'Strong\n(64-95 kts)',
                'Very Strong\n(96+ kts)',
                'N/A'
            ],
            datasets: [{
                label: 'Number of Cyclones',
                data: [
                    distribution.weak,
                    distribution.moderate,
                    distribution.strong,
                    distribution.veryStrong,
                    distribution.na
                ],
                backgroundColor: [
                    '#52B788',  // Green - Weak
                    '#F7DC6F',  // Yellow - Moderate
                    '#FFA07A',  // Orange - Strong
                    '#FF6B6B',  // Red - Very Strong
                    '#CCCCCC'   // Gray - N/A
                ],
                borderColor: [
                    '#45a074',
                    '#e0c65c',
                    '#e68f68',
                    '#e55858',
                    '#b3b3b3'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const count = context.parsed.y;
                            const total = cyclones.length;
                            const percentage = ((count / total) * 100).toFixed(1);
                            return `${count} cyclones (${percentage}%)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: 'Number of Cyclones'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Max Wind Speed Category'
                    }
                }
            }
        }
    });
    
    // Add statistics
    const statsDiv = document.createElement('div');
    statsDiv.className = 'chart-stats';
    statsDiv.innerHTML = `
        <div class="stat-item">
            <div class="stat-label">Max Wind Speed</div>
            <div class="stat-value">${distribution.maxWind}<span class="stat-unit"> kts</span></div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Avg Wind Speed</div>
            <div class="stat-value">${distribution.avgWind}<span class="stat-unit"> kts</span></div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Total Cyclones</div>
            <div class="stat-value">${cyclones.length}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">With Wind Data</div>
            <div class="stat-value">${distribution.withData}<span class="stat-unit"> of ${cyclones.length}</span></div>
        </div>
    `;
    container.appendChild(statsDiv);
    
    return container;
}

function calculateWindSpeedDistribution(cyclones) {
    let weak = 0;        // 0-33 kts (Tropical Depression)
    let moderate = 0;    // 34-63 kts (Tropical Storm)
    let strong = 0;      // 64-95 kts (Category 1-2 Hurricane)
    let veryStrong = 0;  // 96+ kts (Category 3-5 Hurricane)
    let na = 0;          // No data
    
    let maxWind = 0;
    let totalWind = 0;
    let countWithData = 0;
    
    cyclones.forEach(cyclone => {
        const wind = cyclone.max_wind_speed;
        
        if (!wind || wind === 0) {
            na++;
        } else {
            countWithData++;
            totalWind += wind;
            if (wind > maxWind) maxWind = wind;
            
            if (wind < 34) weak++;
            else if (wind < 64) moderate++;
            else if (wind < 96) strong++;
            else veryStrong++;
        }
    });
    
    const avgWind = countWithData > 0 ? Math.round(totalWind / countWithData) : 0;
    
    return {
        weak,
        moderate,
        strong,
        veryStrong,
        na,
        maxWind,
        avgWind: avgWind > 0 ? avgWind : 'N/A',
        withData: countWithData
    };
}

// ===============================================
// CREATE RESULTS TABLE
// ===============================================

function createResultsTable(cyclones) {
    const container = document.createElement('div');
    container.className = 'results-table-container';
    
    const table = document.createElement('table');
    table.className = 'results-table';
    
    // Create header
    table.innerHTML = `
        <thead>
            <tr>
                <th>Name</th>
                <th>Year</th>
                <th>Distance (km)</th>
                <th>Max Wind Speed (kts)</th>
                <th>Min Pressure (mb)</th>
                <th>Start Date</th>
                <th>End Date</th>
            </tr>
        </thead>
        <tbody id="results-tbody">
        </tbody>
    `;
    
    const tbody = table.querySelector('tbody');
    
    // Create rows
    cyclones.forEach((cyclone, index) => {
        const row = createTableRow(cyclone, index);
        tbody.appendChild(row);
    });
    
    container.appendChild(table);
    return container;
}

function createTableRow(cyclone, index) {
    const row = document.createElement('tr');
    row.dataset.stormId = cyclone.storm_id;
    
    const startDate = new Date(cyclone.start_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    const endDate = new Date(cyclone.end_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    // Determine wind speed class
    let windClass = '';
    let windValue = 'N/A';
    if (cyclone.max_wind_speed && cyclone.max_wind_speed > 0) {
        windValue = cyclone.max_wind_speed;
        if (cyclone.max_wind_speed >= 64) windClass = 'wind-high';
        else if (cyclone.max_wind_speed >= 34) windClass = 'wind-medium';
        else windClass = 'wind-low';
    }
    
    const pressureValue = (cyclone.min_pressure && cyclone.min_pressure > 0) 
        ? cyclone.min_pressure 
        : 'N/A';
    
    row.innerHTML = `
        <td class="cyclone-name-cell">${cyclone.cyclone_name}</td>
        <td class="year-cell number">${cyclone.year}</td>
        <td class="number">${cyclone.distance_km.toFixed(2)}</td>
        <td class="wind-cell number ${windClass} ${windValue === 'N/A' ? 'na-value' : ''}">${windValue}</td>
        <td class="number ${pressureValue === 'N/A' ? 'na-value' : ''}">${pressureValue}</td>
        <td>${startDate}</td>
        <td>${endDate}</td>
    `;
    
    // Add click event
    row.addEventListener('click', () => {
        highlightCycloneTrack(cyclone.storm_id);
        
        // Remove active class from all rows
        document.querySelectorAll('.results-table tbody tr').forEach(r => {
            r.classList.remove('active');
        });
        
        // Add active class to clicked row
        row.classList.add('active');
    });
    
    return row;
}

// ===============================================
// CREATE TSUNAMI TABLE
// ===============================================

function createTsunamiTable(tsunamis) {
    const container = document.createElement('div');
    container.className = 'results-table-container';
    
    const table = document.createElement('table');
    table.className = 'results-table';
    
    // Create header
    table.innerHTML = `
        <thead>
            <tr>
                <th>Location</th>
                <th>Year</th>
                <th>Distance (km)</th>
                <th>Max Water Height (m)</th>
                <th>Earthquake Mag</th>
                <th>Deaths</th>
                <th>Damage ($M)</th>
            </tr>
        </thead>
        <tbody id="results-tbody">
        </tbody>
    `;
    
    const tbody = table.querySelector('tbody');
    
    // Create rows
    tsunamis.forEach((tsunami, index) => {
        const row = createTsunamiTableRow(tsunami, index);
        tbody.appendChild(row);
    });
    
    container.appendChild(table);
    return container;
}

function createTsunamiTableRow(tsunami, index) {
    const row = document.createElement('tr');
    row.dataset.tsunamiId = tsunami.id;
    
    // Format location
    const location = tsunami.location_name || 'Unknown';
    const country = tsunami.country || '';
    const fullLocation = country ? `${location}, ${country}` : location;
    
    // Water height with color coding
    let heightClass = '';
    let heightValue = 'N/A';
    if (tsunami.max_water_height && tsunami.max_water_height > 0) {
        heightValue = tsunami.max_water_height.toFixed(2);
        if (tsunami.max_water_height >= 10) heightClass = 'wind-high';
        else if (tsunami.max_water_height >= 5) heightClass = 'wind-medium';
        else if (tsunami.max_water_height >= 2) heightClass = 'wind-low';
    }
    
    const eqMag = tsunami.earthquake_magnitude ? tsunami.earthquake_magnitude.toFixed(1) : 'N/A';
    const deaths = tsunami.total_deaths || tsunami.deaths || 'N/A';
    const damage = tsunami.total_damage_mil || tsunami.damage_mil;
    const damageValue = damage ? damage.toFixed(2) : 'N/A';
    
    row.innerHTML = `
        <td class="cyclone-name-cell" title="${fullLocation}">${fullLocation}</td>
        <td class="year-cell number">${tsunami.year || 'N/A'}</td>
        <td class="number">${tsunami.distance_km ? tsunami.distance_km.toFixed(2) : 'N/A'}</td>
        <td class="wind-cell number ${heightClass} ${heightValue === 'N/A' ? 'na-value' : ''}">${heightValue}</td>
        <td class="number">${eqMag}</td>
        <td class="number ${deaths === 'N/A' ? 'na-value' : ''}">${deaths}</td>
        <td class="number ${damageValue === 'N/A' ? 'na-value' : ''}">${damageValue}</td>
    `;
    
    // Add click event to zoom to marker
    row.addEventListener('click', () => {
        highlightTsunamiMarker(tsunami.id);
        
        // Remove active class from all rows
        document.querySelectorAll('.results-table tbody tr').forEach(r => {
            r.classList.remove('active');
        });
        
        // Add active class to clicked row
        row.classList.add('active');
    });
    
    return row;
}

// ===============================================
// HIGHLIGHT CYCLONE TRACK
// ===============================================

function highlightCycloneTrack(stormId) {
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
        
        // Fit bounds to track with animation
        map.fitBounds(selectedTrack.layer.getBounds(), { 
            padding: [50, 50],
            animate: true,
            duration: 0.5
        });
    }
}

// ===============================================
// HIGHLIGHT TSUNAMI MARKER
// ===============================================

function highlightTsunamiMarker(tsunamiId) {
    const selected = tsunamiMarkers.find(item => item.id === tsunamiId);
    if (selected && selected.data.latitude && selected.data.longitude) {
        // Zoom to marker
        map.setView([selected.data.latitude, selected.data.longitude], 8, {
            animate: true,
            duration: 0.5
        });
        
        // Open popup
        selected.marker.openPopup();
        
        // Pulse effect
        selected.marker.setStyle({
            radius: 12,
            fillOpacity: 1
        });
        
        setTimeout(() => {
            selected.marker.setStyle({
                fillOpacity: 0.7
            });
        }, 500);
    }
}

// ===============================================
// SORTING AND FILTERING
// ===============================================

function applySorting(sortBy) {
    console.log(`Sorting by: ${sortBy}`);
    
    if (activeMode === 'cyclones') {
        filteredCyclones.sort((a, b) => {
            switch (sortBy) {
                case 'distance':
                    return a.distance_km - b.distance_km;
                
                case 'windspeed':
                    const windA = a.max_wind_speed || 0;
                    const windB = b.max_wind_speed || 0;
                    return windB - windA;
                
                case 'year':
                    return b.year - a.year;
                
                default:
                    return 0;
            }
        });
        
        // Move N/A wind speeds to end if sorting by windspeed
        if (sortBy === 'windspeed') {
            const withWind = filteredCyclones.filter(c => c.max_wind_speed && c.max_wind_speed > 0);
            const withoutWind = filteredCyclones.filter(c => !c.max_wind_speed || c.max_wind_speed === 0);
            filteredCyclones = [...withWind, ...withoutWind];
        }
        
        updateResultsPanel(currentSearchData);
    } else {
        // Tsunami sorting
        filteredTsunamis.sort((a, b) => {
            switch (sortBy) {
                case 'distance':
                    return (a.distance_km || 0) - (b.distance_km || 0);
                
                case 'magnitude':
                    const heightA = a.max_water_height || 0;
                    const heightB = b.max_water_height || 0;
                    return heightB - heightA;
                
                case 'year':
                    return (b.year || 0) - (a.year || 0);
                
                default:
                    return 0;
            }
        });
        
        // Move N/A water heights to end if sorting by magnitude
        if (sortBy === 'magnitude') {
            const withHeight = filteredTsunamis.filter(t => t.max_water_height && t.max_water_height > 0);
            const withoutHeight = filteredTsunamis.filter(t => !t.max_water_height || t.max_water_height === 0);
            filteredTsunamis = [...withHeight, ...withoutHeight];
        }
        
        updateTsunamiResultsPanel(currentSearchData);
    }
}

function applyYearFilter() {
    const yearFrom = parseInt(document.getElementById('year-from').value);
    const yearTo = parseInt(document.getElementById('year-to').value);
    
    console.log(`Filtering years: ${yearFrom || 'any'} to ${yearTo || 'any'}`);
    
    if (activeMode === 'cyclones') {
        // Start with all cyclones
        filteredCyclones = [...currentCyclones];
        
        // Apply year filter
        if (yearFrom || yearTo) {
            filteredCyclones = filteredCyclones.filter(cyclone => {
                if (yearFrom && cyclone.year < yearFrom) return false;
                if (yearTo && cyclone.year > yearTo) return false;
                return true;
            });
        }
    } else {
        // Start with all tsunamis
        filteredTsunamis = [...currentTsunamis];
        
        // Apply year filter
        if (yearFrom || yearTo) {
            filteredTsunamis = filteredTsunamis.filter(tsunami => {
                if (!tsunami.year) return false;
                if (yearFrom && tsunami.year < yearFrom) return false;
                if (yearTo && tsunami.year > yearTo) return false;
                return true;
            });
        }
    }
    
    // Re-apply current sorting
    const sortBy = document.getElementById('sort-select').value;
    applySorting(sortBy);
}

// ===============================================
// CSV DOWNLOAD
// ===============================================

function downloadCSV() {
    if (activeMode === 'cyclones') {
        if (filteredCyclones.length === 0) {
            alert('No results to download');
            return;
        }
        
        console.log(`Downloading CSV with ${filteredCyclones.length} cyclones`);
        
        const headers = ['Name', 'Year', 'Distance_km', 'Max_Wind_Speed_kts', 'Min_Pressure_mb', 'Start_Date', 'End_Date'];
        const rows = [headers];
        
        filteredCyclones.forEach(cyclone => {
            rows.push([
                `"${cyclone.cyclone_name.replace(/"/g, '""')}"`,
                cyclone.year,
                cyclone.distance_km.toFixed(2),
                cyclone.max_wind_speed || 'N/A',
                cyclone.min_pressure || 'N/A',
                new Date(cyclone.start_date).toISOString().split('T')[0],
                new Date(cyclone.end_date).toISOString().split('T')[0]
            ]);
        });
        
        const csvContent = rows.map(row => 
            Array.isArray(row) ? row.join(',') : row
        ).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cyclones_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
    } else {
        // Tsunami CSV download
        if (filteredTsunamis.length === 0) {
            alert('No results to download');
            return;
        }
        
        console.log(`Downloading CSV with ${filteredTsunamis.length} tsunamis`);
        
        const headers = ['Location', 'Country', 'Year', 'Distance_km', 'Max_Water_Height_m', 'Earthquake_Magnitude', 'Deaths', 'Damage_Million_USD'];
        const rows = [headers];
        
        filteredTsunamis.forEach(tsunami => {
            rows.push([
                `"${(tsunami.location_name || 'Unknown').replace(/"/g, '""')}"`,
                `"${(tsunami.country || 'N/A').replace(/"/g, '""')}"`,
                tsunami.year || 'N/A',
                tsunami.distance_km ? tsunami.distance_km.toFixed(2) : 'N/A',
                tsunami.max_water_height ? tsunami.max_water_height.toFixed(2) : 'N/A',
                tsunami.earthquake_magnitude || 'N/A',
                tsunami.total_deaths || tsunami.deaths || 'N/A',
                tsunami.total_damage_mil || tsunami.damage_mil || 'N/A'
            ]);
        });
        
        const csvContent = rows.map(row => 
            Array.isArray(row) ? row.join(',') : row
        ).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tsunamis_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
    
    console.log('CSV downloaded successfully');
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
    
    // Remove all tsunami markers
    tsunamiMarkers.forEach(item => {
        map.removeLayer(item.marker);
    });
    tsunamiMarkers = [];
    
    // Reset results
    currentCyclones = [];
    currentTsunamis = [];
    filteredCyclones = [];
    filteredTsunamis = [];
    currentSearchData = null;
    
    // Destroy chart if exists
    if (windSpeedChart) {
        windSpeedChart.destroy();
        windSpeedChart = null;
    }
    
    // Hide filters
    document.getElementById('filters-section').classList.add('hidden');
}

// ===============================================
// TAB SWITCHING
// ===============================================

function switchTab(mode) {
    console.log(`Switching to ${mode} mode`);
    
    activeMode = mode;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update active mode label
    document.getElementById('active-mode-label').textContent = 
        mode === 'cyclones' ? 'Cyclones' : 'Tsunamis';
    
    // Update distance options
    const distanceSelect = document.getElementById('distance-select');
    if (mode === 'cyclones') {
        distanceSelect.innerHTML = `
            <option value="50000">50 km</option>
            <option value="100000" selected>100 km</option>
            <option value="200000">200 km</option>
            <option value="500000">500 km</option>
        `;
    } else {
        distanceSelect.innerHTML = `
            <option value="200000">200 km</option>
            <option value="500000" selected>500 km</option>
            <option value="1000000">1000 km</option>
            <option value="2000000">2000 km</option>
        `;
    }
    
    // Clear map and results
    clearMap();
    
    // Reset results panel
    document.getElementById('results-header').innerHTML = `
        <h2>Results</h2>
        <p class="subtitle">Click on the map to start searching</p>
    `;
    
    document.getElementById('results-content').innerHTML = `
        <div class="welcome-message">
            <p>👈 Click anywhere on the map to find ${mode}</p>
            <p class="info-text">
                The system will search for all historical ${mode} that ${mode === 'cyclones' ? 'passed' : 'occurred'} 
                within your selected radius of the clicked point.
            </p>
        </div>
    `;
}

// ===============================================
// EVENT LISTENERS
// ===============================================

document.getElementById('clear-btn').addEventListener('click', () => {
    clearMap();
    
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

// Sort dropdown
document.getElementById('sort-select').addEventListener('change', (e) => {
    applySorting(e.target.value);
});

// Year filter apply button
document.getElementById('apply-filter-btn').addEventListener('click', () => {
    applyYearFilter();
});

// Download CSV button
document.getElementById('download-csv-btn').addEventListener('click', () => {
    downloadCSV();
});

// Tab buttons
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
    });
});

// ===============================================
// INITIALIZE ON PAGE LOAD
// ===============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Natural Disaster Tracker...');
    initMap();
    console.log('Ready! Click on the map to search for cyclones or tsunamis.');
});

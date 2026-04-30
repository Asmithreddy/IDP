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
let windAnalysisChart = null;
let currentWindAnalysis = null;
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

    // Wind speed intensity legend (bottom-left)
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'wind-legend');
        div.innerHTML = `
            <div class="wind-legend-title">Wind Speed Intensity</div>
            <div class="wind-legend-item"><span class="wind-legend-swatch" style="background:#444444"></span> N/A</div>
            <div class="wind-legend-item"><span class="wind-legend-swatch" style="background:#5dade2"></span> TD &lt;34 kts</div>
            <div class="wind-legend-item"><span class="wind-legend-swatch" style="background:#27ae60"></span> TS 34–63 kts</div>
            <div class="wind-legend-item"><span class="wind-legend-swatch" style="background:#f9ca24"></span> Cat 1 64–82 kts</div>
            <div class="wind-legend-item"><span class="wind-legend-swatch" style="background:#f0932b"></span> Cat 2 83–95 kts</div>
            <div class="wind-legend-item"><span class="wind-legend-swatch" style="background:#e55039"></span> Cat 3 96–112 kts</div>
            <div class="wind-legend-item"><span class="wind-legend-swatch" style="background:#c0392b"></span> Cat 4 113–136 kts</div>
            <div class="wind-legend-item"><span class="wind-legend-swatch" style="background:#8e44ad"></span> Cat 5 ≥137 kts</div>
        `;
        return div;
    };
    legend.addTo(map);

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
    
    // Fire wind analysis in parallel with track loading
    const windAnalysisPromise = fetchWindAnalysis(lat, lon, distance);

    // Update results panel
    updateResultsPanel(data);
    
    // Load and display cyclone tracks
    if (data.cyclones.length > 0) {
        await loadCycloneTracks(data.cyclones);
    }

    // Inject wind analysis once it resolves
    currentWindAnalysis = await windAnalysisPromise;
    injectWindAnalysisSection(currentWindAnalysis);
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
            const [track, trackPoints] = await Promise.all([
                fetchCycloneTrack(cyclone.storm_id),
                fetchCycloneTrackPoints(cyclone.storm_id)
            ]);
            if (track) {
                displayCycloneTrack(track, cyclone, trackPoints);
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
// FETCH CYCLONE TRACK POINTS (individual observations)
// ===============================================

async function fetchCycloneTrackPoints(stormId) {
    const url = `${CONFIG.API_BASE_URL}/track-points/${stormId}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        console.warn(`Could not fetch track points for ${stormId}`);
        return null;
    }
    
    return await response.json();
}

// ===============================================
// FETCH WIND ANALYSIS (GEV / return levels)
// ===============================================

async function fetchWindAnalysis(lat, lon, distance) {
    try {
        const url = `${CONFIG.API_BASE_URL}/wind-analysis?lat=${lat}&lon=${lon}&distance=${distance}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.warn('Wind analysis fetch failed:', e);
        return null;
    }
}

// ===============================================
// DISPLAY CYCLONE TRACK
// ===============================================

function displayCycloneTrack(track, cyclone, trackPoints) {
    const fallbackColor = getColorForCyclone(track.storm_id);
    
    const natureLabels = {
        'TS': 'Tropical Storm', 'HU': 'Hurricane', 'TD': 'Tropical Depression',
        'ET': 'Extratropical', 'SD': 'Sub-tropical Depr.', 'SS': 'Sub-tropical Storm',
        'NR': 'Not Reported', 'MX': 'Mixed'
    };

    const trackPopupHtml = `
        <div class="popup-content">
            <h3>${track.cyclone_name}</h3>
            <p><strong>Year:</strong> ${track.year}</p>
            <p><strong>Storm ID:</strong> ${track.storm_id}</p>
            <p><strong>Distance:</strong> ${cyclone.distance_km} km</p>
            <p><strong>Max Wind:</strong> ${cyclone.max_wind_speed || 'N/A'} knots</p>
            <p><strong>Duration:</strong> ${cyclone.duration_hours ? cyclone.duration_hours.toFixed(1) + ' hours' : 'N/A'}</p>
        </div>
    `;

    const segmentLayers = [];
    const dotLayers = [];

    if (trackPoints && trackPoints.points && trackPoints.points.length > 0) {
        const pts = trackPoints.points;

        // Draw one colored segment between each pair of consecutive points.
        // Each segment takes the wind-speed color of its starting point.
        for (let i = 0; i < pts.length - 1; i++) {
            const segColor = getWindSpeedColor(pts[i].wind_speed);
            const seg = L.polyline(
                [[pts[i].lat, pts[i].lon], [pts[i + 1].lat, pts[i + 1].lon]],
                { color: segColor, weight: 3.5, opacity: 0.85 }
            ).addTo(map);
            seg.bindPopup(trackPopupHtml);
            segmentLayers.push(seg);
        }

        // Draw a dot at each recorded observation.
        pts.forEach((pt, idx) => {
            const isFirst = idx === 0;
            const isLast  = idx === pts.length - 1;
            const dotColor = getWindSpeedColor(pt.wind_speed);

            const dot = L.circleMarker([pt.lat, pt.lon], {
                radius:      (isFirst || isLast) ? 6 : 4,
                fillColor:   dotColor,
                color:       'white',
                weight:      (isFirst || isLast) ? 2 : 1.5,
                opacity:     1,
                fillOpacity: 0.95
            }).addTo(map);

            let timeStr = 'N/A';
            if (pt.iso_time) {
                timeStr = new Date(pt.iso_time).toUTCString().replace(' GMT', ' UTC');
            }
            const natureStr = pt.nature ? (natureLabels[pt.nature] || pt.nature) : 'N/A';
            const label = isFirst ? ' (Start)' : isLast ? ' (End)' : '';
            const windStr = pt.wind_speed != null && pt.wind_speed > 0
                ? `${pt.wind_speed} kts`
                : 'N/A';
            const catLabel = getCategoryLabel(pt.wind_speed);

            dot.bindPopup(`
                <div class="popup-content">
                    <h3>${track.cyclone_name}${label}</h3>
                    <p><strong>Time (UTC):</strong> ${timeStr}</p>
                    <p><strong>Position:</strong> ${pt.lat.toFixed(2)}°, ${pt.lon.toFixed(2)}°</p>
                    <p><strong>Wind Speed:</strong> ${windStr}</p>
                    <p><strong>Category:</strong> <span style="color:${dotColor};font-weight:bold">${catLabel}</span></p>
                    <p><strong>Pressure:</strong> ${pt.pressure != null ? pt.pressure + ' mb' : 'N/A'}</p>
                    <p><strong>Dist to Land:</strong> ${pt.dist2land != null ? pt.dist2land + ' km' : 'N/A'}</p>
                    <p><strong>Nature:</strong> ${natureStr}</p>
                    <p><strong>Obs #:</strong> ${idx + 1} of ${pts.length}</p>
                </div>
            `);

            dotLayers.push(dot);
        });

        cycloneLayers.push({
            stormId:         track.storm_id,
            layer:           null,
            segments:        segmentLayers,
            dots:            dotLayers,
            color:           fallbackColor,
            trackPointsData: trackPoints   // raw data kept for CSV export
        });

    } else {
        // Fallback – no point data, draw a plain colored polyline
        const coordinates = track.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        const polyline = L.polyline(coordinates, {
            color: fallbackColor, weight: 3, opacity: 0.7
        }).addTo(map);
        polyline.bindPopup(trackPopupHtml);

        cycloneLayers.push({
            stormId:         track.storm_id,
            layer:           polyline,
            segments:        [],
            dots:            [],
            color:           fallbackColor,
            trackPointsData: null
        });
    }
}

// Returns a short human-readable category label for a wind speed value
function getCategoryLabel(windSpeed) {
    if (windSpeed == null || windSpeed <= 0) return 'N/A';
    if (windSpeed < 34)  return 'Tropical Depression';
    if (windSpeed < 64)  return 'Tropical Storm';
    if (windSpeed < 83)  return 'Hurricane Cat 1';
    if (windSpeed < 96)  return 'Hurricane Cat 2';
    if (windSpeed < 113) return 'Hurricane Cat 3';
    if (windSpeed < 137) return 'Hurricane Cat 4';
    return 'Hurricane Cat 5';
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
        let nearestHtml = '';
        if (data && data.nearest_cyclone) {
            const nc = data.nearest_cyclone;
            nearestHtml = `
                <div class="nearest-cyclone-card">
                    <p class="nearest-label">Nearest cyclone on record:</p>
                    <p class="nearest-name">${nc.cyclone_name} <span class="nearest-year">(${nc.year})</span></p>
                    <p class="nearest-dist">${nc.distance_km.toFixed(1)} km away</p>
                    <p class="nearest-hint">Try a larger search radius to include it.</p>
                </div>`;
        }
        resultsContent.innerHTML = `
            <div class="no-results">
                <p>😕 No cyclones found within ${data ? data.distance_km : ''} km</p>
                <p class="info-text">Try adjusting filters or increasing the search radius</p>
                ${nearestHtml}
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
                <th>Max Wind (kts)</th>
                <th>Min Pressure (mb)</th>
                <th>Min Dist to Land (km)</th>
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
    
    const distToLandValue = (cyclone.min_dist_to_land != null && cyclone.min_dist_to_land >= 0)
        ? cyclone.min_dist_to_land
        : 'N/A';

    row.innerHTML = `
        <td class="cyclone-name-cell">${cyclone.cyclone_name}</td>
        <td class="year-cell number">${cyclone.year}</td>
        <td class="number">${cyclone.distance_km.toFixed(2)}</td>
        <td class="wind-cell number ${windClass} ${windValue === 'N/A' ? 'na-value' : ''}">${windValue}</td>
        <td class="number ${pressureValue === 'N/A' ? 'na-value' : ''}">${pressureValue}</td>
        <td class="number ${distToLandValue === 'N/A' ? 'na-value' : ''}">${distToLandValue}</td>
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
    // Dim all tracks
    cycloneLayers.forEach(item => {
        if (item.layer)    item.layer.setStyle({ weight: 3, opacity: 0.25 });
        if (item.segments) item.segments.forEach(s => s.setStyle({ weight: 3, opacity: 0.2 }));
        if (item.dots)     item.dots.forEach(d => d.setStyle({ opacity: 0.2, fillOpacity: 0.2 }));
    });

    // Fully highlight the selected track
    const sel = cycloneLayers.find(item => item.stormId === stormId);
    if (!sel) return;

    if (sel.layer) {
        sel.layer.setStyle({ weight: 5, opacity: 1 });
        sel.layer.bringToFront();
    }
    if (sel.segments) {
        sel.segments.forEach(s => { s.setStyle({ weight: 5, opacity: 1 }); s.bringToFront(); });
    }
    if (sel.dots) {
        sel.dots.forEach(d => { d.setStyle({ opacity: 1, fillOpacity: 0.95 }); d.bringToFront(); });
    }

    // Fit map to the selected track
    let bounds;
    if (sel.dots && sel.dots.length > 0) {
        bounds = L.latLngBounds(sel.dots.map(d => d.getLatLng()));
    } else if (sel.layer) {
        bounds = sel.layer.getBounds();
    }
    if (bounds) {
        map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 0.5 });
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
        filteredCyclones = [...currentCyclones];
        if (yearFrom || yearTo) {
            filteredCyclones = filteredCyclones.filter(cyclone => {
                if (yearFrom && cyclone.year < yearFrom) return false;
                if (yearTo && cyclone.year > yearTo) return false;
                return true;
            });
        }
        // Sync map: only show tracks that are in the filtered set
        syncMapToFilter();
    } else {
        filteredTsunamis = [...currentTsunamis];
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

// Show/hide map layers so only tracks in filteredCyclones are visible
function syncMapToFilter() {
    if (activeMode !== 'cyclones') return;
    const visibleIds = new Set(filteredCyclones.map(c => c.storm_id));

    cycloneLayers.forEach(item => {
        const show = visibleIds.has(item.stormId);
        const lineOp = show ? 0.85 : 0;
        const dotOp  = show ? 0.95 : 0;

        if (item.layer) {
            item.layer.setStyle({ opacity: show ? 0.7 : 0 });
        }
        if (item.segments) {
            item.segments.forEach(s => s.setStyle({ opacity: lineOp }));
        }
        if (item.dots) {
            item.dots.forEach(d => d.setStyle({ opacity: dotOp, fillOpacity: dotOp }));
        }
    });
}

// ===============================================
// CSV DOWNLOAD
// ===============================================

// Encode a cyclone's track points as a WKT LineString for the CSV cell
function trackToWKT(stormId) {
    const item = cycloneLayers.find(i => i.stormId === stormId);
    if (!item || !item.trackPointsData || !item.trackPointsData.points || item.trackPointsData.points.length === 0) {
        return 'N/A';
    }
    const coords = item.trackPointsData.points
        .map(pt => `${pt.lon.toFixed(4)} ${pt.lat.toFixed(4)}`)
        .join(', ');
    return `"LINESTRING(${coords})"`;
}

function downloadCSV() {
    if (activeMode === 'cyclones') {
        if (filteredCyclones.length === 0) {
            alert('No results to download');
            return;
        }

        console.log(`Downloading CSV with ${filteredCyclones.length} cyclones`);

        const sd = currentSearchData;
        const rows = [];

        // ── Metadata header block ──
        rows.push(['# Search Location', `Lat: ${sd.clicked_lat.toFixed(6)}`, `Lon: ${sd.clicked_lon.toFixed(6)}`]);
        rows.push(['# Search Radius (km)', sd.distance_km]);
        rows.push(['# Cyclones in results', filteredCyclones.length]);
        rows.push([]);   // blank separator

        // ── Column headers ──
        rows.push([
            'Name', 'Year', 'Basin',
            'Distance_to_Search_km',
            'Max_Wind_Speed_kts', 'Min_Pressure_mb',
            'Min_Dist_to_Land_km',
            'Start_Date', 'End_Date', 'Duration_hrs',
            'Track_WKT'
        ]);

        filteredCyclones.forEach(cyclone => {
            rows.push([
                `"${cyclone.cyclone_name.replace(/"/g, '""')}"`,
                cyclone.year,
                `"${(cyclone.basin || 'N/A').replace(/"/g, '""')}"`,
                cyclone.distance_km.toFixed(2),
                cyclone.max_wind_speed || 'N/A',
                cyclone.min_pressure   || 'N/A',
                cyclone.min_dist_to_land != null ? cyclone.min_dist_to_land : 'N/A',
                new Date(cyclone.start_date).toISOString().split('T')[0],
                new Date(cyclone.end_date).toISOString().split('T')[0],
                cyclone.duration_hours ? cyclone.duration_hours.toFixed(1) : 'N/A',
                trackToWKT(cyclone.storm_id)
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

// ===============================================
// WIND RISK ANALYSIS SECTION
// ===============================================

function injectWindAnalysisSection(data) {
    // Find the anchor point — insert just before the category bar chart
    const resultsContent = document.getElementById('results-content');
    if (!resultsContent) return;

    // Remove any existing wind analysis section
    const existing = document.getElementById('wind-analysis-section');
    if (existing) existing.remove();
    if (windAnalysisChart) { windAnalysisChart.destroy(); windAnalysisChart = null; }

    const section = document.createElement('div');
    section.id = 'wind-analysis-section';
    section.className = 'wind-analysis-section';

    if (!data || data.insufficient_data) {
        section.innerHTML = `
            <div class="wind-analysis-header">
                <span class="wind-analysis-title">⚠ Wind Risk Analysis</span>
            </div>
            <p class="wind-analysis-msg">${data ? data.message : 'Could not load wind analysis.'}</p>
        `;
        // Insert before chart-container if it exists, else append
        const chartContainer = resultsContent.querySelector('.chart-container');
        if (chartContainer) resultsContent.insertBefore(section, chartContainer);
        else resultsContent.appendChild(section);
        return;
    }

    const rl = data.return_levels;
    const wCatLabel = w => {
        if (w < 34)  return 'TD';
        if (w < 64)  return 'TS';
        if (w < 83)  return 'Cat 1';
        if (w < 96)  return 'Cat 2';
        if (w < 113) return 'Cat 3';
        if (w < 137) return 'Cat 4';
        return 'Cat 5';
    };

    section.innerHTML = `
        <div class="wind-analysis-header">
            <span class="wind-analysis-title">🌀 Wind Risk Analysis — ${data.gev_fallback ? 'Gumbel Fit (fallback)' : 'GEV Fit'}</span>
            <span class="wind-analysis-meta">${data.sample_count} storms (with wind data) · ${data.storm_count} total storms · radius ${data.distance_km} km</span>
        </div>
        <div class="wind-analysis-stats">
            <div class="wa-stat">
                <div class="wa-stat-label">Mean Wind</div>
                <div class="wa-stat-value">${data.wind_mean}<span class="wa-stat-unit"> kts</span></div>
                <div class="wa-stat-sub">${wCatLabel(data.wind_mean)}</div>
            </div>
            <div class="wa-stat">
                <div class="wa-stat-label">Median Wind</div>
                <div class="wa-stat-value">${data.wind_median}<span class="wa-stat-unit"> kts</span></div>
                <div class="wa-stat-sub">${wCatLabel(data.wind_median)}</div>
            </div>
            <div class="wa-stat wa-stat-highlight50">
                <div class="wa-stat-label">50-yr Level</div>
                <div class="wa-stat-value">${rl.w50}<span class="wa-stat-unit"> kts</span></div>
                <div class="wa-stat-sub">${wCatLabel(rl.w50)}</div>
            </div>
            <div class="wa-stat wa-stat-highlight100">
                <div class="wa-stat-label">100-yr Level</div>
                <div class="wa-stat-value">${rl.w100}<span class="wa-stat-unit"> kts</span></div>
                <div class="wa-stat-sub">${wCatLabel(rl.w100)}</div>
            </div>
        </div>
        <div class="wa-gev-params">
            ${data.gev_fallback ? 'Gumbel params (GEV shape fixed=0)' : 'GEV params'} — shape: <b>${data.gev_params.shape}</b> · loc: <b>${data.gev_params.loc}</b> · scale: <b>${data.gev_params.scale}</b>
        </div>
        <div class="wa-chart-wrapper">
            <canvas id="windAnalysisChart"></canvas>
        </div>
        <p class="wa-note">* Each storm contributes one value — the maximum wind speed recorded within the search radius. The GEV distribution is fitted to these per-storm maxima. Return levels: ppf(1−1/50) for 50-yr and ppf(1−1/100) for 100-yr.</p>
    `;

    const chartContainer = resultsContent.querySelector('.chart-container');
    if (chartContainer) resultsContent.insertBefore(section, chartContainer);
    else resultsContent.appendChild(section);

    // Render the chart after the DOM is ready
    setTimeout(() => renderWindAnalysisChart(data), 50);
}

function renderWindAnalysisChart(data) {
    const canvas = document.getElementById('windAnalysisChart');
    if (!canvas) return;
    if (windAnalysisChart) { windAnalysisChart.destroy(); windAnalysisChart = null; }

    const hist = data.histogram;
    const pdf  = data.fitted_pdf;
    const rl   = data.return_levels;

    windAnalysisChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: hist.bins,
            datasets: [
                {
                    type: 'bar',
                    label: 'Per-storm max wind speed',
                    data: hist.counts,
                    backgroundColor: 'rgba(102, 126, 234, 0.55)',
                    borderColor:     'rgba(102, 126, 234, 0.9)',
                    borderWidth: 1,
                    order: 2
                },
                {
                    type: 'line',
                    label: 'GEV fitted PDF',
                    data: pdf.x.map((x, i) => ({ x, y: pdf.y[i] })),
                    borderColor: '#e55039',
                    borderWidth: 2.5,
                    pointRadius: 0,
                    tension: 0.4,
                    fill: false,
                    order: 1,
                    parsing: false
                },
                {
                    type: 'line',
                    label: `50-yr: ${rl.w50} kts`,
                    data: [{ x: rl.w50, y: 0 }, { x: rl.w50, y: Math.max(...hist.counts) * 1.1 }],
                    borderColor: '#f0932b',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false,
                    order: 0,
                    parsing: false
                },
                {
                    type: 'line',
                    label: `100-yr: ${rl.w100} kts`,
                    data: [{ x: rl.w100, y: 0 }, { x: rl.w100, y: Math.max(...hist.counts) * 1.1 }],
                    borderColor: '#8e44ad',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false,
                    order: 0,
                    parsing: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        title: ctx => `Wind: ${ctx[0].label} kts`,
                        label: ctx => `${ctx.dataset.label}: ${Number(ctx.raw.y ?? ctx.raw).toFixed(1)}`
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Wind Speed (kts)' },
                    min: 0,
                    // Clamp to data range so bars stay visible even if return-level
                    // lines extend far right (chart clips lines but preserves bars).
                    max: Math.max(...hist.bins) * 1.4
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Number of Storms / Scaled density' }
                }
            }
        }
    });
}

// Returns a color based on wind speed using standard meteorological categories
function getWindSpeedColor(windSpeed) {
    if (windSpeed == null || windSpeed <= 0) return '#444444'; // N/A  - dark gray
    if (windSpeed < 34)  return '#5dade2'; // TD   <34 kts  - blue
    if (windSpeed < 64)  return '#27ae60'; // TS   34-63    - green
    if (windSpeed < 83)  return '#f9ca24'; // Cat1 64-82    - yellow
    if (windSpeed < 96)  return '#f0932b'; // Cat2 83-95    - amber
    if (windSpeed < 113) return '#e55039'; // Cat3 96-112   - red-orange
    if (windSpeed < 137) return '#c0392b'; // Cat4 113-136  - crimson
    return '#8e44ad';                      // Cat5 137+     - purple
}

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
    
    // Remove all cyclone tracks, segments, and observation dots
    cycloneLayers.forEach(item => {
        if (item.layer)    map.removeLayer(item.layer);
        if (item.segments) item.segments.forEach(s => map.removeLayer(s));
        if (item.dots)     item.dots.forEach(d => map.removeLayer(d));
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
    
    // Destroy charts if exist
    if (windSpeedChart) {
        windSpeedChart.destroy();
        windSpeedChart = null;
    }
    if (windAnalysisChart) {
        windAnalysisChart.destroy();
        windAnalysisChart = null;
    }
    currentWindAnalysis = null;
    
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

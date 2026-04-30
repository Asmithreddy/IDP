"""
NATURAL DISASTER TRACKER API SERVER
FastAPI backend for cyclone and tsunami tracking interface
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import json
import uvicorn
import sys
import os
import numpy as np
from scipy.stats import genextreme

# Add tsu folder to path to import tsunami router
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'tsu'))

# ===============================================
# DATABASE CONFIGURATION
# ===============================================
DB_CONFIG = {
    'dbname': 'hazard_tracker',
    'user': 'postgres',           # Change this to your PostgreSQL username
    'password': '1234',  # Change this to your PostgreSQL password
    'host': 'localhost',
    'port': '5432'
}

# ===============================================
# MODELS
# ===============================================

class CycloneResult(BaseModel):
    storm_id: str
    cyclone_name: str
    year: int
    basin: str
    start_date: str
    end_date: str
    distance_km: float
    num_observations: int
    max_wind_speed: Optional[int]
    min_pressure: Optional[int]
    duration_hours: Optional[float]
    min_dist_to_land: Optional[int] = None   # km; None means no data

class TrackGeometry(BaseModel):
    storm_id: str
    cyclone_name: str
    year: int
    geometry: dict  # GeoJSON geometry

class ClickResponse(BaseModel):
    clicked_lat: float
    clicked_lon: float
    distance_km: int
    cyclones_found: int
    cyclones: List[CycloneResult]
    nearest_cyclone: Optional[dict] = None   # populated only when cyclones_found == 0

# ===============================================
# DATABASE FUNCTIONS
# ===============================================

def get_db_connection():
    """Create database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

# ===============================================
# FASTAPI APP
# ===============================================

app = FastAPI(
    title="Natural Disaster Tracker API",
    description="API for finding historical cyclones and tsunamis near a geographic point",
    version="2.0.0"
)

# Import and mount tsunami router
try:
    from tsunami_api import tsunami_router
    app.include_router(tsunami_router)
    print("✓ Tsunami API router mounted successfully")
except Exception as e:
    print(f"⚠ Warning: Could not load tsunami router: {e}")
    print("  Tsunami features will be unavailable")

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===============================================
# API ENDPOINTS
# ===============================================

@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Natural Disaster Tracker API",
        "version": "2.0.0",
        "endpoints": {
            "health": "/health",
            "cyclones": {
                "find_cyclones": "/api/cyclones-near",
                "get_track": "/api/track/{storm_id}",
                "stats": "/api/stats"
            },
            "tsunamis": {
                "find_tsunamis": "/api/tsunamis-near",
                "get_event": "/api/tsunami/{event_id}",
                "stats": "/api/tsunami-stats"
            }
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM cyclone_tracks")
        cyclone_count = cursor.fetchone()[0]
        
        # Check tsunami table
        tsunami_count = 0
        try:
            cursor.execute("SELECT COUNT(*) FROM tsunami_events")
            tsunami_count = cursor.fetchone()[0]
        except:
            pass
        
        cursor.close()
        conn.close()
        
        return {
            "status": "healthy",
            "database": "connected",
            "cyclones": cyclone_count,
            "tsunamis": tsunami_count
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

@app.get("/api/cyclones-near", response_model=ClickResponse)
async def get_cyclones_near_point(
    lat: float = Query(..., ge=-90, le=90, description="Latitude (-90 to 90)"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude (-180 to 180)"),
    distance: int = Query(100000, ge=1000, le=1000000, description="Search distance in meters")
):
    """
    Find all cyclones that passed within specified distance of a point
    
    - **lat**: Latitude of clicked point
    - **lon**: Longitude of clicked point
    - **distance**: Search radius in meters (default 100km)
    """
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # 1. Find cyclones within the requested radius
        cursor.execute(
            "SELECT * FROM find_cyclones_near_point(%s, %s, %s)",
            (lat, lon, distance)
        )
        results = cursor.fetchall()

        # 2. Batch-fetch minimum distance-to-land for every matched storm
        storm_ids = [row['storm_id'] for row in results]
        dist2land_map = {}
        if storm_ids:
            cursor.execute(
                """
                SELECT sid,
                       MIN(CASE WHEN dist2land IS NOT NULL AND dist2land >= 0
                                THEN dist2land END) AS min_d2l
                FROM cyclone_points
                WHERE sid = ANY(%s)
                GROUP BY sid
                """,
                (storm_ids,)
            )
            for r in cursor.fetchall():
                dist2land_map[r['sid']] = r['min_d2l']

        # 3. Build response objects
        cyclones = []
        for row in results:
            try:
                cyclones.append(CycloneResult(
                    storm_id=row['storm_id'],
                    cyclone_name=row['cyclone_name'] or 'UNNAMED',
                    year=int(row['year']) if row['year'] else 0,
                    basin=row['basin'] or 'Unknown',
                    start_date=row['start_date'].isoformat() if row['start_date'] else '',
                    end_date=row['end_date'].isoformat() if row['end_date'] else '',
                    distance_km=float(row['distance_km']) if row['distance_km'] is not None else 0.0,
                    num_observations=int(row['num_observations']) if row['num_observations'] else 0,
                    max_wind_speed=int(row['max_wind_speed']) if row['max_wind_speed'] else None,
                    min_pressure=int(row['min_pressure']) if row['min_pressure'] else None,
                    duration_hours=float(row['duration_hours']) if row['duration_hours'] else None,
                    min_dist_to_land=(int(dist2land_map[row['storm_id']])
                                      if row['storm_id'] in dist2land_map
                                         and dist2land_map[row['storm_id']] is not None
                                      else None)
                ))
            except Exception as row_error:
                print(f"Error processing row: {row_error}, Row data: {row}")
                continue

        # 4. If nothing found, locate the single nearest cyclone on the globe
        nearest_cyclone = None
        if not cyclones:
            cursor.execute(
                """
                SELECT ct.sid,
                       COALESCE(ct.name, 'UNNAMED') AS name,
                       ct.season,
                       CAST(ST_Distance(
                           ct.path::geography,
                           ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                       ) / 1000.0 AS DOUBLE PRECISION) AS distance_km
                FROM cyclone_tracks ct
                WHERE ct.path IS NOT NULL
                ORDER BY ct.path::geography <->
                         ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                LIMIT 1
                """,
                (lon, lat, lon, lat)
            )
            nearest = cursor.fetchone()
            if nearest:
                nearest_cyclone = {
                    'storm_id':     nearest['sid'],
                    'cyclone_name': nearest['name'],
                    'year':         nearest['season'],
                    'distance_km':  round(float(nearest['distance_km']), 2)
                }

        cursor.close()

        return ClickResponse(
            clicked_lat=lat,
            clicked_lon=lon,
            distance_km=distance // 1000,
            cyclones_found=len(cyclones),
            cyclones=cyclones,
            nearest_cyclone=nearest_cyclone
        )

    except Exception as e:
        import traceback
        error_detail = f"Query failed: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in get_cyclones_near_point: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.get("/api/track/{storm_id}", response_model=TrackGeometry)
async def get_cyclone_track(storm_id: str):
    """
    Get the track geometry (LineString) for a specific cyclone
    
    - **storm_id**: Storm ID (SID) to retrieve
    """
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get track geometry as GeoJSON
        cursor.execute(
            "SELECT * FROM get_cyclone_track(%s)",
            (storm_id,)
        )
        
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail=f"Storm ID {storm_id} not found")
        
        cursor.close()
        
        return TrackGeometry(
            storm_id=result['sid'],
            cyclone_name=result['name'],
            year=result['season'],
            geometry=json.loads(result['geojson'])
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.get("/api/track-points/{storm_id}")
async def get_cyclone_track_points(storm_id: str):
    """
    Get individual recorded observation points for a specific cyclone track,
    including timestamps, wind speed, and pressure at each recorded position.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute(
            """
            SELECT lat, lon, iso_time, wmo_wind, wmo_pres, nature, dist2land
            FROM cyclone_points
            WHERE sid = %s
            ORDER BY iso_time
            """,
            (storm_id,)
        )

        rows = cursor.fetchall()
        cursor.close()

        points = []
        for row in rows:
            if row["lat"] is not None and row["lon"] is not None:
                d2l = row["dist2land"]
                points.append({
                    "lat": float(row["lat"]),
                    "lon": float(row["lon"]),
                    "iso_time": row["iso_time"].isoformat() if row["iso_time"] else None,
                    "wind_speed": int(row["wmo_wind"]) if row["wmo_wind"] else None,
                    "pressure": int(row["wmo_pres"]) if row["wmo_pres"] else None,
                    "nature": row["nature"],
                    "dist2land": int(d2l) if d2l is not None and d2l >= 0 else None
                })

        return {
            "storm_id": storm_id,
            "count": len(points),
            "points": points
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.get("/api/wind-analysis")
async def get_wind_analysis(
    lat: float = Query(..., ge=-90, le=90, description="Latitude of the site"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude of the site"),
    distance: int = Query(500000, ge=10000, le=2000000, description="Radius in metres")
):
    """
    For a given location and radius:
      1. Collects every wmo_wind observation from cyclone_points within the radius.
      2. Fits a Generalised Extreme Value (GEV) distribution to the sample.
      3. Returns high-quantile wind speeds (labelled 50-yr / 100-yr), sample stats,
         histogram bins/counts, and the fitted PDF curve — ready for Chart.js.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Step 1 — use the indexed cyclone_tracks table to get candidate storm IDs
        cursor.execute(
            """
            SELECT sid
            FROM cyclone_tracks
            WHERE path IS NOT NULL
              AND ST_DWithin(
                  path::geography,
                  ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                  %s
              )
            """,
            (lon, lat, distance)
        )
        storm_ids = [r['sid'] for r in cursor.fetchall()]

        if not storm_ids:
            return {
                "sample_count": 0, "storm_count": 0,
                "insufficient_data": True,
                "message": "No storms pass within this radius — try a larger search radius."
            }

        # Step 2 — for each storm, take the maximum wind speed from observations
        #           whose position falls within the radius (per-storm block maxima).
        #           Upper cap of 250 kts excludes fill/sentinel values in IBTrACS.
        cursor.execute(
            """
            SELECT sid, MAX(wmo_wind) AS max_wind
            FROM cyclone_points
            WHERE sid = ANY(%s)
              AND wmo_wind IS NOT NULL
              AND wmo_wind > 0
              AND wmo_wind <= 250
              AND ST_DWithin(
                  ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                  ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                  %s
              )
            GROUP BY sid
            """,
            (storm_ids, lon, lat, distance)
        )
        rows = cursor.fetchall()
        cursor.close()

        if len(rows) < 5:
            return {
                "sample_count": len(rows), "storm_count": len(storm_ids),
                "insufficient_data": True,
                "message": f"Only {len(rows)} storms have wind data inside the radius — need ≥5 for a reliable GEV fit."
            }

        winds = np.array([float(r['max_wind']) for r in rows])

        # GEV fit  (shape c, location loc, scale scale)
        c, loc, scale = genextreme.fit(winds)

        # High-quantile return levels
        # ppf(1 - 1/T) gives the T-year return level when data are annual maxima.
        # Here we use the same convention as the IBTrACS notebook (ppf 0.98 / 0.99).
        w50  = float(genextreme.ppf(0.98, c, loc=loc, scale=scale))
        w100 = float(genextreme.ppf(0.99, c, loc=loc, scale=scale))

        # Sanity check: MLE can produce a large positive shape (Fréchet) with heavy-tailed
        # samples, causing return levels to blow up astronomically.  When return levels are
        # non-finite, negative, or more than 5× the observed maximum, fall back to a Gumbel
        # fit (shape fixed at 0) which is stable and commonly used for wind extremes.
        max_obs = float(winds.max())
        gev_fallback = False

        def _is_bad(v):
            return (not np.isfinite(v)) or v < 0 or v > max_obs * 5

        if _is_bad(w50) or _is_bad(w100):
            gev_fallback = True
            c, loc, scale = genextreme.fit(winds, f0=0)   # Gumbel (shape=0) fallback
            w50  = float(genextreme.ppf(0.98, c, loc=loc, scale=scale))
            w100 = float(genextreme.ppf(0.99, c, loc=loc, scale=scale))
            # If still bad, fall back to empirical quantiles
            if _is_bad(w50) or _is_bad(w100):
                w50  = float(np.percentile(winds, 98))
                w100 = float(np.percentile(winds, 99))

        # Histogram (25 equal-width bins)
        hist_counts, bin_edges = np.histogram(winds, bins=25)
        bin_centers = ((bin_edges[:-1] + bin_edges[1:]) / 2)

        # Fitted PDF scaled to match histogram counts  (density × bin_width × n)
        bin_width = float(bin_edges[1] - bin_edges[0])
        x_pdf = np.linspace(max(0.0, float(winds.min()) - bin_width),
                            float(winds.max()) * 1.15, 300)
        y_pdf_density = genextreme.pdf(x_pdf, c, loc=loc, scale=scale)
        y_pdf_scaled  = y_pdf_density * bin_width * len(winds)

        return {
            "sample_count":  int(len(winds)),   # storms with wind data inside radius
            "storm_count":   len(storm_ids),     # total storms passing through radius
            "wind_mean":     round(float(winds.mean()), 1),
            "wind_std":      round(float(winds.std()),  1),
            "wind_min":      round(float(winds.min()),  1),
            "wind_max":      round(float(winds.max()),  1),
            "wind_median":   round(float(np.median(winds)), 1),
            "gev_params": {
                "shape": round(float(c),     4),
                "loc":   round(float(loc),   4),
                "scale": round(float(scale), 4)
            },
            "return_levels": {
                "w50":  round(w50,  1),
                "w100": round(w100, 1)
            },
            "histogram": {
                "bins":   [round(float(b), 1) for b in bin_centers],
                "counts": hist_counts.tolist()
            },
            "fitted_pdf": {
                "x": [round(float(v), 1) for v in x_pdf],
                "y": [round(float(v), 2) for v in y_pdf_scaled]
            },
            "distance_km":       distance // 1000,
            "insufficient_data": False,
            "gev_fallback":      gev_fallback
        }

    except Exception as e:
        import traceback
        print(f"ERROR in wind_analysis: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Wind analysis failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.get("/api/stats")
async def get_statistics():
    """Get database statistics"""
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get various statistics
        cursor.execute("""
            SELECT 
                COUNT(*) as total_tracks,
                MIN(season) as earliest_year,
                MAX(season) as latest_year,
                COUNT(DISTINCT basin) as unique_basins,
                SUM(point_count) as total_observations
            FROM cyclone_tracks
        """)
        
        stats = cursor.fetchone()
        
        # Get basin distribution
        cursor.execute("""
            SELECT basin, COUNT(*) as count
            FROM cyclone_tracks
            GROUP BY basin
            ORDER BY count DESC
        """)
        
        basins = cursor.fetchall()
        
        cursor.close()
        
        return {
            "total_tracks": stats['total_tracks'],
            "year_range": {
                "earliest": stats['earliest_year'],
                "latest": stats['latest_year']
            },
            "unique_basins": stats['unique_basins'],
            "total_observations": stats['total_observations'],
            "basin_distribution": [dict(row) for row in basins]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")
    finally:
        if conn:
            conn.close()

# ===============================================
# RUN SERVER
# ===============================================

if __name__ == "__main__":
    print("=" * 60)
    print("HAZARD TRACKER API SERVER")
    print("=" * 60)
    print("\nStarting server...")
    print("  - API URL: http://localhost:8000")
    print("  - API Docs: http://localhost:8000/docs")
    print("  - Health Check: http://localhost:8000/health")
    print("\nPress Ctrl+C to stop\n")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

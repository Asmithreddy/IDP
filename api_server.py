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

# Add tsu folder to path to import tsunami router
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'tsu'))

# ===============================================
# DATABASE CONFIGURATION
# ===============================================
DB_CONFIG = {
    'dbname': 'cyclone_tracker',
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
        
        # Execute query
        cursor.execute(
            "SELECT * FROM find_cyclones_near_point(%s, %s, %s)",
            (lat, lon, distance)
        )
        
        results = cursor.fetchall()
        
        # Convert to response format
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
                    duration_hours=float(row['duration_hours']) if row['duration_hours'] else None
                ))
            except Exception as row_error:
                print(f"Error processing row: {row_error}, Row data: {row}")
                continue  # Skip this row and continue with others
        
        cursor.close()
        
        return ClickResponse(
            clicked_lat=lat,
            clicked_lon=lon,
            distance_km=distance // 1000,
            cyclones_found=len(cyclones),
            cyclones=cyclones
        )
        
    except Exception as e:
        import traceback
        error_detail = f"Query failed: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in get_cyclones_near_point: {error_detail}")  # Log to console
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
            SELECT lat, lon, iso_time, wmo_wind, wmo_pres, nature
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
                points.append({
                    "lat": float(row["lat"]),
                    "lon": float(row["lon"]),
                    "iso_time": row["iso_time"].isoformat() if row["iso_time"] else None,
                    "wind_speed": int(row["wmo_wind"]) if row["wmo_wind"] else None,
                    "pressure": int(row["wmo_pres"]) if row["wmo_pres"] else None,
                    "nature": row["nature"]
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
    print("CYCLONE TRACKER API SERVER")
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

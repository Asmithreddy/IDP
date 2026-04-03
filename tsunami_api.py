"""
TSUNAMI TRACKER API ROUTER
Separate FastAPI router - mounted into api_server.py
Does not touch any cyclone tables or logic
"""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor

# ===============================================
# DATABASE CONFIGURATION
# ===============================================
DB_CONFIG = {
    'dbname': 'cyclone_tracker',
    'user': 'postgres',
    'password': '1234',
    'host': 'localhost',
    'port': '5432'
}

# ===============================================
# ROUTER
# ===============================================
tsunami_router = APIRouter(prefix="/api", tags=["tsunamis"])

# ===============================================
# MODELS
# ===============================================

class TsunamiEvent(BaseModel):
    id: int
    year: Optional[int]
    month: Optional[int]
    day: Optional[int]
    event_validity: Optional[int]
    cause_code: Optional[int]
    earthquake_magnitude: Optional[float]
    country: Optional[str]
    location_name: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    max_water_height: Optional[float]
    num_runups: Optional[int]
    deaths: Optional[int]
    total_deaths: Optional[int]
    damage_mil: Optional[float]
    total_damage_mil: Optional[float]
    houses_destroyed: Optional[int]
    total_houses_destroyed: Optional[int]
    distance_km: Optional[float]

class TsunamiDetailEvent(BaseModel):
    id: int
    year: Optional[int]
    month: Optional[int]
    day: Optional[int]
    hour: Optional[int]
    minute: Optional[int]
    event_validity: Optional[int]
    cause_code: Optional[int]
    earthquake_magnitude: Optional[float]
    country: Optional[str]
    location_name: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    max_water_height: Optional[float]
    num_runups: Optional[int]
    tsunami_magnitude_abe: Optional[float]
    tsunami_magnitude_iida: Optional[float]
    deaths: Optional[int]
    missing: Optional[int]
    injuries: Optional[int]
    damage_mil: Optional[float]
    houses_destroyed: Optional[int]
    houses_damaged: Optional[int]
    total_deaths: Optional[int]
    total_missing: Optional[int]
    total_injuries: Optional[int]
    total_damage_mil: Optional[float]
    total_houses_destroyed: Optional[int]
    total_houses_damaged: Optional[int]

class TsunamiNearResponse(BaseModel):
    count: int
    latitude: float
    longitude: float
    distance_km: float
    events: List[TsunamiEvent]

class TsunamiStatsResponse(BaseModel):
    total_events: int
    reliable_events: int
    year_min: Optional[int]
    year_max: Optional[int]
    avg_magnitude: Optional[float]
    max_water_height: Optional[float]
    total_deaths: Optional[int]
    events_with_height: int
    events_with_deaths: int
    top_countries: List[dict]
    cause_distribution: List[dict]

# ===============================================
# DB HELPER
# ===============================================

def get_db_connection():
    try:
        return psycopg2.connect(**DB_CONFIG, connect_timeout=5)
    except psycopg2.OperationalError as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")

CAUSE_LABELS = {
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
}

# ===============================================
# ENDPOINTS
# ===============================================

@tsunami_router.get("/tsunamis-near", response_model=TsunamiNearResponse)
async def get_tsunamis_near(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
    distance: float = Query(500000, ge=10000, le=5000000, description="Search radius in meters")
):
    """
    Find all tsunami events within a given distance of a point.
    Click on map → returns nearby historical tsunamis.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute(
            "SELECT * FROM find_tsunamis_near_point(%s, %s, %s)",
            (lat, lon, distance)
        )
        rows = cursor.fetchall()
        cursor.close()

        events = []
        for row in rows:
            events.append(TsunamiEvent(
                id=row['id'],
                year=row['year'],
                month=row['month'],
                day=row['day'],
                event_validity=row['event_validity'],
                cause_code=row['cause_code'],
                earthquake_magnitude=float(row['earthquake_magnitude']) if row['earthquake_magnitude'] else None,
                country=row['country'],
                location_name=row['location_name'],
                latitude=float(row['latitude']) if row['latitude'] else None,
                longitude=float(row['longitude']) if row['longitude'] else None,
                max_water_height=float(row['max_water_height']) if row['max_water_height'] else None,
                num_runups=row['num_runups'],
                deaths=row['deaths'],
                total_deaths=row['total_deaths'],
                damage_mil=float(row['damage_mil']) if row['damage_mil'] else None,
                total_damage_mil=float(row['total_damage_mil']) if row['total_damage_mil'] else None,
                houses_destroyed=row['houses_destroyed'],
                total_houses_destroyed=row['total_houses_destroyed'],
                distance_km=float(row['distance_km']) if row['distance_km'] else None
            ))

        return TsunamiNearResponse(
            count=len(events),
            latitude=lat,
            longitude=lon,
            distance_km=distance / 1000,
            events=events
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@tsunami_router.get("/tsunami/{event_id}", response_model=TsunamiDetailEvent)
async def get_tsunami_event(event_id: int):
    """
    Get full details of a single tsunami event by ID.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute(
            "SELECT * FROM get_tsunami_event(%s)",
            (event_id,)
        )
        row = cursor.fetchone()
        cursor.close()

        if not row:
            raise HTTPException(status_code=404, detail=f"Tsunami event {event_id} not found")

        return TsunamiDetailEvent(
            id=row['id'],
            year=row['year'],
            month=row['month'],
            day=row['day'],
            hour=row['hour'],
            minute=row['minute'],
            event_validity=row['event_validity'],
            cause_code=row['cause_code'],
            earthquake_magnitude=float(row['earthquake_magnitude']) if row['earthquake_magnitude'] else None,
            country=row['country'],
            location_name=row['location_name'],
            latitude=float(row['latitude']) if row['latitude'] else None,
            longitude=float(row['longitude']) if row['longitude'] else None,
            max_water_height=float(row['max_water_height']) if row['max_water_height'] else None,
            num_runups=row['num_runups'],
            tsunami_magnitude_abe=float(row['tsunami_magnitude_abe']) if row['tsunami_magnitude_abe'] else None,
            tsunami_magnitude_iida=float(row['tsunami_magnitude_iida']) if row['tsunami_magnitude_iida'] else None,
            deaths=row['deaths'],
            missing=row['missing'],
            injuries=row['injuries'],
            damage_mil=float(row['damage_mil']) if row['damage_mil'] else None,
            houses_destroyed=row['houses_destroyed'],
            houses_damaged=row['houses_damaged'],
            total_deaths=row['total_deaths'],
            total_missing=row['total_missing'],
            total_injuries=row['total_injuries'],
            total_damage_mil=float(row['total_damage_mil']) if row['total_damage_mil'] else None,
            total_houses_destroyed=row['total_houses_destroyed'],
            total_houses_damaged=row['total_houses_damaged']
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@tsunami_router.get("/tsunami-stats", response_model=TsunamiStatsResponse)
async def get_tsunami_stats():
    """
    Summary statistics for the tsunami dataset.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # General stats
        cursor.execute("""
            SELECT
                COUNT(*)                                            AS total_events,
                COUNT(*) FILTER (WHERE event_validity >= 3)        AS reliable_events,
                MIN(year)                                           AS year_min,
                MAX(year)                                           AS year_max,
                ROUND(AVG(earthquake_magnitude)::numeric, 2)       AS avg_magnitude,
                MAX(max_water_height)                               AS max_water_height,
                SUM(total_deaths)                                   AS total_deaths,
                COUNT(*) FILTER (WHERE max_water_height IS NOT NULL) AS events_with_height,
                COUNT(*) FILTER (WHERE total_deaths > 0)           AS events_with_deaths
            FROM tsunami_events
        """)
        stats = cursor.fetchone()

        # Top 10 countries by event count
        cursor.execute("""
            SELECT country, COUNT(*) AS count
            FROM tsunami_events
            WHERE country IS NOT NULL
            GROUP BY country
            ORDER BY count DESC
            LIMIT 10
        """)
        top_countries = [dict(r) for r in cursor.fetchall()]

        # Cause distribution
        cursor.execute("""
            SELECT cause_code, COUNT(*) AS count
            FROM tsunami_events
            WHERE cause_code IS NOT NULL
            GROUP BY cause_code
            ORDER BY count DESC
        """)
        cause_rows = cursor.fetchall()
        cause_distribution = [
            {
                "cause_code": r['cause_code'],
                "label": CAUSE_LABELS.get(r['cause_code'], 'Unknown'),
                "count": r['count']
            }
            for r in cause_rows
        ]

        cursor.close()

        return TsunamiStatsResponse(
            total_events=stats['total_events'],
            reliable_events=stats['reliable_events'],
            year_min=stats['year_min'],
            year_max=stats['year_max'],
            avg_magnitude=float(stats['avg_magnitude']) if stats['avg_magnitude'] else None,
            max_water_height=float(stats['max_water_height']) if stats['max_water_height'] else None,
            total_deaths=int(stats['total_deaths']) if stats['total_deaths'] else None,
            events_with_height=stats['events_with_height'],
            events_with_deaths=stats['events_with_deaths'],
            top_countries=top_countries,
            cause_distribution=cause_distribution
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stats query failed: {str(e)}")
    finally:
        if conn:
            conn.close()


@tsunami_router.get("/tsunami-health")
async def tsunami_health():
    """Check tsunami DB table and functions are ready"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("SELECT COUNT(*) AS total FROM tsunami_events")
        total = cursor.fetchone()['total']

        cursor.execute("""
            SELECT
                EXISTS(SELECT 1 FROM pg_proc WHERE proname='find_tsunamis_near_point') AS fn_near,
                EXISTS(SELECT 1 FROM pg_proc WHERE proname='get_tsunami_event') AS fn_detail
        """)
        fns = cursor.fetchone()
        cursor.close()

        return {
            "status": "healthy",
            "total_tsunami_events": total,
            "find_tsunamis_near_point": fns['fn_near'],
            "get_tsunami_event": fns['fn_detail']
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Tsunami health check failed: {str(e)}")
    finally:
        if conn:
            conn.close()
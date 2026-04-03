-- ===============================================
-- CYCLONE TRACKER DATABASE SETUP
-- ===============================================

-- Step 1: Create database (run this first in PostgreSQL)
-- CREATE DATABASE cyclone_tracker;
-- \c cyclone_tracker;

-- Step 2: Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify PostGIS installation
SELECT PostGIS_Version();

-- ===============================================
-- Step 3: Create raw data table for cyclone points
-- ===============================================
CREATE TABLE IF NOT EXISTS cyclone_points (
    id SERIAL PRIMARY KEY,
    sid TEXT NOT NULL,                -- Storm ID (unique identifier)
    season INT,                        -- Year
    number INT,                        -- Storm number
    basin TEXT,                        -- Basin code (NI, SI, NA, etc.)
    subbasin TEXT,                     -- Sub-basin
    name TEXT,                         -- Cyclone name
    iso_time TIMESTAMP,                -- Date and time (UTC)
    nature TEXT,                       -- Nature of storm (NR, TS, HU, etc.)
    lat DOUBLE PRECISION,              -- Latitude
    lon DOUBLE PRECISION,              -- Longitude
    wmo_wind INT,                      -- Wind speed (knots)
    wmo_pres INT,                      -- Pressure (mb)
    dist2land INT,                     -- Distance to land (km)
    landfall INT                       -- Landfall indicator
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_sid ON cyclone_points(sid);
CREATE INDEX IF NOT EXISTS idx_time ON cyclone_points(iso_time);
CREATE INDEX IF NOT EXISTS idx_season ON cyclone_points(season);

-- ===============================================
-- Step 4: Create cyclone tracks table (LineStrings)
-- ===============================================
CREATE TABLE IF NOT EXISTS cyclone_tracks (
    id SERIAL PRIMARY KEY,
    sid TEXT UNIQUE NOT NULL,          -- Storm ID
    name TEXT,                         -- Cyclone name
    basin TEXT,                        -- Basin
    subbasin TEXT,                     -- Sub-basin
    season INT,                        -- Year
    path GEOMETRY(LineString, 4326),   -- The track as LineString (WGS84)
    start_time TIMESTAMP,              -- First observation time
    end_time TIMESTAMP,                -- Last observation time
    duration_hours DOUBLE PRECISION,   -- Duration in hours
    point_count INT,                   -- Number of observations
    max_wind INT,                      -- Maximum wind speed (knots)
    min_pressure INT,                  -- Minimum pressure (mb)
    max_lat DOUBLE PRECISION,          -- Bounding box
    min_lat DOUBLE PRECISION,
    max_lon DOUBLE PRECISION,
    min_lon DOUBLE PRECISION
);

-- ===============================================
-- Step 5: Generate LineString tracks from points
-- ===============================================
-- This will be run after importing data
-- (Kept here for reference, but will be executed by Python script)

-- INSERT INTO cyclone_tracks (sid, name, basin, subbasin, season, path, start_time, end_time, duration_hours, point_count, max_wind, min_pressure, max_lat, min_lat, max_lon, min_lon)
-- SELECT
--     sid,
--     MAX(name) as name,
--     MAX(basin) as basin,
--     MAX(subbasin) as subbasin,
--     MAX(season) as season,
--     ST_MakeLine(
--         ST_SetSRID(ST_Point(lon, lat), 4326)
--         ORDER BY iso_time
--     ) as path,
--     MIN(iso_time) as start_time,
--     MAX(iso_time) as end_time,
--     EXTRACT(EPOCH FROM (MAX(iso_time) - MIN(iso_time))) / 3600.0 as duration_hours,
--     COUNT(*) as point_count,
--     MAX(wmo_wind) as max_wind,
--     MIN(wmo_pres) as min_pressure,
--     MAX(lat) as max_lat,
--     MIN(lat) as min_lat,
--     MAX(lon) as max_lon,
--     MIN(lon) as min_lon
-- FROM cyclone_points
-- WHERE lat IS NOT NULL 
--   AND lon IS NOT NULL
--   AND lat BETWEEN -90 AND 90
--   AND lon BETWEEN -180 AND 180
-- GROUP BY sid
-- HAVING COUNT(*) >= 2;

-- ===============================================
-- Step 6: Create spatial index (CRITICAL for performance)
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_cyclone_path_gist 
ON cyclone_tracks 
USING GIST (path);

-- Additional indexes for filtering
CREATE INDEX IF NOT EXISTS idx_tracks_season ON cyclone_tracks(season);
CREATE INDEX IF NOT EXISTS idx_tracks_basin ON cyclone_tracks(basin);
CREATE INDEX IF NOT EXISTS idx_tracks_name ON cyclone_tracks(name);

-- ===============================================
-- Step 7: Create query function to find cyclones near a point
-- ===============================================
CREATE OR REPLACE FUNCTION find_cyclones_near_point(
    clicked_lat DOUBLE PRECISION,
    clicked_lon DOUBLE PRECISION,
    distance_meters INTEGER DEFAULT 100000  -- Default 100km
)
RETURNS TABLE (
    storm_id TEXT,
    cyclone_name TEXT,
    year INTEGER,
    basin TEXT,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    distance_km DOUBLE PRECISION,
    num_observations INT,
    max_wind_speed INT,
    min_pressure INT,
    duration_hours DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ct.sid,
        COALESCE(ct.name, 'UNNAMED') as cyclone_name,
        ct.season,
        ct.basin,
        ct.start_time,
        ct.end_time,
        CAST(
            ROUND(
                CAST(
                    ST_Distance(
                        ct.path::geography,
                        ST_SetSRID(ST_MakePoint(clicked_lon, clicked_lat), 4326)::geography
                    ) / 1000.0 AS numeric
                ),
                2
            ) AS DOUBLE PRECISION
        ) as distance_km,
        ct.point_count,
        COALESCE(ct.max_wind, 0) as max_wind,
        COALESCE(ct.min_pressure, 0) as min_pressure,
        COALESCE(ct.duration_hours, 0.0) as duration_hours
    FROM cyclone_tracks ct
    WHERE ct.path IS NOT NULL
      AND ST_DWithin(
        ct.path::geography,
        ST_SetSRID(ST_MakePoint(clicked_lon, clicked_lat), 4326)::geography,
        distance_meters
    )
    ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- Step 8: Function to get cyclone track geometry (for drawing on map)
-- ===============================================
CREATE OR REPLACE FUNCTION get_cyclone_track(
    storm_id TEXT
)
RETURNS TABLE (
    sid TEXT,
    name TEXT,
    season INT,
    geojson TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ct.sid,
        COALESCE(ct.name, 'UNNAMED') as name,
        ct.season,
        ST_AsGeoJSON(ct.path)::TEXT as geojson
    FROM cyclone_tracks ct
    WHERE ct.sid = storm_id;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- VERIFICATION QUERIES (run after data import)
-- ===============================================

-- Count total points
-- SELECT COUNT(*) as total_points FROM cyclone_points;

-- Count unique cyclones
-- SELECT COUNT(DISTINCT sid) as unique_cyclones FROM cyclone_points;

-- Count tracks created
-- SELECT COUNT(*) as total_tracks FROM cyclone_tracks;

-- Sample tracks
-- SELECT sid, name, season, point_count, start_time, end_time 
-- FROM cyclone_tracks 
-- ORDER BY season DESC
-- LIMIT 10;

-- Test query near Mumbai (19.0760° N, 72.8777° E)
-- SELECT * FROM find_cyclones_near_point(19.0760, 72.8777, 100000);

-- Test query near New Orleans (29.9511° N, -90.0715° W)
-- SELECT * FROM find_cyclones_near_point(29.9511, -90.0715, 100000);

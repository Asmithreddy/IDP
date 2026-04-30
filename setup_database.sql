-- =============================================================
-- NATURAL DISASTER TRACKER — DATABASE SETUP
-- Run this file once against a fresh cyclone_tracker database.
-- It creates all tables, indexes, and stored functions needed
-- by both the cyclone and tsunami parts of the application.
--
-- How to run:
--   psql -U postgres -d cyclone_tracker -f setup_database.sql
-- =============================================================


-- =============================================================
-- 1. PostGIS
-- =============================================================

CREATE EXTENSION IF NOT EXISTS postgis;


-- =============================================================
-- 2. Cyclone raw observations table
-- =============================================================

CREATE TABLE IF NOT EXISTS cyclone_points (
    id          SERIAL PRIMARY KEY,
    sid         TEXT NOT NULL,          -- Storm ID (e.g. 2020296N27083)
    season      INT,                    -- Year the storm occurred
    number      INT,                    -- Storm number within season
    basin       TEXT,                   -- Basin code (NI, NA, SI, EP, WP, SP, SA)
    subbasin    TEXT,
    name        TEXT,
    iso_time    TIMESTAMP,              -- Observation time in UTC
    nature      TEXT,                   -- TS, HU, TD, ET, SD, SS, NR, MX
    lat         DOUBLE PRECISION,
    lon         DOUBLE PRECISION,
    wmo_wind    INT,                    -- Max sustained wind (knots)
    wmo_pres    INT,                    -- Min central pressure (mb)
    dist2land   INT,                    -- Distance to nearest land (km)
    landfall    INT                     -- 1 = landfall observation
);

CREATE INDEX IF NOT EXISTS idx_cp_sid     ON cyclone_points(sid);
CREATE INDEX IF NOT EXISTS idx_cp_time    ON cyclone_points(iso_time);
CREATE INDEX IF NOT EXISTS idx_cp_season  ON cyclone_points(season);


-- =============================================================
-- 3. Cyclone tracks table  (one row per storm, LineString path)
-- =============================================================

CREATE TABLE IF NOT EXISTS cyclone_tracks (
    id              SERIAL PRIMARY KEY,
    sid             TEXT UNIQUE NOT NULL,
    name            TEXT,
    basin           TEXT,
    subbasin        TEXT,
    season          INT,
    path            GEOMETRY(LineString, 4326),
    start_time      TIMESTAMP,
    end_time        TIMESTAMP,
    duration_hours  DOUBLE PRECISION,
    point_count     INT,
    max_wind        INT,
    min_pressure    INT,
    max_lat         DOUBLE PRECISION,
    min_lat         DOUBLE PRECISION,
    max_lon         DOUBLE PRECISION,
    min_lon         DOUBLE PRECISION
);

-- Spatial index is critical — this is what makes map-click queries fast
CREATE INDEX IF NOT EXISTS idx_ct_path_gist ON cyclone_tracks USING GIST (path);
CREATE INDEX IF NOT EXISTS idx_ct_season    ON cyclone_tracks(season);
CREATE INDEX IF NOT EXISTS idx_ct_basin     ON cyclone_tracks(basin);
CREATE INDEX IF NOT EXISTS idx_ct_name      ON cyclone_tracks(name);


-- =============================================================
-- 4. find_cyclones_near_point()
--    Returns all storms whose track passed within distance_meters
--    of the given lat/lon.
-- =============================================================

DROP FUNCTION IF EXISTS find_cyclones_near_point(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);

CREATE OR REPLACE FUNCTION find_cyclones_near_point(
    clicked_lat     DOUBLE PRECISION,
    clicked_lon     DOUBLE PRECISION,
    distance_meters INTEGER DEFAULT 100000
)
RETURNS TABLE (
    storm_id        TEXT,
    cyclone_name    TEXT,
    year            INTEGER,
    basin           TEXT,
    start_date      TIMESTAMP,
    end_date        TIMESTAMP,
    distance_km     DOUBLE PRECISION,
    num_observations INT,
    max_wind_speed  INT,
    min_pressure    INT,
    duration_hours  DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF clicked_lat < -90 OR clicked_lat > 90 THEN
        RAISE EXCEPTION 'Latitude out of range: %', clicked_lat;
    END IF;
    IF clicked_lon < -180 OR clicked_lon > 180 THEN
        RAISE EXCEPTION 'Longitude out of range: %', clicked_lon;
    END IF;

    RETURN QUERY
    SELECT
        ct.sid,
        COALESCE(ct.name, 'UNNAMED'),
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
                ), 2
            ) AS DOUBLE PRECISION
        ),
        ct.point_count,
        COALESCE(ct.max_wind, 0),
        COALESCE(ct.min_pressure, 0),
        COALESCE(ct.duration_hours, 0.0)
    FROM cyclone_tracks ct
    WHERE ct.path IS NOT NULL
      AND ST_DWithin(
            ct.path::geography,
            ST_SetSRID(ST_MakePoint(clicked_lon, clicked_lat), 4326)::geography,
            distance_meters
          )
    ORDER BY distance_km ASC;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'find_cyclones_near_point error: %', SQLERRM;
        RETURN;
END;
$$;


-- =============================================================
-- 5. get_cyclone_track()
--    Returns the GeoJSON LineString for a single storm.
-- =============================================================

CREATE OR REPLACE FUNCTION get_cyclone_track(storm_id TEXT)
RETURNS TABLE (
    sid     TEXT,
    name    TEXT,
    season  INT,
    geojson TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ct.sid,
        COALESCE(ct.name, 'UNNAMED'),
        ct.season,
        ST_AsGeoJSON(ct.path)::TEXT
    FROM cyclone_tracks ct
    WHERE ct.sid = storm_id;
END;
$$;


-- =============================================================
-- 6. Tsunami events table
-- =============================================================

CREATE TABLE IF NOT EXISTS tsunami_events (
    id                      SERIAL PRIMARY KEY,
    year                    INTEGER,
    month                   INTEGER,
    day                     INTEGER,
    hour                    INTEGER,
    minute                  INTEGER,
    second                  NUMERIC(5,1),
    event_datetime          TIMESTAMP,
    event_validity          INTEGER,        -- 2=questionable 3=probable 4=definite
    cause_code              INTEGER,        -- 1=earthquake 2=volcanic 3=landslide …
    earthquake_magnitude    NUMERIC(4,1),
    country                 VARCHAR(100),
    location_name           VARCHAR(255),
    latitude                NUMERIC(8,5),
    longitude               NUMERIC(8,5),
    max_water_height        NUMERIC(8,2),   -- metres
    num_runups              INTEGER,
    tsunami_magnitude_abe   NUMERIC(5,2),
    tsunami_magnitude_iida  NUMERIC(5,2),
    tsunami_intensity       NUMERIC(5,2),
    deaths                  INTEGER,
    death_description       INTEGER,
    missing                 INTEGER,
    missing_description     INTEGER,
    injuries                INTEGER,
    injuries_description    INTEGER,
    damage_mil              NUMERIC(12,2),  -- USD millions
    damage_description      INTEGER,
    houses_destroyed        INTEGER,
    houses_destroyed_desc   INTEGER,
    houses_damaged          INTEGER,
    houses_damaged_desc     INTEGER,
    total_deaths            INTEGER,
    total_death_description INTEGER,
    total_missing           INTEGER,
    total_missing_desc      INTEGER,
    total_injuries          INTEGER,
    total_injuries_desc     INTEGER,
    total_damage_mil        NUMERIC(12,2),
    total_damage_desc       INTEGER,
    total_houses_destroyed  INTEGER,
    total_houses_dest_desc  INTEGER,
    total_houses_damaged    INTEGER,
    total_houses_dam_desc   INTEGER,
    geom                    GEOMETRY(POINT, 4326)
);

CREATE INDEX IF NOT EXISTS idx_tsunami_geom      ON tsunami_events USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_tsunami_year      ON tsunami_events(year);
CREATE INDEX IF NOT EXISTS idx_tsunami_country   ON tsunami_events(country);
CREATE INDEX IF NOT EXISTS idx_tsunami_validity  ON tsunami_events(event_validity);
CREATE INDEX IF NOT EXISTS idx_tsunami_magnitude ON tsunami_events(earthquake_magnitude);


-- =============================================================
-- 7. find_tsunamis_near_point()
-- =============================================================

CREATE OR REPLACE FUNCTION find_tsunamis_near_point(
    p_lat        DOUBLE PRECISION,
    p_lon        DOUBLE PRECISION,
    p_distance_m DOUBLE PRECISION DEFAULT 500000
)
RETURNS TABLE (
    id                   INTEGER,
    year                 INTEGER,
    month                INTEGER,
    day                  INTEGER,
    event_datetime       TIMESTAMP,
    event_validity       INTEGER,
    cause_code           INTEGER,
    earthquake_magnitude NUMERIC,
    country              VARCHAR,
    location_name        VARCHAR,
    latitude             NUMERIC,
    longitude            NUMERIC,
    max_water_height     NUMERIC,
    num_runups           INTEGER,
    deaths               INTEGER,
    total_deaths         INTEGER,
    damage_mil           NUMERIC,
    total_damage_mil     NUMERIC,
    houses_destroyed     INTEGER,
    total_houses_destroyed INTEGER,
    distance_km          DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id, e.year, e.month, e.day, e.event_datetime,
        e.event_validity, e.cause_code, e.earthquake_magnitude,
        e.country, e.location_name, e.latitude, e.longitude,
        e.max_water_height, e.num_runups,
        e.deaths, e.total_deaths,
        e.damage_mil, e.total_damage_mil,
        e.houses_destroyed, e.total_houses_destroyed,
        ROUND(
            ST_Distance(
                e.geom::geography,
                ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
            ) / 1000.0
        ) AS distance_km
    FROM tsunami_events e
    WHERE e.geom IS NOT NULL
      AND e.event_validity >= 2
      AND ST_DWithin(
            e.geom::geography,
            ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
            p_distance_m
          )
    ORDER BY distance_km ASC;
END;
$$;


-- =============================================================
-- 8. get_tsunami_event()
-- =============================================================

CREATE OR REPLACE FUNCTION get_tsunami_event(p_id INTEGER)
RETURNS TABLE (
    id                   INTEGER,
    year                 INTEGER,
    month                INTEGER,
    day                  INTEGER,
    hour                 INTEGER,
    minute               INTEGER,
    event_datetime       TIMESTAMP,
    event_validity       INTEGER,
    cause_code           INTEGER,
    earthquake_magnitude NUMERIC,
    country              VARCHAR,
    location_name        VARCHAR,
    latitude             NUMERIC,
    longitude            NUMERIC,
    max_water_height     NUMERIC,
    num_runups           INTEGER,
    tsunami_magnitude_abe  NUMERIC,
    tsunami_magnitude_iida NUMERIC,
    deaths               INTEGER,
    missing              INTEGER,
    injuries             INTEGER,
    damage_mil           NUMERIC,
    houses_destroyed     INTEGER,
    houses_damaged       INTEGER,
    total_deaths         INTEGER,
    total_missing        INTEGER,
    total_injuries       INTEGER,
    total_damage_mil     NUMERIC,
    total_houses_destroyed INTEGER,
    total_houses_damaged   INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id, e.year, e.month, e.day, e.hour, e.minute,
        e.event_datetime, e.event_validity, e.cause_code,
        e.earthquake_magnitude, e.country, e.location_name,
        e.latitude, e.longitude, e.max_water_height, e.num_runups,
        e.tsunami_magnitude_abe, e.tsunami_magnitude_iida,
        e.deaths, e.missing, e.injuries, e.damage_mil,
        e.houses_destroyed, e.houses_damaged,
        e.total_deaths, e.total_missing, e.total_injuries,
        e.total_damage_mil, e.total_houses_destroyed, e.total_houses_damaged
    FROM tsunami_events e
    WHERE e.id = p_id;
END;
$$;


-- =============================================================
-- 9. Quick sanity check  (uncomment after data import)
-- =============================================================

-- SELECT COUNT(*)          AS total_observations FROM cyclone_points;
-- SELECT COUNT(DISTINCT sid) AS unique_storms      FROM cyclone_points;
-- SELECT COUNT(*)          AS total_tracks        FROM cyclone_tracks;
-- SELECT COUNT(*)          AS total_tsunamis      FROM tsunami_events;

-- Test cyclone search near Mumbai:
-- SELECT COUNT(*) FROM find_cyclones_near_point(19.0760, 72.8777, 100000);

-- Test tsunami search near Indian Ocean:
-- SELECT COUNT(*) FROM find_tsunamis_near_point(12.0, 80.0, 1000000);

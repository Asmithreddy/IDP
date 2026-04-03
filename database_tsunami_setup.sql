-- ===============================================
-- TSUNAMI TRACKER DATABASE SETUP
-- Run this in psql or pgAdmin after database_setup.sql
-- Assumes cyclone_tracker DB already exists with PostGIS
-- ===============================================

-- ===============================================
-- Step 1: Create tsunami events table
-- ===============================================
CREATE TABLE IF NOT EXISTS tsunami_events (
    id                      SERIAL PRIMARY KEY,
    year                    INTEGER,
    month                   INTEGER,
    day                     INTEGER,
    hour                    INTEGER,
    minute                  INTEGER,
    second                  NUMERIC(5,1),
    event_datetime          TIMESTAMP,          -- parsed combined datetime (nullable for BC/ancient)
    event_validity          INTEGER,             -- 1=very doubtful, 2=questionable, 3=probable, 4=definite
    cause_code              INTEGER,             -- 1=earthquake, 2=volcanic, 3=landslide, etc.
    earthquake_magnitude    NUMERIC(4,1),
    country                 VARCHAR(100),
    location_name           VARCHAR(255),
    latitude                NUMERIC(8,5),
    longitude               NUMERIC(8,5),
    max_water_height        NUMERIC(8,2),        -- meters
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
    damage_mil              NUMERIC(12,2),
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
    geom                    GEOMETRY(POINT, 4326)  -- PostGIS point
);

-- ===============================================
-- Step 2: Create spatial + attribute indexes
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_tsunami_geom
    ON tsunami_events USING GIST(geom);

CREATE INDEX IF NOT EXISTS idx_tsunami_year
    ON tsunami_events(year);

CREATE INDEX IF NOT EXISTS idx_tsunami_country
    ON tsunami_events(country);

CREATE INDEX IF NOT EXISTS idx_tsunami_validity
    ON tsunami_events(event_validity);

CREATE INDEX IF NOT EXISTS idx_tsunami_magnitude
    ON tsunami_events(earthquake_magnitude);

-- ===============================================
-- Step 3: Spatial search function
-- ===============================================
CREATE OR REPLACE FUNCTION find_tsunamis_near_point(
    p_lat           DOUBLE PRECISION,
    p_lon           DOUBLE PRECISION,
    p_distance_m    DOUBLE PRECISION DEFAULT 500000
)
RETURNS TABLE (
    id                      INTEGER,
    year                    INTEGER,
    month                   INTEGER,
    day                     INTEGER,
    event_datetime          TIMESTAMP,
    event_validity          INTEGER,
    cause_code              INTEGER,
    earthquake_magnitude    NUMERIC,
    country                 VARCHAR,
    location_name           VARCHAR,
    latitude                NUMERIC,
    longitude               NUMERIC,
    max_water_height        NUMERIC,
    num_runups              INTEGER,
    deaths                  INTEGER,
    total_deaths            INTEGER,
    damage_mil              NUMERIC,
    total_damage_mil        NUMERIC,
    houses_destroyed        INTEGER,
    total_houses_destroyed  INTEGER,
    distance_km             DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.year,
        e.month,
        e.day,
        e.event_datetime,
        e.event_validity,
        e.cause_code,
        e.earthquake_magnitude,
        e.country,
        e.location_name,
        e.latitude,
        e.longitude,
        e.max_water_height,
        e.num_runups,
        e.deaths,
        e.total_deaths,
        e.damage_mil,
        e.total_damage_mil,
        e.houses_destroyed,
        e.total_houses_destroyed,
        ROUND(
            ST_Distance(
                e.geom::geography,
                ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
            ) / 1000.0
        ) AS distance_km
    FROM tsunami_events e
    WHERE
        e.geom IS NOT NULL
        AND e.event_validity >= 2    -- filter out very doubtful events
        AND ST_DWithin(
            e.geom::geography,
            ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
            p_distance_m
        )
    ORDER BY distance_km ASC;
END;
$$;

-- ===============================================
-- Step 4: Get single event details function
-- ===============================================
CREATE OR REPLACE FUNCTION get_tsunami_event(p_id INTEGER)
RETURNS TABLE (
    id                      INTEGER,
    year                    INTEGER,
    month                   INTEGER,
    day                     INTEGER,
    hour                    INTEGER,
    minute                  INTEGER,
    event_datetime          TIMESTAMP,
    event_validity          INTEGER,
    cause_code              INTEGER,
    earthquake_magnitude    NUMERIC,
    country                 VARCHAR,
    location_name           VARCHAR,
    latitude                NUMERIC,
    longitude               NUMERIC,
    max_water_height        NUMERIC,
    num_runups              INTEGER,
    tsunami_magnitude_abe   NUMERIC,
    tsunami_magnitude_iida  NUMERIC,
    deaths                  INTEGER,
    missing                 INTEGER,
    injuries                INTEGER,
    damage_mil              NUMERIC,
    houses_destroyed        INTEGER,
    houses_damaged          INTEGER,
    total_deaths            INTEGER,
    total_missing           INTEGER,
    total_injuries          INTEGER,
    total_damage_mil        NUMERIC,
    total_houses_destroyed  INTEGER,
    total_houses_damaged    INTEGER
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

-- ===============================================
-- Step 5: Verify
-- ===============================================
SELECT 'tsunami_events table created' AS status;
SELECT COUNT(*) AS total_tsunami_events FROM tsunami_events;
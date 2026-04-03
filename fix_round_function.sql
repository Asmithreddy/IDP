-- Fix the ROUND() function error
-- Run this to update the function in your database

DROP FUNCTION IF EXISTS find_cyclones_near_point(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);

CREATE OR REPLACE FUNCTION find_cyclones_near_point(
    clicked_lat DOUBLE PRECISION,
    clicked_lon DOUBLE PRECISION,
    distance_meters INTEGER DEFAULT 100000
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
                        ST_SetSRID(ST_Point(clicked_lon, clicked_lat), 4326)::geography
                    ) / 1000.0 AS numeric
                ),
                2
            ) AS DOUBLE PRECISION
        ) as distance_km,
        ct.point_count,
        ct.max_wind,
        ct.min_pressure,
        ct.duration_hours
    FROM cyclone_tracks ct
    WHERE ST_DWithin(
        ct.path::geography,
        ST_SetSRID(ST_Point(clicked_lon, clicked_lat), 4326)::geography,
        distance_meters
    )
    ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT * FROM find_cyclones_near_point(19.0760, 72.8777, 100000);

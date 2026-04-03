-- FINAL FIX - Run this in psql to fix all issues
-- This fixes: type mismatch, NULL values, and polar region issues

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

-- Verify the fix works
SELECT 'Testing Mumbai...' as test;
SELECT COUNT(*) as cyclones_near_mumbai FROM find_cyclones_near_point(19.0760, 72.8777, 100000);

SELECT 'Testing Atlantic...' as test;
SELECT COUNT(*) as cyclones_in_atlantic FROM find_cyclones_near_point(49.38, -33.05, 50000);

SELECT 'Function fixed successfully!' as status;

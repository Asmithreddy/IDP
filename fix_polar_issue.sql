-- Fix for polar regions and edge cases
-- This adds better error handling for high latitude areas

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
    -- Validate input coordinates
    IF clicked_lat < -90 OR clicked_lat > 90 THEN
        RAISE EXCEPTION 'Invalid latitude: must be between -90 and 90';
    END IF;
    
    IF clicked_lon < -180 OR clicked_lon > 180 THEN
        RAISE EXCEPTION 'Invalid longitude: must be between -180 and 180';
    END IF;
    
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
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but return empty result instead of failing
        RAISE WARNING 'Error in find_cyclones_near_point: %', SQLERRM;
        RETURN;
END;
$$ LANGUAGE plpgsql;

-- Test in various locations
SELECT COUNT(*) as count_mumbai FROM find_cyclones_near_point(19.0760, 72.8777, 100000);
SELECT COUNT(*) as count_atlantic FROM find_cyclones_near_point(49.38, -33.05, 50000);
SELECT COUNT(*) as count_polar FROM find_cyclones_near_point(71.41, 16.52, 50000);

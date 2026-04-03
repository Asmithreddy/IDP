"""
CYCLONE DATA IMPORT SCRIPT
Imports IBTrACS CSV data into PostgreSQL database
"""

import pandas as pd
import psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_batch
import sys
from datetime import datetime

# ===============================================
# DATABASE CONFIGURATION
# ===============================================
# IMPORTANT: Update these with your PostgreSQL credentials
DB_CONFIG = {
    'dbname': 'cyclone_tracker',
    'user': 'postgres',           # Change this to your PostgreSQL username
    'password': '1234',  # Change this to your PostgreSQL password
    'host': 'localhost',
    'port': '5432'
}

CSV_FILE = 'ibtracs.ALL.list.v04r01.csv'

# ===============================================
# FUNCTIONS
# ===============================================

def connect_db():
    """Connect to PostgreSQL database"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("✓ Connected to database successfully")
        return conn
    except Exception as e:
        print(f"✗ Error connecting to database: {e}")
        sys.exit(1)

def read_csv_data(csv_file):
    """Read and clean CSV data"""
    print(f"\n📂 Reading CSV file: {csv_file}")
    
    try:
        # Read CSV, skip the units row (row 1)
        df = pd.read_csv(csv_file, skiprows=[1], na_values=[' ', '', 'NA', 'NaN'])
        print(f"✓ Read {len(df):,} rows from CSV")
        
        # Select only needed columns
        columns_needed = ['SID', 'SEASON', 'NUMBER', 'BASIN', 'SUBBASIN', 'NAME', 
                         'ISO_TIME', 'NATURE', 'LAT', 'LON', 'WMO_WIND', 'WMO_PRES',
                         'DIST2LAND', 'LANDFALL']
        
        df_clean = df[columns_needed].copy()
        
        # Convert to proper types
        df_clean['ISO_TIME'] = pd.to_datetime(df_clean['ISO_TIME'], errors='coerce')
        df_clean['LAT'] = pd.to_numeric(df_clean['LAT'], errors='coerce')
        df_clean['LON'] = pd.to_numeric(df_clean['LON'], errors='coerce')
        df_clean['SEASON'] = pd.to_numeric(df_clean['SEASON'], errors='coerce')
        df_clean['NUMBER'] = pd.to_numeric(df_clean['NUMBER'], errors='coerce')
        df_clean['WMO_WIND'] = pd.to_numeric(df_clean['WMO_WIND'], errors='coerce')
        df_clean['WMO_PRES'] = pd.to_numeric(df_clean['WMO_PRES'], errors='coerce')
        df_clean['DIST2LAND'] = pd.to_numeric(df_clean['DIST2LAND'], errors='coerce')
        df_clean['LANDFALL'] = pd.to_numeric(df_clean['LANDFALL'], errors='coerce')
        
        # Remove rows with missing LAT/LON (can't map without coordinates)
        initial_count = len(df_clean)
        df_clean = df_clean.dropna(subset=['LAT', 'LON', 'ISO_TIME', 'SID'])
        
        # Validate LAT/LON ranges
        df_clean = df_clean[
            (df_clean['LAT'] >= -90) & (df_clean['LAT'] <= 90) &
            (df_clean['LON'] >= -180) & (df_clean['LON'] <= 180)
        ]
        
        removed_count = initial_count - len(df_clean)
        print(f"✓ Cleaned data: {len(df_clean):,} valid rows (removed {removed_count:,} invalid rows)")
        print(f"✓ Unique cyclones: {df_clean['SID'].nunique():,}")
        print(f"✓ Year range: {int(df_clean['SEASON'].min())} to {int(df_clean['SEASON'].max())}")
        
        return df_clean
        
    except Exception as e:
        print(f"✗ Error reading CSV: {e}")
        sys.exit(1)

def import_to_database(conn, df):
    """Import data to PostgreSQL"""
    print(f"\n📥 Importing data to database...")
    
    cursor = conn.cursor()
    
    try:
        # Clear existing data
        print("  Clearing existing data...")
        cursor.execute("TRUNCATE TABLE cyclone_points RESTART IDENTITY CASCADE;")
        cursor.execute("TRUNCATE TABLE cyclone_tracks RESTART IDENTITY CASCADE;")
        conn.commit()
        
        # Prepare data for batch insert
        print("  Preparing data...")
        records = []
        for _, row in df.iterrows():
            records.append((
                row['SID'],
                int(row['SEASON']) if pd.notna(row['SEASON']) else None,
                int(row['NUMBER']) if pd.notna(row['NUMBER']) else None,
                row['BASIN'] if pd.notna(row['BASIN']) else None,
                row['SUBBASIN'] if pd.notna(row['SUBBASIN']) else None,
                row['NAME'] if pd.notna(row['NAME']) else 'UNNAMED',
                row['ISO_TIME'],
                row['NATURE'] if pd.notna(row['NATURE']) else None,
                float(row['LAT']),
                float(row['LON']),
                int(row['WMO_WIND']) if pd.notna(row['WMO_WIND']) else None,
                int(row['WMO_PRES']) if pd.notna(row['WMO_PRES']) else None,
                int(row['DIST2LAND']) if pd.notna(row['DIST2LAND']) else None,
                int(row['LANDFALL']) if pd.notna(row['LANDFALL']) else None
            ))
        
        # Batch insert (much faster than row-by-row)
        print(f"  Inserting {len(records):,} records...")
        insert_query = """
            INSERT INTO cyclone_points 
            (sid, season, number, basin, subbasin, name, iso_time, nature, lat, lon, 
             wmo_wind, wmo_pres, dist2land, landfall)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        execute_batch(cursor, insert_query, records, page_size=1000)
        conn.commit()
        
        print(f"✓ Successfully imported {len(records):,} records to cyclone_points table")
        
    except Exception as e:
        conn.rollback()
        print(f"✗ Error importing data: {e}")
        raise
    finally:
        cursor.close()

def generate_tracks(conn):
    """Generate LineString tracks from points"""
    print(f"\n🗺️  Generating cyclone tracks (LineStrings)...")
    
    cursor = conn.cursor()
    
    try:
        # Generate tracks
        print("  Creating LineStrings from points...")
        cursor.execute("""
            INSERT INTO cyclone_tracks 
            (sid, name, basin, subbasin, season, path, start_time, end_time, 
             duration_hours, point_count, max_wind, min_pressure, 
             max_lat, min_lat, max_lon, min_lon)
            SELECT
                sid,
                MAX(name) as name,
                MAX(basin) as basin,
                MAX(subbasin) as subbasin,
                MAX(season) as season,
                ST_MakeLine(
                    ST_SetSRID(ST_Point(lon, lat), 4326)
                    ORDER BY iso_time
                ) as path,
                MIN(iso_time) as start_time,
                MAX(iso_time) as end_time,
                EXTRACT(EPOCH FROM (MAX(iso_time) - MIN(iso_time))) / 3600.0 as duration_hours,
                COUNT(*) as point_count,
                MAX(wmo_wind) as max_wind,
                MIN(wmo_pres) as min_pressure,
                MAX(lat) as max_lat,
                MIN(lat) as min_lat,
                MAX(lon) as max_lon,
                MIN(lon) as min_lon
            FROM cyclone_points
            WHERE lat IS NOT NULL 
              AND lon IS NOT NULL
              AND lat BETWEEN -90 AND 90
              AND lon BETWEEN -180 AND 180
            GROUP BY sid
            HAVING COUNT(*) >= 2
        """)
        
        conn.commit()
        
        # Get count
        cursor.execute("SELECT COUNT(*) FROM cyclone_tracks")
        track_count = cursor.fetchone()[0]
        
        print(f"✓ Successfully created {track_count:,} cyclone tracks")
        
        # Show sample
        cursor.execute("""
            SELECT sid, name, season, point_count, start_time, end_time 
            FROM cyclone_tracks 
            ORDER BY season DESC 
            LIMIT 5
        """)
        
        print("\n  Sample tracks:")
        for row in cursor.fetchall():
            print(f"    - {row[1]} ({row[2]}): {row[3]} points, {row[4]} to {row[5]}")
        
    except Exception as e:
        conn.rollback()
        print(f"✗ Error generating tracks: {e}")
        raise
    finally:
        cursor.close()

def verify_data(conn):
    """Verify imported data"""
    print(f"\n✅ Verification:")
    
    cursor = conn.cursor()
    
    try:
        # Count points
        cursor.execute("SELECT COUNT(*) FROM cyclone_points")
        point_count = cursor.fetchone()[0]
        print(f"  - Total points: {point_count:,}")
        
        # Count unique cyclones
        cursor.execute("SELECT COUNT(DISTINCT sid) FROM cyclone_points")
        unique_cyclones = cursor.fetchone()[0]
        print(f"  - Unique cyclones: {unique_cyclones:,}")
        
        # Count tracks
        cursor.execute("SELECT COUNT(*) FROM cyclone_tracks")
        track_count = cursor.fetchone()[0]
        print(f"  - Tracks created: {track_count:,}")
        
        # Test query
        print(f"\n  Testing query near Mumbai (19.0760° N, 72.8777° E)...")
        cursor.execute("SELECT * FROM find_cyclones_near_point(19.0760, 72.8777, 100000)")
        results = cursor.fetchall()
        print(f"  - Found {len(results)} cyclones within 100km")
        
        if results:
            print(f"  - Nearest: {results[0][1]} ({results[0][2]}) at {results[0][6]:.2f} km")
        
    except Exception as e:
        print(f"✗ Error during verification: {e}")
    finally:
        cursor.close()

# ===============================================
# MAIN EXECUTION
# ===============================================

def main():
    print("=" * 60)
    print("CYCLONE DATA IMPORT SCRIPT")
    print("=" * 60)
    
    # Connect to database
    conn = connect_db() 
    
    try:
        # Read CSV data
        df = read_csv_data(CSV_FILE)
        
        # Import to database
        import_to_database(conn, df)
        
        # Generate tracks
        generate_tracks(conn)
        
        # Verify
        verify_data(conn)
        
        print("\n" + "=" * 60)
        print("✓ IMPORT COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print("\nNext steps:")
        print("  1. Run the backend API: python api_server.py")
        print("  2. Open frontend/index.html in your browser")
        
    except Exception as e:
        print(f"\n✗ Import failed: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()

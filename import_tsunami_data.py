"""
TSUNAMI DATA IMPORTER
Reads NOAA TSV file and imports into PostgreSQL tsunami_events table
Separate from cyclone importer - does not touch cyclone tables
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import numpy as np
from datetime import datetime
import os
import sys

# ===============================================
# CONFIGURATION
# ===============================================
DB_CONFIG = {
    'dbname': 'cyclone_tracker',
    'user': 'postgres',
    'password': '1234',
    'host': 'localhost',
    'port': '5432'
}

TSV_FILE = r'C:\Users\abhin\idp\Code\Code\tsunamis-2026-03-05_22-04-25_+0530.tsv'

# ===============================================
# HELPERS
# ===============================================

def safe_int(val):
    """Convert to int, return None if invalid"""
    try:
        if pd.isna(val):
            return None
        return int(val)
    except:
        return None

def safe_float(val):
    """Convert to float, return None if invalid"""
    try:
        if pd.isna(val):
            return None
        return float(val)
    except:
        return None

def safe_str(val):
    """Convert to string, return None if invalid"""
    try:
        if pd.isna(val):
            return None
        s = str(val).strip()
        return s if s else None
    except:
        return None

def parse_datetime(row):
    """
    Parse Year/Mo/Dy/Hr/Mn/Sec into a datetime object.
    Returns None if year is missing, BC (negative), or incomplete.
    """
    try:
        year = safe_int(row.get('Year'))
        if year is None or year <= 0:
            return None  # BC years or missing — skip datetime

        month = safe_int(row.get('Mo')) or 1
        day   = safe_int(row.get('Dy')) or 1
        hour  = safe_int(row.get('Hr')) or 0
        minute= safe_int(row.get('Mn')) or 0
        sec   = safe_float(row.get('Sec')) or 0.0

        # clamp values to valid ranges
        month  = max(1, min(12, month))
        day    = max(1, min(31, day))
        hour   = max(0, min(23, hour))
        minute = max(0, min(59, minute))
        sec    = max(0.0, min(59.9, sec))

        return datetime(year, month, day, hour, minute, int(sec))
    except:
        return None

def get_cause_label(code):
    """Human readable cause for logging"""
    causes = {
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
        11: 'Astronomical'
    }
    return causes.get(code, 'Unknown')

# ===============================================
# LOAD + CLEAN TSV
# ===============================================
# ...existing code...

def load_tsv(filepath):
    print(f"\n📂 Loading TSV: {filepath}")

    if not os.path.exists(filepath):
        print(f"❌ File not found: {filepath}")
        sys.exit(1)

    # Row 0 = actual column names
    # Row 1 = ["Year >= 1970"] junk row
    # Row 2+ = actual data
    df = pd.read_csv(
        filepath,
        sep='\t',
        header=0,            # row 0 is the real header
        dtype=str,
        encoding='utf-8',
        on_bad_lines='skip'
    )

    print(f"✅ Raw rows loaded: {len(df)}")

    # Drop the junk search parameters row (Year column will be nan or contain "[")
    df = df[df['Year'].notna()]
    df = df[~df['Year'].str.contains(r'\[', na=True)]
    df = df[df['Year'].str.strip() != '']

    # Strip quotes from all string values
    df = df.apply(lambda col: col.str.strip('"').str.strip() if col.dtype == object else col)

    print(f"✅ Rows after cleaning: {len(df)}")
    print(f"📋 Columns: {list(df.columns)}")
    return df

# ...existing code...

# ===============================================
# BUILD RECORDS
# ===============================================

def build_records(df):
    print("\n🔨 Building records...")
    records = []
    skipped_no_coords = 0
    skipped_bc = 0

    for _, row in df.iterrows():
        lat = safe_float(row.get('Latitude'))
        lon = safe_float(row.get('Longitude'))

        # Must have coordinates for spatial queries
        if lat is None or lon is None:
            skipped_no_coords += 1
            continue

        # Validate coordinate ranges
        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            skipped_no_coords += 1
            continue

        year = safe_int(row.get('Year'))
        if year is not None and year <= 0:
            skipped_bc += 1
            # still import BC events but without datetime

        event_dt = parse_datetime(row)

        record = (
            year,
            safe_int(row.get('Mo')),
            safe_int(row.get('Dy')),
            safe_int(row.get('Hr')),
            safe_int(row.get('Mn')),
            safe_float(row.get('Sec')),
            event_dt,
            safe_int(row.get('Tsunami Event Validity')),
            safe_int(row.get('Tsunami Cause Code')),
            safe_float(row.get('Earthquake Magnitude')),
            safe_str(row.get('Country')),
            safe_str(row.get('Location Name')),
            lat,
            lon,
            safe_float(row.get('Maximum Water Height (m)')),
            safe_int(row.get('Number of Runups')),
            safe_float(row.get('Tsunami Magnitude (Abe)')),
            safe_float(row.get('Tsunami Magnitude (Iida)')),
            safe_float(row.get('Tsunami Intensity')),
            safe_int(row.get('Deaths')),
            safe_int(row.get('Death Description')),
            safe_int(row.get('Missing')),
            safe_int(row.get('Missing Description')),
            safe_int(row.get('Injuries')),
            safe_int(row.get('Injuries Description')),
            safe_float(row.get('Damage ($Mil)')),
            safe_int(row.get('Damage Description')),
            safe_int(row.get('Houses Destroyed')),
            safe_int(row.get('Houses Destroyed Description')),
            safe_int(row.get('Houses Damaged')),
            safe_int(row.get('Houses Damaged Description')),
            safe_int(row.get('Total Deaths')),
            safe_int(row.get('Total Death Description')),
            safe_int(row.get('Total Missing')),
            safe_int(row.get('Total Missing Description')),
            safe_int(row.get('Total Injuries')),
            safe_int(row.get('Total Injuries Description')),
            safe_float(row.get('Total Damage ($Mil)')),
            safe_int(row.get('Total Damage Description')),
            safe_int(row.get('Total Houses Destroyed')),
            safe_int(row.get('Total Houses Destroyed Description')),
            safe_int(row.get('Total Houses Damaged')),
            safe_int(row.get('Total Houses Damaged Description')),
            lon,   # for ST_MakePoint(lon, lat)
            lat,
        )
        records.append(record)

    print(f"✅ Records built: {len(records)}")
    print(f"⚠️  Skipped (no coords): {skipped_no_coords}")
    print(f"ℹ️  BC year events included (no datetime): {skipped_bc}")
    return records

# ===============================================
# INSERT INTO DB
# ===============================================

INSERT_SQL = """
    INSERT INTO tsunami_events (
        year, month, day, hour, minute, second,
        event_datetime, event_validity, cause_code,
        earthquake_magnitude, country, location_name,
        latitude, longitude,
        max_water_height, num_runups,
        tsunami_magnitude_abe, tsunami_magnitude_iida, tsunami_intensity,
        deaths, death_description,
        missing, missing_description,
        injuries, injuries_description,
        damage_mil, damage_description,
        houses_destroyed, houses_destroyed_desc,
        houses_damaged, houses_damaged_desc,
        total_deaths, total_death_description,
        total_missing, total_missing_desc,
        total_injuries, total_injuries_desc,
        total_damage_mil, total_damage_desc,
        total_houses_destroyed, total_houses_dest_desc,
        total_houses_damaged, total_houses_dam_desc,
        geom
    ) VALUES (
        %s, %s, %s, %s, %s, %s,
        %s, %s, %s,
        %s, %s, %s,
        %s, %s,
        %s, %s,
        %s, %s, %s,
        %s, %s,
        %s, %s,
        %s, %s,
        %s, %s,
        %s, %s,
        %s, %s,
        %s, %s,
        %s, %s,
        %s, %s,
        %s, %s,
        %s, %s,
        %s, %s,
        ST_SetSRID(ST_MakePoint(%s, %s), 4326)
    )
"""

def import_to_db(records):
    print(f"\n🗄️  Connecting to database...")
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Clear existing data
        print("🗑️  Clearing existing tsunami data...")
        cursor.execute("TRUNCATE TABLE tsunami_events RESTART IDENTITY;")

        # Batch insert
        BATCH_SIZE = 500
        total = len(records)
        inserted = 0

        print(f"📥 Inserting {total} records in batches of {BATCH_SIZE}...")

        for i in range(0, total, BATCH_SIZE):
            batch = records[i:i + BATCH_SIZE]
            cursor.executemany(INSERT_SQL, batch)
            inserted += len(batch)
            pct = (inserted / total) * 100
            print(f"   {inserted}/{total} ({pct:.1f}%)", end='\r')

        conn.commit()
        print(f"\n✅ Successfully inserted {inserted} tsunami events")

        # Verify
        cursor.execute("SELECT COUNT(*) FROM tsunami_events")
        count = cursor.fetchone()[0]
        print(f"✅ DB verification: {count} rows in tsunami_events")

        # Quick stats
        cursor.execute("""
            SELECT
                MIN(year) AS earliest,
                MAX(year) AS latest,
                COUNT(*) FILTER (WHERE event_validity >= 3) AS reliable_events,
                COUNT(*) FILTER (WHERE max_water_height IS NOT NULL) AS with_height,
                COUNT(*) FILTER (WHERE total_deaths > 0) AS with_deaths,
                ROUND(AVG(earthquake_magnitude)::numeric, 2) AS avg_magnitude
            FROM tsunami_events
        """)
        stats = cursor.fetchone()
        print(f"\n📊 Dataset Summary:")
        print(f"   Year range   : {stats[0]} → {stats[1]}")
        print(f"   Reliable (≥3): {stats[2]}")
        print(f"   With height  : {stats[3]}")
        print(f"   With deaths  : {stats[4]}")
        print(f"   Avg magnitude: {stats[5]}")

        cursor.close()

    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        if conn:
            conn.rollback()
        sys.exit(1)
    finally:
        if conn:
            conn.close()
            print("🔒 DB connection closed")

# ===============================================
# MAIN
# ===============================================

if __name__ == '__main__':
    print("=" * 50)
    print("  TSUNAMI DATA IMPORTER")
    print("=" * 50)

    df = load_tsv(TSV_FILE)
    records = build_records(df)

    if not records:
        print("❌ No valid records to import. Check TSV file.")
        sys.exit(1)

    import_to_db(records)

    print("\n🎉 Import complete!")
    print("   Next: run tsunami_api.py or start api_server.py")
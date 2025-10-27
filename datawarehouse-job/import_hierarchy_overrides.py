#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced CSV Hierarchy Import Script - Uses campaign_hierarchy_overrides table
Imports campaign hierarchy from CSV and saves to overrides table so data persists across syncs
"""
import sys
import csv
import sqlite3
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Optional

# Fix Windows console encoding
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


def clean_field(value: str, default: str = 'Unknown') -> str:
    """
    Clean field value, replace 'none' with default

    Args:
        value: Raw field value from CSV
        default: Default value for 'none' or empty fields

    Returns:
        Cleaned field value
    """
    if not value:
        return default

    value = value.strip()

    # Replace 'none' with default
    if value.lower() == 'none':
        return default

    # Return cleaned value
    return value


def load_csv_hierarchy(csv_path: str) -> List[Dict[str, str]]:
    """
    Load hierarchy data from CSV file

    Args:
        csv_path: Path to CSV file

    Returns:
        List of hierarchy records
    """
    records = []

    print(f"Loading CSV: {csv_path}")

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for i, row in enumerate(reader, start=2):
            # Validate required fields
            if not row.get('campaign_name'):
                print(f"  ✗ Row {i}: Missing campaign_name")
                continue

            # Extract and clean fields
            record = {
                'csv_campaign_id': row.get('campaign_id', ''),
                'campaign_name': row['campaign_name'].strip(),
                'network': clean_field(row.get('network', ''), 'Unknown'),
                'domain': clean_field(row.get('domain', ''), 'Unknown'),
                'placement': clean_field(row.get('placement', ''), 'Unknown'),
                'targeting': clean_field(row.get('targeting', ''), 'Unknown'),
                'special': clean_field(row.get('special', ''), 'Standard')
            }

            records.append(record)

    print(f"✓ Loaded {len(records)} records from CSV\n")
    return records


def match_campaigns_to_database(csv_records: List[Dict], db_campaigns: List[Dict]) -> Dict:
    """
    Match CSV records to database campaigns by name

    Args:
        csv_records: Records from CSV
        db_campaigns: Campaigns from database

    Returns:
        Dictionary with match statistics and matched records
    """
    print("Matching campaigns by name...")

    # Create lookup dict for database campaigns
    db_lookup = {campaign['name'].lower().strip(): campaign for campaign in db_campaigns}

    matched = []
    not_found = []

    for record in csv_records:
        campaign_name_lower = record['campaign_name'].lower().strip()

        if campaign_name_lower in db_lookup:
            db_campaign = db_lookup[campaign_name_lower]
            matched.append({
                'db_campaign_id': db_campaign['id'],
                'campaign_name': db_campaign['name'],
                'network': record['network'],
                'domain': record['domain'],
                'placement': record['placement'],
                'targeting': record['targeting'],
                'special': record['special']
            })
        else:
            not_found.append(record['campaign_name'])

    print(f"✓ Matched {len(matched)} campaigns")
    if not_found:
        print(f"✗ Not found in database: {len(not_found)} campaigns")

    return {
        'matched': matched,
        'not_found': not_found
    }


def import_to_overrides_table(conn: sqlite3.Connection, matched_records: List[Dict], overridden_by: str = 'CSV Import') -> Dict:
    """
    Import matched records into campaign_hierarchy_overrides table

    Args:
        conn: Database connection
        matched_records: List of matched campaign records
        overridden_by: Who/what created this override

    Returns:
        Statistics dictionary
    """
    cursor = conn.cursor()
    timestamp = datetime.now(timezone.utc).isoformat()

    imported = 0
    errors = 0

    print(f"\nImporting {len(matched_records)} records to campaign_hierarchy_overrides...")

    for record in matched_records:
        try:
            # Deactivate any existing active overrides for this campaign
            cursor.execute("""
                UPDATE campaign_hierarchy_overrides
                SET is_active = 0, updated_at = ?
                WHERE campaign_id = ? AND is_active = 1
            """, (timestamp, record['db_campaign_id']))

            # Insert new override
            cursor.execute("""
                INSERT INTO campaign_hierarchy_overrides
                (campaign_id, network, domain, placement, targeting, special,
                 override_reason, overridden_by, overridden_at, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """, (
                record['db_campaign_id'],
                record['network'],
                record['domain'],
                record['placement'],
                record['targeting'],
                record['special'],
                'CSV hierarchy import',
                overridden_by,
                timestamp,
                timestamp,
                timestamp
            ))

            # Also update campaign_hierarchy table for immediate effect
            cursor.execute("""
                INSERT OR REPLACE INTO campaign_hierarchy
                (campaign_id, campaign_name, network, domain, placement, targeting, special,
                 mapping_confidence, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1.0, ?)
            """, (
                record['db_campaign_id'],
                record['campaign_name'],
                record['network'],
                record['domain'],
                record['placement'],
                record['targeting'],
                record['special'],
                timestamp
            ))

            imported += 1

        except Exception as e:
            errors += 1
            print(f"✗ Error importing {record['campaign_name']}: {e}")

    conn.commit()

    print(f"\n✓ Imported {imported} overrides")
    if errors:
        print(f"✗ {errors} errors")

    return {
        'imported': imported,
        'errors': errors
    }


def show_network_distribution(conn: sqlite3.Connection):
    """Display network distribution after import"""
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("NETWORK DISTRIBUTION AFTER IMPORT")
    print("=" * 70)

    cursor.execute("""
        SELECT network, COUNT(*) as count
        FROM campaign_hierarchy
        WHERE network IS NOT NULL
        GROUP BY network
        ORDER BY count DESC
    """)

    for network, count in cursor.fetchall():
        print(f"  {network}: {count} campaigns")


def main():
    parser = argparse.ArgumentParser(
        description='Import campaign hierarchy from CSV into overrides table (persists across syncs)'
    )
    parser.add_argument('--csv', required=True, help='Path to CSV file with hierarchy columns')
    parser.add_argument('--db', required=True, help='Path to SQLite database file')
    parser.add_argument('--dry-run', action='store_true', help='Preview without importing')
    parser.add_argument('--overridden-by', default='CSV Import', help='Name/source of this import')

    args = parser.parse_args()

    csv_path = Path(args.csv)
    db_path = Path(args.db)

    # Validate files
    if not csv_path.exists():
        print(f"ERROR: CSV file not found: {csv_path}")
        return 1

    if not db_path.exists():
        print(f"ERROR: Database file not found: {db_path}")
        return 1

    print("=" * 70)
    print("ENHANCED CSV HIERARCHY IMPORT (Uses Overrides Table)")
    print("Hierarchy assignments will PERSIST across syncs")
    print("=" * 70)
    print()

    # Connect to database
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print(f"Connected to database: {db_path}\n")

    # Load database campaigns
    cursor.execute("SELECT id, name FROM campaigns")
    db_campaigns = [dict(row) for row in cursor.fetchall()]
    print(f"✓ Loaded {len(db_campaigns)} campaigns from database\n")

    # Load CSV data
    csv_records = load_csv_hierarchy(str(csv_path))

    if not csv_records:
        print("ERROR: No valid records found in CSV")
        conn.close()
        return 1

    # Match campaigns
    match_results = match_campaigns_to_database(csv_records, db_campaigns)

    if not match_results['matched']:
        print("ERROR: No campaigns matched between CSV and database")
        conn.close()
        return 1

    # Show sample matches
    print("\nSample matches (first 10):")
    print("-" * 70)
    for i, record in enumerate(match_results['matched'][:10]):
        print(f"  {record['campaign_name'][:40]:40} -> {record['network']}")

    if len(match_results['matched']) > 10:
        print(f"  ... and {len(match_results['matched']) - 10} more")

    if args.dry_run:
        print("\n[DRY RUN] Skipping import")
        conn.close()
        return 0

    # Import to overrides table
    import_stats = import_to_overrides_table(
        conn,
        match_results['matched'],
        args.overridden_by
    )

    # Show network distribution
    show_network_distribution(conn)

    print("\n" + "=" * 70)
    print("✓ IMPORT COMPLETE")
    print("=" * 70)
    print(f"  Campaigns imported: {import_stats['imported']}")
    print(f"  Errors: {import_stats['errors']}")
    print(f"  Not found in DB: {len(match_results['not_found'])}")
    print()
    print("✓ These hierarchy assignments will now PERSIST across syncs!")
    print("=" * 70)

    conn.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())

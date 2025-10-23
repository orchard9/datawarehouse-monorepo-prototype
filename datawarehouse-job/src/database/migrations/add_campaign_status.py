#!/usr/bin/env python3
"""
Database Migration: Add Status Column to Campaigns
Adds status column to campaigns table enabling manual status override
Supports 'live', 'paused', and 'unknown' status values
"""
import sqlite3
from datetime import datetime, timezone
from typing import Optional
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))


def check_column_exists(cursor: sqlite3.Cursor, table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]
    return column_name in columns


def migrate_up(conn: sqlite3.Connection) -> None:
    """Apply the migration"""
    cursor = conn.cursor()

    print(f"[{datetime.now(timezone.utc)}] Starting campaign status migration...")

    # Step 1: Add status column
    if not check_column_exists(cursor, 'campaigns', 'status'):
        print("  Adding 'status' column to campaigns table...")
        cursor.execute("""
            ALTER TABLE campaigns
            ADD COLUMN status TEXT
            CHECK(status IN ('live', 'paused', 'unknown'))
        """)
        print("  [OK] Added 'status' column")
    else:
        print("  [INFO] 'status' column already exists in campaigns table")

    # Step 2: Populate status values from existing is_serving data
    print("  Populating status values from is_serving data...")
    cursor.execute("""
        SELECT id, is_serving
        FROM campaigns
        WHERE status IS NULL
    """)

    campaigns = cursor.fetchall()

    if campaigns:
        for campaign_id, is_serving in campaigns:
            # Derive status from is_serving
            if is_serving == 1:
                status = 'live'
            elif is_serving == 0:
                status = 'paused'
            else:
                status = 'unknown'

            cursor.execute("""
                UPDATE campaigns
                SET status = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            """, (status, campaign_id))

        print(f"  [OK] Populated status for {len(campaigns)} campaign(s)")
    else:
        print("  [INFO] No campaigns need status population")

    # Step 3: Create index on status column for better query performance
    print("  Creating index on campaign status...")
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_campaigns_status
        ON campaigns (status)
    """)
    print("  [OK] Created index 'idx_campaigns_status'")

    conn.commit()
    print(f"[{datetime.now(timezone.utc)}] [SUCCESS] Campaign status migration completed successfully!")
    print("\n  NOTE: The 'is_serving' column remains unchanged.")
    print("  The 'status' column now allows manual override of campaign status.")
    print("  When status is NULL, the system falls back to deriving from is_serving.\n")


def migrate_down(conn: sqlite3.Connection) -> None:
    """Rollback the migration"""
    cursor = conn.cursor()

    print(f"[{datetime.now(timezone.utc)}] Rolling back campaign status migration...")

    # Drop the status index
    print("  Dropping index 'idx_campaigns_status'...")
    cursor.execute("DROP INDEX IF EXISTS idx_campaigns_status")
    print("  [OK] Dropped index")

    # Note: SQLite doesn't support DROP COLUMN without recreating the table
    print("  [WARNING] Cannot drop 'status' column")
    print("    SQLite doesn't support DROP COLUMN. The column will remain but be unused.")
    print("    To fully remove it, you would need to recreate the table.")

    conn.commit()
    print(f"[{datetime.now(timezone.utc)}] [SUCCESS] Rollback completed!")


def main():
    """Run migration script"""
    import argparse

    parser = argparse.ArgumentParser(description='Campaign status database migration')
    parser.add_argument('action', choices=['up', 'down'], help='Migration action (up=apply, down=rollback)')
    parser.add_argument('--db-path', default='datawarehouse.db', help='Path to database file')

    args = parser.parse_args()

    # Get database path
    db_path = args.db_path

    # Check if database exists
    if not os.path.exists(db_path):
        print(f"[ERROR] Database file not found at {db_path}")
        sys.exit(1)

    # Connect to database
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")

    try:
        if args.action == 'up':
            migrate_up(conn)
        elif args.action == 'down':
            migrate_down(conn)
    except Exception as e:
        print(f"[ERROR] Migration failed: {str(e)}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == '__main__':
    main()

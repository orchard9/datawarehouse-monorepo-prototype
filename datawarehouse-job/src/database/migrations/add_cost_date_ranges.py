#!/usr/bin/env python3
"""
Database Migration: Add Date Ranges to Cost Overrides
Adds start_date, end_date, billing_period columns to campaign_cost_overrides table
Enables period-specific cost tracking with accurate date filtering
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

    print(f"[{datetime.now(timezone.utc)}] Starting cost date ranges migration...")

    # Step 1: Add start_date column
    if not check_column_exists(cursor, 'campaign_cost_overrides', 'start_date'):
        print("  Adding 'start_date' column to campaign_cost_overrides table...")
        cursor.execute("ALTER TABLE campaign_cost_overrides ADD COLUMN start_date TEXT")
        print("  [OK] Added 'start_date' column")
    else:
        print("  [INFO] 'start_date' column already exists in campaign_cost_overrides table")

    # Step 2: Add end_date column
    if not check_column_exists(cursor, 'campaign_cost_overrides', 'end_date'):
        print("  Adding 'end_date' column to campaign_cost_overrides table...")
        cursor.execute("ALTER TABLE campaign_cost_overrides ADD COLUMN end_date TEXT")
        print("  [OK] Added 'end_date' column")
    else:
        print("  [INFO] 'end_date' column already exists in campaign_cost_overrides table")

    # Step 3: Add billing_period column
    if not check_column_exists(cursor, 'campaign_cost_overrides', 'billing_period'):
        print("  Adding 'billing_period' column to campaign_cost_overrides table...")
        cursor.execute("ALTER TABLE campaign_cost_overrides ADD COLUMN billing_period TEXT DEFAULT 'custom'")
        print("  [OK] Added 'billing_period' column")
    else:
        print("  [INFO] 'billing_period' column already exists in campaign_cost_overrides table")

    # Step 4: Populate date ranges for existing cost overrides
    print("  Populating date ranges for existing cost overrides...")
    cursor.execute("""
        SELECT cco.id, cco.campaign_id, cco.overridden_at, c.created_at
        FROM campaign_cost_overrides cco
        JOIN campaigns c ON cco.campaign_id = c.id
        WHERE cco.start_date IS NULL OR cco.end_date IS NULL
    """)

    overrides = cursor.fetchall()

    if overrides:
        current_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')

        for override_id, campaign_id, overridden_at, campaign_created_at in overrides:
            # Use campaign created date as start date, current date as end date
            # This gives a reasonable default range for existing overrides
            start_date = campaign_created_at[:10] if campaign_created_at else overridden_at[:10]
            end_date = current_date

            cursor.execute("""
                UPDATE campaign_cost_overrides
                SET start_date = ?,
                    end_date = ?,
                    billing_period = 'custom',
                    updated_at = datetime('now')
                WHERE id = ?
            """, (start_date, end_date, override_id))

        print(f"  [OK] Updated {len(overrides)} existing cost override(s) with default date ranges")
    else:
        print("  [INFO] No existing cost overrides to migrate")

    # Step 5: Create index on date columns for better query performance
    print("  Creating index on cost override dates...")
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_cost_overrides_dates
        ON campaign_cost_overrides (campaign_id, start_date, end_date, is_active)
    """)
    print("  [OK] Created index 'idx_cost_overrides_dates'")

    conn.commit()
    print(f"[{datetime.now(timezone.utc)}] [SUCCESS] Cost date ranges migration completed successfully!")


def migrate_down(conn: sqlite3.Connection) -> None:
    """Rollback the migration"""
    cursor = conn.cursor()

    print(f"[{datetime.now(timezone.utc)}] Rolling back cost date ranges migration...")

    # Drop the date index
    print("  Dropping index 'idx_cost_overrides_dates'...")
    cursor.execute("DROP INDEX IF EXISTS idx_cost_overrides_dates")
    print("  [OK] Dropped index")

    # Note: SQLite doesn't support DROP COLUMN without recreating the table
    print("  [WARNING] Cannot drop 'start_date', 'end_date', 'billing_period' columns")
    print("    SQLite doesn't support DROP COLUMN. The columns will remain but be unused.")

    conn.commit()
    print(f"[{datetime.now(timezone.utc)}] [SUCCESS] Rollback completed!")


def main():
    """Run migration script"""
    import argparse

    parser = argparse.ArgumentParser(description='Cost date ranges database migration')
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

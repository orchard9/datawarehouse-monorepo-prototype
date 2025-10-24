#!/usr/bin/env python3
"""
Database Migration: Add Source Column to Campaigns
Adds source column to campaigns table to track origin (API vs Manual)
Supports 'api' and 'manual' source values
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

    print(f"[{datetime.now(timezone.utc)}] Starting campaign source migration...")

    # Step 1: Add source column
    if not check_column_exists(cursor, 'campaigns', 'source'):
        print("  Adding 'source' column to campaigns table...")
        cursor.execute("""
            ALTER TABLE campaigns
            ADD COLUMN source TEXT DEFAULT 'api'
            CHECK(source IN ('api', 'manual'))
        """)
        print("  [OK] Added 'source' column")
    else:
        print("  [INFO] 'source' column already exists in campaigns table")

    # Step 2: Set all existing campaigns to 'api' source
    print("  Setting existing campaigns to 'api' source...")
    cursor.execute("""
        UPDATE campaigns
        SET source = 'api'
        WHERE source IS NULL
    """)
    rows_updated = cursor.rowcount
    print(f"  [OK] Updated {rows_updated} campaign(s) to 'api' source")

    # Step 3: Create index on source column for better query performance
    print("  Creating index on campaign source...")
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_campaigns_source
        ON campaigns (source)
    """)
    print("  [OK] Created index 'idx_campaigns_source'")

    conn.commit()
    print(f"[{datetime.now(timezone.utc)}] [SUCCESS] Campaign source migration completed successfully!")
    print("\n  NOTE: All existing campaigns are marked as 'api' source.")
    print("  New manually created campaigns will be marked as 'manual' source.")
    print("  This enables filtering and tracking of campaign origin.\n")


def migrate_down(conn: sqlite3.Connection) -> None:
    """Rollback the migration"""
    cursor = conn.cursor()

    print(f"[{datetime.now(timezone.utc)}] Rolling back campaign source migration...")

    # Drop the source index
    print("  Dropping index 'idx_campaigns_source'...")
    cursor.execute("DROP INDEX IF EXISTS idx_campaigns_source")
    print("  [OK] Dropped index")

    # Note: SQLite doesn't support DROP COLUMN without recreating the table
    print("  [WARNING] Cannot drop 'source' column")
    print("    SQLite doesn't support DROP COLUMN. The column will remain but be unused.")
    print("    To fully remove it, you would need to recreate the table.")

    conn.commit()
    print(f"[{datetime.now(timezone.utc)}] [SUCCESS] Rollback completed!")


def main():
    """Run migration script"""
    import argparse

    parser = argparse.ArgumentParser(description='Campaign source database migration')
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

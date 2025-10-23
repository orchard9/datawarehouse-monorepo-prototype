#!/usr/bin/env python3
"""
Database Migration: Add Cost Tracking
Adds cost and cost_status columns to campaigns table
Creates campaign_cost_overrides table for manual cost entries
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


def check_table_exists(cursor: sqlite3.Cursor, table_name: str) -> bool:
    """Check if a table exists"""
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
    return cursor.fetchone() is not None


def migrate_up(conn: sqlite3.Connection) -> None:
    """Apply the migration"""
    cursor = conn.cursor()

    print(f"[{datetime.now(timezone.utc)}] Starting cost tracking migration...")

    # Step 1: Add status column to campaigns table if it doesn't exist
    if not check_column_exists(cursor, 'campaigns', 'status'):
        print("  Adding 'status' column to campaigns table...")
        cursor.execute("ALTER TABLE campaigns ADD COLUMN status TEXT DEFAULT 'unknown'")
        print("  [OK] Added 'status' column")
    else:
        print("  [INFO] 'status' column already exists in campaigns table")

    # Step 2: Add cost column to campaigns table if it doesn't exist
    if not check_column_exists(cursor, 'campaigns', 'cost'):
        print("  Adding 'cost' column to campaigns table...")
        cursor.execute("ALTER TABLE campaigns ADD COLUMN cost REAL DEFAULT NULL")
        print("  [OK] Added 'cost' column")
    else:
        print("  [INFO] 'cost' column already exists in campaigns table")

    # Step 3: Add cost_status column to campaigns table if it doesn't exist
    if not check_column_exists(cursor, 'campaigns', 'cost_status'):
        print("  Adding 'cost_status' column to campaigns table...")
        cursor.execute("ALTER TABLE campaigns ADD COLUMN cost_status TEXT DEFAULT 'estimated'")
        print("  [OK] Added 'cost_status' column")
    else:
        print("  [INFO] 'cost_status' column already exists in campaigns table")

    # Step 4: Create campaign_cost_overrides table if it doesn't exist
    if not check_table_exists(cursor, 'campaign_cost_overrides'):
        print("  Creating 'campaign_cost_overrides' table...")
        cursor.execute("""
            CREATE TABLE campaign_cost_overrides (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL,
                cost REAL NOT NULL,
                cost_status TEXT NOT NULL CHECK(cost_status IN ('estimated', 'confirmed', 'api_sourced')) DEFAULT 'confirmed',
                override_reason TEXT,
                overridden_by TEXT NOT NULL,
                overridden_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (campaign_id) REFERENCES campaigns (id),
                UNIQUE(campaign_id, is_active) ON CONFLICT REPLACE
            )
        """)
        print("  [OK] Created 'campaign_cost_overrides' table")
    else:
        print("  [INFO] 'campaign_cost_overrides' table already exists")

    # Step 5: Create index if it doesn't exist
    print("  Creating index on campaign_cost_overrides...")
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_cost_overrides_campaign
        ON campaign_cost_overrides (campaign_id, is_active)
    """)
    print("  [OK] Created index 'idx_cost_overrides_campaign'")

    # Step 6: Initialize cost_status for existing campaigns
    print("  Initializing cost_status for existing campaigns...")
    cursor.execute("""
        UPDATE campaigns
        SET cost_status = 'estimated'
        WHERE cost_status IS NULL OR cost_status = ''
    """)
    rows_updated = cursor.rowcount
    print(f"  [OK] Updated {rows_updated} campaign(s) with default cost_status")

    conn.commit()
    print(f"[{datetime.now(timezone.utc)}] [SUCCESS] Cost tracking migration completed successfully!")


def migrate_down(conn: sqlite3.Connection) -> None:
    """Rollback the migration (SQLite doesn't support DROP COLUMN easily)"""
    cursor = conn.cursor()

    print(f"[{datetime.now(timezone.utc)}] Rolling back cost tracking migration...")

    # Drop campaign_cost_overrides table
    if check_table_exists(cursor, 'campaign_cost_overrides'):
        print("  Dropping 'campaign_cost_overrides' table...")
        cursor.execute("DROP TABLE IF EXISTS campaign_cost_overrides")
        print("  [OK] Dropped 'campaign_cost_overrides' table")

    # Note: SQLite doesn't support DROP COLUMN without recreating the table
    # For production, we'd need to:
    # 1. Create new campaigns table without cost columns
    # 2. Copy data
    # 3. Drop old table
    # 4. Rename new table
    # For now, we'll just warn the user
    print("  [WARNING] Note: Cannot drop 'cost' and 'cost_status' columns from campaigns table")
    print("    SQLite doesn't support DROP COLUMN. The columns will remain but be unused.")

    conn.commit()
    print(f"[{datetime.now(timezone.utc)}] [SUCCESS] Rollback completed!")


def main():
    """Run migration script"""
    import argparse

    parser = argparse.ArgumentParser(description='Cost tracking database migration')
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

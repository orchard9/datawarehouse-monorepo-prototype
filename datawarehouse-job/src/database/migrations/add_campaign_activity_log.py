#!/usr/bin/env python3
"""
Database Migration: Add Campaign Activity Log Table
Creates campaign_activity table for tracking user actions and changes to campaigns
Enables real-time activity tracking in the Recent Activity section
"""
import sqlite3
from datetime import datetime, timezone
from typing import Optional
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))


def check_table_exists(cursor: sqlite3.Cursor, table_name: str) -> bool:
    """Check if a table exists in the database"""
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name=?
    """, (table_name,))
    return cursor.fetchone() is not None


def migrate_up(conn: sqlite3.Connection) -> None:
    """Apply the migration"""
    cursor = conn.cursor()

    print(f"[{datetime.now(timezone.utc)}] Starting campaign activity log migration...")

    # Step 1: Create campaign_activity table
    if not check_table_exists(cursor, 'campaign_activity'):
        print("  Creating 'campaign_activity' table...")
        cursor.execute("""
            CREATE TABLE campaign_activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL,
                activity_type TEXT NOT NULL CHECK(activity_type IN (
                    'sync', 'hierarchy_update', 'status_change', 'cost_update',
                    'cost_delete', 'data_received', 'manual_edit'
                )),
                description TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                user_id TEXT,
                source TEXT NOT NULL DEFAULT 'web_ui' CHECK(source IN ('etl', 'web_ui', 'api', 'system')),
                FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
            )
        """)
        print("  [OK] Created 'campaign_activity' table")
    else:
        print("  [INFO] 'campaign_activity' table already exists")

    # Step 2: Create index on campaign_id for fast lookups
    print("  Creating index on campaign_id...")
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_campaign_activity_campaign_id
        ON campaign_activity (campaign_id, created_at DESC)
    """)
    print("  [OK] Created index 'idx_campaign_activity_campaign_id'")

    # Step 3: Create index on activity_type for filtering
    print("  Creating index on activity_type...")
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_campaign_activity_type
        ON campaign_activity (activity_type)
    """)
    print("  [OK] Created index 'idx_campaign_activity_type'")

    # Step 4: Create index on created_at for chronological queries
    print("  Creating index on created_at...")
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_campaign_activity_created_at
        ON campaign_activity (created_at DESC)
    """)
    print("  [OK] Created index 'idx_campaign_activity_created_at'")

    conn.commit()
    print(f"[{datetime.now(timezone.utc)}] [SUCCESS] Campaign activity log migration completed successfully!")
    print("\n  NOTE: The campaign_activity table is now ready to track user actions.")
    print("  Activity types: sync, hierarchy_update, status_change, cost_update, cost_delete")
    print("  Sources: etl (automated), web_ui (user actions), api (external), system (internal)\n")


def migrate_down(conn: sqlite3.Connection) -> None:
    """Rollback the migration"""
    cursor = conn.cursor()

    print(f"[{datetime.now(timezone.utc)}] Rolling back campaign activity log migration...")

    # Drop indices
    print("  Dropping indices...")
    cursor.execute("DROP INDEX IF EXISTS idx_campaign_activity_campaign_id")
    cursor.execute("DROP INDEX IF EXISTS idx_campaign_activity_type")
    cursor.execute("DROP INDEX IF EXISTS idx_campaign_activity_created_at")
    print("  [OK] Dropped indices")

    # Drop table
    if check_table_exists(cursor, 'campaign_activity'):
        print("  Dropping 'campaign_activity' table...")
        cursor.execute("DROP TABLE campaign_activity")
        print("  [OK] Dropped 'campaign_activity' table")
    else:
        print("  [INFO] 'campaign_activity' table does not exist")

    conn.commit()
    print(f"[{datetime.now(timezone.utc)}] [SUCCESS] Rollback completed!")


def main():
    """Run migration script"""
    import argparse

    parser = argparse.ArgumentParser(description='Campaign activity log database migration')
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

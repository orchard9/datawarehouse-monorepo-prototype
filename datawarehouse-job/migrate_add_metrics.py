#!/usr/bin/env python3
"""
Database migration script to add new metrics columns to hourly_data table
Adds: facebook_accounts, chat_room_simulation_chats, payment_methods_canceled,
      and 6 revenue columns (successful/failed cents, dollars, count)
"""
import sqlite3
from pathlib import Path

def migrate_database(db_path: str = "datawarehouse.db"):
    """Add new columns to existing hourly_data table"""

    print(f"Migrating database: {db_path}")

    # Check if database exists
    if not Path(db_path).exists():
        print(f"ERROR: Database file not found: {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Get existing columns
        cursor.execute("PRAGMA table_info(hourly_data)")
        existing_columns = {row[1] for row in cursor.fetchall()}
        print(f"Found {len(existing_columns)} existing columns in hourly_data table")

        # Define new columns to add
        new_columns = {
            'facebook_accounts': 'INTEGER DEFAULT 0',
            'chat_room_simulation_chats': 'INTEGER DEFAULT 0',
            'payment_methods_canceled': 'INTEGER DEFAULT 0',
            'revenue_successful_cents': 'INTEGER DEFAULT 0',
            'revenue_successful_dollars': 'REAL DEFAULT 0.0',
            'revenue_successful_count': 'INTEGER DEFAULT 0',
            'revenue_failed_cents': 'INTEGER DEFAULT 0',
            'revenue_failed_dollars': 'REAL DEFAULT 0.0',
            'revenue_failed_count': 'INTEGER DEFAULT 0'
        }

        # Add each column if it doesn't exist
        columns_added = 0
        columns_skipped = 0

        for column_name, column_def in new_columns.items():
            if column_name not in existing_columns:
                try:
                    print(f"Adding column: {column_name}")
                    cursor.execute(f"ALTER TABLE hourly_data ADD COLUMN {column_name} {column_def}")
                    columns_added += 1
                except Exception as e:
                    print(f"  ERROR adding {column_name}: {e}")
                    raise
            else:
                print(f"Column {column_name} already exists, skipping")
                columns_skipped += 1

        conn.commit()

        print("\nMigration completed successfully!")
        print(f"  Columns added: {columns_added}")
        print(f"  Columns skipped (already exist): {columns_skipped}")

        # Verify the migration
        cursor.execute("PRAGMA table_info(hourly_data)")
        final_columns = {row[1] for row in cursor.fetchall()}
        print(f"  Total columns in hourly_data: {len(final_columns)}")

        return True

    except Exception as e:
        print(f"ERROR during migration: {e}")
        conn.rollback()
        return False

    finally:
        conn.close()

if __name__ == "__main__":
    import sys

    # Allow custom database path as command line argument
    db_path = sys.argv[1] if len(sys.argv) > 1 else "datawarehouse.db"

    success = migrate_database(db_path)

    if success:
        print("\n✅ Migration completed! You can now run 'python main.py sync' to fetch new metrics.")
        sys.exit(0)
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)

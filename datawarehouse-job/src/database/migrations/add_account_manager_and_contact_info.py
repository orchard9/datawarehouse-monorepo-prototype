"""
Database migration: Add account_manager and contact_info_credentials to campaigns table

This migration adds two new fields to the campaigns table:
- account_manager: Stores the name of the person managing this campaign
- contact_info_credentials: Stores contact information and credentials for the campaign

Migration ID: 005
Created: 2025-10-23
"""

import sqlite3
from typing import Optional


def migrate_up(conn: sqlite3.Connection) -> None:
    """Apply the migration - add account_manager and contact_info_credentials columns"""
    cursor = conn.cursor()

    # Add account_manager column
    cursor.execute("""
        ALTER TABLE campaigns
        ADD COLUMN account_manager TEXT NULL
    """)

    # Add contact_info_credentials column
    cursor.execute("""
        ALTER TABLE campaigns
        ADD COLUMN contact_info_credentials TEXT NULL
    """)

    conn.commit()
    print("✓ Added account_manager and contact_info_credentials columns to campaigns table")


def migrate_down(conn: sqlite3.Connection) -> None:
    """Revert the migration - SQLite doesn't support DROP COLUMN directly"""
    # Note: SQLite doesn't support DROP COLUMN, so we'd need to:
    # 1. Create new table without these columns
    # 2. Copy data from old table
    # 3. Drop old table
    # 4. Rename new table

    # For development purposes, we'll document this but not implement full rollback
    print("⚠ SQLite doesn't support DROP COLUMN. To rollback:")
    print("  1. Create new campaigns table without account_manager and contact_info_credentials")
    print("  2. Copy data: INSERT INTO campaigns_new SELECT [original columns] FROM campaigns")
    print("  3. DROP TABLE campaigns")
    print("  4. ALTER TABLE campaigns_new RENAME TO campaigns")

    raise NotImplementedError(
        "SQLite doesn't support DROP COLUMN. Manual rollback required."
    )


def get_migration_info() -> dict:
    """Return migration metadata"""
    return {
        'id': '005',
        'name': 'add_account_manager_and_contact_info',
        'description': 'Add account_manager and contact_info_credentials columns to campaigns table',
        'created_at': '2025-10-23',
    }


if __name__ == '__main__':
    # Test migration
    import sys
    import os

    # Add parent directory to path for imports
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

    from src.database.operations import DatabaseOperations

    print("Testing migration: add_account_manager_and_contact_info")
    print("-" * 60)

    # Create test database
    test_db_path = 'test_migration_005.db'
    if os.path.exists(test_db_path):
        os.remove(test_db_path)

    db_ops = DatabaseOperations(test_db_path)

    # Create base schema first (minimal campaigns table)
    conn = db_ops.get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.commit()

    print("\n1. Running migrate_up()...")
    migrate_up(conn)

    print("\n2. Verifying columns exist...")
    cursor.execute("PRAGMA table_info(campaigns)")
    columns = cursor.fetchall()
    column_names = [col[1] for col in columns]

    assert 'account_manager' in column_names, "account_manager column not found!"
    assert 'contact_info_credentials' in column_names, "contact_info_credentials column not found!"
    print("✓ All columns created successfully")

    print("\n3. Testing data insertion...")
    cursor.execute("""
        INSERT INTO campaigns (id, name, created_at, updated_at, account_manager, contact_info_credentials)
        VALUES (1, 'Test Campaign', datetime('now'), datetime('now'), 'John Smith', 'Email: john@example.com\nPassword: test123')
    """)
    conn.commit()

    cursor.execute("SELECT account_manager, contact_info_credentials FROM campaigns WHERE id = 1")
    result = cursor.fetchone()
    assert result[0] == 'John Smith', "account_manager not stored correctly!"
    assert 'john@example.com' in result[1], "contact_info_credentials not stored correctly!"
    print("✓ Data insertion and retrieval working correctly")

    conn.close()
    os.remove(test_db_path)

    print("\n" + "=" * 60)
    print("✓ Migration test passed!")

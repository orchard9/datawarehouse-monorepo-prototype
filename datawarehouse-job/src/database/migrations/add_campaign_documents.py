"""
Database migration: Create campaign_documents table

This migration creates a new table to store documents attached to campaigns.
Documents include PDFs, images, text files, Excel files, etc.

Migration ID: 006
Created: 2025-10-23
"""

import sqlite3
from typing import Optional


def migrate_up(conn: sqlite3.Connection) -> None:
    """Apply the migration - create campaign_documents table"""
    cursor = conn.cursor()

    # Create campaign_documents table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS campaign_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            mime_type TEXT NOT NULL,
            uploaded_by TEXT,
            uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
            deleted_at TEXT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
        )
    """)

    # Create indexes for performance
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_campaign_documents_campaign_id
        ON campaign_documents (campaign_id, deleted_at)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_campaign_documents_uploaded_at
        ON campaign_documents (uploaded_at DESC)
    """)

    conn.commit()
    print("Created campaign_documents table with indexes")


def migrate_down(conn: sqlite3.Connection) -> None:
    """Revert the migration - drop campaign_documents table"""
    cursor = conn.cursor()

    cursor.execute("DROP INDEX IF EXISTS idx_campaign_documents_uploaded_at")
    cursor.execute("DROP INDEX IF EXISTS idx_campaign_documents_campaign_id")
    cursor.execute("DROP TABLE IF EXISTS campaign_documents")

    conn.commit()
    print("Dropped campaign_documents table and indexes")


def get_migration_info() -> dict:
    """Return migration metadata"""
    return {
        'id': '006',
        'name': 'add_campaign_documents',
        'description': 'Create campaign_documents table for file attachments',
        'created_at': '2025-10-23',
    }


if __name__ == '__main__':
    # Test migration
    import sys
    import os

    print("Testing migration: add_campaign_documents")
    print("-" * 60)

    # Create test database
    test_db_path = 'test_migration_006.db'
    if os.path.exists(test_db_path):
        os.remove(test_db_path)

    conn = sqlite3.connect(test_db_path)
    cursor = conn.cursor()

    # Create minimal campaigns table for foreign key
    cursor.execute("""
        CREATE TABLE campaigns (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        )
    """)
    cursor.execute("INSERT INTO campaigns (id, name) VALUES (1, 'Test Campaign')")
    conn.commit()

    print("\n1. Running migrate_up()...")
    migrate_up(conn)

    print("\n2. Verifying table and indexes exist...")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='campaign_documents'")
    assert cursor.fetchone() is not None, "campaign_documents table not found!"
    print("Table created successfully")

    cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_campaign_documents%'")
    indexes = cursor.fetchall()
    assert len(indexes) == 2, f"Expected 2 indexes, found {len(indexes)}"
    print("Indexes created successfully")

    print("\n3. Testing data insertion...")
    cursor.execute("""
        INSERT INTO campaign_documents (
            campaign_id, filename, original_filename, file_path,
            file_size, mime_type, uploaded_by
        ) VALUES (1, 'doc_123.pdf', 'Campaign Plan.pdf', '/uploads/1/doc_123.pdf', 1024000, 'application/pdf', 'john@example.com')
    """)
    conn.commit()

    cursor.execute("SELECT * FROM campaign_documents WHERE campaign_id = 1")
    result = cursor.fetchone()
    assert result is not None, "Document not inserted!"
    print("Data insertion working correctly")

    print("\n4. Testing foreign key constraint...")
    try:
        cursor.execute("""
            INSERT INTO campaign_documents (
                campaign_id, filename, original_filename, file_path,
                file_size, mime_type
            ) VALUES (999, 'test.pdf', 'test.pdf', '/test.pdf', 1000, 'application/pdf')
        """)
        conn.commit()
        print("WARNING: Foreign key constraint not enforced!")
    except sqlite3.IntegrityError:
        print("Foreign key constraint working correctly")

    print("\n5. Running migrate_down()...")
    migrate_down(conn)

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='campaign_documents'")
    assert cursor.fetchone() is None, "Table still exists after migration down!"
    print("Table dropped successfully")

    conn.close()
    os.remove(test_db_path)

    print("\n" + "=" * 60)
    print("Migration test passed!")

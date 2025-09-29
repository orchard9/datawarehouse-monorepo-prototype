#!/usr/bin/env python3
"""
Complete system integration tests for Peach AI Data Warehouse
Tests the entire ETL pipeline from database initialization to data export
"""

import os
import sys
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add project root to Python path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.database.schema import DatabaseSchema, initialize_database
from src.database.operations import DatabaseOperations
from src.config.settings import get_settings


class TestCompleteSystem(unittest.TestCase):
    """Complete system integration tests"""

    def setUp(self):
        """Set up test database and components"""
        # Create temporary database for testing
        self.test_db_fd, self.test_db_path = tempfile.mkstemp(suffix='.db')
        os.close(self.test_db_fd)

        # Initialize test database
        self.conn = initialize_database(self.test_db_path)
        self.db_ops = DatabaseOperations(self.conn)

    def tearDown(self):
        """Clean up test database"""
        if self.conn:
            self.conn.close()
        if os.path.exists(self.test_db_path):
            os.unlink(self.test_db_path)

    def test_database_initialization(self):
        """Test that database initializes with correct schema"""
        # Check that all required tables exist
        cursor = self.conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]

        expected_tables = {
            'campaigns', 'hourly_data', 'campaign_hierarchy',
            'hierarchy_rules', 'sync_history', 'export_history'
        }

        for table in expected_tables:
            self.assertIn(table, tables, f"Table {table} should exist")

        # Check that foreign key constraints are enabled
        cursor.execute("PRAGMA foreign_keys")
        result = cursor.fetchone()
        self.assertEqual(result[0], 1, "Foreign keys should be enabled")

    def test_campaigns_table_structure(self):
        """Test campaigns table has correct structure"""
        cursor = self.conn.cursor()
        cursor.execute("PRAGMA table_info(campaigns)")
        columns = cursor.fetchall()

        column_names = [col[1] for col in columns]
        required_columns = [
            'id', 'name', 'description', 'tracking_url', 'is_serving',
            'serving_url', 'traffic_weight', 'deleted_at', 'created_at',
            'updated_at', 'slug', 'path', 'sync_timestamp'
        ]

        for col in required_columns:
            self.assertIn(col, column_names, f"Column {col} should exist in campaigns")

    def test_hourly_data_table_structure(self):
        """Test hourly_data table has correct structure"""
        cursor = self.conn.cursor()
        cursor.execute("PRAGMA table_info(hourly_data)")
        columns = cursor.fetchall()

        column_names = [col[1] for col in columns]
        required_columns = [
            'campaign_id', 'unix_hour', 'credit_cards', 'email_accounts',
            'google_accounts', 'sessions', 'total_accounts', 'registrations',
            'messages', 'companion_chats', 'chat_room_user_chats', 'total_user_chats',
            'media', 'payment_methods', 'converted_users', 'terms_acceptances',
            'sync_timestamp'
        ]

        for col in required_columns:
            self.assertIn(col, column_names, f"Column {col} should exist in hourly_data")

    def test_hierarchy_rules_populated(self):
        """Test that default hierarchy rules are populated"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM hierarchy_rules")
        count = cursor.fetchone()[0]

        self.assertGreater(count, 0, "Default hierarchy rules should be populated")

        # Check for some specific expected rules
        cursor.execute("SELECT rule_name FROM hierarchy_rules WHERE rule_name LIKE '%Facebook%'")
        facebook_rules = cursor.fetchall()
        self.assertGreater(len(facebook_rules), 0, "Should have Facebook rules")

    def test_database_operations_basic_functionality(self):
        """Test basic database operations work"""
        # Test campaign insertion
        campaign_data = {
            'id': 12345,
            'name': 'Test Campaign',
            'description': 'Test Description',
            'is_serving': True,
            'traffic_weight': 100,
            'created_at': '2025-01-01T00:00:00Z',
            'updated_at': '2025-01-01T00:00:00Z'
        }

        self.db_ops.upsert_campaign(campaign_data)

        # Verify campaign was inserted
        campaigns = self.db_ops.get_campaigns()
        self.assertEqual(len(campaigns), 1)
        self.assertEqual(campaigns[0]['id'], 12345)
        self.assertEqual(campaigns[0]['name'], 'Test Campaign')

    def test_hourly_data_insertion(self):
        """Test hourly data insertion and retrieval"""
        # First insert a campaign
        campaign_data = {
            'id': 12345,
            'name': 'Test Campaign',
            'created_at': '2025-01-01T00:00:00Z',
            'updated_at': '2025-01-01T00:00:00Z'
        }
        self.db_ops.upsert_campaign(campaign_data)

        # Insert hourly data
        hourly_data = {
            'campaign_id': 12345,
            'unix_hour': 495000,  # Some arbitrary hour
            'sessions': 100,
            'registrations': 10,
            'credit_cards': 5,
            'messages': 20
        }

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO hourly_data
            (campaign_id, unix_hour, sessions, registrations, credit_cards, messages)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            hourly_data['campaign_id'], hourly_data['unix_hour'],
            hourly_data['sessions'], hourly_data['registrations'],
            hourly_data['credit_cards'], hourly_data['messages']
        ))
        self.conn.commit()

        # Verify hourly data was inserted
        retrieved_data = self.db_ops.get_hourly_data(campaign_id=12345)
        self.assertEqual(len(retrieved_data), 1)
        self.assertEqual(retrieved_data[0]['sessions'], 100)
        self.assertEqual(retrieved_data[0]['registrations'], 10)

    def test_sync_history_tracking(self):
        """Test sync history is properly tracked"""
        sync_data = {
            'sync_type': 'test_sync',
            'status': 'completed',
            'records_processed': 50,
            'records_inserted': 30,
            'records_updated': 20
        }

        sync_id = self.db_ops.start_sync(sync_data['sync_type'])
        self.db_ops.complete_sync(
            sync_id=sync_id,
            records_processed=sync_data['records_processed'],
            records_inserted=sync_data['records_inserted'],
            records_updated=sync_data['records_updated']
        )

        # Verify sync history
        history = self.db_ops.get_sync_history(limit=1)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]['sync_type'], 'test_sync')
        self.assertEqual(history[0]['status'], 'completed')  # Should be 'completed' since no error_message
        self.assertEqual(history[0]['records_processed'], 50)

    def test_configuration_loading(self):
        """Test that configuration loads properly"""
        settings = get_settings()

        # Check that basic config sections exist
        api_config = settings.get_api_config()
        db_config = settings.get_database_config()

        self.assertIsInstance(api_config, dict)
        self.assertIsInstance(db_config, dict)

        # Check required API config keys
        self.assertIn('base_url', api_config)
        self.assertIn('bearer_token', api_config)

        # Check required database config keys
        self.assertIn('path', db_config)

    def test_foreign_key_constraints(self):
        """Test that foreign key constraints are enforced"""
        # Try to insert hourly data for non-existent campaign
        cursor = self.conn.cursor()

        with self.assertRaises(sqlite3.IntegrityError):
            cursor.execute("""
                INSERT INTO hourly_data (campaign_id, unix_hour, sessions)
                VALUES (99999, 495000, 100)
            """)
            self.conn.commit()

    def test_unique_constraints(self):
        """Test that unique constraints are enforced"""
        # Insert campaign
        campaign_data = {
            'id': 12345,
            'name': 'Test Campaign',
            'created_at': '2025-01-01T00:00:00Z',
            'updated_at': '2025-01-01T00:00:00Z'
        }
        self.db_ops.upsert_campaign(campaign_data)

        # Try to insert duplicate campaign ID (should work with upsert)
        campaign_data_duplicate = {
            'id': 12345,
            'name': 'Updated Campaign Name',
            'created_at': '2025-01-01T00:00:00Z',
            'updated_at': '2025-01-02T00:00:00Z'
        }
        self.db_ops.upsert_campaign(campaign_data_duplicate)

        # Verify campaign was updated, not duplicated
        campaigns = self.db_ops.get_campaigns()
        self.assertEqual(len(campaigns), 1)
        self.assertEqual(campaigns[0]['name'], 'Updated Campaign Name')

    def test_data_types_and_defaults(self):
        """Test that data types and default values work correctly"""
        # Insert minimal campaign data
        campaign_data = {
            'id': 12345,
            'name': 'Minimal Campaign',
            'created_at': '2025-01-01T00:00:00Z',
            'updated_at': '2025-01-01T00:00:00Z'
        }
        self.db_ops.upsert_campaign(campaign_data)

        # Insert minimal hourly data (most fields should default to 0)
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO hourly_data (campaign_id, unix_hour)
            VALUES (?, ?)
        """, (12345, 495000))
        self.conn.commit()

        # Verify default values
        hourly_data = self.db_ops.get_hourly_data(campaign_id=12345)
        self.assertEqual(len(hourly_data), 1)

        # Check that numeric fields default to 0
        numeric_fields = [
            'sessions', 'registrations', 'credit_cards', 'email_accounts',
            'google_accounts', 'total_accounts', 'messages', 'companion_chats',
            'chat_room_user_chats', 'total_user_chats', 'media', 'payment_methods',
            'converted_users', 'terms_acceptances'
        ]

        for field in numeric_fields:
            self.assertEqual(hourly_data[0][field], 0, f"Field {field} should default to 0")


class TestDataIntegrity(unittest.TestCase):
    """Test data integrity and consistency"""

    def setUp(self):
        """Set up test database"""
        self.test_db_fd, self.test_db_path = tempfile.mkstemp(suffix='.db')
        os.close(self.test_db_fd)
        self.conn = initialize_database(self.test_db_path)
        self.db_ops = DatabaseOperations(self.conn)

    def tearDown(self):
        """Clean up test database"""
        if self.conn:
            self.conn.close()
        if os.path.exists(self.test_db_path):
            os.unlink(self.test_db_path)

    def test_primary_key_constraints(self):
        """Test primary key constraints on time-series data"""
        # Insert campaign first
        campaign_data = {
            'id': 12345,
            'name': 'Test Campaign',
            'created_at': '2025-01-01T00:00:00Z',
            'updated_at': '2025-01-01T00:00:00Z'
        }
        self.db_ops.upsert_campaign(campaign_data)

        # Insert hourly data
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO hourly_data (campaign_id, unix_hour, sessions)
            VALUES (?, ?, ?)
        """, (12345, 495000, 100))
        self.conn.commit()

        # Try to insert duplicate (same campaign_id, unix_hour) - should fail
        with self.assertRaises(sqlite3.IntegrityError):
            cursor.execute("""
                INSERT INTO hourly_data (campaign_id, unix_hour, sessions)
                VALUES (?, ?, ?)
            """, (12345, 495000, 200))
            self.conn.commit()

    def test_cascade_behavior(self):
        """Test foreign key cascade behavior (if any)"""
        # Insert campaign and related data
        campaign_data = {
            'id': 12345,
            'name': 'Test Campaign',
            'created_at': '2025-01-01T00:00:00Z',
            'updated_at': '2025-01-01T00:00:00Z'
        }
        self.db_ops.upsert_campaign(campaign_data)

        # Insert hourly data
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO hourly_data (campaign_id, unix_hour, sessions)
            VALUES (?, ?, ?)
        """, (12345, 495000, 100))
        self.conn.commit()

        # Verify data exists
        hourly_data = self.db_ops.get_hourly_data(campaign_id=12345)
        self.assertEqual(len(hourly_data), 1)

        # Note: Since we're using soft deletes, we don't actually delete campaigns
        # Instead, we mark them as deleted. This test verifies the relationship exists


def run_tests():
    """Run all system tests"""
    print("Running Complete System Integration Tests...")
    print("=" * 60)

    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add test classes
    suite.addTests(loader.loadTestsFromTestCase(TestCompleteSystem))
    suite.addTests(loader.loadTestsFromTestCase(TestDataIntegrity))

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Return success/failure
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
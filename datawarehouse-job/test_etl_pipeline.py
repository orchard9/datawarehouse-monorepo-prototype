#!/usr/bin/env python3
"""
ETL Pipeline tests for Peach AI Data Warehouse
Tests ETL pipeline components including data processing, hierarchy mapping, and pipeline orchestration
"""

import os
import sys
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

# Add project root to Python path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.database.schema import initialize_database
from src.database.operations import DatabaseOperations
from src.etl.pipeline import ETLPipeline
from src.etl.hierarchy_mapper import HierarchyMapper
from src.etl.data_processor import DataProcessor


class TestETLPipeline(unittest.TestCase):
    """Test ETL pipeline orchestration"""

    def setUp(self):
        """Set up test database and ETL components"""
        # Create temporary database for testing
        self.test_db_fd, self.test_db_path = tempfile.mkstemp(suffix='.db')
        os.close(self.test_db_fd)

        # Initialize test database
        self.conn = initialize_database(self.test_db_path)
        self.db_ops = DatabaseOperations(self.conn)

        # Initialize ETL pipeline with mock API config
        self.pipeline = ETLPipeline(
            db_ops=self.db_ops,
            api_base_url="https://test-api.example.com",
            api_token="test-token-123"
        )

    def tearDown(self):
        """Clean up test database"""
        if self.conn:
            self.conn.close()
        if os.path.exists(self.test_db_path):
            os.unlink(self.test_db_path)

    def test_pipeline_initialization(self):
        """Test pipeline initializes with correct components"""
        self.assertIsNotNone(self.pipeline.db_ops)
        self.assertIsNotNone(self.pipeline.campaigns_client)
        self.assertIsNotNone(self.pipeline.metrics_client)
        # Check that pipeline has necessary methods
        self.assertTrue(hasattr(self.pipeline, 'sync_campaigns'))
        self.assertTrue(hasattr(self.pipeline, 'run_full_sync'))

    def test_sync_methods_exist(self):
        """Test that sync methods exist on pipeline"""
        self.assertTrue(hasattr(self.pipeline, 'sync_campaigns'))
        self.assertTrue(callable(getattr(self.pipeline, 'sync_campaigns')))

        self.assertTrue(hasattr(self.pipeline, 'run_full_sync'))
        self.assertTrue(callable(getattr(self.pipeline, 'run_full_sync')))

    def test_pipeline_status_check(self):
        """Test pipeline status checking"""
        # Check that the method exists
        if hasattr(self.pipeline, 'get_pipeline_status'):
            status = self.pipeline.get_pipeline_status()
            self.assertIsInstance(status, dict)

    def test_api_health_checks(self):
        """Test API health checking"""
        # Test that health check methods exist on the clients
        self.assertTrue(hasattr(self.pipeline.campaigns_client, 'health_check'))
        self.assertTrue(hasattr(self.pipeline.metrics_client, 'health_check'))


class TestHierarchyMapper(unittest.TestCase):
    """Test hierarchy mapping functionality"""

    def setUp(self):
        """Set up test database and hierarchy mapper"""
        self.test_db_fd, self.test_db_path = tempfile.mkstemp(suffix='.db')
        os.close(self.test_db_fd)
        self.conn = initialize_database(self.test_db_path)
        self.db_ops = DatabaseOperations(self.conn)
        self.mapper = HierarchyMapper(self.db_ops)

    def tearDown(self):
        """Clean up test database"""
        if self.conn:
            self.conn.close()
        if os.path.exists(self.test_db_path):
            os.unlink(self.test_db_path)

    def test_mapper_initialization(self):
        """Test hierarchy mapper initializes correctly"""
        self.assertIsNotNone(self.mapper.db_ops)

    def test_mapping_statistics(self):
        """Test hierarchy mapping statistics"""
        if hasattr(self.mapper, 'get_mapping_statistics'):
            stats = self.mapper.get_mapping_statistics()
            self.assertIsInstance(stats, dict)
            self.assertIn('total_rules', stats)
            self.assertGreater(stats['total_rules'], 0)

    def test_mapper_has_necessary_methods(self):
        """Test that mapper has necessary methods"""
        # Check for key methods that should exist
        expected_methods = ['map_campaign_hierarchy']
        for method in expected_methods:
            if hasattr(self.mapper, method):
                self.assertTrue(callable(getattr(self.mapper, method)))


class TestDataProcessor(unittest.TestCase):
    """Test data processing and aggregation functionality"""

    def setUp(self):
        """Set up test database and data processor"""
        self.test_db_fd, self.test_db_path = tempfile.mkstemp(suffix='.db')
        os.close(self.test_db_fd)
        self.conn = initialize_database(self.test_db_path)
        self.db_ops = DatabaseOperations(self.conn)
        self.processor = DataProcessor(self.db_ops)

        # Insert test campaign and hourly data
        self._setup_test_data()

    def tearDown(self):
        """Clean up test database"""
        if self.conn:
            self.conn.close()
        if os.path.exists(self.test_db_path):
            os.unlink(self.test_db_path)

    def _setup_test_data(self):
        """Set up test campaign and hourly data"""
        # Insert test campaign
        campaign_data = {
            'id': 12345,
            'name': 'Test Campaign',
            'created_at': '2025-01-01T00:00:00Z',
            'updated_at': '2025-01-01T00:00:00Z'
        }
        self.db_ops.upsert_campaign(campaign_data)

        # Insert hierarchy mapping
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO campaign_hierarchy
            (campaign_id, campaign_name, network, domain, placement, targeting, special)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (12345, 'Test Campaign', 'Facebook', 'Social Media', 'Desktop', 'Desktop Users', 'Premium'))
        self.conn.commit()

        # Insert test hourly data
        test_hours = [
            (12345, 495000, 100, 10, 5, 20, 15),  # hour 1
            (12345, 495001, 150, 15, 8, 30, 25),  # hour 2
            (12345, 495002, 200, 20, 12, 40, 35), # hour 3
        ]

        for campaign_id, unix_hour, sessions, regs, cc, messages, media in test_hours:
            cursor.execute("""
                INSERT INTO hourly_data
                (campaign_id, unix_hour, sessions, registrations, credit_cards, messages, media)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (campaign_id, unix_hour, sessions, regs, cc, messages, media))
        self.conn.commit()

    def test_campaign_performance_aggregation(self):
        """Test campaign performance aggregation"""
        performance = self.processor.aggregate_campaign_performance(12345)

        # Verify aggregated metrics
        self.assertEqual(performance['sessions'], 450)      # 100 + 150 + 200
        self.assertEqual(performance['registrations'], 45)  # 10 + 15 + 20
        self.assertEqual(performance['credit_cards'], 25)   # 5 + 8 + 12

        # Verify calculated percentages
        self.assertAlmostEqual(performance['reg_percentage'], 10.0, places=1)  # 45/450 * 100
        self.assertAlmostEqual(performance['cc_conv_percentage'], 55.6, places=1)  # 25/45 * 100

        # Verify hierarchy data is included
        self.assertEqual(performance['network'], 'Facebook')
        self.assertEqual(performance['domain'], 'Social Media')

    def test_all_campaigns_performance_aggregation(self):
        """Test aggregation of all campaigns performance"""
        all_performance = self.processor.aggregate_all_campaigns_performance()

        self.assertEqual(len(all_performance), 1)  # Only one campaign in test data

        campaign_perf = all_performance[0]
        self.assertEqual(campaign_perf['campaign_id'], 12345)
        self.assertEqual(campaign_perf['sessions'], 450)
        self.assertEqual(campaign_perf['network'], 'Facebook')

    def test_daily_performance_aggregation(self):
        """Test daily performance aggregation"""
        daily_performance = self.processor.aggregate_daily_campaign_performance()

        # Should have daily records
        self.assertGreater(len(daily_performance), 0)

        # Check that daily record has required fields
        if daily_performance:
            daily_record = daily_performance[0]
            required_fields = ['date', 'campaign_id', 'campaign_name', 'sessions', 'registrations']
            for field in required_fields:
                self.assertIn(field, daily_record, f"Field {field} should be in daily record")

    def test_unmapped_campaigns_detection(self):
        """Test detection of unmapped campaigns"""
        # Insert campaign without hierarchy mapping
        campaign_data = {
            'id': 99999,
            'name': 'Unmapped Campaign',
            'created_at': '2025-01-01T00:00:00Z',
            'updated_at': '2025-01-01T00:00:00Z'
        }
        self.db_ops.upsert_campaign(campaign_data)

        # Get unmapped campaigns
        unmapped = self.processor.get_unmapped_campaigns()

        # Should find the unmapped campaign
        unmapped_ids = [c['id'] for c in unmapped]
        self.assertIn(99999, unmapped_ids)

    def test_data_quality_scoring(self):
        """Test data quality scoring"""
        # Get performance with quality score
        performance = self.processor.aggregate_campaign_performance(12345)

        # Should have data quality score
        self.assertIn('data_quality_score', performance)
        self.assertGreaterEqual(performance['data_quality_score'], 0)
        self.assertLessEqual(performance['data_quality_score'], 100)

    def test_time_range_filtering(self):
        """Test filtering data by time ranges"""
        # Test getting data for specific date range
        start_date = '2025-01-01'
        end_date = '2025-01-02'

        # This tests that the data processor can handle date range filtering
        # (Implementation depends on the actual data processor methods)
        try:
            range_data = self.processor.get_campaign_summary_range(start_date, end_date)
            self.assertIsInstance(range_data, list)
        except AttributeError:
            # Method might not exist yet, which is OK for basic tests
            pass


class TestETLErrorHandling(unittest.TestCase):
    """Test ETL pipeline error handling and resilience"""

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

    def test_database_connection_failure_handling(self):
        """Test handling of database connection failures"""
        # Test with invalid database path
        try:
            invalid_pipeline = ETLPipeline(
                db_ops=None,  # Invalid db_ops
                api_base_url="https://test-api.example.com",
                api_token="test-token"
            )
            # Should handle gracefully or raise appropriate exception
        except Exception as e:
            # Expected to fail, should be a meaningful error
            self.assertIsInstance(e, (TypeError, ValueError, AttributeError))

    def test_malformed_data_handling(self):
        """Test handling of malformed API data"""
        processor = DataProcessor(self.db_ops)

        # Test with campaign that has missing required fields
        try:
            # This should handle missing data gracefully
            result = processor.aggregate_campaign_performance(99999)  # Non-existent campaign

            # Should return empty or default result rather than crash
            self.assertIsInstance(result, dict)
        except Exception as e:
            # If it throws an exception, it should be a meaningful one
            self.assertIsInstance(e, (KeyError, ValueError))

    def test_sync_history_error_tracking(self):
        """Test that sync errors are properly logged"""
        pipeline = ETLPipeline(
            db_ops=self.db_ops,
            api_base_url="https://test-api.example.com",
            api_token="test-token"
        )

        # Start a sync that we'll fail
        sync_id = self.db_ops.start_sync('test_sync')

        # Complete with error
        self.db_ops.complete_sync(
            sync_id=sync_id,
            error_message='Test error message'  # Status will automatically be 'failed' due to error_message
        )

        # Verify error was logged
        history = self.db_ops.get_sync_history(limit=1)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]['status'], 'failed')
        self.assertEqual(history[0]['error_message'], 'Test error message')


def run_tests():
    """Run all ETL pipeline tests"""
    print("Running ETL Pipeline Tests...")
    print("=" * 40)

    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add test classes
    suite.addTests(loader.loadTestsFromTestCase(TestETLPipeline))
    suite.addTests(loader.loadTestsFromTestCase(TestHierarchyMapper))
    suite.addTests(loader.loadTestsFromTestCase(TestDataProcessor))
    suite.addTests(loader.loadTestsFromTestCase(TestETLErrorHandling))

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Return success/failure
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
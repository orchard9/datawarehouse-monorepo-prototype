#!/usr/bin/env python3
"""
ETL Pipeline Orchestrator - Coordinates complete data synchronization workflow
Handles campaigns, metrics, reports, hierarchy mapping, and data processing
"""
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path

from .hierarchy_mapper import HierarchyMapper
from .data_processor import DataProcessor
from ..api_clients.campaigns import CampaignsClient
from ..api_clients.metrics import MetricsClient
from ..database.operations import DatabaseOperations

class ETLPipeline:
    """Orchestrates complete ETL workflow from APIs to processed data"""
    
    def __init__(self, db_ops: DatabaseOperations, api_base_url: str, api_token: str):
        """
        Initialize ETL pipeline
        
        Args:
            db_ops: DatabaseOperations instance
            api_base_url: Base URL for API endpoints
            api_token: Bearer token for API authentication
        """
        self.db_ops = db_ops
        
        # Initialize API clients
        self.campaigns_client = CampaignsClient(api_base_url, api_token)
        self.metrics_client = MetricsClient(api_base_url, api_token)
        
        # Initialize processing components
        self.hierarchy_mapper = HierarchyMapper(db_ops)
        self.data_processor = DataProcessor(db_ops)
        
        # Pipeline state
        self.current_sync_id = None
        self.pipeline_stats = {
            'campaigns_processed': 0,
            'metrics_processed': 0,
            'hierarchies_mapped': 0,
            'errors': []
        }
    
    def run_full_sync(self, skip_campaigns: bool = False, skip_metrics: bool = False) -> Dict[str, Any]:
        """
        Run complete ETL pipeline synchronization
        
        Args:
            skip_campaigns: Skip campaign sync
            skip_metrics: Skip metrics sync
            
        Returns:
            Dictionary with sync results and statistics
        """
        print("STARTING: Full ETL Pipeline Synchronization")
        print("=" * 60)
        
        start_time = time.time()
        
        try:
            # Start sync tracking
            self.current_sync_id = self.db_ops.start_sync('full_sync')
            
            # Reset pipeline stats
            self.pipeline_stats = {
                'campaigns_processed': 0,
                'metrics_processed': 0,
                'hierarchies_mapped': 0,
                'errors': []
            }
            
            # Step 1: Sync Campaigns
            if not skip_campaigns:
                campaigns_result = self.sync_campaigns()
                self.pipeline_stats['campaigns_processed'] = campaigns_result.get('inserted', 0)
            else:
                print("SKIPPED: Campaign sync")
                campaigns_result = {'inserted': 0, 'updated': 0}
            
            # Step 2: Sync Hourly Metrics
            if not skip_metrics:
                metrics_result = self.sync_hourly_metrics()
                self.pipeline_stats['metrics_processed'] = metrics_result.get('processed', 0)
            else:
                print("SKIPPED: Metrics sync")
                metrics_result = {'processed': 0, 'stored': 0}
            
            # Step 3: Process Hierarchy Mapping
            hierarchy_result = self.process_hierarchy_mapping()
            self.pipeline_stats['hierarchies_mapped'] = hierarchy_result.get('mapped', 0)
            
            # Step 4: Validate Data Quality
            quality_warnings = self.validate_data_quality()
            
            # Step 5: Sync Integrity Checks
            print(f"\nSYNC INTEGRITY CHECKS")
            print("-" * 40)
            self.run_sync_integrity_checks()
            
            # Calculate final statistics
            end_time = time.time()
            duration = end_time - start_time
            
            # Complete sync tracking
            total_processed = (self.pipeline_stats['campaigns_processed'] + 
                             self.pipeline_stats['metrics_processed'])
            
            self.db_ops.complete_sync(
                self.current_sync_id,
                records_processed=total_processed,
                records_inserted=total_processed,
                error_message='; '.join(self.pipeline_stats['errors']) if self.pipeline_stats['errors'] else None
            )
            
            # Build final result
            result = {
                'sync_id': self.current_sync_id,
                'status': 'completed',
                'duration_seconds': round(duration, 2),
                'results': {
                    'campaigns': campaigns_result,
                    'metrics': metrics_result,
                    'hierarchies': hierarchy_result
                },
                'statistics': self.pipeline_stats,
                'data_quality_warnings': quality_warnings,
                'completed_at': datetime.now(timezone.utc).isoformat()
            }
            
            print(f"\\nSUCCESS: Full sync completed in {duration:.2f} seconds")
            print(f"  Campaigns: {campaigns_result.get('inserted', 0)} processed")
            print(f"  Metrics: {metrics_result.get('processed', 0)} processed")
            print(f"  Hierarchies: {hierarchy_result.get('mapped', 0)} mapped")
            
            if quality_warnings:
                print(f"  Data Quality Warnings: {len(quality_warnings)}")
            
            return result
            
        except Exception as e:
            error_msg = f"Pipeline failed: {e}"
            self.pipeline_stats['errors'].append(error_msg)
            
            # Mark sync as failed
            if self.current_sync_id:
                self.db_ops.complete_sync(
                    self.current_sync_id,
                    records_processed=0,
                    records_inserted=0,
                    error_message=error_msg
                )
            
            print(f"ERROR: {error_msg}")
            return {
                'sync_id': self.current_sync_id,
                'status': 'failed',
                'error': error_msg,
                'completed_at': datetime.now(timezone.utc).isoformat()
            }
    
    def sync_campaigns(self) -> Dict[str, int]:
        """
        Synchronize campaigns from API to database
        
        Returns:
            Dictionary with sync statistics
        """
        print("\\nSTEP 1: Synchronizing Campaigns")
        print("-" * 40)
        
        try:
            # Fetch campaigns from API
            print("FETCHING: Getting campaigns from API...")
            campaigns = self.campaigns_client.get_campaigns()
            
            if not campaigns:
                print("WARNING: No campaigns returned from API")
                return {'inserted': 0, 'updated': 0}
            
            print(f"SUCCESS: Retrieved {len(campaigns)} campaigns from API")
            
            # Upsert campaigns to database
            inserted = 0
            updated = 0
            
            for campaign in campaigns:
                try:
                    existing = self.db_ops.get_campaign_by_id(campaign['id'])
                    
                    if existing:
                        self.db_ops.upsert_campaign(campaign)
                        updated += 1
                    else:
                        self.db_ops.upsert_campaign(campaign)
                        inserted += 1
                        
                except Exception as e:
                    error_msg = f"Failed to upsert campaign {campaign.get('id', 'unknown')}: {e}"
                    self.pipeline_stats['errors'].append(error_msg)
                    print(f"ERROR: {error_msg}")
            
            result = {'inserted': inserted, 'updated': updated}
            print(f"SUCCESS: Campaigns sync completed ({inserted} new, {updated} updated)")
            
            return result
            
        except Exception as e:
            error_msg = f"Campaign sync failed: {e}"
            self.pipeline_stats['errors'].append(error_msg)
            print(f"ERROR: {error_msg}")
            raise RuntimeError(f"CRITICAL: Campaign sync failed - {e}") from e
    
    def sync_hourly_metrics(self) -> Dict[str, int]:
        """
        Synchronize hourly metrics data from API to database
        
        Returns:
            Dictionary with sync statistics
        """
        print("\\nSTEP 2: Synchronizing Hourly Metrics")
        print("-" * 40)
        
        try:
            # Get all campaigns to fetch metrics for
            campaigns = self.db_ops.get_campaigns(active_only=False)
            
            if not campaigns:
                print("WARNING: No campaigns found for metrics sync")
                return {'processed': 0, 'stored': 0}
            
            campaign_ids = [c['id'] for c in campaigns]
            print(f"FETCHING: Getting hourly metrics for {len(campaign_ids)} campaigns...")
            
            # Fetch and process metrics for the last 48 hours
            hourly_records = self.metrics_client.process_metrics_for_storage(
                campaign_ids=campaign_ids,
                hours_back=48
            )
            
            if not hourly_records:
                print("WARNING: No hourly metrics data returned from API")
                return {'processed': 0, 'stored': 0}
            
            print(f"SUCCESS: Retrieved {len(hourly_records)} hourly metric records from API")
            
            # Store hourly records to database
            stored = 0
            errors = 0
            
            for record in hourly_records:
                try:
                    self.db_ops.upsert_hourly_data(record)
                    stored += 1
                except Exception as e:
                    error_msg = f"Failed to store hourly data for campaign {record.get('campaign_id', 'unknown')}: {e}"
                    self.pipeline_stats['errors'].append(error_msg)
                    print(f"ERROR: {error_msg}")
                    errors += 1
            
            result = {'processed': len(hourly_records), 'stored': stored, 'errors': errors}
            print(f"SUCCESS: Hourly metrics sync completed ({stored} stored, {errors} errors)")
            
            return result
            
        except Exception as e:
            error_msg = f"Hourly metrics sync failed: {e}"
            self.pipeline_stats['errors'].append(error_msg)
            print(f"ERROR: {error_msg}")
            return {'processed': 0, 'stored': 0, 'errors': 1}
    
    def process_hierarchy_mapping(self) -> Dict[str, int]:
        """
        Process hierarchy mapping for all campaigns
        
        Returns:
            Dictionary with mapping statistics
        """
        print("\\nSTEP 3: Processing Hierarchy Mapping")
        print("-" * 40)
        
        try:
            # Get all campaigns that need mapping
            campaigns = self.db_ops.get_campaigns()
            
            if not campaigns:
                print("WARNING: No campaigns found for hierarchy mapping")
                return {'mapped': 0, 'errors': 0}
            
            print(f"MAPPING: Processing hierarchy for {len(campaigns)} campaigns...")
            
            # Extract campaign names for batch mapping
            campaign_names = [campaign['name'] for campaign in campaigns]
            
            # Map campaigns using hierarchy mapper
            mapping_results = self.hierarchy_mapper.map_campaigns_batch(campaign_names)
            
            # Store hierarchy mappings
            mapped = 0
            errors = 0
            
            for i, result in enumerate(mapping_results):
                try:
                    campaign = campaigns[i]
                    
                    if 'error' in result:
                        errors += 1
                        continue
                    
                    # Prepare hierarchy data
                    hierarchy_data = {
                        'campaign_id': campaign['id'],
                        'campaign_name': result['campaign_name'],
                        'network': result['network'],
                        'domain': result['domain'],
                        'placement': result['placement'],
                        'targeting': result['targeting'],
                        'special': result['special'],
                        'mapping_confidence': result['mapping_confidence']
                    }
                    
                    # Upsert hierarchy mapping
                    self.db_ops.upsert_campaign_hierarchy(hierarchy_data)
                    mapped += 1
                    
                except Exception as e:
                    error_msg = f"Failed to store hierarchy for campaign {campaign.get('id', 'unknown')}: {e}"
                    self.pipeline_stats['errors'].append(error_msg)
                    print(f"ERROR: {error_msg}")
                    errors += 1
            
            result = {'mapped': mapped, 'errors': errors}
            print(f"SUCCESS: Hierarchy mapping completed ({mapped} mapped, {errors} errors)")
            
            return result
            
        except Exception as e:
            error_msg = f"Hierarchy mapping failed: {e}"
            self.pipeline_stats['errors'].append(error_msg)
            print(f"ERROR: {error_msg}")
            return {'mapped': 0, 'errors': 1}
    
    def validate_data_quality(self) -> List[str]:
        """
        Validate data quality across the pipeline
        
        Returns:
            List of data quality warnings
        """
        print("\\nSTEP 4: Validating Data Quality")
        print("-" * 40)
        
        try:
            warnings = []
            
            # Get processed performance data
            performance_data = self.data_processor.aggregate_all_campaigns_performance()
            
            if not performance_data:
                warnings.append("No performance data available for validation")
                return warnings
            
            # Use data processor validation
            quality_warnings = self.data_processor.validate_data_quality(performance_data)
            warnings.extend(quality_warnings)
            
            # Additional pipeline-specific validations
            
            # Check for API connectivity issues
            if not self.campaigns_client.health_check():
                warnings.append("API connectivity issues detected")
            
            # Check sync completeness
            total_campaigns = len(self.db_ops.get_campaigns())
            mapped_campaigns = len([d for d in performance_data if d.get('network') != 'Unknown'])
            
            if mapped_campaigns < total_campaigns * 0.8:  # Less than 80% mapped
                warnings.append(f"Low mapping coverage: {mapped_campaigns}/{total_campaigns} campaigns mapped")
            
            # Check for recent data
            recent_sync_history = self.db_ops.get_sync_history(limit=1)
            if recent_sync_history:
                last_sync_time = recent_sync_history[0].get('created_at')
                # Add timestamp check if needed
            
            if warnings:
                print(f"WARNING: Found {len(warnings)} data quality issues:")
                for warning in warnings:
                    print(f"  - {warning}")
            else:
                print("SUCCESS: Data quality validation passed")
            
            return warnings
            
        except Exception as e:
            error_msg = f"Data quality validation failed: {e}"
            self.pipeline_stats['errors'].append(error_msg)
            print(f"ERROR: {error_msg}")
            return [error_msg]
    
    
    def run_sync_integrity_checks(self) -> None:
        """Run comprehensive integrity checks after sync"""
        try:
            print("CHECKING: Post-sync data integrity...")
            
            # Check 1: Campaign count consistency
            campaigns = self.db_ops.get_campaigns()
            print(f"✓ INTEGRITY: {len(campaigns)} total campaigns in database")
            
            # Check 2: Data coverage analysis
            campaigns_with_hierarchy = 0
            campaigns_with_hourly = 0
            
            for campaign in campaigns[:10]:  # Check first 10 for detailed analysis
                campaign_id = campaign['id']
                
                # Only check hourly data now (metrics_snapshots removed)
                hierarchy = self.db_ops.get_campaign_hierarchy(campaign_id)
                hourly = self.db_ops.get_hourly_data(campaign_id=campaign_id)
                
                if hierarchy:
                    campaigns_with_hierarchy += 1
                if hourly:
                    campaigns_with_hourly += 1
                
                print(f"  Campaign {campaign_id} ({campaign.get('name', 'Unknown')[:30]}): "
                      f"Hierarchy={len(hierarchy)}, Hourly={len(hourly)}")
            
            print(f"✓ INTEGRITY: Data coverage (first 10 campaigns):")
            print(f"  - Campaigns with hierarchy: {campaigns_with_hierarchy}/10")
            print(f"  - Campaigns with hourly data: {campaigns_with_hourly}/10")
            
            # Check 3: Non-zero data validation
            if campaigns_with_hourly > 0:
                print("✓ INTEGRITY: Found campaigns with hourly data")
            else:
                print("⚠️ INTEGRITY: No campaigns have hourly data")
            
        except Exception as e:
            print(f"ERROR: Integrity check failed: {e}")
    
    def get_pipeline_status(self) -> Dict[str, Any]:
        """
        Get current pipeline status and recent sync history
        
        Returns:
            Dictionary with pipeline status information
        """
        try:
            # Get recent sync history
            sync_history = self.db_ops.get_sync_history(limit=5)
            
            # Get database statistics
            total_campaigns = len(self.db_ops.get_campaigns())
            # Get total hourly data records as metrics count
            total_metrics = len(self.db_ops.get_hourly_data())
            
            # Get hierarchy mapping statistics
            hierarchy_stats = self.hierarchy_mapper.get_mapping_statistics()
            
            # Check API health
            api_health = {
                'campaigns_api': self.campaigns_client.health_check(),
                'metrics_api': self.metrics_client.health_check()
            }
            
            return {
                'pipeline_ready': all(api_health.values()),
                'api_health': api_health,
                'database_stats': {
                    'total_campaigns': total_campaigns,
                    'total_metrics': total_metrics
                },
                'hierarchy_stats': hierarchy_stats,
                'recent_syncs': sync_history,
                'current_sync_id': self.current_sync_id,
                'status_checked_at': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            return {
                'pipeline_ready': False,
                'error': str(e),
                'status_checked_at': datetime.now(timezone.utc).isoformat()
            }
    
    def sync_historical_metrics(self, start_date: str, end_date: str, 
                              batch_hours: int = 6, test_batches: Optional[int] = None) -> Dict[str, Any]:
        """
        Synchronize historical metrics data in batches
        
        Args:
            start_date: Start date string (YYYY-MM-DD)
            end_date: End date string (YYYY-MM-DD)
            batch_hours: Hours per batch (max 6 for API limits)
            test_batches: Limit to N batches for testing
            
        Returns:
            Dictionary with sync results and statistics
        """
        try:
            # Parse dates
            start_dt = datetime.strptime(start_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            end_dt = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            
            # Get all campaigns for metrics sync
            campaigns = self.db_ops.get_campaigns(active_only=False)
            if not campaigns:
                raise RuntimeError("No campaigns found. Run 'python main.py sync' first to load campaigns.")
            
            campaign_ids = [c['id'] for c in campaigns]
            print(f"Loading historical metrics for {len(campaign_ids)} campaigns...")
            
            # Generate time batches
            time_batches = self._generate_time_batches(start_dt, end_dt, batch_hours)
            
            if test_batches:
                time_batches = time_batches[:test_batches]
                print(f"TESTING: Limited to {len(time_batches)} batches")
            
            total_batches = len(time_batches)
            print(f"Processing {total_batches} batches...")
            print()
            
            # Process batches with progress tracking
            total_records = 0
            batches_completed = 0
            errors = []
            
            for i, (batch_start, batch_end) in enumerate(time_batches, 1):
                try:
                    # Progress indicator
                    progress_pct = (i / total_batches) * 100
                    batch_start_str = batch_start.strftime('%Y-%m-%d %H:%M')
                    batch_end_str = batch_end.strftime('%Y-%m-%d %H:%M')
                    
                    print(f"Batch {i:3}/{total_batches} [{progress_pct:5.1f}%] | {batch_start_str} - {batch_end_str}")
                    
                    # Convert to milliseconds for API
                    start_ms = int(batch_start.timestamp() * 1000)
                    end_ms = int(batch_end.timestamp() * 1000)
                    
                    # Fetch metrics for this time range
                    batch_records = self._fetch_batch_metrics(campaign_ids, start_ms, end_ms)
                    
                    # Store records
                    stored_count = 0
                    for record in batch_records:
                        try:
                            self.db_ops.upsert_hourly_data(record)
                            stored_count += 1
                        except Exception as e:
                            errors.append(f"Failed to store record: {e}")
                    
                    total_records += stored_count
                    batches_completed += 1
                    
                    print(f"  + Stored {stored_count} records")
                    
                    # Small delay to be nice to the API
                    time.sleep(0.3)
                    
                except Exception as e:
                    error_msg = f"Batch {i} failed: {e}"
                    errors.append(error_msg)
                    print(f"  - {error_msg}")
                    continue
            
            print()
            print(f"Historical sync completed!")
            print(f"Batches processed: {batches_completed}/{total_batches}")
            print(f"Total records: {total_records}")
            
            if errors:
                print(f"Errors: {len(errors)}")
                for error in errors[:5]:  # Show first 5 errors
                    print(f"  - {error}")
                if len(errors) > 5:
                    print(f"  ... and {len(errors) - 5} more errors")
            
            return {
                'status': 'completed',
                'total_records': total_records,
                'batches_completed': batches_completed,
                'total_batches': total_batches,
                'errors': errors
            }
            
        except Exception as e:
            return {
                'status': 'failed',
                'error': str(e),
                'total_records': 0,
                'batches_completed': 0,
                'errors': [str(e)]
            }
    
    def _generate_time_batches(self, start_dt: datetime, end_dt: datetime, 
                             batch_hours: int) -> List[tuple]:
        """Generate list of (start, end) datetime tuples for batched processing"""
        batches = []
        current = start_dt
        
        while current < end_dt:
            batch_end = min(current + timedelta(hours=batch_hours), end_dt)
            batches.append((current, batch_end))
            current = batch_end
            
        return batches
    
    def _fetch_batch_metrics(self, campaign_ids: List[int], start_ms: int, end_ms: int) -> List[Dict[str, Any]]:
        """Fetch and process metrics for a single time batch"""
        try:
            # Fetch metrics for all campaigns in this time range
            processed_records = []
            
            for campaign_id in campaign_ids:
                try:
                    # Get metrics via direct API call (reuse existing method logic)
                    raw_buckets = self.metrics_client.get_metrics(
                        start_time=start_ms,
                        end_time=end_ms,
                        bucket="one_hour",
                        metrics="registrations,messages,media,payment_methods,charge_revenue,terms_acceptances",
                        campaign_ids=[campaign_id]
                    )
                    
                    # Process each bucket
                    for bucket in raw_buckets:
                        try:
                            processed_record = self.metrics_client.parse_metrics_bucket(bucket, campaign_id)
                            processed_records.append(processed_record)
                        except Exception as e:
                            print(f"    Warning: Failed to process bucket for campaign {campaign_id}: {e}")
                            continue
                            
                except Exception as e:
                    print(f"    Warning: Failed to fetch metrics for campaign {campaign_id}: {e}")
                    continue
            
            return processed_records
            
        except Exception as e:
            print(f"    Error fetching batch metrics: {e}")
            return []
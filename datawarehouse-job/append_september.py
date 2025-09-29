#!/usr/bin/env python3
"""
Append September 2025 data to existing August data (no clearing)
"""
import sys
import os
from datetime import datetime, timezone

# Add src to path
sys.path.insert(0, 'src')

from database.schema import initialize_database
from database.operations import DatabaseOperations
from config.settings import get_settings
from api_clients.campaigns import CampaignsClient
from api_clients.metrics import MetricsClient

def main():
    print("Appending September 2025 data to existing database...")
    
    # Load settings
    settings = get_settings()
    api_config = settings.get_api_config()
    
    # Initialize database (don't create schema, it exists)
    conn = initialize_database("datawarehouse.db")
    db_ops = DatabaseOperations(conn)
    
    # Initialize API clients
    campaigns_client = CampaignsClient(api_config['base_url'], api_config['bearer_token'])
    metrics_client = MetricsClient(api_config['base_url'], api_config['bearer_token'])
    
    try:
        # Step 1: Get campaigns
        print("\nStep 1: Fetching campaigns...")
        campaigns = campaigns_client.get_campaigns()
        print(f"Found {len(campaigns)} campaigns")
        
        # Get campaign IDs for metrics
        campaign_ids = [c['id'] for c in campaigns]
        
        # Step 2: Fetch September metrics
        print("\nStep 2: Fetching September 2025 metrics...")
        
        # September 1, 2025 00:00:00 UTC to October 1, 2025 00:00:00 UTC
        sept_start = datetime(2025, 9, 1, 0, 0, 0, tzinfo=timezone.utc)
        oct_start = datetime(2025, 10, 1, 0, 0, 0, tzinfo=timezone.utc)
        
        start_ms = int(sept_start.timestamp() * 1000)
        end_ms = int(oct_start.timestamp() * 1000)
        
        print(f"Date range: {sept_start} to {oct_start}")
        print(f"Timestamp range: {start_ms} to {end_ms}")
        
        # Fetch metrics using the new date range method
        september_metrics = metrics_client.process_metrics_for_date_range(
            campaign_ids=campaign_ids,
            start_time_ms=start_ms,
            end_time_ms=end_ms
        )
        
        print(f"Retrieved {len(september_metrics)} September metric records")
        
        # Step 3: Store metrics in database (APPEND, don't clear)
        if september_metrics:
            print("\nStep 3: Appending metrics to database (keeping existing August data)...")
            
            # Store new data without clearing
            for record in september_metrics:
                db_ops.upsert_hourly_data(record)
            
            print(f"Added {len(september_metrics)} September hourly records to database")
        else:
            print("No September metrics data available")
        
        print("\n✅ September 2025 data appended successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during append: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__":
    main()
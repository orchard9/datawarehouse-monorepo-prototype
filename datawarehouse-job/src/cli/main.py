#!/usr/bin/env python3
"""
Peach AI Data Warehouse CLI - Main command interface
Provides sync, export, status, and schedule commands
"""
import sys
import os
import click
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Add project root to Python path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.database.schema import initialize_database
from src.database.operations import DatabaseOperations
from src.etl.pipeline import ETLPipeline
from src.config.settings import get_settings

# Month and date utilities
MONTH_NAMES = {
    # Full month names
    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
    'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
    # Abbreviated month names
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
}

def parse_month_string(month_input: str) -> int:
    """
    Parse month input string or number to month number (1-12)
    
    Args:
        month_input: Month as string ("January", "Jan", "august") or number string ("8", "12")
        
    Returns:
        Month number (1-12)
        
    Raises:
        ValueError: If month input is invalid
    """
    month_input = str(month_input).strip().lower()
    
    # Try parsing as number first
    try:
        month_num = int(month_input)
        if 1 <= month_num <= 12:
            return month_num
        else:
            raise ValueError(f"Month number must be between 1 and 12, got {month_num}")
    except ValueError as e:
        # If it's not a number, try month names
        if month_input in MONTH_NAMES:
            return MONTH_NAMES[month_input]
        
        # Provide helpful suggestions
        suggestions = []
        for name in MONTH_NAMES.keys():
            if month_input in name or name in month_input:
                suggestions.append(name.capitalize())
        
        if suggestions:
            raise ValueError(f"Invalid month '{month_input}'. Did you mean: {', '.join(suggestions[:3])}?")
        else:
            raise ValueError(f"Invalid month '{month_input}'. Use month names (January, Feb) or numbers (1-12)")

def get_month_date_range(month: int, year: int) -> tuple:
    """
    Get the first and last day of a given month and year
    
    Args:
        month: Month number (1-12)
        year: Year (e.g., 2025)
        
    Returns:
        Tuple of (start_date_str, end_date_str) in YYYY-MM-DD format
    """
    import calendar
    
    # First day of month
    start_date = datetime(year, month, 1)
    
    # Last day of month
    last_day = calendar.monthrange(year, month)[1]
    end_date = datetime(year, month, last_day)
    
    return start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')

def validate_year(year: int) -> bool:
    """
    Validate if year is in reasonable range
    
    Args:
        year: Year to validate
        
    Returns:
        True if valid
        
    Raises:
        ValueError: If year is outside reasonable range
    """
    current_year = datetime.now(timezone.utc).year
    if year < 2020 or year > current_year + 5:
        raise ValueError(f"Year must be between 2020 and {current_year + 5}, got {year}")
    return True

def get_month_name(month: int) -> str:
    """Get full month name from month number"""
    month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']
    return month_names[month - 1]

# Load settings from config file
settings = get_settings()
api_config = settings.get_api_config()
db_config = settings.get_database_config()

# Configuration defaults from settings.yaml
DEFAULT_DB_PATH = PROJECT_ROOT / db_config['path']
DEFAULT_API_URL = api_config['base_url']
DEFAULT_API_TOKEN = api_config['bearer_token']

@click.group()
@click.option('--db-path', default=str(DEFAULT_DB_PATH), help='Database file path')
@click.option('--api-url', default=DEFAULT_API_URL, help='API base URL')
@click.option('--api-token', default=DEFAULT_API_TOKEN, help='API bearer token')
@click.option('--verbose', '-v', is_flag=True, help='Verbose output')
@click.pass_context
def cli(ctx, db_path, api_url, api_token, verbose):
    """Peach AI Data Warehouse CLI
    
    Synchronize campaign data from APIs and export to spreadsheets.
    """
    # Ensure ctx.obj exists
    ctx.ensure_object(dict)
    
    # Store configuration in context
    ctx.obj['db_path'] = db_path
    ctx.obj['api_url'] = api_url
    ctx.obj['api_token'] = api_token
    ctx.obj['verbose'] = verbose
    
    # Initialize database if it doesn't exist
    if not Path(db_path).exists():
        if verbose:
            click.echo(f"Initializing database at {db_path}")
        initialize_database(db_path)

@cli.command()
@click.option('--dry-run', is_flag=True, help='Show what would be synced without executing')
@click.pass_context
def sync(ctx, dry_run):
    """Synchronize data from APIs
    
    Pulls campaigns and hourly metrics data from the Peach AI APIs
    and processes them through the complete ETL pipeline.
    """
    config = ctx.obj
    
    if dry_run:
        click.echo("DRY RUN: Would synchronize data from APIs")
        click.echo(f"  API URL: {config['api_url']}")
        click.echo(f"  Database: {config['db_path']}")
        click.echo(f"  Would sync: campaigns, hourly metrics, hierarchy mapping")
        return
    
    try:
        # Initialize database and ETL pipeline
        conn = initialize_database(config['db_path'])
        db_ops = DatabaseOperations(conn)
        
        pipeline = ETLPipeline(
            db_ops=db_ops,
            api_base_url=config['api_url'],
            api_token=config['api_token']
        )
        
        click.echo("Starting data synchronization...")
        click.echo("=" * 50)
        
        start_time = time.time()
        
        # Run full sync (campaigns and metrics)
        result = pipeline.run_full_sync()
        
        # Display results
        if result['status'] == 'completed':
            duration = result['duration_seconds']
            click.echo(f"SUCCESS: Synchronization completed in {duration:.2f} seconds")
            click.echo()
            
            # Show detailed results
            results = result['results']
            click.echo("Sync Results:")
            click.echo(f"  Campaigns: {results['campaigns']['inserted']} processed")
            if 'metrics' in results:
                click.echo(f"  Hourly Metrics: {results['metrics']['processed']} processed")
            click.echo(f"  Hierarchies: {results['hierarchies']['mapped']} mapped")
            
            # Show data quality warnings
            warnings = result.get('data_quality_warnings', [])
            if warnings:
                click.echo()
                click.echo("Data Quality Warnings:")
                for warning in warnings:
                    click.echo(f"  - {warning}")
            
            click.echo()
            click.echo("Sync completed successfully!")
            
        else:
            click.echo(f"ERROR: Synchronization failed: {result.get('error', 'Unknown error')}")
            sys.exit(1)
        
        conn.close()
        
    except Exception as e:
        click.echo(f"ERROR: Error during synchronization: {e}")
        if config['verbose']:
            import traceback
            click.echo(traceback.format_exc())
        sys.exit(1)

@cli.command()
@click.option('--format', default='google_sheets', type=click.Choice(['google_sheets', 'csv', 'excel']), 
              help='Export format')
@click.option('--output-file', type=str, help='Output file path (for CSV/Excel formats)')
@click.option('--spreadsheet-title', default=None, help='Spreadsheet title')
@click.option('--credentials-path', type=str, default=None, help='Path to Google service account credentials JSON file')
@click.option('--daily', is_flag=True, help='Export daily records (one record per campaign per day) instead of campaign summaries')
@click.option('--dry-run', is_flag=True, help='Show what would be exported without executing')
@click.pass_context
def export(ctx, format, output_file, spreadsheet_title, credentials_path, daily, dry_run):
    """Export data to spreadsheet
    
    Exports processed campaign performance data to Google Sheets, CSV, or Excel format
    with hierarchical organization and calculated metrics.
    """
    config = ctx.obj
    
    # Use Google Sheets settings from config if not provided
    sheets_config = settings.get_google_sheets_config()
    if not spreadsheet_title:
        spreadsheet_title = sheets_config['default_title']
    if not credentials_path:
        credentials_path = sheets_config['credentials_path']
    
    if dry_run:
        click.echo("DRY RUN: Would export campaign performance data")
        click.echo(f"  Format: {format}")
        click.echo(f"  Database: {config['db_path']}")
        if output_file:
            click.echo(f"  Output file: {output_file}")
        if format == 'google_sheets':
            click.echo(f"  Spreadsheet title: {spreadsheet_title}")
        return
    
    try:
        # Initialize database
        conn = initialize_database(config['db_path'])
        db_ops = DatabaseOperations(conn)
        
        # Get performance data
        from src.etl.data_processor import DataProcessor
        processor = DataProcessor(db_ops)
        
        if daily:
            click.echo(" Generating daily performance data...")
            performance_data = processor.aggregate_daily_campaign_performance()
            
            if not performance_data:
                click.echo("ERROR: No daily performance data available to export")
                click.echo("TIP: Run 'sync' command first to pull data from APIs")
                sys.exit(1)
            
            click.echo(f"SUCCESS: Generated {len(performance_data)} daily records for campaigns")
        else:
            click.echo(" Generating performance data...")
            performance_data = processor.aggregate_all_campaigns_performance()
            
            if not performance_data:
                click.echo("ERROR: No performance data available to export")
                click.echo("TIP: Run 'sync' command first to pull data from APIs")
                sys.exit(1)
            
            click.echo(f"SUCCESS: Generated performance data for {len(performance_data)} campaigns")
        
        # Export based on format
        if format == 'google_sheets':
            click.echo("Exporting to Google Sheets...")
            
            # Check if credentials provided
            if not credentials_path:
                click.echo("ERROR: Google Sheets export requires --credentials-path")
                click.echo("TIP: Use --format csv or --format excel for local exports")
                click.echo()
                
                # Show setup instructions
                from src.exporters.google_sheets import GoogleSheetsExporter
                exporter = GoogleSheetsExporter()
                click.echo(exporter.get_setup_instructions())
                sys.exit(1)
            
            try:
                from src.exporters.google_sheets import export_to_google_sheets_simple
                
                spreadsheet_id = export_to_google_sheets_simple(
                    data=performance_data,
                    credentials_path=credentials_path,
                    title=spreadsheet_title
                )
                
                if spreadsheet_id:
                    click.echo(f"SUCCESS: Exported to Google Sheets")
                    click.echo(f"Spreadsheet ID: {spreadsheet_id}")
                    click.echo(f"URL: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")
                else:
                    click.echo("ERROR: Google Sheets export failed")
                    sys.exit(1)
                    
            except ImportError:
                click.echo("ERROR: Google Sheets API not available")
                click.echo("TIP: Install with: pip install google-api-python-client google-auth")
                sys.exit(1)
            
        elif format == 'csv':
            output_path = output_file or f"campaign_performance_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
            export_to_csv(performance_data, output_path)
            click.echo(f"SUCCESS: Exported to CSV: {output_path}")
            
        elif format == 'excel':
            output_path = output_file or f"campaign_performance_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.xlsx"
            export_to_excel(performance_data, output_path)
            click.echo(f"SUCCESS: Exported to Excel: {output_path}")
        
        conn.close()
        
    except Exception as e:
        click.echo(f"ERROR: Error during export: {e}")
        if config['verbose']:
            import traceback
            click.echo(traceback.format_exc())
        sys.exit(1)

@cli.command()
@click.option('--detailed', is_flag=True, help='Show detailed status information')
@click.pass_context
def status(ctx, detailed):
    """Show system status and recent sync history
    
    Displays current database statistics, recent sync history, 
    API connectivity status, and hierarchy mapping coverage.
    """
    config = ctx.obj
    
    try:
        # Initialize database
        conn = initialize_database(config['db_path'])
        db_ops = DatabaseOperations(conn)
        
        click.echo(" Data Warehouse Status")
        click.echo("=" * 50)
        
        # Database statistics
        campaigns = db_ops.get_campaigns()
        sync_history = db_ops.get_sync_history(limit=5)
        
        click.echo(f" Database Statistics:")
        click.echo(f"  Total Campaigns: {len(campaigns)}")
        click.echo(f"  Database Path: {config['db_path']}")
        click.echo(f"  Database Size: {get_database_size(config['db_path'])}")
        
        # Recent sync history
        click.echo(f"\n Recent Sync History:")
        if sync_history:
            for sync in sync_history:
                status_icon = "SUCCESS:" if sync.get('error_message') is None else "ERROR:"
                click.echo(f"  {status_icon} {sync['sync_type']} - {sync['created_at']} ({sync['records_processed']} records)")
        else:
            click.echo("  No sync history found")
        
        # API connectivity (if detailed)
        if detailed:
            click.echo(f"\n API Connectivity:")
            
            # Test API connectivity
            from src.etl.pipeline import ETLPipeline
            pipeline = ETLPipeline(
                db_ops=db_ops,
                api_base_url=config['api_url'],
                api_token=config['api_token']
            )
            
            status_info = pipeline.get_pipeline_status()
            api_health = status_info.get('api_health', {})
            
            for api_name, is_healthy in api_health.items():
                status_icon = "SUCCESS:" if is_healthy else "ERROR:"
                click.echo(f"  {status_icon} {api_name}: {'Healthy' if is_healthy else 'Unavailable'}")
        
        # Hierarchy mapping coverage
        if detailed:
            from src.etl.hierarchy_mapper import HierarchyMapper
            mapper = HierarchyMapper(db_ops)
            stats = mapper.get_mapping_statistics()
            
            click.echo(f"\n  Hierarchy Mapping:")
            click.echo(f"  Total Rules: {stats['total_rules']}")
            click.echo(f"  Rules Cached: {'Yes' if stats['cache_status']['cached_rules'] else 'No'}")
            
            # Show unmapped campaigns
            from src.etl.data_processor import DataProcessor
            processor = DataProcessor(db_ops)
            unmapped_campaigns = processor.get_unmapped_campaigns()
            
            click.echo(f"\n  Unmapped Campaigns ({len(unmapped_campaigns)}):")
            if unmapped_campaigns:
                for campaign in unmapped_campaigns[:10]:  # Show first 10
                    sessions = campaign.get('sessions', 0)
                    regs = campaign.get('registrations', 0)
                    click.echo(f"    - {campaign['name']} (ID: {campaign['id']}, Sessions: {sessions}, Regs: {regs})")
                if len(unmapped_campaigns) > 10:
                    click.echo(f"    ... and {len(unmapped_campaigns) - 10} more")
            else:
                click.echo("    All campaigns are mapped!")
        
        conn.close()
        
    except Exception as e:
        click.echo(f"ERROR: Error checking status: {e}")
        if config['verbose']:
            import traceback
            click.echo(traceback.format_exc())
        sys.exit(1)

@cli.command()
@click.argument('campaign_id', type=int)
@click.pass_context
def debug_campaign(ctx, campaign_id):
    """Debug a specific campaign - show all stored data
    
    Shows everything we know about a campaign including raw data from
    all tables, hierarchy mapping, and calculated metrics.
    """
    config = ctx.obj
    
    try:
        # Initialize database
        conn = initialize_database(config['db_path'])
        db_ops = DatabaseOperations(conn)
        
        click.echo(f"DEBUGGING CAMPAIGN ID: {campaign_id}")
        click.echo("=" * 60)
        
        # 1. Basic campaign info
        campaign = db_ops.get_campaign_by_id(campaign_id)
        if not campaign:
            click.echo(f"ERROR: Campaign {campaign_id} not found in database")
            return
        
        click.echo("BASIC CAMPAIGN INFO:")
        click.echo(f"  ID: {campaign['id']}")
        click.echo(f"  Name: {campaign['name']}")
        click.echo(f"  Description: {campaign.get('description', 'None')}")
        click.echo(f"  Is Serving: {campaign.get('is_serving', 'Unknown')}")
        click.echo(f"  Traffic Weight: {campaign.get('traffic_weight', 'Unknown')}")
        click.echo(f"  Created: {campaign.get('created_at', 'Unknown')}")
        click.echo(f"  Updated: {campaign.get('updated_at', 'Unknown')}")
        
        # 2. Hierarchy mapping
        click.echo(f"\nHIERARCHY MAPPING:")
        hierarchy_list = db_ops.get_campaign_hierarchy(campaign_id)
        if hierarchy_list:
            # Take the first (should only be one) hierarchy record
            hierarchy = hierarchy_list[0]
            click.echo(f"  Network: {hierarchy.get('network', 'Unknown')}")
            click.echo(f"  Domain: {hierarchy.get('domain', 'Unknown')}")
            click.echo(f"  Placement: {hierarchy.get('placement', 'Unknown')}")
            click.echo(f"  Targeting: {hierarchy.get('targeting', 'Unknown')}")
            click.echo(f"  Special: {hierarchy.get('special', 'Unknown')}")
            click.echo(f"  Confidence: {hierarchy.get('mapping_confidence', 'Unknown')}")
            click.echo(f"  Mapped At: {hierarchy.get('mapped_at', 'Unknown')}")
        else:
            click.echo("  ERROR: No hierarchy mapping found")
        
        # 3. Metrics summary from hourly data
        click.echo(f"\nMETRICS SUMMARY:")
        hourly_data = db_ops.get_hourly_data(campaign_id=campaign_id)
        if hourly_data:
            # Calculate totals from hourly data
            total_registrations = sum(h.get('registrations', 0) for h in hourly_data)
            total_messages = sum(h.get('messages', 0) for h in hourly_data) 
            total_media = sum(h.get('media', 0) for h in hourly_data)
            total_payment_methods = sum(h.get('payment_methods', 0) for h in hourly_data)
            total_terms_acceptances = sum(h.get('terms_acceptances', 0) for h in hourly_data)
            
            click.echo(f"  Total Registrations: {total_registrations}")
            click.echo(f"  Total Messages: {total_messages}")
            click.echo(f"  Total Media: {total_media}")
            click.echo(f"  Total Payment Methods: {total_payment_methods}")
            click.echo(f"  Total Terms Acceptances: {total_terms_acceptances}")
            click.echo(f"  Based on {len(hourly_data)} hourly records")
        else:
            click.echo("  ERROR: No hourly data found for metrics calculation")
        
        
        # 4. Hourly data (comprehensive metrics)
        click.echo(f"\nHOURLY DATA:")
        hourly_data = db_ops.get_hourly_data(campaign_id=campaign_id)
        if hourly_data:
            click.echo(f"  Found {len(hourly_data)} hourly records:")
            for i, hour_record in enumerate(hourly_data[-5:]):  # Show last 5 hours
                from datetime import datetime
                hour_time = datetime.fromtimestamp(hour_record['unix_hour'] * 3600, tz=timezone.utc)
                click.echo(f"    Hour {i+1} ({hour_time.strftime('%Y-%m-%d %H:00')}):")
                # Registration data
                click.echo(f"      Sessions: {hour_record.get('sessions', 0)}")
                click.echo(f"      Registrations: {hour_record.get('registrations', 0)}")
                click.echo(f"      Credit Cards: {hour_record.get('credit_cards', 0)}")
                click.echo(f"      Email Accounts: {hour_record.get('email_accounts', 0)}")
                click.echo(f"      Google Accounts: {hour_record.get('google_accounts', 0)}")
                click.echo(f"      Total Accounts: {hour_record.get('total_accounts', 0)}")
                # Messages data
                if hour_record.get('messages', 0) > 0 or hour_record.get('total_user_chats', 0) > 0:
                    click.echo(f"      Messages: {hour_record.get('messages', 0)}")
                    click.echo(f"      Total User Chats: {hour_record.get('total_user_chats', 0)}")
            if len(hourly_data) > 5:
                click.echo(f"    ... and {len(hourly_data) - 5} older records")
        else:
            click.echo("  ERROR: No hourly data found")
        
        # 5. Calculated performance summary
        click.echo(f"\nCALCULATED PERFORMANCE:")
        try:
            from src.etl.data_processor import DataProcessor
            processor = DataProcessor(db_ops)
            performance = processor.aggregate_campaign_performance(campaign_id)
            
            click.echo(f"  Sessions: {performance.get('sessions', 0)}")
            click.echo(f"  Registrations: {performance.get('registrations', 0)}")
            click.echo(f"  Reg%: {performance.get('reg_percentage', 0)}%")
            click.echo(f"  CC Conv%: {performance.get('cc_conv_percentage', 0)}%")
            click.echo(f"  Data Quality Score: {performance.get('data_quality_score', 0)}")
            
        except Exception as e:
            click.echo(f"  ERROR: Error calculating performance: {e}")
        
        conn.close()
        
    except Exception as e:
        click.echo(f"ERROR: {e}")
        if config['verbose']:
            import traceback
            click.echo(traceback.format_exc())
        sys.exit(1)

@cli.command()
@click.option('--time', default='06:00', help='Schedule time (HH:MM format)')
@click.option('--enable/--disable', default=True, help='Enable or disable scheduled sync')
@click.pass_context
def schedule(ctx, time, enable):
    """Set up scheduled sync
    
    Configures automatic daily synchronization at the specified time.
    Uses the system's task scheduler (Windows Task Scheduler, cron, etc.)
    """
    config = ctx.obj
    
    if enable:
        click.echo(f" Setting up daily sync at {time}")
        click.echo("WARNING:  Scheduled sync setup not yet implemented")
        click.echo("TIP: For now, you can manually run 'python -m src.cli.main sync' daily")
        
        # Show what the schedule would do
        click.echo(f"\nProposed schedule:")
        click.echo(f"  Time: {time} daily")
        click.echo(f"  Command: python -m src.cli.main sync")
        click.echo(f"  Database: {config['db_path']}")
        click.echo(f"  API URL: {config['api_url']}")
        
    else:
        click.echo(" Disabling scheduled sync")
        click.echo("WARNING:  Scheduled sync disable not yet implemented")

def export_to_csv(performance_data, output_path):
    """Export performance data to CSV format"""
    import csv
    
    if not performance_data:
        return
    
    # Check if this is daily data (has 'date' field) or campaign summary data
    is_daily_data = len(performance_data) > 0 and 'date' in performance_data[0]
    
    if is_daily_data:
        # Define column order for daily export
        columns = [
            'date', 'campaign_id', 'campaign_name', 'network', 'domain', 'placement', 'targeting', 'special',
            'sessions', 'registrations', 'credit_cards', 'email_accounts', 'google_accounts', 'total_accounts',
            'messages', 'companion_chats', 'total_user_chats', 'media', 'payment_methods', 'converted_users', 'terms_acceptances',
            'reg_percentage', 'cc_conv_percentage', 'clicks_to_reg_ratio', 'reg_to_cc_ratio',
            'hourly_records_count', 'data_quality_score'
        ]
    else:
        # Define column order for campaign summary export  
        columns = [
            'campaign_id', 'campaign_name', 'network', 'domain', 'placement', 'targeting', 'special',
            'sessions', 'registrations', 'credit_cards',
            'reg_percentage', 'cc_conv_percentage', 'clicks_to_reg_ratio', 'reg_to_cc_ratio'
        ]
    
    with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=columns)
        writer.writeheader()
        
        for campaign in performance_data:
            # Write only the columns we want, skip missing fields
            row = {col: campaign.get(col, '') for col in columns}
            writer.writerow(row)

def export_to_excel(performance_data, output_path):
    """Export performance data to Excel format"""
    try:
        import pandas as pd
        
        if not performance_data:
            return
        
        # Convert to DataFrame
        df = pd.DataFrame(performance_data)
        
        # Select and reorder columns
        columns = [
            'campaign_name', 'network', 'domain', 'placement', 'targeting', 'special',
            'sessions', 'registrations', 'credit_cards', 
            'reg_percentage', 'cc_conv_percentage', 'clicks_to_reg_ratio', 'reg_to_cc_ratio'
        ]
        
        # Keep only available columns
        available_columns = [col for col in columns if col in df.columns]
        df_export = df[available_columns]
        
        # Export to Excel
        df_export.to_excel(output_path, index=False, sheet_name='Campaign Performance')
        
    except ImportError:
        # Fallback to CSV if pandas/openpyxl not available
        click.echo("WARNING:  Excel export requires pandas and openpyxl")
        click.echo("TIP: Installing: pip install pandas openpyxl")
        csv_path = output_path.replace('.xlsx', '.csv')
        export_to_csv(performance_data, csv_path)
        click.echo(f" Exported as CSV instead: {csv_path}")

@cli.command()
@click.option('--start-date', required=True, help='Start date (YYYY-MM-DD)')
@click.option('--end-date', required=True, help='End date (YYYY-MM-DD)')
@click.option('--batch-hours', default=168, type=int, help='Hours per API batch (max 168 hours = 7 days)')
@click.option('--test-batches', type=int, help='Limit to N batches for testing (e.g., --test-batches 2)')
@click.option('--dry-run', is_flag=True, help='Show what would be synced without executing')
@click.pass_context
def sync_historical(ctx, start_date, end_date, batch_hours, test_batches, dry_run):
    """Synchronize historical data in batches
    
    Load historical campaign metrics data for a date range.
    API requests are batched to respect rate limits (max 6 hours per request).
    
    Examples:
      python main.py sync-historical --start-date 2025-08-01 --end-date 2025-08-31
      python main.py sync-historical --start-date 2025-08-01 --end-date 2025-08-01 --test-batches 2
    """
    config = ctx.obj
    
    try:
        # Validate and parse dates
        try:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            end_dt = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        except ValueError as e:
            click.echo(f"ERROR: Invalid date format. Use YYYY-MM-DD. {e}")
            sys.exit(1)
        
        # Validate date range
        if start_dt > end_dt:
            click.echo("ERROR: Start date must be before or equal to end date")
            sys.exit(1)
        
        # Validate batch hours
        if batch_hours <= 0 or batch_hours > 168:
            click.echo("ERROR: Batch hours must be between 1 and 168 (7 days)")
            sys.exit(1)
        
        # Calculate total duration
        total_duration = end_dt - start_dt
        total_hours = int(total_duration.total_seconds() / 3600) + 1
        total_batches = (total_hours + batch_hours - 1) // batch_hours  # Ceiling division
        
        if test_batches:
            total_batches = min(total_batches, test_batches)
            click.echo(f"TESTING MODE: Limited to {test_batches} batches")
        
        if dry_run:
            click.echo("DRY RUN: Would synchronize historical data")
            click.echo(f"  Date Range: {start_date} to {end_date}")
            click.echo(f"  Total Duration: {total_hours} hours")
            click.echo(f"  Batch Size: {batch_hours} hours per batch")
            click.echo(f"  Total Batches: {total_batches}")
            click.echo(f"  API URL: {config['api_url']}")
            click.echo(f"  Database: {config['db_path']}")
            return
        
        click.echo("Starting historical data synchronization...")
        click.echo("=" * 60)
        click.echo(f"Date Range: {start_date} to {end_date}")
        click.echo(f"Total Batches: {total_batches} ({batch_hours} hours each)")
        click.echo()
        
        # Initialize components
        from src.etl.pipeline import ETLPipeline
        from src.database.operations import DatabaseOperations
        import sqlite3
        
        # Initialize database connection and operations
        conn = sqlite3.connect(config['db_path'])
        db_ops = DatabaseOperations(conn)
        
        pipeline = ETLPipeline(
            db_ops=db_ops,
            api_base_url=config['api_url'],
            api_token=config['api_token']
        )
        
        # Run historical sync
        start_time = time.time()
        result = pipeline.sync_historical_metrics(
            start_date=start_date,
            end_date=end_date, 
            batch_hours=batch_hours,
            test_batches=test_batches
        )
        
        # Display results
        duration = time.time() - start_time
        if result['status'] == 'completed':
            click.echo()
            click.echo(f"SUCCESS: Historical sync completed in {duration:.2f} seconds")
            click.echo(f"Processed {result['total_records']} records across {result['batches_completed']} batches")
            if result['errors']:
                click.echo(f"Warnings: {len(result['errors'])} batch errors occurred")
        else:
            click.echo(f"ERROR: Historical sync failed: {result.get('error', 'Unknown error')}")
            sys.exit(1)
        
    except Exception as e:
        click.echo(f"ERROR: {e}")
        if config['verbose']:
            import traceback
            click.echo(traceback.format_exc())
        sys.exit(1)

@cli.command()
@click.option('--start-date', required=True, help='Start date (YYYY-MM-DD)')
@click.option('--end-date', required=True, help='End date (YYYY-MM-DD)')
@click.option('--spreadsheet-title', default=None, help='Spreadsheet title (auto-generated if not provided)')
@click.option('--credentials-path', type=str, default=None, help='Path to Google service account credentials JSON file')
@click.option('--dry-run', is_flag=True, help='Show what would be exported without executing')
@click.pass_context
def export_daterange(ctx, start_date, end_date, spreadsheet_title, credentials_path, dry_run):
    """Export campaign data for a date range to multi-tab Google Sheet
    
    Creates a comprehensive 3-tab Google Sheet with campaign performance data:
    - Performance Summary: Executive summary with campaign rankings
    - Daily Summary: Daily aggregated performance with growth tracking  
    - Hourly Data: Time-series hourly metrics for trend analysis
    
    Only includes campaigns with actual activity in the specified date range.
    
    Examples:
      python main.py export-daterange --start-date 2025-08-01 --end-date 2025-08-31
      python main.py export-daterange --start-date 2025-07-15 --end-date 2025-07-20 --spreadsheet-title "July Test Data"
    """
    config = ctx.obj
    
    try:
        # Validate dates
        try:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            end_dt = datetime.strptime(end_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        except ValueError as e:
            click.echo(f"ERROR: Invalid date format. Use YYYY-MM-DD. {e}")
            sys.exit(1)
        
        # Validate date range
        if start_dt > end_dt:
            click.echo("ERROR: Start date must be before or equal to end date")
            sys.exit(1)
        
        # Generate title if not provided
        if not spreadsheet_title:
            if start_dt.year == end_dt.year and start_dt.month == end_dt.month:
                # Same month
                spreadsheet_title = f"{start_dt.strftime('%B %Y')} Campaign Performance"
            else:
                # Date range spans multiple months
                spreadsheet_title = f"Campaign Performance {start_date} to {end_date}"
        
        if dry_run:
            click.echo("DRY RUN: Would export date range data to Google Sheets")
            click.echo(f"  Date Range: {start_date} to {end_date}")
            click.echo(f"  Spreadsheet Title: {spreadsheet_title}")
            click.echo(f"  Tabs: Performance Summary, Daily Summary, Hourly Data")
            click.echo(f"  Database: {config['db_path']}")
            click.echo(f"  Filter: Only campaigns with activity in date range")
            return
        
        click.echo("Starting date range export to Google Sheets...")
        click.echo("=" * 50)
        click.echo(f"Date Range: {start_date} to {end_date}")
        click.echo(f"Title: {spreadsheet_title}")
        click.echo()
        
        # Initialize components
        from src.etl.data_processor import DataProcessor  
        from src.exporters.google_sheets import GoogleSheetsExporter
        from src.database.operations import DatabaseOperations
        import sqlite3
        
        # Initialize database connection
        conn = sqlite3.connect(config['db_path'])
        db_ops = DatabaseOperations(conn)
        
        processor = DataProcessor(db_ops)
        exporter = GoogleSheetsExporter(credentials_path=credentials_path)
        
        # Authenticate with Google Sheets
        if not exporter.authenticate():
            click.echo("ERROR: Failed to authenticate with Google Sheets")
            sys.exit(1)
        
        click.echo("Generating data for date range...")
        
        # Generate all three data sets using new generalized methods
        hourly_data = processor.get_hourly_data_range(start_date, end_date)
        daily_data = processor.get_daily_aggregates_range(start_date, end_date) 
        summary_data = processor.get_campaign_summary_range(start_date, end_date)
        
        click.echo(f"Found data for {len(summary_data)} campaigns with activity in date range")
        
        if not any([hourly_data, daily_data, summary_data]):
            click.echo(f"WARNING: No data found for date range {start_date} to {end_date}")
            sys.exit(1)
        
        # Export to Google Sheets using new generalized method
        spreadsheet_url = exporter.create_daterange_export(
            hourly_data=hourly_data,
            daily_data=daily_data, 
            summary_data=summary_data,
            title=spreadsheet_title,
            start_date=start_date,
            end_date=end_date
        )
        
        click.echo()
        click.echo("SUCCESS: Date range data exported to Google Sheets")
        click.echo(f"Spreadsheet URL: {spreadsheet_url}")
        
        conn.close()
        
    except Exception as e:
        click.echo(f"ERROR: {e}")
        if config['verbose']:
            import traceback
            click.echo(traceback.format_exc())
        sys.exit(1)

@cli.command()
@click.option('--month', required=True, help='Month name (January, Aug, august) or number (1-12)')
@click.option('--year', type=int, default=None, help='Year (defaults to current year)')
@click.option('--spreadsheet-title', default=None, help='Spreadsheet title (auto-generated if not provided)')
@click.option('--credentials-path', type=str, default=None, help='Path to Google service account credentials JSON file')
@click.option('--dry-run', is_flag=True, help='Show what would be exported without executing')
@click.pass_context
def export_month(ctx, month, year, spreadsheet_title, credentials_path, dry_run):
    """Export campaign data for a specific month to multi-tab Google Sheet
    
    Creates a comprehensive 3-tab Google Sheet with campaign performance data for the specified month:
    - Performance Summary: Executive summary with campaign rankings
    - Daily Summary: Daily aggregated performance with growth tracking  
    - Hourly Data: Time-series hourly metrics for trend analysis
    
    Only includes campaigns with actual activity in the specified month.
    
    Examples:
      python main.py export-month --month August --year 2025
      python main.py export-month --month "July" --year 2025
      python main.py export-month --month 8 --year 2025
      python main.py export-month --month Dec  # Uses current year
    """
    config = ctx.obj
    
    try:
        # Set default year to current year if not provided
        if year is None:
            year = datetime.now(timezone.utc).year
        
        # Parse and validate month
        try:
            month_num = parse_month_string(month)
        except ValueError as e:
            click.echo(f"ERROR: {e}")
            sys.exit(1)
        
        # Validate year
        try:
            validate_year(year)
        except ValueError as e:
            click.echo(f"ERROR: {e}")
            sys.exit(1)
        
        # Calculate date range for the month
        start_date, end_date = get_month_date_range(month_num, year)
        
        # Generate title if not provided
        if not spreadsheet_title:
            month_name = get_month_name(month_num)
            spreadsheet_title = f"{month_name} {year} Campaign Performance"
        
        if dry_run:
            click.echo("DRY RUN: Would export month data to Google Sheets")
            click.echo(f"  Month: {get_month_name(month_num)} {year}")
            click.echo(f"  Date Range: {start_date} to {end_date}")
            click.echo(f"  Spreadsheet Title: {spreadsheet_title}")
            click.echo(f"  Tabs: Performance Summary, Daily Summary, Hourly Data")
            click.echo(f"  Database: {config['db_path']}")
            click.echo(f"  Filter: Only campaigns with activity in {get_month_name(month_num)} {year}")
            return
        
        # Call the generalized export-daterange function
        ctx.invoke(export_daterange, 
                   start_date=start_date, 
                   end_date=end_date,
                   spreadsheet_title=spreadsheet_title,
                   credentials_path=credentials_path,
                   dry_run=dry_run)
        
    except Exception as e:
        click.echo(f"ERROR: {e}")
        if config['verbose']:
            import traceback
            click.echo(traceback.format_exc())
        sys.exit(1)

def get_database_size(db_path):
    """Get human-readable database size"""
    try:
        size_bytes = Path(db_path).stat().st_size
        
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        else:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
    except:
        return "Unknown"

if __name__ == "__main__":
    cli()
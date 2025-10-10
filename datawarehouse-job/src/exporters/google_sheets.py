#!/usr/bin/env python3
"""
Google Sheets Exporter - Export processed data to Google Sheets with formatting
Supports hierarchical organization, custom formatting, and automatic spreadsheet creation
"""
import json
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from pathlib import Path

try:
    from google.oauth2.service_account import Credentials
    from google.auth import default
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    GOOGLE_SHEETS_AVAILABLE = True
except ImportError:
    GOOGLE_SHEETS_AVAILABLE = False

class GoogleSheetsExporter:
    """Export campaign performance data to Google Sheets with hierarchical formatting"""
    
    def __init__(self, credentials_path: Optional[str] = None):
        """
        Initialize Google Sheets exporter
        
        Args:
            credentials_path: Path to Google service account credentials JSON file
        """
        self.credentials_path = credentials_path
        self.service = None
        self.scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]
        
        # Column definitions for export
        self.columns = [
            {'header': 'Campaign Name', 'field': 'campaign_name', 'width': 250},
            {'header': 'Network', 'field': 'network', 'width': 120},
            {'header': 'Domain', 'field': 'domain', 'width': 150},
            {'header': 'Placement', 'field': 'placement', 'width': 120},
            {'header': 'Targeting', 'field': 'targeting', 'width': 150},
            {'header': 'Special', 'field': 'special', 'width': 100},
            {'header': 'Sessions', 'field': 'sessions', 'width': 90, 'format': 'number'},
            {'header': 'Registrations', 'field': 'registrations', 'width': 120, 'format': 'number'},
            {'header': "CC's", 'field': 'credit_cards', 'width': 80, 'format': 'number'},
            {'header': 'Reg%', 'field': 'reg_percentage', 'width': 80, 'format': 'percentage'},
            {'header': 'CC Conv%', 'field': 'cc_conv_percentage', 'width': 100, 'format': 'percentage'},
            {'header': 'Clicks:Reg', 'field': 'clicks_to_reg_ratio', 'width': 100, 'format': 'decimal'},
            {'header': 'Reg:CC', 'field': 'reg_to_cc_ratio', 'width': 80, 'format': 'decimal'}
        ]
    
    def authenticate(self) -> bool:
        """
        Authenticate with Google Sheets API using service account credentials or Application Default Credentials (ADC)
        
        Returns:
            True if authentication successful, False otherwise
        """
        if not GOOGLE_SHEETS_AVAILABLE:
            print("ERROR: Google Sheets API not available. Install: pip install google-api-python-client google-auth")
            return False
        
        try:
            # Try service account credentials first if path provided
            if self.credentials_path:
                credentials_file = Path(self.credentials_path)
                if credentials_file.exists():
                    try:
                        credentials = Credentials.from_service_account_file(
                            self.credentials_path, 
                            scopes=self.scopes
                        )
                        self.service = build('sheets', 'v4', credentials=credentials)
                        print("SUCCESS: Authenticated with Google Sheets API using service account")
                        return True
                    except Exception as e:
                        print(f"WARNING: Service account authentication failed: {e}")
                        print("Falling back to Application Default Credentials...")
            
            # Fall back to Application Default Credentials (ADC)
            credentials, project = default(scopes=self.scopes)
            self.service = build('sheets', 'v4', credentials=credentials)
            print("SUCCESS: Authenticated with Google Sheets API using Application Default Credentials")
            return True
            
        except Exception as e:
            print(f"ERROR: Failed to authenticate with Google Sheets: {e}")
            print("Make sure you have run 'gcloud auth application-default login'")
            return False
    
    def create_spreadsheet(self, title: str) -> Optional[str]:
        """
        Create a new Google Spreadsheet
        
        Args:
            title: Spreadsheet title
            
        Returns:
            Spreadsheet ID if successful, None otherwise
        """
        if not self.service:
            print("ERROR: Not authenticated with Google Sheets API")
            return None
        
        try:
            spreadsheet_body = {
                'properties': {
                    'title': title,
                    'locale': 'en_US',
                    'autoRecalc': 'ON_CHANGE',
                    'timeZone': 'America/New_York'
                },
                'sheets': [{
                    'properties': {
                        'title': 'Campaign Performance',
                        'gridProperties': {
                            'rowCount': 1000,
                            'columnCount': len(self.columns)
                        }
                    }
                }]
            }
            
            result = self.service.spreadsheets().create(body=spreadsheet_body).execute()
            spreadsheet_id = result['spreadsheetId']
            
            print(f"SUCCESS: Created spreadsheet '{title}' with ID: {spreadsheet_id}")
            print(f"Spreadsheet URL: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")
            
            return spreadsheet_id
            
        except HttpError as e:
            print(f"ERROR: Failed to create spreadsheet: {e}")
            return None
    
    def format_hierarchical_data(self, data: List[Dict[str, Any]]) -> List[List[Any]]:
        """
        Format campaign data into hierarchical rows for Google Sheets
        
        Args:
            data: List of campaign performance dictionaries
            
        Returns:
            List of rows ready for Google Sheets insertion
        """
        if not data:
            return []
        
        # Group data by hierarchy levels
        hierarchy_groups = {}
        
        for campaign in data:
            network = campaign.get('network', 'Unknown')
            domain = campaign.get('domain', 'Unknown')
            placement = campaign.get('placement', 'Unknown')
            targeting = campaign.get('targeting', 'Unknown')
            special = campaign.get('special', 'Unknown')
            
            # Create nested structure
            if network not in hierarchy_groups:
                hierarchy_groups[network] = {}
            if domain not in hierarchy_groups[network]:
                hierarchy_groups[network][domain] = {}
            if placement not in hierarchy_groups[network][domain]:
                hierarchy_groups[network][domain][placement] = {}
            if targeting not in hierarchy_groups[network][domain][placement]:
                hierarchy_groups[network][domain][placement][targeting] = {}
            if special not in hierarchy_groups[network][domain][placement][targeting]:
                hierarchy_groups[network][domain][placement][targeting][special] = []
            
            hierarchy_groups[network][domain][placement][targeting][special].append(campaign)
        
        # Build rows with hierarchical headers
        rows = []
        
        # Add header row
        header_row = [col['header'] for col in self.columns]
        rows.append(header_row)
        
        # Add hierarchical data rows
        for network in sorted(hierarchy_groups.keys()):
            # Network header
            network_row = [f"NETWORK: {network}"] + [""] * (len(self.columns) - 1)
            rows.append(network_row)
            
            for domain in sorted(hierarchy_groups[network].keys()):
                # Domain header (indented)
                domain_row = ["", f"DOMAIN: {domain}"] + [""] * (len(self.columns) - 2)
                rows.append(domain_row)
                
                for placement in sorted(hierarchy_groups[network][domain].keys()):
                    # Placement header (more indented)
                    placement_row = ["", "", f"PLACEMENT: {placement}"] + [""] * (len(self.columns) - 3)
                    rows.append(placement_row)
                    
                    for targeting in sorted(hierarchy_groups[network][domain][placement].keys()):
                        # Targeting header (more indented)
                        targeting_row = ["", "", "", f"TARGETING: {targeting}"] + [""] * (len(self.columns) - 4)
                        rows.append(targeting_row)
                        
                        for special in sorted(hierarchy_groups[network][domain][placement][targeting].keys()):
                            # Special header (most indented)
                            special_row = ["", "", "", "", f"SPECIAL: {special}"] + [""] * (len(self.columns) - 5)
                            rows.append(special_row)
                            
                            # Campaign data rows
                            campaigns = hierarchy_groups[network][domain][placement][targeting][special]
                            for campaign in sorted(campaigns, key=lambda x: x.get('campaign_name', '')):
                                campaign_row = []
                                for col in self.columns:
                                    value = campaign.get(col['field'], '')
                                    
                                    # Format values based on column type
                                    if col.get('format') == 'currency' and isinstance(value, (int, float)):
                                        campaign_row.append(f"${value:.2f}")
                                    elif col.get('format') == 'percentage' and isinstance(value, (int, float)):
                                        campaign_row.append(f"{value:.2f}%")
                                    elif col.get('format') == 'decimal' and isinstance(value, (int, float)):
                                        campaign_row.append(f"{value:.2f}")
                                    elif col.get('format') == 'number' and isinstance(value, (int, float)):
                                        campaign_row.append(int(value))
                                    else:
                                        campaign_row.append(str(value) if value is not None else '')
                                
                                rows.append(campaign_row)
                            
                            # Add spacing after each special group
                            rows.append([""] * len(self.columns))
        
        return rows
    
    def export_campaign_data(self, spreadsheet_id: str, data: List[Dict[str, Any]]) -> bool:
        """
        Export campaign performance data to Google Sheets
        
        Args:
            spreadsheet_id: Google Sheets spreadsheet ID
            data: Campaign performance data
            
        Returns:
            True if export successful, False otherwise
        """
        if not self.service:
            print("ERROR: Not authenticated with Google Sheets API")
            return False
        
        try:
            # Format data for hierarchical display
            print("Formatting data for hierarchical export...")
            rows = self.format_hierarchical_data(data)
            
            if not rows:
                print("WARNING: No data to export")
                return True
            
            # Clear existing data
            clear_request = {
                'range': 'Campaign Performance!A:Z'
            }
            self.service.spreadsheets().values().clear(
                spreadsheetId=spreadsheet_id, 
                range=clear_request['range']
            ).execute()
            
            # Insert new data
            body = {
                'values': rows,
                'majorDimension': 'ROWS'
            }
            
            result = self.service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range='Campaign Performance!A1',
                valueInputOption='USER_ENTERED',
                body=body
            ).execute()
            
            updated_cells = result.get('updatedCells', 0)
            print(f"SUCCESS: Updated {updated_cells} cells in Google Sheets")
            
            # Apply formatting
            self.apply_formatting(spreadsheet_id, len(rows))
            
            return True
            
        except HttpError as e:
            print(f"ERROR: Failed to export data to Google Sheets: {e}")
            return False
    
    def apply_formatting(self, spreadsheet_id: str, num_rows: int) -> bool:
        """
        Apply formatting to the Google Sheets spreadsheet
        
        Args:
            spreadsheet_id: Google Sheets spreadsheet ID
            num_rows: Number of rows with data
            
        Returns:
            True if formatting successful, False otherwise
        """
        if not self.service:
            return False
        
        try:
            requests = []
            
            # Format header row (bold, frozen)
            requests.append({
                'repeatCell': {
                    'range': {
                        'sheetId': 0,
                        'startRowIndex': 0,
                        'endRowIndex': 1,
                        'startColumnIndex': 0,
                        'endColumnIndex': len(self.columns)
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'textFormat': {'bold': True},
                            'backgroundColor': {'red': 0.9, 'green': 0.9, 'blue': 0.9}
                        }
                    },
                    'fields': 'userEnteredFormat(textFormat,backgroundColor)'
                }
            })
            
            # Freeze header row
            requests.append({
                'updateSheetProperties': {
                    'properties': {
                        'sheetId': 0,
                        'gridProperties': {
                            'frozenRowCount': 1
                        }
                    },
                    'fields': 'gridProperties.frozenRowCount'
                }
            })
            
            # Set column widths
            for i, col in enumerate(self.columns):
                requests.append({
                    'updateDimensionProperties': {
                        'range': {
                            'sheetId': 0,
                            'dimension': 'COLUMNS',
                            'startIndex': i,
                            'endIndex': i + 1
                        },
                        'properties': {
                            'pixelSize': col.get('width', 100)
                        },
                        'fields': 'pixelSize'
                    }
                })
            
            # Apply batch updates
            batch_update_request = {'requests': requests}
            
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=spreadsheet_id,
                body=batch_update_request
            ).execute()
            
            print("SUCCESS: Applied formatting to spreadsheet")
            return True
            
        except HttpError as e:
            print(f"ERROR: Failed to apply formatting: {e}")
            return False
    
    def export_to_google_sheets(self, data: List[Dict[str, Any]], 
                              title: str = "Campaign Performance Report", 
                              credentials_path: Optional[str] = None) -> Optional[str]:
        """
        Complete export workflow: authenticate, create spreadsheet, and export data
        
        Args:
            data: Campaign performance data to export
            title: Spreadsheet title
            credentials_path: Path to Google service account credentials
            
        Returns:
            Spreadsheet ID if successful, None otherwise
        """
        if credentials_path:
            self.credentials_path = credentials_path
        
        # Authenticate
        if not self.authenticate():
            return None
        
        # Create spreadsheet
        spreadsheet_id = self.create_spreadsheet(title)
        if not spreadsheet_id:
            return None
        
        # Export data
        if not self.export_campaign_data(spreadsheet_id, data):
            print("ERROR: Failed to export campaign data")
            return None
        
        print(f"SUCCESS: Export completed to Google Sheets")
        print(f"Spreadsheet URL: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")
        
        return spreadsheet_id
    
    def get_setup_instructions(self) -> str:
        """
        Get instructions for setting up Google Sheets API access
        
        Returns:
            Setup instructions as formatted string
        """
        instructions = """
Google Sheets Export Setup Instructions:

1. Install required packages:
   pip install google-api-python-client google-auth

2. Create Google Cloud Project:
   - Go to https://console.cloud.google.com/
   - Create a new project or select existing one
   - Enable Google Sheets API and Google Drive API

3. Create Service Account:
   - Go to IAM & Admin > Service Accounts
   - Create new service account
   - Download JSON credentials file

4. Share spreadsheet access (if needed):
   - Use the service account email from the JSON file
   - Share target spreadsheets with this email

5. Set credentials path:
   - Save JSON file securely (e.g., config/google_credentials.json)
   - Use --credentials-path flag or set in configuration

Example usage:
   python main.py export --format google_sheets --credentials-path config/google_credentials.json
        """
        
        return instructions.strip()
    
    
    def create_daterange_export(self, hourly_data: List[Dict], daily_data: List[Dict], 
                               summary_data: List[Dict], title: str, start_date: str, end_date: str) -> str:
        """
        Create multi-tab Google Sheet for date range campaign performance analysis
        
        Args:
            hourly_data: List of hourly data records
            daily_data: List of daily aggregated records  
            summary_data: List of campaign summary records
            title: Spreadsheet title
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            
        Returns:
            URL of created spreadsheet
        """
        try:
            print(f"Creating Google Sheet: {title}")
            
            # Generate simple tab names (avoid spaces and special characters)
            if start_date == end_date:
                date_suffix = f"_{start_date.replace('-', '')}"
            else:
                start_short = start_date.replace('-', '')
                end_short = end_date.replace('-', '')
                date_suffix = f"_{start_short}_to_{end_short}"
            
            # Create spreadsheet with 3 tabs
            spreadsheet_body = {
                'properties': {'title': title},
                'sheets': [
                    {'properties': {'title': f'Performance_Summary{date_suffix}', 'index': 0}},
                    {'properties': {'title': f'Daily_Summary{date_suffix}', 'index': 1}}, 
                    {'properties': {'title': f'Hourly_Data{date_suffix}', 'index': 2}}
                ]
            }
            
            result = self.service.spreadsheets().create(body=spreadsheet_body).execute()
            spreadsheet_id = result['spreadsheetId']
            spreadsheet_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}"
            
            print(f"Created spreadsheet with ID: {spreadsheet_id}")
            
            # Get sheet IDs from the result
            sheet_ids = {}
            for sheet in result['sheets']:
                sheet_title = sheet['properties']['title']
                sheet_id = sheet['properties']['sheetId']
                sheet_ids[sheet_title] = sheet_id
            
            # Create each tab with date-aware methods
            self._create_daterange_summary_tab(spreadsheet_id, summary_data, start_date, end_date, sheet_ids)
            self._create_daterange_daily_tab(spreadsheet_id, daily_data, start_date, end_date, sheet_ids)
            self._create_daterange_hourly_tab(spreadsheet_id, hourly_data, start_date, end_date, sheet_ids)
            
            return spreadsheet_url
            
        except Exception as e:
            print(f"ERROR: Failed to create date range export: {e}")
            raise
    
    def _create_daterange_summary_tab(self, spreadsheet_id: str, data: List[Dict], start_date: str, end_date: str, sheet_ids: Dict[str, int]) -> None:
        """Create date range Performance summary tab"""
        try:
            print(f"Creating Performance Summary tab for {start_date} to {end_date}...")
            
            # Headers for summary tab
            headers = [
                'Campaign Name', 'Network', 'Domain', 'Total Sessions', 'Total Registrations', 
                'Total Credit Cards', 'Reg %', 'CC Conv %', 'Avg Daily Sessions', 
                'Avg Daily Regs', 'Active Days', 'First Activity', 'Last Activity'
            ]
            
            # Build rows
            rows = [headers]
            
            for campaign in data:
                row = [
                    campaign.get('campaign_name', ''),
                    campaign.get('network', ''),
                    campaign.get('domain', ''),
                    campaign.get('total_sessions', 0),
                    campaign.get('total_registrations', 0),
                    campaign.get('total_credit_cards', 0),
                    f"{campaign.get('reg_percentage', 0)}%",
                    f"{campaign.get('cc_conv_percentage', 0)}%",
                    campaign.get('avg_daily_sessions', 0),
                    campaign.get('avg_daily_registrations', 0),
                    campaign.get('active_days', 0),
                    campaign.get('first_activity', ''),
                    campaign.get('last_activity', '')
                ]
                rows.append(row)
            
            # Add totals row
            total_sessions = sum(c.get('total_sessions', 0) for c in data)
            total_regs = sum(c.get('total_registrations', 0) for c in data)
            total_ccs = sum(c.get('total_credit_cards', 0) for c in data)
            
            totals_row = [
                'TOTALS', '', '', total_sessions, total_regs, total_ccs,
                f"{(total_regs/total_sessions*100):.2f}%" if total_sessions > 0 else "0%",
                f"{(total_ccs/total_regs*100):.2f}%" if total_regs > 0 else "0%",
                '', '', '', '', ''
            ]
            rows.append(totals_row)
            
            # Update sheet - use actual sheet name and ID
            sheet_name = f'Performance_Summary_{start_date.replace("-", "")}_to_{end_date.replace("-", "")}'
            self._update_sheet_data(spreadsheet_id, f'{sheet_name}!A1', rows)
            sheet_id = sheet_ids[sheet_name]
            self._format_summary_sheet(spreadsheet_id, len(rows), len(headers), sheet_id)
            
        except Exception as e:
            print(f"ERROR: Failed to create date range summary tab: {e}")
            raise
    
    def _create_daterange_daily_tab(self, spreadsheet_id: str, data: List[Dict], start_date: str, end_date: str, sheet_ids: Dict[str, int]) -> None:
        """Create date range Daily Summary tab"""
        try:
            print(f"Creating Daily Summary tab for {start_date} to {end_date}...")
            
            headers = [
                'Date', 'Campaign Name', 'Network', 'Domain', 'Daily Sessions', 
                'Daily Registrations', 'Daily Credit Cards', 'Reg %', 'CC Conv %', 
                'Daily Growth %', 'Hours Active'
            ]
            
            rows = [headers]
            
            for record in data:
                row = [
                    record.get('date', ''),
                    record.get('campaign_name', ''),
                    record.get('network', ''),
                    record.get('domain', ''),
                    record.get('daily_sessions', 0),
                    record.get('daily_registrations', 0),
                    record.get('daily_credit_cards', 0),
                    f"{record.get('reg_percentage', 0)}%",
                    f"{record.get('cc_conv_percentage', 0)}%",
                    f"{record.get('daily_growth_pct', 0)}%",
                    record.get('hours_active', 0)
                ]
                rows.append(row)
            
            sheet_name = f'Daily_Summary_{start_date.replace("-", "")}_to_{end_date.replace("-", "")}'
            self._update_sheet_data(spreadsheet_id, f'{sheet_name}!A1', rows)
            sheet_id = sheet_ids[sheet_name]
            self._format_daily_sheet(spreadsheet_id, len(rows), len(headers), sheet_id)
            
        except Exception as e:
            print(f"ERROR: Failed to create date range daily summary tab: {e}")
            raise
    
    def _create_daterange_hourly_tab(self, spreadsheet_id: str, data: List[Dict], start_date: str, end_date: str, sheet_ids: Dict[str, int]) -> None:
        """Create date range Hourly Data tab"""
        try:
            print(f"Creating Hourly Data tab for {start_date} to {end_date}...")
            
            headers = [
                'Date', 'Hour', 'Campaign Name', 'Network', 'Domain', 'Sessions', 
                'Registrations', 'Credit Cards', 'Reg %', 'CC Conv %'
            ]
            
            rows = [headers]
            
            for record in data:
                row = [
                    record.get('date', ''),
                    record.get('hour', ''),
                    record.get('campaign_name', ''),
                    record.get('network', ''),
                    record.get('domain', ''),
                    record.get('sessions', 0),
                    record.get('registrations', 0),
                    record.get('credit_cards', 0),
                    f"{record.get('reg_percentage', 0)}%",
                    f"{record.get('cc_conv_percentage', 0)}%"
                ]
                rows.append(row)
            
            sheet_name = f'Hourly_Data_{start_date.replace("-", "")}_to_{end_date.replace("-", "")}'
            self._update_sheet_data(spreadsheet_id, f'{sheet_name}!A1', rows)
            sheet_id = sheet_ids[sheet_name]
            self._format_hourly_sheet(spreadsheet_id, len(rows), len(headers), sheet_id)
            
        except Exception as e:
            print(f"ERROR: Failed to create date range hourly data tab: {e}")
            raise
    
    
    def _update_sheet_data(self, spreadsheet_id: str, range_name: str, rows: List[List]) -> None:
        """Update sheet with data"""
        body = {
            'values': rows
        }
        self.service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            valueInputOption='USER_ENTERED',
            body=body
        ).execute()
    
    def _format_summary_sheet(self, spreadsheet_id: str, num_rows: int, num_cols: int, sheet_id: int = 0) -> None:
        """Apply formatting to August Performance tab"""
        requests = [
            # Header formatting
            {
                'repeatCell': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 0,
                        'endRowIndex': 1,
                        'startColumnIndex': 0,
                        'endColumnIndex': num_cols
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.2, 'green': 0.6, 'blue': 1.0},
                            'textFormat': {'bold': True, 'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}}
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat)'
                }
            },
            # Totals row formatting
            {
                'repeatCell': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': num_rows - 1,
                        'endRowIndex': num_rows,
                        'startColumnIndex': 0,
                        'endColumnIndex': num_cols
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.9, 'green': 0.9, 'blue': 0.9},
                            'textFormat': {'bold': True}
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat)'
                }
            }
        ]
        
        self._apply_formatting(spreadsheet_id, requests)
    
    def _format_daily_sheet(self, spreadsheet_id: str, num_rows: int, num_cols: int, sheet_id: int = 1) -> None:
        """Apply formatting to Daily Summary tab"""
        requests = [
            {
                'repeatCell': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 0,
                        'endRowIndex': 1,
                        'startColumnIndex': 0,
                        'endColumnIndex': num_cols
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.2, 'green': 0.8, 'blue': 0.6},
                            'textFormat': {'bold': True, 'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}}
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat)'
                }
            }
        ]
        
        self._apply_formatting(spreadsheet_id, requests)
    
    def _format_hourly_sheet(self, spreadsheet_id: str, num_rows: int, num_cols: int, sheet_id: int = 2) -> None:
        """Apply formatting to Hourly Data tab"""
        requests = [
            {
                'repeatCell': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 0,
                        'endRowIndex': 1,
                        'startColumnIndex': 0,
                        'endColumnIndex': num_cols
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {'red': 0.8, 'green': 0.6, 'blue': 0.2},
                            'textFormat': {'bold': True, 'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}}
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat)'
                }
            }
        ]
        
        self._apply_formatting(spreadsheet_id, requests)
    
    def _apply_formatting(self, spreadsheet_id: str, requests: List[Dict]) -> None:
        """Apply formatting requests to spreadsheet"""
        body = {'requests': requests}
        self.service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body=body
        ).execute()

def export_to_google_sheets_simple(data: List[Dict[str, Any]], 
                                 credentials_path: str,
                                 title: str = "Campaign Performance Report") -> Optional[str]:
    """
    Simple function to export data to Google Sheets
    
    Args:
        data: Campaign performance data
        credentials_path: Path to Google service account credentials JSON
        title: Spreadsheet title
        
    Returns:
        Spreadsheet ID if successful, None otherwise
    """
    exporter = GoogleSheetsExporter(credentials_path)
    return exporter.export_to_google_sheets(data, title, credentials_path)
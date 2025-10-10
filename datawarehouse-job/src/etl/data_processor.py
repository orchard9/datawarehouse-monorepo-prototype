#!/usr/bin/env python3
"""
Data Processor - Calculate derived metrics from raw API data
Handles cost metrics, conversion rates, and performance calculations
"""
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
import math

class DataProcessor:
    """Processes raw API data and calculates derived metrics"""
    
    def __init__(self, db_ops):
        """
        Initialize data processor
        
        Args:
            db_ops: DatabaseOperations instance
        """
        self.db_ops = db_ops
        
        # Default assumptions for missing data
        self.default_click_rate = 0.15  # 15% click rate assumption
        
    
    
    def calculate_conversion_ratios(self, report_data: Dict[str, Any]) -> Dict[str, float]:
        """
        Calculate conversion rates and ratios
        
        Args:
            report_data: Dictionary with registration report data
            
        Returns:
            Dictionary with calculated conversion metrics
        """
        sessions = report_data.get('sessions', 0)
        registrations = report_data.get('registrations', 0)
        credit_cards = report_data.get('credit_cards', 0)
        
        # Calculate registration percentage (Reg%)
        reg_percentage = self.calculate_reg_percentage(sessions, registrations)
        
        # Calculate credit card conversion percentage (CC Conv%)
        cc_conv_percentage = self.calculate_cc_conv_percentage(registrations, credit_cards)
        
        # Calculate clicks to registration ratio (Clicks:Reg)
        estimated_clicks = self.estimate_clicks_from_sessions(sessions)
        clicks_to_reg_ratio = self.calculate_clicks_to_reg_ratio(estimated_clicks, registrations)
        
        # Calculate registration to credit card ratio (Reg:CC)
        reg_to_cc_ratio = self.calculate_reg_to_cc_ratio(registrations, credit_cards)
        
        return {
            'reg_percentage': reg_percentage,
            'cc_conv_percentage': cc_conv_percentage,
            'clicks_to_reg_ratio': clicks_to_reg_ratio,
            'reg_to_cc_ratio': reg_to_cc_ratio
        }
    
    def calculate_reg_percentage(self, sessions: int, registrations: int) -> float:
        """Calculate registration percentage (Reg%)"""
        if sessions <= 0:
            return 0.0
        return round((registrations / sessions) * 100, 2)
    
    def calculate_cc_conv_percentage(self, registrations: int, credit_cards: int) -> float:
        """Calculate credit card conversion percentage (CC Conv%)"""
        if registrations <= 0:
            return 0.0
        return round((credit_cards / registrations) * 100, 2)
    
    def calculate_clicks_to_reg_ratio(self, clicks: int, registrations: int) -> float:
        """Calculate clicks to registration ratio (Clicks:Reg)"""
        if registrations <= 0:
            return 0.0
        return round(clicks / registrations, 2)
    
    def calculate_reg_to_cc_ratio(self, registrations: int, credit_cards: int) -> float:
        """Calculate registration to credit card ratio (Reg:CC)"""
        if credit_cards <= 0:
            return 0.0
        return round(registrations / credit_cards, 2)
    
    
    def estimate_clicks_from_sessions(self, sessions: int) -> int:
        """
        Estimate clicks from sessions using industry average click-to-session rate
        
        Args:
            sessions: Number of sessions
            
        Returns:
            Estimated number of clicks
        """
        if sessions <= 0:
            return 0
        
        # Assume click rate (sessions/clicks ratio)
        estimated_clicks = math.ceil(sessions / self.default_click_rate)
        return estimated_clicks
    
    def aggregate_campaign_performance(self, campaign_id: int) -> Dict[str, Any]:
        """
        Aggregate all performance data for a single campaign
        
        Args:
            campaign_id: Campaign ID to aggregate
            
        Returns:
            Complete performance summary for the campaign
        """
        try:
            print(f"DEBUG AGGREGATION: Starting aggregation for campaign {campaign_id}")
            
            # Get campaign basic info
            campaign = self.db_ops.get_campaign_by_id(campaign_id)
            if not campaign:
                print(f"DEBUG AGGREGATION: Campaign {campaign_id} not found in database")
                raise ValueError(f"Campaign {campaign_id} not found")
            
            print(f"DEBUG AGGREGATION: Found campaign: {campaign.get('name', 'Unknown')}")
            
            # Metrics snapshots removed - using only hourly data
            print(f"DEBUG AGGREGATION: Using only hourly data (metrics_snapshots removed)")
            
            # Registration reports system removed - using hourly data only
            latest_report = {}
            
            # Get comprehensive hourly data (all metrics in one table)
            hourly_data = self.db_ops.get_hourly_data(campaign_id=campaign_id)
            print(f"DEBUG AGGREGATION: Found {len(hourly_data)} hourly data records for campaign {campaign_id}")
            
            # Aggregate hourly data (last 24 hours)
            import time
            current_hour = int(time.time() // 3600)
            hours_24_ago = current_hour - 24
            
            recent_hourly = [h for h in hourly_data if h['unix_hour'] >= hours_24_ago]
            print(f"DEBUG AGGREGATION: Using {len(recent_hourly)} recent hourly records (last 24h)")
            
            # Sum up hourly data for comprehensive metrics
            hourly_totals = {
                # Registration data
                'sessions': sum(h.get('sessions', 0) for h in recent_hourly),
                'credit_cards': sum(h.get('credit_cards', 0) for h in recent_hourly), 
                'email_accounts': sum(h.get('email_accounts', 0) for h in recent_hourly),
                'google_accounts': sum(h.get('google_accounts', 0) for h in recent_hourly),
                'total_accounts': sum(h.get('total_accounts', 0) for h in recent_hourly),
                'registrations': sum(h.get('registrations', 0) for h in recent_hourly),
                
                # Messages data
                'messages': sum(h.get('messages', 0) for h in recent_hourly),
                'companion_chats': sum(h.get('companion_chats', 0) for h in recent_hourly),
                'chat_room_user_chats': sum(h.get('chat_room_user_chats', 0) for h in recent_hourly),
                'total_user_chats': sum(h.get('total_user_chats', 0) for h in recent_hourly),
                
                # Other metrics
                'media': sum(h.get('media', 0) for h in recent_hourly),
                'payment_methods': sum(h.get('payment_methods', 0) for h in recent_hourly),
                'converted_users': sum(h.get('converted_users', 0) for h in recent_hourly),
                'terms_acceptances': sum(h.get('terms_acceptances', 0) for h in recent_hourly)
            }
            
            print(f"DEBUG AGGREGATION: Hourly totals (24h): {hourly_totals}")
            
            # Get hierarchy mapping
            hierarchy = self.db_ops.get_campaign_hierarchy(campaign_id=campaign_id)
            print(f"DEBUG AGGREGATION: Found {len(hierarchy)} hierarchy records for campaign {campaign_id}")
            hierarchy_data = hierarchy[0] if hierarchy else {}
            
            # Use only hourly data as single source of truth
            print(f"DEBUG AGGREGATION: Using only hourly data (single source of truth)")
            
            combined_data = {
                'campaign_name': campaign.get('name', 'Unknown'),
                # All metrics from hourly aggregated data only
                'sessions': hourly_totals['sessions'],
                'registrations': hourly_totals['registrations'],
                'credit_cards': hourly_totals['credit_cards'],
                'google_accounts': hourly_totals['google_accounts'],
                'email_accounts': hourly_totals['email_accounts'],
                'total_accounts': hourly_totals['total_accounts'],
                'messages': hourly_totals['messages'],
                'companion_chats': hourly_totals['companion_chats'],
                'total_user_chats': hourly_totals['total_user_chats'],
                'media': hourly_totals['media'],
                'payment_methods': hourly_totals['payment_methods'],
                'converted_users': hourly_totals['converted_users'],
                'terms_acceptances': hourly_totals['terms_acceptances']
            }
            
            # Calculate conversion ratios
            conversion_metrics = self.calculate_conversion_ratios(combined_data)
            
            # Build final result
            result = {
                # Campaign info
                'campaign_id': campaign_id,
                'campaign_name': campaign.get('name', 'Unknown'),
                
                # Hierarchy
                'network': hierarchy_data.get('network', 'Unknown'),
                'domain': hierarchy_data.get('domain', 'Unknown'),
                'placement': hierarchy_data.get('placement', 'Unknown'),
                'targeting': hierarchy_data.get('targeting', 'Unknown'),
                'special': hierarchy_data.get('special', 'Unknown'),
                
                # Base metrics from hourly aggregation only
                'sessions': hourly_totals['sessions'],
                'registrations': hourly_totals['registrations'],
                'credit_cards': hourly_totals['credit_cards'],
                
                # Conversion metrics
                'reg_percentage': conversion_metrics['reg_percentage'],
                'cc_conv_percentage': conversion_metrics['cc_conv_percentage'],
                'clicks_to_reg_ratio': conversion_metrics['clicks_to_reg_ratio'],
                'reg_to_cc_ratio': conversion_metrics['reg_to_cc_ratio'],
                
                # Metadata
                'processed_at': datetime.now(timezone.utc).isoformat(),
                'data_quality_score': self.calculate_data_quality_score(combined_data)
            }
            
            return result
            
        except Exception as e:
            print(f"ERROR: Failed to aggregate campaign {campaign_id}: {e}")
            return self.get_error_result(campaign_id, str(e))
    
    def aggregate_all_campaigns_performance(self) -> List[Dict[str, Any]]:
        """
        Aggregate performance data for all campaigns
        
        Returns:
            List of campaign performance summaries
        """
        print("PROCESSING: Aggregating performance for all campaigns...")
        
        try:
            # Get all campaigns
            campaigns = self.db_ops.get_campaigns()
            
            if not campaigns:
                print("WARNING: No campaigns found in database")
                return []
            
            results = []
            
            for i, campaign in enumerate(campaigns):
                campaign_id = campaign['id']
                
                try:
                    result = self.aggregate_campaign_performance(campaign_id)
                    results.append(result)
                    
                    # Progress indicator
                    if (i + 1) % 10 == 0 or (i + 1) == len(campaigns):
                        print(f"  Processed {i + 1}/{len(campaigns)} campaigns")
                        
                except Exception as e:
                    print(f"ERROR: Failed to process campaign {campaign_id}: {e}")
                    results.append(self.get_error_result(campaign_id, str(e)))
            
            print(f"SUCCESS: Aggregated performance for {len(results)} campaigns")
            return results
            
        except Exception as e:
            print(f"ERROR: Failed to aggregate campaigns performance: {e}")
            return []

    def aggregate_daily_campaign_performance(self, campaign_ids: List[int] = None) -> List[Dict[str, Any]]:
        """
        Aggregate performance data by day for campaigns - creates one record per campaign per day
        
        Args:
            campaign_ids: Optional list of campaign IDs to process (None = all campaigns)
            
        Returns:
            List of daily campaign performance records
        """
        print("PROCESSING: Aggregating daily performance for campaigns...")
        
        try:
            # Get campaigns to process
            if campaign_ids:
                campaigns = [{'id': cid} for cid in campaign_ids]
                # Get campaign names
                for camp in campaigns:
                    camp_data = self.db_ops.get_campaigns(campaign_id=camp['id'])
                    camp['name'] = camp_data[0]['name'] if camp_data else f"Campaign {camp['id']}"
            else:
                campaigns = self.db_ops.get_campaigns()
            
            if not campaigns:
                print("WARNING: No campaigns found in database")
                return []
            
            results = []
            
            # Get all hourly data to determine date range
            all_hourly_data = self.db_ops.get_hourly_data()
            if not all_hourly_data:
                print("WARNING: No hourly data found")
                return []
            
            # Convert unix_hour to date and find unique dates
            from datetime import datetime, timezone
            unique_dates = set()
            for record in all_hourly_data:
                date_obj = datetime.fromtimestamp(record['unix_hour'] * 3600, tz=timezone.utc)
                date_str = date_obj.strftime('%Y-%m-%d')
                unique_dates.add(date_str)
            
            unique_dates = sorted(unique_dates)
            print(f"Found data for {len(unique_dates)} unique dates: {unique_dates[0]} to {unique_dates[-1]}")
            
            # Process each campaign for each date
            for campaign in campaigns:
                campaign_id = campaign['id']
                campaign_name = campaign.get('name', f"Campaign {campaign_id}")
                
                # Get hierarchy data for this campaign
                hierarchy = self.db_ops.get_campaign_hierarchy(campaign_id=campaign_id)
                hierarchy_data = hierarchy[0] if hierarchy else {}
                
                # Get all hourly data for this campaign
                campaign_hourly_data = self.db_ops.get_hourly_data(campaign_id=campaign_id)
                
                # Group hourly data by date
                daily_groups = {}
                for record in campaign_hourly_data:
                    date_obj = datetime.fromtimestamp(record['unix_hour'] * 3600, tz=timezone.utc)
                    date_str = date_obj.strftime('%Y-%m-%d')
                    
                    if date_str not in daily_groups:
                        daily_groups[date_str] = []
                    daily_groups[date_str].append(record)
                
                # Create a record for each date (even if no data)
                for date_str in unique_dates:
                    daily_records = daily_groups.get(date_str, [])
                    
                    # Sum up hourly data for this date
                    daily_totals = {
                        'sessions': sum(h.get('sessions', 0) for h in daily_records),
                        'credit_cards': sum(h.get('credit_cards', 0) for h in daily_records), 
                        'email_accounts': sum(h.get('email_accounts', 0) for h in daily_records),
                        'google_accounts': sum(h.get('google_accounts', 0) for h in daily_records),
                        'total_accounts': sum(h.get('total_accounts', 0) for h in daily_records),
                        'registrations': sum(h.get('registrations', 0) for h in daily_records),
                        'messages': sum(h.get('messages', 0) for h in daily_records),
                        'companion_chats': sum(h.get('companion_chats', 0) for h in daily_records),
                        'chat_room_user_chats': sum(h.get('chat_room_user_chats', 0) for h in daily_records),
                        'total_user_chats': sum(h.get('total_user_chats', 0) for h in daily_records),
                        'media': sum(h.get('media', 0) for h in daily_records),
                        'payment_methods': sum(h.get('payment_methods', 0) for h in daily_records),
                        'converted_users': sum(h.get('converted_users', 0) for h in daily_records),
                        'terms_acceptances': sum(h.get('terms_acceptances', 0) for h in daily_records)
                    }
                    
                    # Calculate conversion ratios
                    conversion_metrics = self.calculate_conversion_ratios(daily_totals)
                    
                    # Build daily result record
                    result = {
                        # Date and campaign info
                        'date': date_str,
                        'campaign_id': campaign_id,
                        'campaign_name': campaign_name,
                        
                        # Hierarchy
                        'network': hierarchy_data.get('network', 'Unknown'),
                        'domain': hierarchy_data.get('domain', 'Unknown'),
                        'placement': hierarchy_data.get('placement', 'Unknown'),
                        'targeting': hierarchy_data.get('targeting', 'Unknown'),
                        'special': hierarchy_data.get('special', 'Unknown'),
                        
                        # Base metrics
                        'sessions': daily_totals['sessions'],
                        'registrations': daily_totals['registrations'],
                        'credit_cards': daily_totals['credit_cards'],
                        'email_accounts': daily_totals['email_accounts'],
                        'google_accounts': daily_totals['google_accounts'],
                        'total_accounts': daily_totals['total_accounts'],
                        'messages': daily_totals['messages'],
                        'companion_chats': daily_totals['companion_chats'],
                        'total_user_chats': daily_totals['total_user_chats'],
                        'media': daily_totals['media'],
                        'payment_methods': daily_totals['payment_methods'],
                        'converted_users': daily_totals['converted_users'],
                        'terms_acceptances': daily_totals['terms_acceptances'],
                        
                        # Conversion metrics
                        'reg_percentage': conversion_metrics['reg_percentage'],
                        'cc_conv_percentage': conversion_metrics['cc_conv_percentage'],
                        'clicks_to_reg_ratio': conversion_metrics['clicks_to_reg_ratio'],
                        'reg_to_cc_ratio': conversion_metrics['reg_to_cc_ratio'],
                        
                        # Metadata
                        'hourly_records_count': len(daily_records),
                        'processed_at': datetime.now(timezone.utc).isoformat(),
                        'data_quality_score': self.calculate_data_quality_score(daily_totals)
                    }
                    
                    results.append(result)
            
            print(f"SUCCESS: Generated {len(results)} daily records for {len(campaigns)} campaigns across {len(unique_dates)} dates")
            return results
            
        except Exception as e:
            print(f"ERROR: Failed to aggregate daily campaigns performance: {e}")
            import traceback
            print(traceback.format_exc())
            return []
    
    def calculate_data_quality_score(self, data: Dict[str, Any]) -> float:
        """
        Calculate data quality score based on completeness and consistency
        
        Args:
            data: Campaign data dictionary
            
        Returns:
            Quality score between 0.0 and 1.0
        """
        score = 1.0
        
        # Check for missing critical data
        critical_fields = ['sessions', 'registrations', 'credit_cards']
        missing_critical = sum(1 for field in critical_fields if data.get(field, 0) == 0)
        score -= missing_critical * 0.2
        
        # Check for suspicious conversion rates
        sessions = data.get('sessions', 0)
        registrations = data.get('registrations', 0)
        
        if sessions > 0:
            reg_rate = registrations / sessions
            if reg_rate > 0.5:  # Suspiciously high conversion
                score -= 0.3
            elif reg_rate < 0.001:  # Suspiciously low conversion
                score -= 0.2
        
        # Check for data consistency
        if registrations > sessions:  # Impossible scenario
            score -= 0.5
        
        return max(0.0, min(1.0, score))
    
    def get_error_result(self, campaign_id: int, error_message: str) -> Dict[str, Any]:
        """
        Create error result for failed campaign processing
        
        Args:
            campaign_id: Campaign ID that failed
            error_message: Error description
            
        Returns:
            Error result dictionary
        """
        return {
            'campaign_id': campaign_id,
            'campaign_name': f'Error - Campaign {campaign_id}',
            'network': 'Error',
            'domain': 'Error',
            'placement': 'Error',
            'targeting': 'Error',
            'special': 'Error',
            'sessions': 0,
            'registrations': 0,
            'credit_cards': 0,
            'reg_percentage': 0.0,
            'cc_conv_percentage': 0.0,
            'clicks_to_reg_ratio': 0.0,
            'reg_to_cc_ratio': 0.0,
            'processed_at': datetime.now(timezone.utc).isoformat(),
            'data_quality_score': 0.0,
            'error': error_message
        }
    
    def validate_data_quality(self, performance_data: List[Dict[str, Any]]) -> List[str]:
        """
        Validate data quality across all campaign performance data
        
        Args:
            performance_data: List of campaign performance summaries
            
        Returns:
            List of data quality warnings/issues
        """
        warnings = []
        
        if not performance_data:
            warnings.append("No performance data to validate")
            return warnings
        
        # Check for campaigns with errors
        error_campaigns = [d for d in performance_data if 'error' in d]
        if error_campaigns:
            warnings.append(f"{len(error_campaigns)} campaigns failed processing")
        
        # Check for low data quality scores
        low_quality = [d for d in performance_data if d.get('data_quality_score', 0) < 0.5]
        if low_quality:
            warnings.append(f"{len(low_quality)} campaigns have low data quality scores")
        
        # Check for unmapped campaigns
        unmapped = [d for d in performance_data if d.get('network') == 'Unknown']
        if unmapped:
            unmapped_names = [d.get('campaign_name', 'Unknown') for d in unmapped[:10]]  # Show first 10
            warning_msg = f"{len(unmapped)} campaigns are unmapped in hierarchy"
            if len(unmapped) <= 10:
                warning_msg += f": {', '.join(unmapped_names)}"
            else:
                warning_msg += f" (first 10: {', '.join(unmapped_names)}...)"
            warnings.append(warning_msg)
        
        # Check for zero-session campaigns
        zero_sessions = [d for d in performance_data if d.get('sessions', 0) == 0]
        if zero_sessions:
            warnings.append(f"{len(zero_sessions)} campaigns have zero sessions")
        
        # Check for suspicious conversion rates
        high_conversion = [d for d in performance_data if d.get('reg_percentage', 0) > 50]
        if high_conversion:
            warnings.append(f"{len(high_conversion)} campaigns have suspiciously high conversion rates (>50%)")
        
        return warnings
    
    def get_unmapped_campaigns(self) -> List[Dict[str, Any]]:
        """
        Get list of campaigns that are unmapped in hierarchy
        
        Returns:
            List of unmapped campaign details
        """
        try:
            performance_data = self.aggregate_all_campaigns_performance()
            unmapped = [d for d in performance_data if d.get('network') == 'Unknown']
            
            # Return simplified campaign info for unmapped campaigns
            unmapped_campaigns = []
            for campaign in unmapped:
                unmapped_campaigns.append({
                    'id': campaign.get('campaign_id'),
                    'name': campaign.get('campaign_name', 'Unknown'),
                    'sessions': campaign.get('sessions', 0),
                    'registrations': campaign.get('registrations', 0),
                    'confidence': campaign.get('mapping_confidence', 0.0)
                })
            
            return unmapped_campaigns
            
        except Exception as e:
            print(f"ERROR: Failed to get unmapped campaigns: {e}")
            return []
    
    def get_processing_statistics(self, performance_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Get statistics about processed campaign data
        
        Args:
            performance_data: List of campaign performance summaries
            
        Returns:
            Statistics dictionary
        """
        if not performance_data:
            return {'total_campaigns': 0}
        
        total_campaigns = len(performance_data)
        successful_campaigns = len([d for d in performance_data if 'error' not in d])
        
        # Calculate totals
        total_sessions = sum(d.get('sessions', 0) for d in performance_data)
        total_registrations = sum(d.get('registrations', 0) for d in performance_data)
        total_credit_cards = sum(d.get('credit_cards', 0) for d in performance_data)
        
        # Calculate averages
        avg_reg_rate = sum(d.get('reg_percentage', 0) for d in performance_data) / total_campaigns
        avg_cc_rate = sum(d.get('cc_conv_percentage', 0) for d in performance_data) / total_campaigns
        avg_quality_score = sum(d.get('data_quality_score', 0) for d in performance_data) / total_campaigns
        
        return {
            'total_campaigns': total_campaigns,
            'successful_campaigns': successful_campaigns,
            'failed_campaigns': total_campaigns - successful_campaigns,
            'totals': {
                'sessions': total_sessions,
                'registrations': total_registrations,
                'credit_cards': total_credit_cards
            },
            'averages': {
                'registration_rate': round(avg_reg_rate, 2),
                'cc_conversion_rate': round(avg_cc_rate, 2),
                'data_quality_score': round(avg_quality_score, 2)
            },
            'processed_at': datetime.now(timezone.utc).isoformat()
        }
    
    
    def get_hourly_data_range(self, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """
        Get all hourly data for a date range, formatted for time-series analysis
        
        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            
        Returns:
            List of hourly records with campaign info for time-series analysis
        """
        try:
            # Parse dates and calculate unix hours
            start_dt = datetime.strptime(start_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            end_dt = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            start_unix_hour = int(start_dt.timestamp() // 3600)
            end_unix_hour = int(end_dt.timestamp() // 3600)
            
            # Query for date range hourly data (all campaigns with activity)
            query = """
            SELECT 
                h.campaign_id,
                c.name as campaign_name,
                c.description,
                hm.network,
                hm.domain,
                h.unix_hour,
                h.sessions,
                h.registrations, 
                h.credit_cards,
                h.email_accounts,
                h.google_accounts,
                h.total_accounts,
                h.messages,
                h.payment_methods
            FROM hourly_data h
            JOIN campaigns c ON h.campaign_id = c.id
            LEFT JOIN campaign_hierarchy hm ON c.id = hm.campaign_id
            WHERE h.unix_hour >= ? 
              AND h.unix_hour <= ?
              AND (h.sessions > 0 OR h.registrations > 0 OR h.credit_cards > 0)
            ORDER BY h.unix_hour, c.name
            """
            
            results = self.db_ops.execute_query(query, (start_unix_hour, end_unix_hour))
            
            hourly_data = []
            for row in results:
                # Calculate derived metrics
                reg_percentage = (row['registrations'] / row['sessions'] * 100) if row['sessions'] > 0 else 0
                cc_conv_percentage = (row['credit_cards'] / row['registrations'] * 100) if row['registrations'] > 0 else 0
                
                # Convert unix_hour back to readable datetime
                timestamp = datetime.fromtimestamp(row['unix_hour'] * 3600, tz=timezone.utc)
                date_str = timestamp.strftime('%Y-%m-%d')
                hour_str = timestamp.strftime('%H:00')
                
                hourly_data.append({
                    'date': date_str,
                    'hour': hour_str, 
                    'datetime': timestamp.strftime('%Y-%m-%d %H:%M'),
                    'campaign_id': row['campaign_id'],
                    'campaign_name': row['campaign_name'],
                    'network': row['network'] or 'Unknown',
                    'domain': row['domain'] or 'Unknown', 
                    'sessions': row['sessions'],
                    'registrations': row['registrations'],
                    'credit_cards': row['credit_cards'],
                    'reg_percentage': round(reg_percentage, 2),
                    'cc_conv_percentage': round(cc_conv_percentage, 2)
                })
            
            print(f"Found {len(hourly_data)} hourly records for {start_date} to {end_date} with activity")
            return hourly_data
            
        except Exception as e:
            print(f"ERROR: Failed to get hourly data for {start_date} to {end_date}: {e}")
            return []
    
    def get_daily_aggregates_range(self, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """
        Get daily aggregated data for a date range, optimized for daily tracking
        
        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            
        Returns:
            List of daily aggregates with growth metrics
        """
        try:
            # Parse dates and calculate unix hours
            start_dt = datetime.strptime(start_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            end_dt = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            start_unix_hour = int(start_dt.timestamp() // 3600)
            end_unix_hour = int(end_dt.timestamp() // 3600)
            
            # Query for daily aggregates with day-over-day growth
            query = """
            SELECT 
                h.campaign_id,
                c.name as campaign_name,
                hm.network,
                hm.domain,
                DATE(datetime(h.unix_hour * 3600, 'unixepoch')) as date,
                SUM(h.sessions) as daily_sessions,
                SUM(h.registrations) as daily_registrations,
                SUM(h.credit_cards) as daily_credit_cards,
                COUNT(*) as hours_with_data
            FROM hourly_data h
            JOIN campaigns c ON h.campaign_id = c.id
            LEFT JOIN campaign_hierarchy hm ON c.id = hm.campaign_id
            WHERE h.unix_hour >= ?
              AND h.unix_hour <= ?
              AND (h.sessions > 0 OR h.registrations > 0 OR h.credit_cards > 0)
            GROUP BY h.campaign_id, c.name, hm.network, hm.domain, DATE(datetime(h.unix_hour * 3600, 'unixepoch'))
            ORDER BY DATE(datetime(h.unix_hour * 3600, 'unixepoch')), c.name
            """
            
            results = self.db_ops.execute_query(query, (start_unix_hour, end_unix_hour))
            
            daily_data = []
            prev_data_by_campaign = {}
            
            for row in results:
                # Calculate conversion rates
                reg_percentage = (row['daily_registrations'] / row['daily_sessions'] * 100) if row['daily_sessions'] > 0 else 0
                cc_conv_percentage = (row['daily_credit_cards'] / row['daily_registrations'] * 100) if row['daily_registrations'] > 0 else 0
                
                # Calculate day-over-day growth
                campaign_id = row['campaign_id']
                daily_growth = 0
                if campaign_id in prev_data_by_campaign:
                    prev_sessions = prev_data_by_campaign[campaign_id]['sessions']
                    if prev_sessions > 0:
                        daily_growth = ((row['daily_sessions'] - prev_sessions) / prev_sessions * 100)
                
                daily_record = {
                    'date': row['date'],
                    'campaign_id': campaign_id,
                    'campaign_name': row['campaign_name'],
                    'network': row['network'] or 'Unknown',
                    'domain': row['domain'] or 'Unknown',
                    'daily_sessions': row['daily_sessions'],
                    'daily_registrations': row['daily_registrations'], 
                    'daily_credit_cards': row['daily_credit_cards'],
                    'reg_percentage': round(reg_percentage, 2),
                    'cc_conv_percentage': round(cc_conv_percentage, 2),
                    'daily_growth_pct': round(daily_growth, 2),
                    'hours_active': row['hours_with_data']
                }
                
                daily_data.append(daily_record)
                
                # Store for next day's growth calculation
                prev_data_by_campaign[campaign_id] = {
                    'sessions': row['daily_sessions'],
                    'date': row['date']
                }
            
            print(f"Found {len(daily_data)} daily records for {start_date} to {end_date}")
            return daily_data
            
        except Exception as e:
            print(f"ERROR: Failed to get daily aggregates for {start_date} to {end_date}: {e}")
            return []
    
    def get_campaign_summary_range(self, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """
        Get campaign summary for a date range for executive overview
        
        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            
        Returns:
            List of campaign summaries with totals and rankings for the date range
        """
        try:
            # Parse dates and calculate unix hours
            start_dt = datetime.strptime(start_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            end_dt = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            start_unix_hour = int(start_dt.timestamp() // 3600)
            end_unix_hour = int(end_dt.timestamp() // 3600)
            
            # Query for date range campaign totals
            query = """
            SELECT 
                h.campaign_id,
                c.name as campaign_name,
                c.description,
                hm.network,
                hm.domain,
                hm.placement,
                hm.targeting,
                hm.special,
                SUM(h.sessions) as total_sessions,
                SUM(h.registrations) as total_registrations,
                SUM(h.credit_cards) as total_credit_cards,
                SUM(h.messages) as total_messages,
                COUNT(DISTINCT DATE(datetime(h.unix_hour * 3600, 'unixepoch'))) as active_days,
                COUNT(*) as total_hours,
                MIN(datetime(h.unix_hour * 3600, 'unixepoch')) as first_activity,
                MAX(datetime(h.unix_hour * 3600, 'unixepoch')) as last_activity
            FROM hourly_data h
            JOIN campaigns c ON h.campaign_id = c.id
            LEFT JOIN campaign_hierarchy hm ON c.id = hm.campaign_id
            WHERE h.unix_hour >= ?
              AND h.unix_hour <= ?
              AND (h.sessions > 0 OR h.registrations > 0 OR h.credit_cards > 0)
            GROUP BY h.campaign_id, c.name, c.description, hm.network, hm.domain, 
                     hm.placement, hm.targeting, hm.special
            ORDER BY SUM(h.sessions) DESC
            """
            
            results = self.db_ops.execute_query(query, (start_unix_hour, end_unix_hour))
            
            summary_data = []
            for row in results:
                # Calculate key metrics
                reg_percentage = (row['total_registrations'] / row['total_sessions'] * 100) if row['total_sessions'] > 0 else 0
                cc_conv_percentage = (row['total_credit_cards'] / row['total_registrations'] * 100) if row['total_registrations'] > 0 else 0
                avg_daily_sessions = row['total_sessions'] / row['active_days'] if row['active_days'] > 0 else 0
                avg_daily_registrations = row['total_registrations'] / row['active_days'] if row['active_days'] > 0 else 0
                
                summary_data.append({
                    'campaign_id': row['campaign_id'],
                    'campaign_name': row['campaign_name'],
                    'description': row['description'],
                    'network': row['network'] or 'Unknown',
                    'domain': row['domain'] or 'Unknown', 
                    'placement': row['placement'] or 'Unknown',
                    'targeting': row['targeting'] or 'Unknown',
                    'special': row['special'] or 'Unknown',
                    'total_sessions': row['total_sessions'],
                    'total_registrations': row['total_registrations'],
                    'total_credit_cards': row['total_credit_cards'],
                    'total_messages': row['total_messages'],
                    'reg_percentage': round(reg_percentage, 2),
                    'cc_conv_percentage': round(cc_conv_percentage, 2),
                    'avg_daily_sessions': round(avg_daily_sessions, 1),
                    'avg_daily_registrations': round(avg_daily_registrations, 1),
                    'active_days': row['active_days'],
                    'total_hours': row['total_hours'],
                    'first_activity': row['first_activity'],
                    'last_activity': row['last_activity']
                })
            
            print(f"Found {len(summary_data)} campaigns with activity in {start_date} to {end_date}")
            return summary_data
            
        except Exception as e:
            print(f"ERROR: Failed to get campaign summary for {start_date} to {end_date}: {e}")
            return []
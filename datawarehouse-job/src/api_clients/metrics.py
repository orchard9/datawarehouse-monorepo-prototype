#!/usr/bin/env python3
"""
Metrics API client for fetching time-series metrics data
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import time
from .base_client import BaseApiClient

class MetricsClient(BaseApiClient):
    """Client for metrics API endpoint"""
    
    def get_metrics(self, start_time: int, end_time: int, bucket: str = "one_hour",
                   metrics: str = "registrations,messages,media,payment_methods,charge_revenue,terms_acceptances",
                   campaign_ids: Optional[List[int]] = None) -> List[Dict[str, Any]]:
        """
        Fetch metrics data from the API
        
        Args:
            start_time: Start time in milliseconds (UTC)
            end_time: End time in milliseconds (UTC)  
            bucket: Time bucket ('one_hour', 'four_hour', 'daily')
            metrics: Comma-separated list of metrics to fetch
            campaign_ids: List of campaign IDs to filter by
            
        Returns:
            List of bucket dictionaries with time ranges and metrics
        """
        try:
            # Prepare parameters
            params = {
                'start_time': start_time,
                'end_time': end_time,
                'bucket': bucket,
                'metrics': metrics
            }
            
            # Add campaign IDs if provided
            if campaign_ids:
                params['campaign_ids'] = ','.join(map(str, campaign_ids))
            
            # Make API request
            response = self.get('/admin/metrics', params=params)
            
            # Handle both list and dict response formats
            if isinstance(response, list):
                buckets = response
            elif isinstance(response, dict) and 'buckets' in response:
                buckets = response['buckets']
            else:
                raise ValueError("Expected list of buckets or dict with 'buckets' field in metrics response")
            
            print(f"Fetched {len(buckets)} metric buckets from API")
            
            # Validate bucket structure
            for i, bucket_data in enumerate(buckets):
                required_fields = ['start_time', 'end_time', 'metrics']
                for field in required_fields:
                    if field not in bucket_data:
                        raise ValueError(f"Bucket {i} missing required field: {field}")
            
            return buckets
            
        except Exception as e:
            print(f"Error fetching metrics: {e}")
            raise
    
    def get_metrics_for_campaigns(self, campaign_ids: List[int], 
                                 days_back: int = 7, bucket: str = "daily") -> List[Dict[str, Any]]:
        """
        Fetch metrics for specific campaigns over a time period
        
        Args:
            campaign_ids: List of campaign IDs
            days_back: Number of days back to fetch data
            bucket: Time bucket size
            
        Returns:
            List of metric buckets
        """
        # Calculate time range
        end_time = int(time.time() * 1000)  # Current time in milliseconds
        start_time = end_time - (days_back * 24 * 60 * 60 * 1000)  # X days ago
        
        return self.get_metrics(
            start_time=start_time,
            end_time=end_time,
            bucket=bucket,
            campaign_ids=campaign_ids
        )
    
    def get_recent_metrics(self, hours_back: int = 24, bucket: str = "one_hour") -> List[Dict[str, Any]]:
        """
        Fetch recent metrics data
        
        Args:
            hours_back: Number of hours back to fetch
            bucket: Time bucket size
            
        Returns:
            List of recent metric buckets
        """
        end_time = int(time.time() * 1000)
        start_time = end_time - (hours_back * 60 * 60 * 1000)
        
        return self.get_metrics(
            start_time=start_time,
            end_time=end_time,
            bucket=bucket
        )
    
    def get_hourly_metrics_for_campaign(self, campaign_id: int, hours_back: int = 24) -> List[Dict[str, Any]]:
        """
        Get hourly metrics for a specific campaign
        
        Args:
            campaign_id: Campaign ID
            hours_back: Number of hours of data to fetch
            
        Returns:
            List of hourly metric buckets for the campaign
        """
        end_time = int(time.time() * 1000)
        start_time = end_time - (hours_back * 60 * 60 * 1000)
        
        # For hourly campaign-specific data, get all supported metrics
        return self.get_metrics(
            start_time=start_time,
            end_time=end_time,
            bucket="one_hour",
            metrics="registrations,messages,media,payment_methods,charge_revenue,terms_acceptances",
            campaign_ids=[campaign_id]
        )
    
    def get_hourly_metrics_for_campaigns(self, campaign_ids: List[int], hours_back: int = 24) -> List[Dict[str, Any]]:
        """
        Get hourly metrics for multiple campaigns
        
        Args:
            campaign_ids: List of campaign IDs
            hours_back: Number of hours of data to fetch
            
        Returns:
            List of hourly metric buckets for all campaigns
        """
        end_time = int(time.time() * 1000)
        start_time = end_time - (hours_back * 60 * 60 * 1000)
        
        return self.get_metrics(
            start_time=start_time,
            end_time=end_time,
            bucket="one_hour",
            campaign_ids=campaign_ids
        )
    
    def process_metrics_for_date_range(self, campaign_ids: List[int], start_time_ms: int, end_time_ms: int) -> List[Dict[str, Any]]:
        """
        Fetch and process metrics for a specific date range for database storage
        
        Args:
            campaign_ids: List of campaign IDs to fetch metrics for individually
            start_time_ms: Start time in milliseconds (UTC)
            end_time_ms: End time in milliseconds (UTC)
            
        Returns:
            List of processed hourly data records ready for database insertion
        """
        try:
            processed_records = []
            successful_campaigns = 0
            
            # Fetch metrics for each campaign individually to get campaign-specific data
            for campaign_id in campaign_ids:
                try:
                    # Fetch metrics for this specific campaign within the date range
                    raw_buckets = self.get_metrics(
                        start_time=start_time_ms,
                        end_time=end_time_ms,
                        bucket="one_hour",
                        metrics="registrations,messages,media,payment_methods,charge_revenue,terms_acceptances",
                        campaign_ids=[campaign_id]
                    )
                    
                    if raw_buckets:
                        # Process each bucket for this campaign
                        for bucket in raw_buckets:
                            try:
                                processed_record = self.parse_metrics_bucket(bucket, campaign_id)
                                processed_records.append(processed_record)
                            except Exception as e:
                                print(f"Error processing bucket for campaign {campaign_id}: {e}")
                                continue
                        successful_campaigns += 1
                    else:
                        print(f"No data returned for campaign {campaign_id}")
                    
                except Exception as e:
                    print(f"Error fetching metrics for campaign {campaign_id}: {e}")
                    continue
            
            print(f"Processed {len(processed_records)} metric records for {successful_campaigns}/{len(campaign_ids)} campaigns")
            return processed_records
            
        except Exception as e:
            print(f"Error fetching metrics for campaigns: {e}")
            return []

    def process_metrics_for_storage(self, campaign_ids: List[int], hours_back: int = 24) -> List[Dict[str, Any]]:
        """
        Fetch and process metrics for database storage - campaign-specific approach
        
        Args:
            campaign_ids: List of campaign IDs to fetch metrics for individually
            hours_back: Number of hours back to fetch
            
        Returns:
            List of processed hourly data records ready for database insertion
        """
        try:
            processed_records = []
            successful_campaigns = 0
            
            # Fetch metrics for each campaign individually to get campaign-specific data
            for campaign_id in campaign_ids:
                try:
                    # Fetch metrics for this specific campaign
                    raw_buckets = self.get_hourly_metrics_for_campaign(campaign_id, hours_back)
                    
                    if raw_buckets:
                        # Process each bucket for this campaign
                        for bucket in raw_buckets:
                            try:
                                processed_record = self.parse_metrics_bucket(bucket, campaign_id)
                                processed_records.append(processed_record)
                            except Exception as e:
                                print(f"Error processing bucket for campaign {campaign_id}: {e}")
                                continue
                        successful_campaigns += 1
                    else:
                        print(f"No data returned for campaign {campaign_id}")
                    
                except Exception as e:
                    print(f"Error fetching metrics for campaign {campaign_id}: {e}")
                    continue
            
            print(f"Processed {len(processed_records)} metric records for {successful_campaigns}/{len(campaign_ids)} campaigns")
            return processed_records
            
        except Exception as e:
            print(f"Error fetching metrics for campaigns: {e}")
            return []
    
    def parse_metrics_bucket(self, bucket: Dict[str, Any], campaign_id: int) -> Dict[str, Any]:
        """
        Parse and normalize a metrics bucket for database storage
        
        Args:
            bucket: Raw bucket data from API
            campaign_id: Campaign ID for this bucket
            
        Returns:
            Normalized bucket data ready for database insertion
        """
        from datetime import datetime
        
        # Convert start_time to unix hour
        start_time_str = bucket['start_time']
        start_datetime = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        unix_hour = int(start_datetime.timestamp() // 3600)
        
        metrics = bucket.get('metrics', {})
        
        # Parse registration metrics
        registrations = metrics.get('registrations', {})
        
        # Parse messages metrics
        messages = metrics.get('messages', {})
        
        # Parse payment methods
        payment_methods = metrics.get('payment_methods', {})
        payment_methods_data = payment_methods.get('payment_methods', {})

        # Parse terms acceptances
        terms_acceptances = metrics.get('terms_acceptances', {})

        # Parse media metrics
        media = metrics.get('media', {})

        # Parse charge revenue
        charge_revenue = metrics.get('charge_revenue', {})

        # Calculate proper sessions and registrations
        anonymous_sessions = registrations.get('anonymous', 0)
        email_regs = registrations.get('email', 0)
        google_regs = registrations.get('google', 0)
        facebook_regs = registrations.get('facebook', 0)
        actual_registrations = email_regs + google_regs + facebook_regs

        return {
            'campaign_id': campaign_id,
            'unix_hour': unix_hour,

            # Registration data
            'credit_cards': payment_methods_data.get('added', 0),  # Credit cards from payment methods added
            'email_accounts': email_regs,
            'google_accounts': google_regs,
            'facebook_accounts': facebook_regs,
            'sessions': anonymous_sessions,  # Anonymous users represent sessions
            'total_accounts': registrations.get('total', 0),
            'registrations': actual_registrations,  # Actual registrations excluding anonymous

            # Messages data
            'messages': messages.get('total', 0) if isinstance(messages, dict) else 0,
            'companion_chats': messages.get('companion_chats', 0) if isinstance(messages, dict) else 0,
            'chat_room_user_chats': messages.get('chat_room_user_chats', 0) if isinstance(messages, dict) else 0,
            'chat_room_simulation_chats': messages.get('chat_room_simulation_chats', 0) if isinstance(messages, dict) else 0,
            'total_user_chats': messages.get('total_user_chats', 0) if isinstance(messages, dict) else 0,

            # Payment methods data
            'payment_methods': payment_methods_data.get('added', 0),
            'payment_methods_canceled': payment_methods_data.get('canceled', 0),

            # Revenue data
            'revenue_successful_cents': charge_revenue.get('successful_amount_cents', 0),
            'revenue_successful_dollars': charge_revenue.get('successful_amount_dollars', 0.0),
            'revenue_successful_count': charge_revenue.get('successful_count', 0),
            'revenue_failed_cents': charge_revenue.get('failed_amount_cents', 0),
            'revenue_failed_dollars': charge_revenue.get('failed_amount_dollars', 0.0),
            'revenue_failed_count': charge_revenue.get('failed_count', 0),

            # Other metrics
            'media': media.get('total', 0) if isinstance(media, dict) else 0,
            'converted_users': 0,  # Not directly provided, will be calculated
            'terms_acceptances': terms_acceptances.get('count', 0)
        }
#!/usr/bin/env python3
"""
Campaign API client for fetching campaign data
"""
from typing import List, Dict, Any
from .base_client import BaseApiClient

class CampaignsClient(BaseApiClient):
    """Client for campaigns API endpoint"""
    
    def get_campaigns(self) -> List[Dict[str, Any]]:
        """
        Fetch all campaigns from the API
        
        Returns:
            List of campaign dictionaries with fields:
            - id, name, description, tracking_url, is_serving, serving_url
            - traffic_weight, deleted_at, created_at, updated_at, slug, path
        """
        try:
            campaigns = self.get('/admin/campaigns')
            
            if not isinstance(campaigns, list):
                raise ValueError("Expected list of campaigns from API")
            
            print(f"Fetched {len(campaigns)} campaigns from API")
            
            # Validate campaign data structure
            for i, campaign in enumerate(campaigns):
                required_fields = ['id', 'name', 'created_at', 'updated_at']
                for field in required_fields:
                    if field not in campaign:
                        raise ValueError(f"Campaign {i} missing required field: {field}")
            
            return campaigns
            
        except Exception as e:
            print(f"Error fetching campaigns: {e}")
            raise
    
    def get_campaign_by_id(self, campaign_id: int) -> Dict[str, Any]:
        """
        Fetch specific campaign by ID
        
        Args:
            campaign_id: Campaign ID to fetch
            
        Returns:
            Campaign dictionary or None if not found
        """
        campaigns = self.get_campaigns()
        
        for campaign in campaigns:
            if campaign['id'] == campaign_id:
                return campaign
        
        raise ValueError(f"Campaign with ID {campaign_id} not found")
    
    def get_active_campaigns(self) -> List[Dict[str, Any]]:
        """
        Fetch only active/serving campaigns
        
        Returns:
            List of active campaigns
        """
        all_campaigns = self.get_campaigns()
        active_campaigns = [c for c in all_campaigns if c.get('is_serving', False)]
        
        print(f"Found {len(active_campaigns)} active campaigns out of {len(all_campaigns)} total")
        
        return active_campaigns
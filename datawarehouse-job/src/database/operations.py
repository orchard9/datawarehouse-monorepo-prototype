#!/usr/bin/env python3
"""
Database operations for Peach AI data warehouse
"""
import sqlite3
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
import json

class DatabaseOperations:
    """Handles all database CRUD operations"""
    
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self.conn.row_factory = sqlite3.Row  # Enable dict-like row access
    
    def execute_query(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """Execute a custom SQL query and return results as list of dictionaries"""
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    
    # Campaign operations
    def upsert_campaign(self, campaign_data: Dict[str, Any]) -> int:
        """Insert or update campaign data"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO campaigns 
            (id, name, description, tracking_url, is_serving, serving_url, traffic_weight,
             deleted_at, created_at, updated_at, slug, path, sync_timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            campaign_data['id'],
            campaign_data['name'], 
            campaign_data.get('description'),
            campaign_data.get('tracking_url'),
            campaign_data.get('is_serving', False),
            campaign_data.get('serving_url'),
            campaign_data.get('traffic_weight', 0),
            campaign_data.get('deleted_at'),
            campaign_data.get('created_at'),
            campaign_data.get('updated_at'),
            campaign_data.get('slug'),
            campaign_data.get('path'),
            datetime.now(timezone.utc).isoformat()
        ))
        
        self.conn.commit()
        return campaign_data['id']
    
    def get_campaigns(self, active_only: bool = False) -> List[Dict[str, Any]]:
        """Get all campaigns or only active ones"""
        cursor = self.conn.cursor()
        
        query = "SELECT * FROM campaigns"
        if active_only:
            query += " WHERE is_serving = 1"
        query += " ORDER BY name"
        
        cursor.execute(query)
        return [dict(row) for row in cursor.fetchall()]
    
    def get_campaign_by_id(self, campaign_id: int) -> Optional[Dict[str, Any]]:
        """Get specific campaign by ID"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    
    
    def upsert_hourly_data(self, hourly_data: Dict[str, Any]) -> int:
        """Insert or update comprehensive hourly data"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO hourly_data
            (campaign_id, unix_hour, credit_cards, email_accounts, google_accounts,
             sessions, total_accounts, registrations, messages, companion_chats, 
             chat_room_user_chats, total_user_chats, media, payment_methods, 
             converted_users, terms_acceptances, sync_timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            hourly_data['campaign_id'],
            hourly_data['unix_hour'],
            hourly_data.get('credit_cards', 0),
            hourly_data.get('email_accounts', 0),
            hourly_data.get('google_accounts', 0),
            hourly_data.get('sessions', 0),
            hourly_data.get('total_accounts', 0),
            hourly_data.get('registrations', 0),
            hourly_data.get('messages', 0),
            hourly_data.get('companion_chats', 0),
            hourly_data.get('chat_room_user_chats', 0),
            hourly_data.get('total_user_chats', 0),
            hourly_data.get('media', 0),
            hourly_data.get('payment_methods', 0),
            hourly_data.get('converted_users', 0),
            hourly_data.get('terms_acceptances', 0),
            datetime.now(timezone.utc).isoformat()
        ))
        
        self.conn.commit()
        return cursor.lastrowid
    
    def get_hourly_data(self, campaign_id: int = None, hour_from: int = None, hour_to: int = None) -> List[Dict[str, Any]]:
        """Get comprehensive hourly data with optional filters"""
        cursor = self.conn.cursor()
        
        query = "SELECT * FROM hourly_data"
        params = []
        conditions = []
        
        if campaign_id:
            conditions.append("campaign_id = ?")
            params.append(campaign_id)
        
        if hour_from:
            conditions.append("unix_hour >= ?")
            params.append(hour_from)
            
        if hour_to:
            conditions.append("unix_hour <= ?")
            params.append(hour_to)
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += " ORDER BY campaign_id, unix_hour"
        
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]
    
    
    # Campaign hierarchy operations
    def upsert_campaign_hierarchy(self, hierarchy_data: Dict[str, Any]) -> int:
        """Insert or update campaign hierarchy mapping"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO campaign_hierarchy
            (campaign_id, campaign_name, network, domain, placement, targeting, special,
             mapping_confidence, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            hierarchy_data['campaign_id'],
            hierarchy_data['campaign_name'],
            hierarchy_data['network'],
            hierarchy_data['domain'],
            hierarchy_data['placement'],
            hierarchy_data['targeting'],
            hierarchy_data['special'],
            hierarchy_data.get('mapping_confidence', 1.0),
            datetime.now(timezone.utc).isoformat()
        ))
        
        self.conn.commit()
        return cursor.lastrowid
    
    def get_campaign_hierarchy(self, campaign_id: int = None) -> List[Dict[str, Any]]:
        """Get campaign hierarchy mappings"""
        cursor = self.conn.cursor()
        
        if campaign_id:
            cursor.execute("SELECT * FROM campaign_hierarchy WHERE campaign_id = ?", (campaign_id,))
        else:
            cursor.execute("SELECT * FROM campaign_hierarchy ORDER BY network, domain, placement")
        
        return [dict(row) for row in cursor.fetchall()]
    
    # Hierarchy rules operations
    def get_hierarchy_rules(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """Get hierarchy mapping rules"""
        cursor = self.conn.cursor()
        
        query = "SELECT * FROM hierarchy_rules"
        if active_only:
            query += " WHERE is_active = 1"
        query += " ORDER BY priority DESC"
        
        cursor.execute(query)
        return [dict(row) for row in cursor.fetchall()]
    
    def add_hierarchy_rule(self, rule_data: Dict[str, Any]) -> int:
        """Add new hierarchy mapping rule"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            INSERT INTO hierarchy_rules
            (rule_name, pattern_type, pattern_value, network, domain, placement, 
             targeting, special, priority, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rule_data['rule_name'],
            rule_data['pattern_type'],
            rule_data['pattern_value'],
            rule_data['network'],
            rule_data['domain'],
            rule_data['placement'],
            rule_data['targeting'],
            rule_data['special'],
            rule_data.get('priority', 500),
            rule_data.get('is_active', True)
        ))
        
        self.conn.commit()
        return cursor.lastrowid
    
    # Sync history operations
    def start_sync(self, sync_type: str) -> int:
        """Start a new sync operation"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            INSERT INTO sync_history (sync_type, start_time, status)
            VALUES (?, ?, 'running')
        """, (sync_type, datetime.now(timezone.utc).isoformat()))
        
        self.conn.commit()
        return cursor.lastrowid
    
    def complete_sync(self, sync_id: int, records_processed: int = 0, 
                     records_inserted: int = 0, records_updated: int = 0,
                     api_calls_made: int = 0, error_message: str = None) -> None:
        """Complete a sync operation"""
        cursor = self.conn.cursor()
        
        status = 'failed' if error_message else 'completed'
        
        cursor.execute("""
            UPDATE sync_history 
            SET end_time = ?, status = ?, records_processed = ?, records_inserted = ?,
                records_updated = ?, api_calls_made = ?, error_message = ?
            WHERE id = ?
        """, (
            datetime.now(timezone.utc).isoformat(), status, records_processed, records_inserted,
            records_updated, api_calls_made, error_message, sync_id
        ))
        
        self.conn.commit()
    
    def get_sync_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent sync history"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            SELECT * FROM sync_history 
            ORDER BY start_time DESC 
            LIMIT ?
        """, (limit,))
        
        return [dict(row) for row in cursor.fetchall()]
    
    # Export operations  
    def record_export(self, export_type: str, export_config: Dict[str, Any] = None,
                     file_path: str = None, sheet_url: str = None) -> int:
        """Record a new export operation"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            INSERT INTO export_history (export_type, export_config, file_path, sheet_url, status)
            VALUES (?, ?, ?, ?, 'running')
        """, (
            export_type,
            json.dumps(export_config) if export_config else None,
            file_path,
            sheet_url
        ))
        
        self.conn.commit()
        return cursor.lastrowid
    
    def complete_export(self, export_id: int, records_exported: int = 0, 
                       error_message: str = None) -> None:
        """Complete an export operation"""
        cursor = self.conn.cursor()
        
        status = 'failed' if error_message else 'completed'
        
        cursor.execute("""
            UPDATE export_history 
            SET status = ?, records_exported = ?, error_message = ?, completed_at = ?
            WHERE id = ?
        """, (status, records_exported, error_message, datetime.now(timezone.utc).isoformat(), export_id))
        
        self.conn.commit()
    
    # Analytics and reporting queries
    def get_campaign_performance_summary(self) -> List[Dict[str, Any]]:
        """Get campaign performance summary for spreadsheet export"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            SELECT 
                c.id as campaign_id,
                c.name as campaign_name,
                COALESCE(h.network, 'Unknown') as network,
                COALESCE(h.domain, 'Unknown') as domain, 
                COALESCE(h.placement, 'Unknown') as placement,
                COALESCE(h.targeting, 'Unknown') as targeting,
                COALESCE(h.special, 'Unknown') as special,
                
                -- Cost metrics (placeholder - would need cost data from API)
                0 as cost,
                0 as ecpc,
                0 as ecpa, 
                0 as ecps,
                
                -- Performance metrics from hourly data (last 24 hours)
                COALESCE(hd.sessions, 0) as sessions,
                COALESCE(hd.registrations, 0) as registrations,
                COALESCE(hd.credit_cards, 0) as credit_cards,
                COALESCE(hd.email_accounts, 0) as email_accounts,
                COALESCE(hd.google_accounts, 0) as google_accounts,
                COALESCE(hd.total_accounts, 0) as total_accounts,
                
                -- Message metrics from hourly data
                COALESCE(hd.messages, 0) as total_messages,
                COALESCE(hd.total_user_chats, 0) as total_user_chats,
                
                -- Sync info
                c.sync_timestamp as last_updated
                
            FROM campaigns c
            LEFT JOIN campaign_hierarchy h ON c.id = h.campaign_id
            LEFT JOIN (
                SELECT campaign_id,
                       SUM(sessions) as sessions,
                       SUM(registrations) as registrations,
                       SUM(credit_cards) as credit_cards,
                       SUM(email_accounts) as email_accounts,
                       SUM(google_accounts) as google_accounts,
                       SUM(total_accounts) as total_accounts,
                       SUM(messages) as messages,
                       SUM(total_user_chats) as total_user_chats
                FROM hourly_data
                WHERE unix_hour >= (strftime('%s', 'now') / 3600) - 24
                GROUP BY campaign_id
            ) hd ON c.id = hd.campaign_id
            
            WHERE c.is_serving = 1 OR hd.sessions > 0
            ORDER BY h.network, h.domain, h.placement, c.name
        """)
        
        return [dict(row) for row in cursor.fetchall()]
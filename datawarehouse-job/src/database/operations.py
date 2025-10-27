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
        """Insert or update campaign data, preserving cost fields during sync"""
        cursor = self.conn.cursor()

        # Check if campaign exists
        cursor.execute("SELECT id, cost, cost_status FROM campaigns WHERE id = ?", (campaign_data['id'],))
        existing = cursor.fetchone()

        if existing:
            # Campaign exists - UPDATE only API fields, preserve cost and cost_status
            cursor.execute("""
                UPDATE campaigns
                SET name = ?,
                    description = ?,
                    tracking_url = ?,
                    is_serving = ?,
                    serving_url = ?,
                    traffic_weight = ?,
                    deleted_at = ?,
                    updated_at = ?,
                    slug = ?,
                    path = ?,
                    sync_timestamp = ?
                WHERE id = ?
            """, (
                campaign_data['name'],
                campaign_data.get('description'),
                campaign_data.get('tracking_url'),
                campaign_data.get('is_serving', False),
                campaign_data.get('serving_url'),
                campaign_data.get('traffic_weight', 0),
                campaign_data.get('deleted_at'),
                campaign_data.get('updated_at'),
                campaign_data.get('slug'),
                campaign_data.get('path'),
                datetime.now(timezone.utc).isoformat(),
                campaign_data['id']
            ))
        else:
            # New campaign - INSERT with default cost and status values
            cursor.execute("""
                INSERT INTO campaigns
                (id, name, description, tracking_url, is_serving, serving_url, traffic_weight,
                 deleted_at, created_at, updated_at, slug, path, status, cost, cost_status, sync_timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unknown', NULL, 'estimated', ?)
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
        """
        Insert or update campaign hierarchy mapping

        IMPORTANT: Checks for active overrides first. If an override exists,
        it will be used instead of the provided hierarchy_data. This ensures
        CSV-imported hierarchies persist across syncs.
        """
        cursor = self.conn.cursor()
        campaign_id = hierarchy_data['campaign_id']

        # Check for active override first
        cursor.execute("""
            SELECT network, domain, placement, targeting, special
            FROM campaign_hierarchy_overrides
            WHERE campaign_id = ? AND is_active = 1
            ORDER BY overridden_at DESC
            LIMIT 1
        """, (campaign_id,))

        override = cursor.fetchone()

        # If override exists, use override data instead of rule-based mapping
        # Note: Override fields can be NULL, so we need to fall back to rule-based data
        if override:
            final_network = override['network'] or hierarchy_data['network']
            final_domain = override['domain'] or hierarchy_data['domain']
            final_placement = override['placement'] or hierarchy_data['placement']
            final_targeting = override['targeting'] or hierarchy_data['targeting']
            final_special = override['special'] or hierarchy_data['special']
            final_confidence = 1.0  # Manual overrides get full confidence
        else:
            # No override, use rule-based mapping data
            final_network = hierarchy_data['network']
            final_domain = hierarchy_data['domain']
            final_placement = hierarchy_data['placement']
            final_targeting = hierarchy_data['targeting']
            final_special = hierarchy_data['special']
            final_confidence = hierarchy_data.get('mapping_confidence', 1.0)

        cursor.execute("""
            INSERT OR REPLACE INTO campaign_hierarchy
            (campaign_id, campaign_name, network, domain, placement, targeting, special,
             mapping_confidence, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            campaign_id,
            hierarchy_data['campaign_name'],
            final_network,
            final_domain,
            final_placement,
            final_targeting,
            final_special,
            final_confidence,
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

    # Hierarchy override operations
    def upsert_hierarchy_override(self, override_data: Dict[str, Any]) -> int:
        """Insert or update hierarchy override for a campaign"""
        cursor = self.conn.cursor()

        # Deactivate any existing active overrides for this campaign
        cursor.execute("""
            UPDATE campaign_hierarchy_overrides
            SET is_active = 0, updated_at = ?
            WHERE campaign_id = ? AND is_active = 1
        """, (datetime.now(timezone.utc).isoformat(), override_data['campaign_id']))

        # Insert new override
        cursor.execute("""
            INSERT INTO campaign_hierarchy_overrides
            (campaign_id, network, domain, placement, targeting, special,
             override_reason, overridden_by, overridden_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (
            override_data['campaign_id'],
            override_data.get('network'),
            override_data.get('domain'),
            override_data.get('placement'),
            override_data.get('targeting'),
            override_data.get('special'),
            override_data.get('override_reason', 'Manual correction'),
            override_data['overridden_by'],
            datetime.now(timezone.utc).isoformat()
        ))

        self.conn.commit()
        return cursor.lastrowid

    def get_hierarchy_override(self, campaign_id: int) -> Optional[Dict[str, Any]]:
        """Get active hierarchy override for a campaign"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM campaign_hierarchy_overrides
            WHERE campaign_id = ? AND is_active = 1
            ORDER BY overridden_at DESC
            LIMIT 1
        """, (campaign_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    def get_all_active_overrides(self) -> List[Dict[str, Any]]:
        """Get all active hierarchy overrides"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM campaign_hierarchy_overrides
            WHERE is_active = 1
            ORDER BY campaign_id
        """)
        return [dict(row) for row in cursor.fetchall()]

    def delete_hierarchy_override(self, campaign_id: int, overridden_by: str) -> bool:
        """Deactivate (soft delete) hierarchy override for a campaign"""
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE campaign_hierarchy_overrides
            SET is_active = 0, updated_at = ?
            WHERE campaign_id = ? AND is_active = 1
        """, (datetime.now(timezone.utc).isoformat(), campaign_id))

        self.conn.commit()
        return cursor.rowcount > 0

    def get_hierarchy_override_history(self, campaign_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Get override history for a campaign"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM campaign_hierarchy_overrides
            WHERE campaign_id = ?
            ORDER BY overridden_at DESC
            LIMIT ?
        """, (campaign_id, limit))
        return [dict(row) for row in cursor.fetchall()]

    def get_merged_hierarchy(self, campaign_id: int) -> Optional[Dict[str, Any]]:
        """Get hierarchy with override merged (override takes precedence)"""
        cursor = self.conn.cursor()

        # Get base hierarchy
        cursor.execute("SELECT * FROM campaign_hierarchy WHERE campaign_id = ?", (campaign_id,))
        base = cursor.fetchone()
        if not base:
            return None

        base_dict = dict(base)

        # Get active override
        override = self.get_hierarchy_override(campaign_id)
        if override:
            # Merge override values (only non-null values)
            for field in ['network', 'domain', 'placement', 'targeting', 'special']:
                if override.get(field):
                    base_dict[field] = override[field]

            # Add override metadata
            base_dict['has_override'] = True
            base_dict['override_reason'] = override.get('override_reason')
            base_dict['overridden_by'] = override.get('overridden_by')
            base_dict['overridden_at'] = override.get('overridden_at')
        else:
            base_dict['has_override'] = False

        return base_dict

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
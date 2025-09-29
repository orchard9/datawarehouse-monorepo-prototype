#!/usr/bin/env python3
"""
SQLite database schema for Peach AI data warehouse
"""
import sqlite3
from datetime import datetime, timezone
from typing import Optional

class DatabaseSchema:
    """Manages database schema creation and migrations"""
    
    @staticmethod
    def create_tables(conn: sqlite3.Connection) -> None:
        """Create all database tables"""
        cursor = conn.cursor()
        
        # Campaigns table - stores campaign data from API
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                tracking_url TEXT,
                is_serving BOOLEAN DEFAULT 0,
                serving_url TEXT,
                traffic_weight INTEGER DEFAULT 0,
                deleted_at TEXT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                slug TEXT,
                path TEXT,
                sync_timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(id)
            )
        """)
        
        
        
        # Hourly data table - comprehensive time-series data by hour
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS hourly_data (
                campaign_id INTEGER NOT NULL,
                unix_hour INTEGER NOT NULL,
                
                -- Registration data
                credit_cards INTEGER DEFAULT 0,
                email_accounts INTEGER DEFAULT 0,
                google_accounts INTEGER DEFAULT 0,
                sessions INTEGER DEFAULT 0,
                total_accounts INTEGER DEFAULT 0,
                registrations INTEGER DEFAULT 0,
                
                -- Messages data
                messages INTEGER DEFAULT 0,
                companion_chats INTEGER DEFAULT 0,
                chat_room_user_chats INTEGER DEFAULT 0,
                total_user_chats INTEGER DEFAULT 0,
                
                -- Other metrics
                media INTEGER DEFAULT 0,
                payment_methods INTEGER DEFAULT 0,
                converted_users INTEGER DEFAULT 0,
                terms_acceptances INTEGER DEFAULT 0,
                
                sync_timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (campaign_id, unix_hour),
                FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
            )
        """)
        
        # Campaign hierarchy table - 5-tier mapping
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS campaign_hierarchy (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL,
                campaign_name TEXT NOT NULL,
                network TEXT NOT NULL,
                domain TEXT NOT NULL,
                placement TEXT NOT NULL,
                targeting TEXT NOT NULL,
                special TEXT NOT NULL,
                mapping_confidence REAL DEFAULT 1.0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (campaign_id) REFERENCES campaigns (id),
                UNIQUE(campaign_id)
            )
        """)
        
        # Hierarchy mapping rules table - configurable mapping patterns
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS hierarchy_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_name TEXT NOT NULL,
                pattern_type TEXT NOT NULL, -- 'regex', 'contains', 'starts_with', 'ends_with'
                pattern_value TEXT NOT NULL,
                network TEXT,
                domain TEXT,
                placement TEXT,
                targeting TEXT,
                special TEXT,
                priority INTEGER DEFAULT 0, -- Higher priority rules are checked first
                is_active BOOLEAN DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(rule_name)
            )
        """)
        
        # Sync history table - track ETL runs and data lineage
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sync_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sync_type TEXT NOT NULL, -- 'campaigns', 'metrics', 'reports', 'full'
                start_time TEXT NOT NULL,
                end_time TEXT,
                status TEXT NOT NULL, -- 'running', 'completed', 'failed'
                records_processed INTEGER DEFAULT 0,
                records_inserted INTEGER DEFAULT 0,
                records_updated INTEGER DEFAULT 0,
                error_message TEXT,
                api_calls_made INTEGER DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Export history table - track spreadsheet exports
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS export_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                export_type TEXT NOT NULL, -- 'google_sheets', 'csv', 'excel'
                export_config TEXT, -- JSON config for export parameters
                file_path TEXT,
                sheet_url TEXT,
                records_exported INTEGER DEFAULT 0,
                status TEXT NOT NULL, -- 'running', 'completed', 'failed'
                error_message TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at TEXT
            )
        """)
        
        # Create indexes for performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_campaigns_name ON campaigns (name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_campaigns_is_serving ON campaigns (is_serving)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hierarchy_campaign ON campaign_hierarchy (campaign_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hierarchy_network ON campaign_hierarchy (network)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rules_priority ON hierarchy_rules (priority DESC, is_active)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sync_history_type_time ON sync_history (sync_type, start_time)")
        
        conn.commit()
        print(f"Database schema created successfully at {datetime.now(timezone.utc)}")
    
    @staticmethod
    def insert_default_hierarchy_rules(conn: sqlite3.Connection) -> None:
        """Insert default hierarchy mapping rules"""
        cursor = conn.cursor()
        
        default_rules = [
            # Facebook rules
            ("Facebook Desktop", "contains", "Facebook Desktop", "Facebook", "Social Media", "Desktop", "Desktop Users", "Premium"),
            ("Facebook Mobile", "contains", "Facebook Mobile", "Facebook", "Social Media", "Mobile", "Mobile Users", "Standard"),
            ("Facebook Video", "contains", "Facebook Video", "Facebook", "Social Media", "Video", "Video Viewers", "Premium"),
            ("Facebook Messenger", "contains", "Facebook Messenger", "Facebook", "Messaging", "Mobile", "Messenger Users", "Direct"),
            
            # Instagram rules  
            ("Instagram Mobile", "contains", "Instagram Mobile", "Instagram", "Social Media", "Mobile", "Mobile Users", "Visual"),
            ("Instagram Stories", "contains", "Instagram Stories", "Instagram", "Social Media", "Stories", "Story Viewers", "Ephemeral"),
            ("Instagram Reels", "contains", "Instagram Reels", "Instagram", "Social Media", "Reels", "Short Video", "Viral"),
            
            # Google rules
            ("Google Display", "contains", "Google Display", "Google", "Display Network", "Banner", "Display Users", "Retargeting"),
            ("Google Search", "contains", "Google Search", "Google", "Search Network", "Text", "Search Users", "Intent"),
            
            # Other platforms
            ("TikTok Video", "contains", "TikTok", "TikTok", "Social Media", "Video", "Gen Z", "Viral"),
            ("Snapchat Stories", "contains", "Snapchat", "Snapchat", "Social Media", "Stories", "Young Adults", "AR"),
            ("YouTube Pre-roll", "contains", "YouTube", "YouTube", "Video Platform", "Pre-roll", "Video Viewers", "Skippable"),
            ("LinkedIn Sponsored", "contains", "LinkedIn", "LinkedIn", "Professional", "Sponsored", "Professionals", "B2B"),
            ("Twitter Promoted", "contains", "Twitter", "Twitter", "Social Media", "Promoted", "Social Users", "Real-time"),
            ("Pinterest Pins", "contains", "Pinterest", "Pinterest", "Discovery", "Pins", "Visual Search", "Shopping"),
            ("Reddit Promoted", "contains", "Reddit", "Reddit", "Community", "Promoted", "Niche Communities", "Discussion"),
            
            # Generic fallback rules (lowest priority)
            ("Premium Network", "contains", "Premium", "Unknown", "Premium Network", "Unknown", "Premium Users", "High Value"),
            ("Dating Network", "contains", "Dating", "Unknown", "Dating Network", "Unknown", "Dating Seekers", "Romance"),
            ("Default Rule", "regex", ".*", "Unknown", "Unknown Network", "Unknown", "General", "Standard")
        ]
        
        for rule_name, pattern_type, pattern_value, network, domain, placement, targeting, special in default_rules:
            priority = 100 if rule_name == "Default Rule" else 1000 - len(default_rules)
            
            cursor.execute("""
                INSERT OR IGNORE INTO hierarchy_rules 
                (rule_name, pattern_type, pattern_value, network, domain, placement, targeting, special, priority)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (rule_name, pattern_type, pattern_value, network, domain, placement, targeting, special, priority))
        
        conn.commit()
        print(f"Default hierarchy rules inserted at {datetime.now(timezone.utc)}")

def initialize_database(db_path: str = "datawarehouse.db") -> sqlite3.Connection:
    """Initialize database with schema and default data"""
    conn = sqlite3.connect(db_path, check_same_thread=False)
    
    # Enable foreign key constraints
    conn.execute("PRAGMA foreign_keys = ON")
    
    # Create schema
    DatabaseSchema.create_tables(conn)
    
    # Insert default rules
    DatabaseSchema.insert_default_hierarchy_rules(conn)
    
    return conn

if __name__ == "__main__":
    # Test database creation
    conn = initialize_database("test_datawarehouse.db")
    print("Database initialized successfully!")
    conn.close()
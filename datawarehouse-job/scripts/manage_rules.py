#!/usr/bin/env python3
"""
Professional CLI tool for managing hierarchy mapping rules
Supports YAML validation, hot reloading, testing, and backup management
"""
import os
import sys
import yaml
import shutil  
import sqlite3
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
import argparse
import re

# Add project root to Python path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.database.operations import DatabaseOperations
from src.database.schema import initialize_database

class RuleManager:
    """Professional rule management system with YAML support"""
    
    def __init__(self):
        self.project_root = PROJECT_ROOT
        self.config_dir = self.project_root / "config"
        self.rules_file = self.config_dir / "hierarchy_rules.yaml"
        self.schema_file = self.config_dir / "rules_schema.yaml"
        self.backup_dir = self.config_dir / "rules_backup"
        self.db_path = self.project_root / "datawarehouse.db"
        
        # Ensure directories exist
        self.config_dir.mkdir(exist_ok=True)
        self.backup_dir.mkdir(exist_ok=True)
    
    def load_rules(self) -> Dict[str, Any]:
        """Load rules from YAML file with validation"""
        if not self.rules_file.exists():
            raise FileNotFoundError(f"Rules file not found: {self.rules_file}")
        
        try:
            with open(self.rules_file, 'r', encoding='utf-8') as f:
                rules_data = yaml.safe_load(f)
            
            print(f"SUCCESS: Loaded {len(rules_data.get('rules', []))} rules from YAML")
            return rules_data
            
        except yaml.YAMLError as e:
            raise ValueError(f"Invalid YAML syntax: {e}")
        except Exception as e:
            raise RuntimeError(f"Error loading rules: {e}")
    
    def validate_rules(self, rules_data: Dict[str, Any] = None) -> List[str]:
        """Validate rules structure and business logic"""
        if rules_data is None:
            rules_data = self.load_rules()
        
        errors = []
        
        # Basic structure validation
        if 'rules' not in rules_data:
            errors.append("Missing 'rules' section")
            return errors
        
        if 'version' not in rules_data:
            errors.append("Missing 'version' field")
        
        rules = rules_data['rules']
        if not isinstance(rules, list) or len(rules) == 0:
            errors.append("Rules must be a non-empty list")
            return errors
        
        # Validate individual rules
        priorities = []
        pattern_types = ['contains', 'starts_with', 'ends_with', 'regex', 'exact']
        required_mapping_fields = ['network', 'domain', 'placement', 'targeting', 'special']
        
        for i, rule in enumerate(rules):
            rule_name = rule.get('name', f'Rule {i+1}')
            
            # Required fields
            for field in ['name', 'priority', 'pattern_type', 'pattern_value', 'mapping', 'active']:
                if field not in rule:
                    errors.append(f"{rule_name}: Missing required field '{field}'")
            
            # Priority validation
            priority = rule.get('priority')
            if priority is not None:
                if not isinstance(priority, int) or priority < 1:
                    errors.append(f"{rule_name}: Priority must be positive integer")
                elif priority in priorities:
                    errors.append(f"{rule_name}: Duplicate priority {priority}")
                else:
                    priorities.append(priority)
            
            # Pattern type validation
            pattern_type = rule.get('pattern_type')
            if pattern_type and pattern_type not in pattern_types:
                errors.append(f"{rule_name}: Invalid pattern_type '{pattern_type}'. Must be one of: {pattern_types}")
            
            # Regex validation
            if pattern_type == 'regex':
                pattern_value = rule.get('pattern_value', '')
                try:
                    re.compile(pattern_value)
                except re.error as e:
                    errors.append(f"{rule_name}: Invalid regex pattern: {e}")
            
            # Mapping validation
            mapping = rule.get('mapping', {})
            if isinstance(mapping, dict):
                for field in required_mapping_fields:
                    if field not in mapping:
                        errors.append(f"{rule_name}: Missing mapping field '{field}'")
                    elif not mapping[field] or not isinstance(mapping[field], str):
                        errors.append(f"{rule_name}: Mapping field '{field}' must be non-empty string")
        
        # Business logic validation
        has_fallback = any(rule.get('priority', 999) <= 10 for rule in rules)
        if not has_fallback:
            errors.append("No fallback rule found (priority <= 10)")
        
        return errors
    
    def backup_rules(self) -> Optional[Path]:
        """Create timestamped backup of current rules"""
        if not self.rules_file.exists():
            print("No rules file to backup")
            return None
        
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
        backup_path = self.backup_dir / f"{timestamp}.yaml"
        
        try:
            shutil.copy2(self.rules_file, backup_path)
            print(f"SUCCESS: Rules backed up to {backup_path}")
            
            # Clean up old backups (keep only backup_count)
            self._cleanup_old_backups()
            
            return backup_path
            
        except Exception as e:
            print(f"ERROR: Failed to backup rules: {e}")
            return None
    
    def _cleanup_old_backups(self, keep_count: int = 10):
        """Clean up old backup files"""
        try:
            backups = sorted(self.backup_dir.glob("*.yaml"), key=lambda p: p.stat().st_mtime, reverse=True)
            
            for backup in backups[keep_count:]:
                backup.unlink()
                print(f"Cleaned up old backup: {backup.name}")
                
        except Exception as e:
            print(f"WARNING: Failed to cleanup old backups: {e}")
    
    def reload_to_database(self) -> bool:
        """Reload rules from YAML to database"""
        print("RELOADING: Loading rules from YAML to database...")
        
        try:
            # Validate rules first
            rules_data = self.load_rules()
            errors = self.validate_rules(rules_data)
            
            if errors:
                print("VALIDATION ERRORS:")
                for error in errors:
                    print(f"  - {error}")
                return False
            
            # Backup current rules
            self.backup_rules()
            
            # Initialize database connection
            conn = initialize_database(str(self.db_path))
            db_ops = DatabaseOperations(conn)
            
            # Clear existing rules
            cursor = conn.cursor()
            cursor.execute("DELETE FROM hierarchy_rules")
            print("Cleared existing database rules")
            
            # Insert new rules
            rules = rules_data['rules']
            inserted_count = 0
            
            for rule in rules:
                if not rule.get('active', True):
                    continue
                
                rule_data = {
                    'rule_name': rule['name'],
                    'pattern_type': rule['pattern_type'],
                    'pattern_value': rule['pattern_value'],
                    'network': rule['mapping']['network'],
                    'domain': rule['mapping']['domain'],
                    'placement': rule['mapping']['placement'],
                    'targeting': rule['mapping']['targeting'],
                    'special': rule['mapping']['special'],
                    'priority': rule['priority']
                }
                
                db_ops.add_hierarchy_rule(rule_data)
                inserted_count += 1
            
            conn.commit()
            conn.close()
            
            print(f"SUCCESS: Reloaded {inserted_count} active rules to database")
            return True
            
        except Exception as e:
            print(f"ERROR: Failed to reload rules: {e}")
            return False
    
    def test_campaign_mapping(self, campaign_name: str) -> Dict[str, Any]:
        """Test how a campaign name would be mapped"""
        print(f"TESTING: Campaign mapping for '{campaign_name}'")
        
        try:
            rules_data = self.load_rules()
            rules = sorted(rules_data['rules'], key=lambda r: r.get('priority', 0), reverse=True)
            
            matched_rules = []
            final_mapping = {
                'network': 'Unknown',
                'domain': 'Unknown Network', 
                'placement': 'Unknown',
                'targeting': 'Unknown',
                'special': 'Standard'
            }
            
            # Process rules in priority order
            for rule in rules:
                if not rule.get('active', True):
                    continue
                
                pattern_type = rule['pattern_type']
                pattern_value = rule['pattern_value']
                
                # Check if rule matches
                matches = False
                if pattern_type == 'exact':
                    matches = campaign_name.lower() == pattern_value.lower()
                elif pattern_type == 'contains':
                    matches = pattern_value.lower() in campaign_name.lower()
                elif pattern_type == 'starts_with':
                    matches = campaign_name.lower().startswith(pattern_value.lower())
                elif pattern_type == 'ends_with':
                    matches = campaign_name.lower().endswith(pattern_value.lower())
                elif pattern_type == 'regex':
                    try:
                        matches = bool(re.search(pattern_value, campaign_name, re.IGNORECASE))
                    except re.error:
                        continue
                
                if matches:
                    matched_rules.append({
                        'name': rule['name'],
                        'priority': rule['priority'],
                        'pattern': f"{pattern_type}: {pattern_value}"
                    })
                    
                    # Apply mapping (inherit or override)
                    mapping = rule['mapping']
                    for field in ['network', 'domain', 'placement', 'targeting', 'special']:
                        value = mapping.get(field, 'inherit')
                        if value != 'inherit':
                            final_mapping[field] = value
            
            # Calculate confidence
            confidence = min(1.0, len(matched_rules) * 0.3) if matched_rules else 0.1
            
            result = {
                'campaign_name': campaign_name,
                'matched_rules': matched_rules,
                'final_mapping': final_mapping,
                'confidence': confidence
            }
            
            # Display results
            print(f"\\nMatched Rules ({len(matched_rules)}):")
            for rule in matched_rules:
                print(f"  - {rule['name']} (priority: {rule['priority']}) - {rule['pattern']}")
            
            print(f"\\nFinal Mapping:")
            for field, value in final_mapping.items():
                print(f"  {field.capitalize()}: {value}")
            
            print(f"\\nConfidence: {confidence:.2f}")
            
            return result
            
        except Exception as e:
            print(f"ERROR: Failed to test campaign mapping: {e}")
            return {}
    
    def show_statistics(self) -> Dict[str, Any]:
        """Show rule statistics and database status"""
        print("STATISTICS: Rule Management Statistics")
        print("=" * 50)
        
        stats = {}
        
        try:
            # YAML file stats
            if self.rules_file.exists():
                rules_data = self.load_rules()
                rules = rules_data.get('rules', [])
                active_rules = [r for r in rules if r.get('active', True)]
                
                stats['yaml'] = {
                    'total_rules': len(rules),
                    'active_rules': len(active_rules),
                    'file_size': self.rules_file.stat().st_size,
                    'last_modified': datetime.fromtimestamp(self.rules_file.stat().st_mtime, tz=timezone.utc)
                }
                
                print(f"YAML Rules File:")
                print(f"  Total Rules: {len(rules)}")
                print(f"  Active Rules: {len(active_rules)}")
                print(f"  File Size: {stats['yaml']['file_size']} bytes")
                print(f"  Last Modified: {stats['yaml']['last_modified']}")
            
            # Database stats
            if self.db_path.exists():
                conn = sqlite3.connect(str(self.db_path))
                cursor = conn.cursor()
                
                cursor.execute("SELECT COUNT(*) FROM hierarchy_rules")
                db_rule_count = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM campaigns")
                campaign_count = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM campaign_hierarchy")
                mapped_campaigns = cursor.fetchone()[0]
                
                conn.close()
                
                stats['database'] = {
                    'rules_in_db': db_rule_count,
                    'total_campaigns': campaign_count,
                    'mapped_campaigns': mapped_campaigns
                }
                
                print(f"\\nDatabase:")
                print(f"  Rules in Database: {db_rule_count}")
                print(f"  Total Campaigns: {campaign_count}")
                print(f"  Mapped Campaigns: {mapped_campaigns}")
            
            # Backup stats
            backups = list(self.backup_dir.glob("*.yaml"))
            stats['backups'] = len(backups)
            
            print(f"\\nBackups: {len(backups)} backup files")
            
            return stats
            
        except Exception as e:
            print(f"ERROR: Failed to generate statistics: {e}")
            return {}

def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(description="Hierarchy Rules Management CLI")
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate rules YAML file')
    
    # Reload command  
    reload_parser = subparsers.add_parser('reload', help='Reload rules from YAML to database')
    
    # Test command
    test_parser = subparsers.add_parser('test', help='Test campaign name mapping')
    test_parser.add_argument('campaign_name', help='Campaign name to test')
    
    # Backup command
    backup_parser = subparsers.add_parser('backup', help='Create backup of current rules')
    
    # Stats command
    stats_parser = subparsers.add_parser('stats', help='Show rule statistics')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    manager = RuleManager()
    
    try:
        if args.command == 'validate':
            print("VALIDATING: Checking rules YAML file...")
            errors = manager.validate_rules()
            
            if errors:
                print("VALIDATION FAILED:")
                for error in errors:
                    print(f"  - {error}")
                sys.exit(1)
            else:
                print("SUCCESS: Rules validation passed!")
        
        elif args.command == 'reload':
            success = manager.reload_to_database()
            sys.exit(0 if success else 1)
        
        elif args.command == 'test':
            result = manager.test_campaign_mapping(args.campaign_name)
            sys.exit(0 if result else 1)
        
        elif args.command == 'backup':
            backup_path = manager.backup_rules()
            sys.exit(0 if backup_path else 1)
        
        elif args.command == 'stats':
            stats = manager.show_statistics()
            sys.exit(0 if stats else 1)
        
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
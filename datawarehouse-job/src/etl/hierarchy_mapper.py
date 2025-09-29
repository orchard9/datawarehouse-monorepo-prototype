#!/usr/bin/env python3
"""
Campaign Hierarchy Mapper - Maps campaign names to 5-tier hierarchy using YAML rules
Supports pattern matching, priority-based rules, confidence scoring, and inheritance
"""
import re
import yaml
import sqlite3
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timezone

class HierarchyMapper:
    """Maps campaign names to hierarchical structure using configurable YAML rules"""
    
    def __init__(self, db_ops, rules_file_path: Optional[str] = None):
        """
        Initialize hierarchy mapper
        
        Args:
            db_ops: DatabaseOperations instance
            rules_file_path: Optional path to YAML rules file
        """
        self.db_ops = db_ops
        
        # Set up rules file path
        if rules_file_path:
            self.rules_file = Path(rules_file_path)
        else:
            # Default to project config directory
            project_root = Path(__file__).parent.parent.parent
            self.rules_file = project_root / "config" / "hierarchy_rules.yaml"
        
        # Cache for loaded rules
        self._cached_rules = None
        self._cache_timestamp = None
        
        # Default hierarchy for unknowns
        self.default_hierarchy = {
            'network': 'Unknown',
            'domain': 'Unknown Network',
            'placement': 'Unknown',
            'targeting': 'Unknown',
            'special': 'Standard'
        }
    
    def load_rules_from_yaml(self, force_reload: bool = False) -> List[Dict[str, Any]]:
        """
        Load hierarchy rules from YAML file with caching
        
        Args:
            force_reload: Force reload even if cached version exists
            
        Returns:
            List of rule dictionaries sorted by priority (highest first)
        """
        # Check if we need to reload
        if not force_reload and self._cached_rules is not None:
            if self.rules_file.exists():
                file_mtime = datetime.fromtimestamp(self.rules_file.stat().st_mtime, tz=timezone.utc)
                if self._cache_timestamp and file_mtime <= self._cache_timestamp:
                    return self._cached_rules
        
        # Load rules from YAML
        try:
            if not self.rules_file.exists():
                print(f"WARNING: Rules file not found: {self.rules_file}")
                return []
            
            with open(self.rules_file, 'r', encoding='utf-8') as f:
                rules_data = yaml.safe_load(f)
            
            if not rules_data or 'rules' not in rules_data:
                print("WARNING: No rules found in YAML file")
                return []
            
            # Filter active rules and sort by priority (highest first)
            active_rules = [
                rule for rule in rules_data['rules'] 
                if rule.get('active', True)
            ]
            
            sorted_rules = sorted(active_rules, key=lambda r: r.get('priority', 0), reverse=True)
            
            # Cache the results
            self._cached_rules = sorted_rules
            self._cache_timestamp = datetime.now(timezone.utc)
            
            print(f"SUCCESS: Loaded {len(sorted_rules)} active rules from YAML")
            return sorted_rules
            
        except Exception as e:
            print(f"ERROR: Failed to load rules from YAML: {e}")
            return []
    
    def load_rules_from_database(self) -> List[Dict[str, Any]]:
        """
        Load hierarchy rules from database as fallback
        
        Returns:
            List of rule dictionaries sorted by priority (highest first)
        """
        try:
            db_rules = self.db_ops.get_hierarchy_rules()
            
            # Convert database format to YAML format
            converted_rules = []
            for rule in db_rules:
                converted_rule = {
                    'name': rule['rule_name'],
                    'priority': rule['priority'],
                    'pattern_type': rule['pattern_type'],
                    'pattern_value': rule['pattern_value'],
                    'mapping': {
                        'network': rule['network'],
                        'domain': rule['domain'],
                        'placement': rule['placement'],
                        'targeting': rule['targeting'],
                        'special': rule['special']
                    },
                    'active': True
                }
                converted_rules.append(converted_rule)
            
            # Sort by priority (highest first)
            sorted_rules = sorted(converted_rules, key=lambda r: r.get('priority', 0), reverse=True)
            
            print(f"SUCCESS: Loaded {len(sorted_rules)} rules from database")
            return sorted_rules
            
        except Exception as e:
            print(f"ERROR: Failed to load rules from database: {e}")
            return []
    
    def get_rules(self, prefer_yaml: bool = True) -> List[Dict[str, Any]]:
        """
        Get hierarchy rules, preferring YAML over database
        
        Args:
            prefer_yaml: Whether to prefer YAML file over database
            
        Returns:
            List of rule dictionaries
        """
        if prefer_yaml:
            yaml_rules = self.load_rules_from_yaml()
            if yaml_rules:
                return yaml_rules
            
            print("FALLBACK: Using database rules since YAML failed")
            return self.load_rules_from_database()
        else:
            return self.load_rules_from_database()
    
    def match_rule(self, campaign_name: str, rule: Dict[str, Any]) -> bool:
        """
        Check if a campaign name matches a specific rule
        
        Args:
            campaign_name: Campaign name to test
            rule: Rule dictionary with pattern_type and pattern_value
            
        Returns:
            True if rule matches, False otherwise
        """
        pattern_type = rule.get('pattern_type', '').lower()
        pattern_value = rule.get('pattern_value', '')
        
        if not pattern_type or not pattern_value:
            return False
        
        # Case-insensitive matching by default
        campaign_lower = campaign_name.lower()
        pattern_lower = pattern_value.lower()
        
        try:
            if pattern_type == 'exact':
                return campaign_lower == pattern_lower
            
            elif pattern_type == 'contains':
                return pattern_lower in campaign_lower
            
            elif pattern_type == 'starts_with':
                return campaign_lower.startswith(pattern_lower)
            
            elif pattern_type == 'ends_with':
                return campaign_lower.endswith(pattern_lower)
            
            elif pattern_type == 'regex':
                return bool(re.search(pattern_value, campaign_name, re.IGNORECASE))
            
            else:
                print(f"WARNING: Unknown pattern type: {pattern_type}")
                return False
                
        except re.error as e:
            print(f"WARNING: Invalid regex pattern '{pattern_value}': {e}")
            return False
        except Exception as e:
            print(f"WARNING: Error matching rule: {e}")
            return False
    
    def apply_mapping_rules(self, campaign_name: str) -> Tuple[Dict[str, str], List[Dict[str, Any]], float]:
        """
        Apply hierarchy mapping rules to a campaign name
        
        Args:
            campaign_name: Campaign name to map
            
        Returns:
            Tuple of (final_mapping, matched_rules, confidence_score)
        """
        rules = self.get_rules()
        
        if not rules:
            print(f"WARNING: No rules available for mapping '{campaign_name}'")
            return self.default_hierarchy.copy(), [], 0.1
        
        matched_rules = []
        final_mapping = self.default_hierarchy.copy()
        
        # Apply rules in priority order (highest first)
        for rule in rules:
            if self.match_rule(campaign_name, rule):
                matched_rules.append({
                    'name': rule['name'],
                    'priority': rule.get('priority', 0),
                    'pattern_type': rule.get('pattern_type', ''),
                    'pattern_value': rule.get('pattern_value', '')
                })
                
                # Apply mapping with inheritance support
                mapping = rule.get('mapping', {})
                for field in ['network', 'domain', 'placement', 'targeting', 'special']:
                    value = mapping.get(field)
                    # Only set field if it's not already set by a higher priority rule
                    if value and value != 'inherit' and final_mapping[field] == self.default_hierarchy[field]:
                        final_mapping[field] = value
        
        # Calculate confidence score
        confidence = self.get_mapping_confidence(campaign_name, final_mapping, matched_rules)
        
        return final_mapping, matched_rules, confidence
    
    def get_mapping_confidence(self, campaign_name: str, mapping: Dict[str, str], matched_rules: List[Dict[str, Any]]) -> float:
        """
        Calculate confidence score for a mapping
        
        Args:
            campaign_name: Original campaign name
            mapping: Final mapping result
            matched_rules: List of rules that matched
            
        Returns:
            Confidence score between 0.0 and 1.0
        """
        if not matched_rules:
            return 0.1  # Very low confidence for unmapped campaigns
        
        # Base confidence from number of matched rules
        base_confidence = min(0.8, len(matched_rules) * 0.2)
        
        # Bonus for exact matches
        exact_matches = [r for r in matched_rules if r.get('pattern_type') == 'exact']
        if exact_matches:
            base_confidence += 0.2
        
        # Bonus for high-priority rules
        high_priority_matches = [r for r in matched_rules if r.get('priority', 0) >= 900]
        if high_priority_matches:
            base_confidence += 0.1
        
        # Penalty for too many "Unknown" values
        unknown_count = sum(1 for value in mapping.values() if 'Unknown' in value)
        if unknown_count >= 3:
            base_confidence -= 0.2
        
        # Ensure confidence stays within bounds
        return max(0.1, min(1.0, base_confidence))
    
    def map_campaign(self, campaign_name: str) -> Dict[str, Any]:
        """
        Map a single campaign name to hierarchy structure
        
        Args:
            campaign_name: Campaign name to map
            
        Returns:
            Dictionary with mapping results and metadata
        """
        mapping, matched_rules, confidence = self.apply_mapping_rules(campaign_name)
        
        return {
            'campaign_name': campaign_name,
            'network': mapping['network'],
            'domain': mapping['domain'],
            'placement': mapping['placement'],
            'targeting': mapping['targeting'],
            'special': mapping['special'],
            'mapping_confidence': confidence,
            'matched_rules': matched_rules,
            'mapped_at': datetime.now(timezone.utc).isoformat()
        }
    
    def map_campaigns_batch(self, campaign_names: List[str]) -> List[Dict[str, Any]]:
        """
        Map multiple campaign names in batch
        
        Args:
            campaign_names: List of campaign names to map
            
        Returns:
            List of mapping results
        """
        results = []
        
        print(f"MAPPING: Processing {len(campaign_names)} campaigns...")
        
        for i, campaign_name in enumerate(campaign_names):
            try:
                result = self.map_campaign(campaign_name)
                results.append(result)
                
                # Progress indicator
                if (i + 1) % 10 == 0 or (i + 1) == len(campaign_names):
                    print(f"  Processed {i + 1}/{len(campaign_names)} campaigns")
                    
            except Exception as e:
                print(f"ERROR: Failed to map campaign '{campaign_name}': {e}")
                # Add error result
                results.append({
                    'campaign_name': campaign_name,
                    'network': 'Error',
                    'domain': 'Error',
                    'placement': 'Error',
                    'targeting': 'Error',
                    'special': 'Error',
                    'mapping_confidence': 0.0,
                    'matched_rules': [],
                    'mapped_at': datetime.now(timezone.utc).isoformat(),
                    'error': str(e)
                })
        
        print(f"SUCCESS: Mapped {len(results)} campaigns")
        return results
    
    def handle_unknown_campaign(self, campaign_name: str) -> Dict[str, str]:
        """
        Handle campaigns that don't match any rules
        
        Args:
            campaign_name: Campaign name that couldn't be mapped
            
        Returns:
            Default hierarchy mapping
        """
        print(f"WARNING: No rules matched for campaign '{campaign_name}', using defaults")
        
        # Log to database for review
        try:
            # You could add a table for unmapped campaigns here
            pass
        except Exception as e:
            print(f"WARNING: Failed to log unmapped campaign: {e}")
        
        return self.default_hierarchy.copy()
    
    def get_mapping_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about current mapping rules and performance
        
        Returns:
            Statistics dictionary
        """
        rules = self.get_rules()
        
        stats = {
            'total_rules': len(rules),
            'rules_by_priority': {},
            'rules_by_pattern_type': {},
            'confidence_distribution': {},
            'cache_status': {
                'cached_rules': self._cached_rules is not None,
                'cache_timestamp': self._cache_timestamp.isoformat() if self._cache_timestamp else None
            }
        }
        
        # Analyze rules
        for rule in rules:
            priority = rule.get('priority', 0)
            pattern_type = rule.get('pattern_type', 'unknown')
            
            # Priority distribution
            priority_range = f"{priority//100*100}-{priority//100*100+99}"
            stats['rules_by_priority'][priority_range] = stats['rules_by_priority'].get(priority_range, 0) + 1
            
            # Pattern type distribution
            stats['rules_by_pattern_type'][pattern_type] = stats['rules_by_pattern_type'].get(pattern_type, 0) + 1
        
        return stats
    
    def reload_rules_cache(self) -> bool:
        """
        Force reload of rules cache from YAML file
        
        Returns:
            True if successful, False otherwise
        """
        try:
            self._cached_rules = None
            self._cache_timestamp = None
            rules = self.load_rules_from_yaml(force_reload=True)
            return len(rules) > 0
        except Exception as e:
            print(f"ERROR: Failed to reload rules cache: {e}")
            return False
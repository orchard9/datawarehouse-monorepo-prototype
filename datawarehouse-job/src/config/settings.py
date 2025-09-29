#!/usr/bin/env python3
"""
Configuration management for Peach AI Data Warehouse
Loads settings from YAML files with environment variable overrides
"""
import os
import yaml
from pathlib import Path
from typing import Dict, Any, Optional

class Settings:
    """Configuration manager with YAML and environment variable support"""
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize settings manager
        
        Args:
            config_path: Path to config file, defaults to config/settings.yaml
        """
        if config_path:
            self.config_path = Path(config_path)
        else:
            # Default to config/settings.yaml relative to project root
            project_root = Path(__file__).parent.parent.parent
            self.config_path = project_root / "config" / "settings.yaml"
        
        self._settings = {}
        self.load_settings()
    
    def load_settings(self) -> None:
        """Load settings from YAML file with environment variable overrides"""
        
        # Load from YAML file
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    self._settings = yaml.safe_load(f) or {}
            except Exception as e:
                print(f"WARNING: Failed to load settings from {self.config_path}: {e}")
                self._settings = {}
        else:
            print(f"WARNING: Settings file not found: {self.config_path}")
            self._settings = {}
        
        # Apply environment variable overrides
        self._apply_env_overrides()
    
    def _apply_env_overrides(self) -> None:
        """Apply environment variable overrides"""
        
        # API settings
        if os.getenv('PEACHAI_API_URL'):
            self.set_nested('api.base_url', os.getenv('PEACHAI_API_URL'))
        
        if os.getenv('PEACHAI_API_TOKEN'):
            self.set_nested('api.bearer_token', os.getenv('PEACHAI_API_TOKEN'))
        
        if os.getenv('PEACHAI_API_TIMEOUT'):
            try:
                self.set_nested('api.timeout', int(os.getenv('PEACHAI_API_TIMEOUT')))
            except ValueError:
                pass
        
        # Database settings
        if os.getenv('PEACHAI_DB_PATH'):
            self.set_nested('database.path', os.getenv('PEACHAI_DB_PATH'))
        
        # Google Sheets settings
        if os.getenv('GOOGLE_CREDENTIALS_PATH'):
            self.set_nested('google_sheets.credentials_path', os.getenv('GOOGLE_CREDENTIALS_PATH'))
        
        # Logging settings
        if os.getenv('LOG_LEVEL'):
            self.set_nested('logging.level', os.getenv('LOG_LEVEL').upper())
        
        if os.getenv('LOG_FILE'):
            self.set_nested('logging.file', os.getenv('LOG_FILE'))
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get configuration value using dot notation
        
        Args:
            key: Configuration key (e.g., 'api.base_url')
            default: Default value if key not found
            
        Returns:
            Configuration value or default
        """
        keys = key.split('.')
        value = self._settings
        
        try:
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default
    
    def set_nested(self, key: str, value: Any) -> None:
        """
        Set configuration value using dot notation
        
        Args:
            key: Configuration key (e.g., 'api.base_url')
            value: Value to set
        """
        keys = key.split('.')
        current = self._settings
        
        # Navigate to parent dict
        for k in keys[:-1]:
            if k not in current:
                current[k] = {}
            current = current[k]
        
        # Set the value
        current[keys[-1]] = value
    
    def get_api_config(self) -> Dict[str, Any]:
        """Get API configuration"""
        return {
            'base_url': self.get('api.base_url', 'http://localhost:8000'),
            'bearer_token': self.get('api.bearer_token', 'test-token'),
            'timeout': self.get('api.timeout', 30),
            'retry_attempts': self.get('api.retry_attempts', 3)
        }
    
    def get_database_config(self) -> Dict[str, Any]:
        """Get database configuration"""
        return {
            'path': self.get('database.path', 'datawarehouse.db'),
            'backup_enabled': self.get('database.backup_enabled', True),
            'backup_retention_days': self.get('database.backup_retention_days', 30)
        }
    
    def get_google_sheets_config(self) -> Dict[str, Any]:
        """Get Google Sheets configuration"""
        return {
            'credentials_path': self.get('google_sheets.credentials_path', 'config/google_credentials.json'),
            'default_title': self.get('google_sheets.default_title', 'Campaign Performance Report')
        }
    
    def get_logging_config(self) -> Dict[str, Any]:
        """Get logging configuration"""
        return {
            'level': self.get('logging.level', 'INFO'),
            'file': self.get('logging.file', 'logs/datawarehouse.log'),
            'console': self.get('logging.console', True)
        }
    
    def get_etl_config(self) -> Dict[str, Any]:
        """Get ETL pipeline configuration"""
        return {
            'batch_size': self.get('etl.batch_size', 100),
            'parallel_workers': self.get('etl.parallel_workers', 4),
            'data_quality_threshold': self.get('etl.data_quality_threshold', 0.85)
        }
    
    def get_hierarchy_config(self) -> Dict[str, Any]:
        """Get hierarchy mapping configuration"""
        return {
            'rules_file': self.get('hierarchy.rules_file', 'config/hierarchy_rules.yaml'),
            'cache_enabled': self.get('hierarchy.cache_enabled', True),
            'confidence_threshold': self.get('hierarchy.confidence_threshold', 0.7)
        }
    
    def reload(self) -> None:
        """Reload settings from file"""
        self.load_settings()
    
    def __str__(self) -> str:
        """String representation of current settings"""
        return f"Settings loaded from: {self.config_path}"
    
    def __repr__(self) -> str:
        return f"Settings(config_path='{self.config_path}')"

# Global settings instance
_settings_instance = None

def get_settings(config_path: Optional[str] = None) -> Settings:
    """
    Get global settings instance
    
    Args:
        config_path: Optional config file path
        
    Returns:
        Settings instance
    """
    global _settings_instance
    if _settings_instance is None or config_path:
        _settings_instance = Settings(config_path)
    return _settings_instance
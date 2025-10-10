#!/usr/bin/env python3
"""
Main entry point for Peach AI Data Warehouse CLI
"""
import sys
from pathlib import Path

# Add project root to Python path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.cli.main import cli

if __name__ == "__main__":
    cli()
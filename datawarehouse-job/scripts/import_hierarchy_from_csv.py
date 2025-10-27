#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSV Hierarchy Import Script
Imports campaign hierarchy data from CSV into the database
"""
import sys
import csv
import sqlite3
import argparse
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict
from typing import List, Dict, Optional

# Fix Windows console encoding
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))
sys.path.insert(0, str(Path(__file__).parent))

from hierarchy_mapping_rules import extract_full_hierarchy


class CSVHierarchyImporter:
    """Import campaign hierarchy from CSV file"""

    def __init__(self, csv_path: str, db_path: str, dry_run: bool = False, verbose: bool = False):
        self.csv_path = Path(csv_path)
        self.db_path = Path(db_path)
        self.dry_run = dry_run
        self.verbose = verbose

        self.current_group_header = None
        self.mappings = []
        self.errors = []
        self.campaigns_not_found = []

        # Statistics
        self.total_campaigns = 0
        self.successful_imports = 0
        self.domain_counts = defaultdict(int)
        self.network_counts = defaultdict(int)

    def print_header(self):
        """Print script header"""
        print("=" * 60)
        print("CSV Hierarchy Import Script")
        if self.dry_run:
            print("MODE: DRY RUN (No database changes)")
        print("=" * 60)
        print()

    def parse_csv(self) -> List[Dict]:
        """
        Parse CSV file and extract campaign hierarchy

        Returns:
            List of hierarchy mappings
        """
        print(f"Loading CSV: {self.csv_path}")

        if not self.csv_path.exists():
            raise FileNotFoundError(f"CSV file not found: {self.csv_path}")

        mappings = []
        group_headers_count = 0

        with open(self.csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)

            # Skip first row (header with date)
            next(reader)
            # Skip second row (column headers)
            next(reader)
            # Skip third row (grand total)
            next(reader)

            for row_num, row in enumerate(reader, start=4):
                try:
                    # Skip empty rows
                    if not any(row):
                        continue

                    # Check if this is a group header row
                    # Group headers have empty col 0 and empty col 1, but value in col 2
                    if (not row[0].strip() or row[0].strip() == '') and \
                       (not row[1].strip() or row[1].strip() == '') and \
                       len(row) > 2 and row[2].strip():
                        self.current_group_header = row[2].strip()
                        group_headers_count += 1
                        if self.verbose:
                            print(f"  Found group header: {self.current_group_header}")
                        continue

                    # Check if this is a campaign data row
                    # Campaign rows have name in col 0 and ID in col 1
                    if row[0].strip() and row[1].strip():
                        campaign_name = row[0].strip()
                        try:
                            campaign_id = int(row[1].strip())
                        except ValueError:
                            # Not a valid campaign row
                            continue

                        # Extract hierarchy using our mapping rules
                        hierarchy = extract_full_hierarchy(
                            campaign_id=campaign_id,
                            campaign_name=campaign_name,
                            group_header=self.current_group_header
                        )

                        mappings.append(hierarchy)
                        self.total_campaigns += 1

                        # Track statistics
                        self.domain_counts[hierarchy['domain']] += 1
                        self.network_counts[hierarchy['network']] += 1

                except Exception as e:
                    error_msg = f"Row {row_num}: Error parsing row - {str(e)}"
                    self.errors.append(error_msg)
                    if self.verbose:
                        print(f"  ✗ {error_msg}")

        print(f"✓ Found {self.total_campaigns} campaigns, {group_headers_count} group headers")
        print()

        return mappings

    def connect_database(self) -> Optional[sqlite3.Connection]:
        """Connect to SQLite database"""
        if self.dry_run:
            print(f"DRY RUN: Would connect to database: {self.db_path}")
            print()
            return None

        print(f"Connecting to database: {self.db_path}")

        if not self.db_path.exists():
            raise FileNotFoundError(f"Database file not found: {self.db_path}")

        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        print("✓ Database connection established")
        print()

        return conn

    def import_to_database(self, conn: Optional[sqlite3.Connection], mappings: List[Dict]):
        """
        Import hierarchy mappings to database

        Args:
            conn: Database connection (None if dry run)
            mappings: List of hierarchy mappings to import
        """
        print(f"Processing campaigns...")
        print()

        for idx, mapping in enumerate(mappings, start=1):
            campaign_id = mapping['campaign_id']
            campaign_name = mapping['campaign_name']

            try:
                # Check if campaign exists in database
                if conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT id FROM campaigns WHERE id = ?", (campaign_id,))
                    if not cursor.fetchone():
                        self.campaigns_not_found.append(campaign_id)
                        if self.verbose:
                            print(f"[{idx}/{self.total_campaigns}] ⚠ ID {campaign_id} ({campaign_name}) - Not found in database, skipping")
                        continue

                # Display mapping
                if self.verbose or (idx <= 5):  # Show first 5 always
                    print(f"[{idx}/{self.total_campaigns}] ✓ ID {campaign_id} ({campaign_name})")
                    print(f"  → Network: {mapping['network']} | Domain: {mapping['domain']}")
                    print(f"  → Placement: {mapping['placement']} | Targeting: {mapping['targeting']} | Special: {mapping['special']}")

                # Insert into database
                if conn and not self.dry_run:
                    cursor.execute("""
                        INSERT OR REPLACE INTO campaign_hierarchy
                        (campaign_id, campaign_name, network, domain, placement, targeting, special,
                         mapping_confidence, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 1.0, ?)
                    """, (
                        campaign_id,
                        campaign_name,
                        mapping['network'],
                        mapping['domain'],
                        mapping['placement'],
                        mapping['targeting'],
                        mapping['special'],
                        datetime.now(timezone.utc).isoformat()
                    ))

                self.successful_imports += 1

            except Exception as e:
                error_msg = f"Campaign {campaign_id} ({campaign_name}): {str(e)}"
                self.errors.append(error_msg)
                if self.verbose:
                    print(f"[{idx}/{self.total_campaigns}] ✗ {error_msg}")

        if conn and not self.dry_run:
            conn.commit()

        print()

    def print_summary(self, mappings: List[Dict]):
        """Print import summary statistics"""
        print("=" * 60)
        print("Import Summary")
        print("=" * 60)

        print(f"✓ Successfully imported: {self.successful_imports} campaigns")

        if self.campaigns_not_found:
            print(f"⚠ Campaigns not in database: {len(self.campaigns_not_found)}")
            if self.verbose:
                print(f"  IDs: {', '.join(map(str, self.campaigns_not_found))}")

        if self.errors:
            print(f"✗ Parsing errors: {len(self.errors)}")
            if self.verbose:
                for error in self.errors:
                    print(f"  - {error}")
        else:
            print(f"✗ Parsing errors: 0")

        print()
        print("Domain Distribution:")
        for domain, count in sorted(self.domain_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  {domain}: {count} campaigns")

        print()
        print("Network Distribution:")
        top_networks = sorted(self.network_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        for network, count in top_networks:
            print(f"  {network}: {count} campaigns")
        if len(self.network_counts) > 10:
            print(f"  ... ({len(self.network_counts) - 10} more networks)")

        print()
        print("=" * 60)
        print("Sample Mappings (First 5)")
        print("=" * 60)

        for idx, mapping in enumerate(mappings[:5], start=1):
            print(f"{idx}. {mapping['campaign_name']} ({mapping['campaign_id']})")
            print(f"   → Network: {mapping['network']} | Domain: {mapping['domain']}")
            print(f"   → Placement: {mapping['placement']} | Targeting: {mapping['targeting']} | Special: {mapping['special']}")
            print()

        print("=" * 60)
        if self.dry_run:
            print("✓ Dry run completed successfully!")
            print("  Run without --dry-run to perform actual import")
        else:
            print("✓ Import completed successfully!")
        print("=" * 60)

    def run(self):
        """Execute the import process"""
        self.print_header()

        try:
            # Parse CSV
            mappings = self.parse_csv()

            if not mappings:
                print("No campaigns found in CSV file")
                return

            # Connect to database
            conn = self.connect_database()

            # Import to database
            self.import_to_database(conn, mappings)

            # Close connection
            if conn:
                conn.close()

            # Print summary
            self.print_summary(mappings)

        except Exception as e:
            print(f"\n✗ ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            sys.exit(1)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Import campaign hierarchy from CSV to database'
    )
    parser.add_argument(
        '--csv',
        required=True,
        help='Path to CSV file'
    )
    parser.add_argument(
        '--db',
        required=True,
        help='Path to SQLite database file'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview mappings without importing to database'
    )
    parser.add_argument(
        '--verbose',
        '-v',
        action='store_true',
        help='Show detailed output for all campaigns'
    )

    args = parser.parse_args()

    importer = CSVHierarchyImporter(
        csv_path=args.csv,
        db_path=args.db,
        dry_run=args.dry_run,
        verbose=args.verbose
    )

    importer.run()


if __name__ == '__main__':
    main()

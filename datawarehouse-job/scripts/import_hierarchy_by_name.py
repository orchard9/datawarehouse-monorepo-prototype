#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Name-Based CSV Hierarchy Import Script
Imports campaign hierarchy from CSV by matching campaign NAMES instead of IDs
This solves issues where CSV IDs don't match database IDs
"""
import sys
import csv
import sqlite3
import argparse
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict
from typing import List, Dict, Optional
from difflib import get_close_matches

# Fix Windows console encoding
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


def clean_field(value: str, default: str = 'Unknown') -> str:
    """
    Clean field value, replace 'none' with default

    Args:
        value: Raw field value from CSV
        default: Default value for 'none' or empty fields

    Returns:
        Cleaned field value
    """
    if not value:
        return default

    value = value.strip()

    # Replace 'none' with default
    if value.lower() == 'none':
        return default

    # Return cleaned value
    return value


def normalize_name(name: str) -> str:
    """
    Normalize campaign name for matching
    - Convert to lowercase
    - Remove extra whitespace
    - Remove special characters that might differ

    Args:
        name: Campaign name

    Returns:
        Normalized name for matching
    """
    return name.lower().strip().replace('  ', ' ')


class NameBasedHierarchyImporter:
    """Import campaign hierarchy from CSV by matching campaign names"""

    def __init__(self, csv_path: str, db_path: str, dry_run: bool = False, verbose: bool = False):
        self.csv_path = Path(csv_path)
        self.db_path = Path(db_path)
        self.dry_run = dry_run
        self.verbose = verbose

        self.mappings = []
        self.errors = []
        self.campaigns_not_found = []
        self.fuzzy_matches = []
        self.exact_matches = 0

        # Statistics
        self.total_csv_campaigns = 0
        self.successful_imports = 0
        self.domain_counts = defaultdict(int)
        self.network_counts = defaultdict(int)

        # Database campaigns cache (name -> id mapping)
        self.db_campaigns = {}

    def print_header(self):
        """Print script header"""
        print("=" * 70)
        print("Name-Based CSV Hierarchy Import Script")
        print("Matches campaigns by NAME instead of ID")
        if self.dry_run:
            print("MODE: DRY RUN (No database changes)")
        print("=" * 70)
        print()

    def load_database_campaigns(self, conn: sqlite3.Connection):
        """
        Load all campaigns from database into memory
        Creates a mapping of normalized name -> campaign record

        Args:
            conn: Database connection
        """
        print("Loading campaigns from database...")
        cursor = conn.cursor()
        cursor.execute("SELECT id, name FROM campaigns")

        for row in cursor.fetchall():
            campaign_id = row[0]
            campaign_name = row[1]
            normalized_name = normalize_name(campaign_name)
            self.db_campaigns[normalized_name] = {
                'id': campaign_id,
                'name': campaign_name,
                'normalized': normalized_name
            }

        print(f"✓ Loaded {len(self.db_campaigns)} campaigns from database")
        print()

    def find_campaign_by_name(self, csv_name: str) -> Optional[Dict]:
        """
        Find campaign in database by name
        - First tries exact match (normalized)
        - Then tries fuzzy match if exact fails

        Args:
            csv_name: Campaign name from CSV

        Returns:
            Campaign dict if found, None otherwise
        """
        normalized_csv = normalize_name(csv_name)

        # Try exact match first
        if normalized_csv in self.db_campaigns:
            return self.db_campaigns[normalized_csv]

        # Try fuzzy match
        all_names = list(self.db_campaigns.keys())
        matches = get_close_matches(normalized_csv, all_names, n=1, cutoff=0.85)

        if matches:
            matched_name = matches[0]
            return self.db_campaigns[matched_name]

        return None

    def parse_csv(self) -> List[Dict]:
        """
        Parse CSV file with explicit hierarchy columns

        Returns:
            List of hierarchy mappings with matched database IDs
        """
        print(f"Loading CSV: {self.csv_path}")

        if not self.csv_path.exists():
            raise FileNotFoundError(f"CSV file not found: {self.csv_path}")

        mappings = []

        with open(self.csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)

            # Skip empty row 2 (reader already skipped header row 1)
            try:
                next(reader)  # Skip row 2 which is empty
            except StopIteration:
                pass

            for row_num, row in enumerate(reader, start=3):  # Start at 3 (header=1, empty=2)
                try:
                    # Skip completely empty rows
                    if not any(row.values()):
                        continue

                    # Extract campaign data from CSV
                    csv_campaign_id = row.get('campaign_id', '').strip()
                    campaign_name = row.get('campaign_name', '').strip()

                    if not campaign_name:
                        error_msg = f"Row {row_num}: Missing campaign_name"
                        self.errors.append(error_msg)
                        if self.verbose:
                            print(f"  ✗ {error_msg}")
                        continue

                    self.total_csv_campaigns += 1

                    # Build hierarchy mapping
                    hierarchy = {
                        'csv_id': csv_campaign_id,
                        'csv_name': campaign_name,
                        'network': clean_field(row.get('network', ''), default='Unknown'),
                        'domain': clean_field(row.get('domain', ''), default='Unknown'),
                        'placement': clean_field(row.get('placement', ''), default='Standard'),
                        'targeting': clean_field(row.get('targeting', ''), default='General'),
                        'special': clean_field(row.get('special', ''), default='Standard')
                    }

                    # Try to find matching campaign in database by name
                    db_campaign = self.find_campaign_by_name(campaign_name)

                    if db_campaign:
                        hierarchy['db_id'] = db_campaign['id']
                        hierarchy['db_name'] = db_campaign['name']

                        # Check if it's exact or fuzzy match
                        if normalize_name(campaign_name) == db_campaign['normalized']:
                            self.exact_matches += 1
                            hierarchy['match_type'] = 'exact'
                        else:
                            self.fuzzy_matches.append({
                                'csv_name': campaign_name,
                                'db_name': db_campaign['name']
                            })
                            hierarchy['match_type'] = 'fuzzy'

                        mappings.append(hierarchy)

                        # Track statistics
                        self.domain_counts[hierarchy['domain']] += 1
                        self.network_counts[hierarchy['network']] += 1
                    else:
                        self.campaigns_not_found.append(campaign_name)
                        if self.verbose:
                            print(f"  ⚠ Row {row_num}: Campaign '{campaign_name}' not found in database")

                except Exception as e:
                    error_msg = f"Row {row_num}: Error parsing row - {str(e)}"
                    self.errors.append(error_msg)
                    if self.verbose:
                        print(f"  ✗ {error_msg}")

        print(f"✓ Parsed {self.total_csv_campaigns} campaigns from CSV")
        print(f"  - {self.exact_matches} exact matches")
        print(f"  - {len(self.fuzzy_matches)} fuzzy matches")
        print(f"  - {len(self.campaigns_not_found)} not found in database")
        print()

        return mappings

    def import_to_database(self, conn: sqlite3.Connection, mappings: List[Dict]):
        """
        Import hierarchy mappings to database

        Args:
            conn: Database connection
            mappings: List of hierarchy mappings to import
        """
        print(f"Importing hierarchy data...")
        print()

        if self.fuzzy_matches and not self.dry_run:
            print("Fuzzy matches found (CSV name → Database name):")
            for match in self.fuzzy_matches[:10]:  # Show first 10
                print(f"  '{match['csv_name']}' → '{match['db_name']}'")
            if len(self.fuzzy_matches) > 10:
                print(f"  ... and {len(self.fuzzy_matches) - 10} more")
            print()

        for idx, mapping in enumerate(mappings, start=1):
            db_id = mapping['db_id']
            db_name = mapping['db_name']
            match_type = mapping['match_type']

            try:
                # Display mapping
                if self.verbose or (idx <= 10):  # Show first 10 always
                    match_indicator = "✓" if match_type == 'exact' else "≈"
                    print(f"[{idx}/{len(mappings)}] {match_indicator} ID {db_id}: {db_name}")
                    print(f"  → Network: {mapping['network']} | Domain: {mapping['domain']}")
                    print(f"  → Placement: {mapping['placement']} | Targeting: {mapping['targeting']} | Special: {mapping['special']}")

                # Insert into database
                if not self.dry_run:
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT OR REPLACE INTO campaign_hierarchy
                        (campaign_id, campaign_name, network, domain, placement, targeting, special,
                         mapping_confidence, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        db_id,
                        db_name,
                        mapping['network'],
                        mapping['domain'],
                        mapping['placement'],
                        mapping['targeting'],
                        mapping['special'],
                        1.0 if match_type == 'exact' else 0.9,  # Confidence score
                        datetime.now(timezone.utc).isoformat()
                    ))

                self.successful_imports += 1

            except Exception as e:
                error_msg = f"Campaign {db_id} ({db_name}): {str(e)}"
                self.errors.append(error_msg)
                if self.verbose:
                    print(f"[{idx}/{len(mappings)}] ✗ {error_msg}")

        if not self.dry_run:
            conn.commit()

        print()

    def print_summary(self):
        """Print import summary statistics"""
        print("=" * 70)
        print("Import Summary")
        print("=" * 70)

        print(f"✓ Successfully imported: {self.successful_imports} campaigns")
        print(f"  - {self.exact_matches} exact name matches")
        print(f"  - {len(self.fuzzy_matches)} fuzzy name matches")

        if self.campaigns_not_found:
            print(f"\n⚠ Campaigns not in database: {len(self.campaigns_not_found)}")
            if self.verbose:
                print("  Names not found:")
                for name in self.campaigns_not_found[:15]:
                    print(f"    - {name}")
                if len(self.campaigns_not_found) > 15:
                    print(f"  ... and {len(self.campaigns_not_found) - 15} more")

        if self.errors:
            print(f"\n✗ Parsing errors: {len(self.errors)}")
            if self.verbose:
                for error in self.errors[:5]:
                    print(f"  - {error}")
                if len(self.errors) > 5:
                    print(f"  ... and {len(self.errors) - 5} more errors")
        else:
            print(f"✗ Parsing errors: 0")

        print("\nNetwork Distribution:")
        for network, count in sorted(self.network_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  {network}: {count} campaigns")

        print("\nDomain Distribution:")
        top_domains = sorted(self.domain_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        for domain, count in top_domains:
            print(f"  {domain}: {count} campaigns")
        if len(self.domain_counts) > 10:
            print(f"  ... ({len(self.domain_counts) - 10} more domains)")

        print()
        print("=" * 70)
        if self.dry_run:
            print("✓ Dry run completed successfully!")
            print("  Run without --dry-run to perform actual import")
        else:
            print("✓ Import completed successfully!")
        print("=" * 70)

    def run(self):
        """Execute the import process"""
        self.print_header()

        try:
            # Connect to database
            if not self.db_path.exists():
                raise FileNotFoundError(f"Database file not found: {self.db_path}")

            conn = sqlite3.connect(str(self.db_path))
            conn.row_factory = sqlite3.Row
            print(f"Connected to database: {self.db_path}")
            print()

            # Load existing campaigns
            self.load_database_campaigns(conn)

            # Parse CSV and match by name
            mappings = self.parse_csv()

            if not mappings:
                print("No campaigns found to import")
                return

            # Import to database
            self.import_to_database(conn, mappings)

            # Close connection
            if not self.dry_run:
                conn.close()

            # Print summary
            self.print_summary()

        except Exception as e:
            print(f"\n✗ ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            sys.exit(1)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Import campaign hierarchy from CSV by matching campaign names'
    )
    parser.add_argument(
        '--csv',
        required=True,
        help='Path to CSV file with explicit hierarchy columns'
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

    importer = NameBasedHierarchyImporter(
        csv_path=args.csv,
        db_path=args.db,
        dry_run=args.dry_run,
        verbose=args.verbose
    )

    importer.run()


if __name__ == '__main__':
    main()

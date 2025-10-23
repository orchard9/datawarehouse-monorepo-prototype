#!/usr/bin/env python3
"""
Populate estimated costs for all campaigns
Formula: total_sessions * 0.75
Status: estimated
"""
import sqlite3
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'src')))

from database.schema import initialize_database

def populate_costs():
    """Populate estimated costs for all campaigns based on sessions"""

    # Connect to database
    db_path = os.path.join(os.path.dirname(__file__), 'datawarehouse.db')
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    print("Calculating estimated costs for all campaigns...")
    print("Formula: total_sessions * 0.75")
    print("-" * 60)

    # Get all campaigns with their total sessions
    query = """
        SELECT
            c.id,
            c.name,
            COALESCE(SUM(hd.sessions), 0) as total_sessions,
            c.cost,
            c.cost_status
        FROM campaigns c
        LEFT JOIN hourly_data hd ON c.id = hd.campaign_id
        GROUP BY c.id
        ORDER BY total_sessions DESC
    """

    cursor.execute(query)
    campaigns = cursor.fetchall()

    print(f"Found {len(campaigns)} campaigns")
    print()

    updated_count = 0
    skipped_count = 0

    for campaign_id, name, total_sessions, current_cost, cost_status in campaigns:
        # Calculate estimated cost
        estimated_cost = total_sessions * 0.75

        # Only update if cost is NULL or 0
        if current_cost is None or current_cost == 0:
            cursor.execute("""
                UPDATE campaigns
                SET cost = ?,
                    cost_status = 'estimated',
                    updated_at = datetime('now')
                WHERE id = ?
            """, (estimated_cost, campaign_id))

            updated_count += 1
            print(f"[OK] Campaign {campaign_id:4d} | {name[:40]:40s} | Sessions: {total_sessions:6d} | Cost: ${estimated_cost:10.2f}")
        else:
            skipped_count += 1
            status_label = cost_status or 'estimated'
            print(f"     Campaign {campaign_id:4d} | {name[:40]:40s} | Sessions: {total_sessions:6d} | Cost: ${current_cost:10.2f} ({status_label}) - SKIPPED")

    conn.commit()

    print()
    print("-" * 60)
    print(f"Summary:")
    print(f"  Updated: {updated_count} campaigns")
    print(f"  Skipped: {skipped_count} campaigns (already have cost)")
    print(f"  Total:   {len(campaigns)} campaigns")

    conn.close()

if __name__ == '__main__':
    try:
        populate_costs()
        print("\n[SUCCESS] Cost population completed!")
    except Exception as e:
        print(f"\n[ERROR] Failed: {str(e)}")
        sys.exit(1)

"""Test that hierarchy overrides persist through sync operations"""
import sqlite3
import sys

# Fix Windows console encoding
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from src.database.operations import DatabaseOperations

def test_override_persistence():
    print("=" * 70)
    print("TESTING OVERRIDE PERSISTENCE")
    print("=" * 70)
    print()

    # Connect directly to check for override
    conn = sqlite3.connect('datawarehouse.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Find a campaign with an Aylo override
    cursor.execute('''
        SELECT c.id, c.name, ch.network, cho.network as override_network
        FROM campaigns c
        JOIN campaign_hierarchy ch ON c.id = ch.campaign_id
        JOIN campaign_hierarchy_overrides cho ON c.id = cho.campaign_id AND cho.is_active = 1
        WHERE cho.network = 'Aylo'
        LIMIT 1
    ''')
    result = cursor.fetchone()

    if not result:
        print("ERROR: No test campaign found with Aylo override")
        conn.close()
        return False

    campaign_id = result['id']
    campaign_name = result['name']
    current_network = result['network']
    override_network = result['override_network']

    print(f"Sample campaign with override:")
    print(f"  ID: {campaign_id}")
    print(f"  Name: {campaign_name}")
    print(f"  Current Network: {current_network}")
    print(f"  Override Network: {override_network}")
    print()

    conn.close()

    # Now test the upsert function
    print("Testing sync persistence...")
    print(f"  Attempting to set network to 'Unknown' (simulating sync)...")
    print()

    # Create database operations instance
    conn2 = sqlite3.connect('datawarehouse.db')
    db_ops = DatabaseOperations(conn2)

    # Simulate what sync does - try to update with rule-based mapping
    test_hierarchy = {
        'campaign_id': campaign_id,
        'campaign_name': campaign_name,
        'network': 'Unknown',  # Rule-based would assign this
        'domain': 'Test Domain',
        'placement': 'Test Placement',
        'targeting': 'Test Targeting',
        'special': 'Test Special',
        'mapping_confidence': 0.5
    }

    db_ops.upsert_campaign_hierarchy(test_hierarchy)

    # Check if override was preserved
    cursor2 = conn2.cursor()
    cursor2.execute('SELECT network FROM campaign_hierarchy WHERE campaign_id = ?', (campaign_id,))
    final_network = cursor2.fetchone()[0]

    print(f"RESULTS:")
    print(f"  Attempted to set network to: 'Unknown'")
    print(f"  Final network in database: '{final_network}'")
    print()

    conn2.close()

    # Verify result
    if final_network == 'Aylo':
        print("=" * 70)
        print("SUCCESS: Override persisted!")
        print("=" * 70)
        print()
        print("CSV-imported hierarchy will now persist across all future syncs.")
        print()
        return True
    else:
        print("=" * 70)
        print("FAILED: Override was not preserved")
        print("=" * 70)
        return False

if __name__ == '__main__':
    success = test_override_persistence()
    sys.exit(0 if success else 1)

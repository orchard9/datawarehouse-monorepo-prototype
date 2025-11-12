"""Quick script to check campaign hierarchy data in the database."""
import sqlite3

def check_hierarchy():
    conn = sqlite3.connect('datawarehouse.db')
    cursor = conn.cursor()

    # Check network distribution
    print("=" * 60)
    print("NETWORK DISTRIBUTION IN DATABASE")
    print("=" * 60)
    cursor.execute('''
        SELECT network, COUNT(*) as count
        FROM campaign_hierarchy
        WHERE network IS NOT NULL
        GROUP BY network
        ORDER BY count DESC
    ''')

    networks = cursor.fetchall()
    if networks:
        for network, count in networks:
            print(f"{network}: {count} campaigns")
    else:
        print("❌ NO NETWORKS FOUND IN DATABASE")

    # Check campaigns without network
    cursor.execute('SELECT COUNT(*) FROM campaign_hierarchy WHERE network IS NULL')
    null_count = cursor.fetchone()[0]
    print(f"\n⚠️  Campaigns without network: {null_count}")

    # Check total campaigns
    cursor.execute('SELECT COUNT(*) FROM campaign_hierarchy')
    total_count = cursor.fetchone()[0]
    print(f"✅ Total campaigns in hierarchy: {total_count}")

    # Sample some campaigns to see their hierarchy
    print("\n" + "=" * 60)
    print("SAMPLE CAMPAIGNS (first 10)")
    print("=" * 60)
    cursor.execute('''
        SELECT
            ch.campaign_id,
            c.campaign_name,
            ch.network,
            ch.domain,
            ch.placement,
            ch.targeting,
            ch.special
        FROM campaign_hierarchy ch
        JOIN campaigns c ON ch.campaign_id = c.campaign_id
        LIMIT 10
    ''')

    for row in cursor.fetchall():
        campaign_id, name, network, domain, placement, targeting, special = row
        print(f"\nID: {campaign_id}")
        print(f"  Name: {name}")
        print(f"  Network: {network or 'NULL'}")
        print(f"  Domain: {domain or 'NULL'}")
        print(f"  Placement: {placement or 'NULL'}")

    conn.close()

if __name__ == '__main__':
    check_hierarchy()

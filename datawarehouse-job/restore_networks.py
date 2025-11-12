"""Restore network assignments based on campaign name patterns."""
import sqlite3
from datetime import datetime, timezone

def assign_network(campaign_name):
    """Determine network based on campaign name patterns."""
    name_lower = campaign_name.lower()

    # Aylo properties (Pornhub, YouJizz, etc.)
    if any(pattern in name_lower for pattern in [
        'pornhub', 'youporn', 'redtube', 'tube8', 'xtube',
        'spankwire', 'keezmovies', 'extremetube', 'gaytube',
        'discover grid', 'join pop', 'fapcatgrid', 'aylo'
    ]):
        return 'Aylo'

    # YouJizz
    if 'youjizz' in name_lower or 'yj' in name_lower:
        return 'YouJizz'

    # Pornpics
    if 'pornpics' in name_lower or 'ppics' in name_lower:
        return 'Pornpics'

    # Google
    if 'google' in name_lower:
        return 'Google'

    # Crak Media
    if 'cmtest' in name_lower or 'chatmate' in name_lower or 'crak' in name_lower:
        return 'Crak Media'

    # Meetinchat
    if 'meetinchat' in name_lower or 'mic' in name_lower:
        return 'Meetinchat'

    # Specific networks
    if '01tube' in name_lower:
        return '01tube'
    if 'bftv' in name_lower:
        return 'BFTV'
    if 'blackporn' in name_lower:
        return 'Blackporn'
    if 'brazzers' in name_lower:
        return 'Brazzers'
    if 'dreamgf' in name_lower:
        return 'Dreamgf'
    if 'gamecore' in name_lower:
        return 'Gamecore'
    if 'hotai' in name_lower:
        return 'HOTai'
    if 'inporn' in name_lower:
        return 'InPorn'
    if 'juicyads' in name_lower or 'j001' in name_lower:
        return 'JuicyAds'
    if 'morazzia' in name_lower:
        return 'Morazzia'
    if 'pimpbunny' in name_lower:
        return 'Pimpbunny'

    # Default to Unknown
    return 'Unknown'

def restore_networks():
    """Restore network assignments for all campaigns in database."""
    print("=" * 70)
    print("RESTORING NETWORK ASSIGNMENTS")
    print("=" * 70)

    conn = sqlite3.connect('datawarehouse.db')
    cursor = conn.cursor()

    # Get all campaigns
    cursor.execute('SELECT campaign_id, campaign_name FROM campaigns')
    campaigns = cursor.fetchall()

    print(f"\nProcessing {len(campaigns)} campaigns...\n")

    # Track network assignments
    network_counts = {}
    updated_count = 0

    # Update each campaign
    for campaign_id, campaign_name in campaigns:
        network = assign_network(campaign_name)

        # Update campaign_hierarchy table
        cursor.execute('''
            UPDATE campaign_hierarchy
            SET network = ?,
                updated_at = ?
            WHERE campaign_id = ?
        ''', (network, datetime.now(timezone.utc).isoformat(), campaign_id))

        updated_count += cursor.rowcount

        # Track counts
        network_counts[network] = network_counts.get(network, 0) + 1

    # Commit changes
    conn.commit()

    # Print results
    print(f"✅ Updated {updated_count} campaigns\n")
    print("Network Distribution:")
    print("-" * 70)

    for network, count in sorted(network_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {network}: {count} campaigns")

    # Sample some campaigns
    print("\n" + "=" * 70)
    print("SAMPLE CAMPAIGNS (first 15)")
    print("=" * 70)

    cursor.execute('''
        SELECT
            c.campaign_name,
            ch.network
        FROM campaigns c
        JOIN campaign_hierarchy ch ON c.campaign_id = ch.campaign_id
        ORDER BY c.campaign_name
        LIMIT 15
    ''')

    for campaign_name, network in cursor.fetchall():
        print(f"  {campaign_name[:50]:50} -> {network}")

    conn.close()
    print("\n✅ Network restoration complete!")

if __name__ == '__main__':
    restore_networks()

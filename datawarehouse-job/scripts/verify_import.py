#!/usr/bin/env python3
"""Quick verification script for hierarchy import"""
import sqlite3
import sys

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

conn = sqlite3.connect('datawarehouse.db')
cursor = conn.cursor()

# Total count
cursor.execute('SELECT COUNT(*) FROM campaign_hierarchy')
total = cursor.fetchone()[0]
print(f'✓ Total campaigns with hierarchy: {total}')
print()

# Sample mappings
print('Sample mappings:')
cursor.execute('''
    SELECT campaign_id, campaign_name, network, domain, placement, targeting, special
    FROM campaign_hierarchy
    LIMIT 5
''')
for row in cursor.fetchall():
    print(f'ID {row[0]}: {row[1]}')
    print(f'  Network: {row[2]} | Domain: {row[3]}')
    print(f'  Placement: {row[4]} | Targeting: {row[5]} | Special: {row[6]}')
    print()

# Domain distribution
print('Domain distribution:')
cursor.execute('''
    SELECT domain, COUNT(*) as count
    FROM campaign_hierarchy
    GROUP BY domain
    ORDER BY count DESC
''')
for row in cursor.fetchall():
    print(f'  {row[0]}: {row[1]} campaigns')

print()

# Network distribution (top 10)
print('Network distribution (top 10):')
cursor.execute('''
    SELECT network, COUNT(*) as count
    FROM campaign_hierarchy
    GROUP BY network
    ORDER BY count DESC
    LIMIT 10
''')
for row in cursor.fetchall():
    print(f'  {row[0]}: {row[1]} campaigns')

conn.close()
print()
print('✓ Verification complete!')

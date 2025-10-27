#!/usr/bin/env python3
"""
Hierarchy Mapping Rules - Pattern extraction logic for CSV import
Maps campaign names and group headers to 5-tier hierarchy
"""
import re
from typing import Optional, Dict, Tuple


# Domain category mapping based on network type
DOMAIN_MAPPING = {
    r'pornhub|youjizz|youporn|redtube|tube8|01tube|bftv|blackporn|inporn|morazzia|pimpbunny|fapcat': 'Adult Video Platform',
    r'pornpics': 'Adult Photo Platform',
    r'google': 'Search Engine',
    r'facebook|instagram': 'Social Media',
    r'meetinchat|wellhello|dreamgf|hotai': 'Dating Platform',
    r'brazzers|gamecore|theporndude': 'Direct Partnership',
    r'juicyads|crak media|aylo|bftv': 'Affiliate Network',
    r'theporndude': 'Review Site',
}


def extract_network(campaign_name: str, group_header: Optional[str] = None) -> str:
    """
    Extract network from campaign name and/or group header

    Priority order:
    1. Group header first word/phrase
    2. Campaign name prefix patterns
    3. Exact match for standalone campaigns
    """
    campaign_lower = campaign_name.lower()

    # Use group header if available
    if group_header:
        group_lower = group_header.lower()

        # Extract first meaningful word(s)
        if 'pornhub' in group_lower:
            return 'Pornhub'
        elif 'youporn' in group_lower:
            return 'YouPorn'
        elif 'youjizz' in group_lower:
            return 'YouJizz'
        elif 'redtube' in group_lower:
            return 'RedTube'
        elif 'tube8' in group_lower:
            return 'Tube8'
        elif 'google' in group_lower:
            return 'Google'
        elif 'meetinchat' in group_lower:
            return 'Meetinchat'
        elif 'crak media' in group_lower:
            return 'Crak Media'
        elif 'aylo' in group_lower:
            return 'AYLO'

    # Campaign name prefix patterns
    if campaign_lower.startswith('pornhubm_') or campaign_lower.startswith('pornhub'):
        return 'Pornhub'
    elif campaign_lower.startswith('youporn') or campaign_lower.startswith('ypmhead'):
        return 'YouPorn'
    elif campaign_lower.startswith('youjizz'):
        return 'YouJizz'
    elif campaign_lower.startswith('pornpicsm'):
        return 'PornPics'
    elif campaign_lower.startswith('rtmhead'):
        return 'RedTube'
    elif campaign_lower.startswith('t8mhead'):
        return 'Tube8'
    elif campaign_lower.startswith('google'):
        return 'Google'
    elif campaign_lower.startswith('meetinchat') or campaign_lower.startswith('mic'):
        return 'Meetinchat'
    elif campaign_lower.startswith('cm'):
        return 'Crak Media'
    elif 'chatmate' in campaign_lower:
        return 'Crak Media'

    # Exact matches for standalone campaigns
    exact_matches = {
        '01tube': '01tube',
        'bftv': 'BFTV',
        'blackporn': 'Blackporn',
        'brazzers': 'Brazzers',
        'dreamgf': 'Dreamgf',
        'fapcatgrid': 'Fapcat',
        'gamecore': 'Gamecore',
        'hotai': 'HOTai',
        'inporn': 'InPorn',
        'j001': 'JuicyAds',
        'morazzia': 'Morazzia',
        'pimpbunny': 'Pimpbunny',
        'theporndude': 'ThePornDude',
        'wellhellof': 'Wellhello',
        'wellhellop': 'Wellhello',
        'phmtab': 'Pornhub',
        'pt': 'Unknown',
    }

    return exact_matches.get(campaign_lower, campaign_name.split('_')[0].title())


def infer_domain(network: str) -> str:
    """
    Infer domain category from network name
    """
    network_lower = network.lower()

    for pattern, domain in DOMAIN_MAPPING.items():
        if re.search(pattern, network_lower):
            return domain

    return 'Unknown Network'


def extract_placement(campaign_name: str, group_header: Optional[str] = None) -> str:
    """
    Extract placement from group header and campaign name patterns
    """
    campaign_lower = campaign_name.lower()

    # Group header patterns have priority
    if group_header:
        group_lower = group_header.lower()

        if 'mobile header' in group_lower:
            return 'Mobile Header'
        elif 'mobile preroll' in group_lower:
            return 'Mobile Preroll'
        elif 'mobile tab' in group_lower:
            return 'Mobile Tab'
        elif 'desktop header' in group_lower or 'header banner' in group_lower:
            return 'Desktop Header'
        elif 'tabs' in group_lower:
            if 'grid' in campaign_lower:
                return 'Tab - Grid View'
            elif 'pop' in campaign_lower:
                return 'Tab - Pop'
            return 'Tab Placement'

    # Campaign name patterns
    if 'preroll' in campaign_lower:
        return 'Mobile Preroll'
    elif 'mhead' in campaign_lower or 'header' in campaign_lower:
        if '_swipe' in campaign_lower:
            return 'Mobile Header'
        return 'Mobile Header'
    elif 'grid' in campaign_lower:
        return 'Grid Placement'
    elif 'pop' in campaign_lower:
        return 'Pop Placement'
    elif 'tab' in campaign_lower:
        return 'Mobile Tab'
    elif 'nav' in campaign_lower:
        return 'Nav Link'

    # Default based on network type
    network = extract_network(campaign_name, group_header)
    if network.lower() == 'google':
        return 'Search Ads'
    elif 'meeting' in network.lower() or 'wellhello' in network.lower():
        return 'Display Banner'

    return 'Embedded Link'


def extract_targeting(campaign_name: str) -> str:
    """
    Extract targeting (model names, audience segments, keywords) from campaign name
    """
    campaign_lower = campaign_name.lower()

    # Model name patterns (middle component after underscore split)
    if '_' in campaign_name:
        parts = campaign_name.split('_')

        # For pornhubm_NAME_page patterns
        if len(parts) >= 3 and parts[0].lower() in ['pornhubm', 'pornpicsm']:
            model_name = parts[1].title()
            return model_name

        # For YouJizz patterns (YouJizzDAva)
        if campaign_name.startswith('YouJizz') and len(campaign_name) > 8:
            model_part = campaign_name[8:]  # After "YouJizzD"
            return model_part

        # For PornPics patterns
        if campaign_name.startswith('PornPicsM') and len(campaign_name) > 9:
            model_part = campaign_name[9:]
            return model_part

        # For PornHub legacy patterns
        if campaign_name.startswith('PornHubM') and len(campaign_name) > 8:
            model_part = campaign_name[8:]
            if model_part.lower() not in ['gen', 'logo']:
                return model_part
            elif model_part.lower() == 'logo':
                return 'Branding'

    # Keyword targeting patterns
    if 'aichat' in campaign_lower:
        return 'AI Chat Keywords'

    # Branded targeting
    if 'logo' in campaign_lower:
        return 'Branding'

    # Audience segment patterns
    if 'female' in campaign_lower or campaign_name.lower().endswith('f'):
        return 'Female Targeted'
    elif 'premium' in campaign_lower or campaign_name.lower().endswith('p'):
        return 'Premium Targeted'

    # Special targeting for specific campaigns
    if 'porn4fans' in campaign_lower:
        return 'Porn4fans'
    elif 'discovery' in campaign_lower or 'discover' in campaign_lower:
        return 'Discovery'
    elif 'join' in campaign_lower:
        return 'New Users'

    return 'General'


def extract_special(campaign_name: str) -> str:
    """
    Extract special attributes (page types, variants, interface types) from campaign name
    """
    campaign_lower = campaign_name.lower()

    # Page type patterns
    if campaign_lower.endswith('_lounge') or 'lounge' in campaign_lower:
        return 'Lounge Page'
    elif campaign_lower.endswith('_profile') or 'profile' in campaign_lower:
        return 'Profile Page'
    elif campaign_lower.endswith('_lander') or 'lander' in campaign_lower:
        return 'Lander Page'

    # Interface patterns
    if '_swipe' in campaign_lower or 'swipe' in campaign_lower:
        return 'Swipe Interface'
    elif '_grid' in campaign_lower and not campaign_lower.endswith('grid'):
        return 'Grid Layout'

    # Variant patterns
    variant_match = re.search(r'_(\d+)$', campaign_name)
    if variant_match:
        variant_num = variant_match.group(1)
        return f'Variant {variant_num}'

    # Numbered variants without underscore (mic1, mic2, etc.)
    if re.search(r'\d+$', campaign_name):
        num = re.search(r'(\d+)$', campaign_name).group(1)
        return f'Variant {num}'

    # Flow/destination patterns
    if 'tohome' in campaign_lower:
        return 'To Home'
    elif 'tolander' in campaign_lower:
        match = re.search(r'tolander(\d+)', campaign_lower)
        if match:
            return f'To Lander {match.group(1)}'
        return 'To Lander'
    elif 'tolounge' in campaign_lower:
        return 'To Lounge'
    elif 'toswipe' in campaign_lower:
        if 'nsfw' in campaign_lower:
            return 'To Swipe NSFW'
        return 'To Swipe'
    elif 'tobuildyourown' in campaign_lower:
        return 'To Build Flow'

    # Special campaign types
    if 'test' in campaign_lower:
        return 'Test'
    elif 'typein' in campaign_lower:
        return 'Direct Traffic'
    elif 'premium' in campaign_lower:
        return 'Premium'
    elif 'aichat' in campaign_lower or 'ai' in campaign_lower:
        return 'AI Focus'

    # Legacy marker
    if campaign_name.startswith('PornHub') or campaign_name.startswith('PornPics'):
        if not campaign_name.startswith('pornhub'):  # Capitalized = legacy
            return 'Legacy'

    # Variant ID patterns (cm388577)
    variant_id_match = re.search(r'(\d{6,})$', campaign_name)
    if variant_id_match:
        return f'Variant {variant_id_match.group(1)}'

    return 'Standard'


def extract_full_hierarchy(campaign_id: int, campaign_name: str,
                           group_header: Optional[str] = None) -> Dict[str, str]:
    """
    Extract complete 5-tier hierarchy for a campaign

    Args:
        campaign_id: Campaign ID from database
        campaign_name: Campaign name from CSV
        group_header: Optional group header context from CSV

    Returns:
        Dictionary with all 5 hierarchy fields
    """
    network = extract_network(campaign_name, group_header)
    domain = infer_domain(network)
    placement = extract_placement(campaign_name, group_header)
    targeting = extract_targeting(campaign_name)
    special = extract_special(campaign_name)

    return {
        'campaign_id': campaign_id,
        'campaign_name': campaign_name,
        'network': network,
        'domain': domain,
        'placement': placement,
        'targeting': targeting,
        'special': special
    }

"""
WhatsApp Lead Extraction Service

Parses structured WhatsApp lead messages in the forwarded template format:

>> Forwarded

Clint name - Ram patil
*No-8459122869
Bhk - 3 bhk
Location-,Ravet
Budject -
SLG through project
Other Cp thru -
Suggested-star vista project details send ready to move

Handles:
- Multiple leads per paste (split on "Forwarded" markers)
- Typo-tolerant field matching (Clint/Client, Budject/Budget)
- Indian phone formats
- Indian budget formats (lakhs, crores)
- BHK extraction
- Project name matching from "Suggested" field
"""

import re
from typing import List, Dict


class WhatsAppLeadExtractor:
    """Parses structured WhatsApp lead messages and extracts lead data."""

    # Field patterns — tolerant of typos and spacing variations
    FIELD_PATTERNS = {
        'name': re.compile(
            r'\*?\s*(?:clint|client|cline|clinet|name)\s*(?:name)?\s*\*?[-–:.]?\s*(.*)',
            re.IGNORECASE
        ),
        'phone': re.compile(
            r'\*?\s*(?:no|number|mob|mobile|ph|contact|phone)(?:\s*(?:no\.?|number))?\s*\*?[-–:.]?\s*(\+?\d[\d\s-]{7,})',
            re.IGNORECASE
        ),
        'bhk': re.compile(
            r'\*?\s*(?:bhk|b\.?h\.?k)\s*\*?[-–:.]?\s*(.*)',
            re.IGNORECASE
        ),
        'location': re.compile(
            r'\*?\s*(?:location|loc|area|city|address)\s*\*?[-–:,.]?\s*(.*)',
            re.IGNORECASE
        ),
        'budget': re.compile(
            r'\*?\s*(?:budject|budget|budgt|buget|bgt)\s*\*?[-–:.]?\s*(.*)',
            re.IGNORECASE
        ),
        'source': re.compile(
            r'\*?\s*(?:source|from)\s*\*?[-–:.]?\s*(.*)|(?:\*?\s*(SLG\s+through\s+project|99acres|magicbricks|housing|justdial|facebook|google)\s*\*?)',
            re.IGNORECASE
        ),
        'cp': re.compile(
            r'\*?\s*(?:other\s+)?(?:cp|channel\s*partner)\s*(?:thru|through)?\s*\*?[-–:.]?\s*(.*)',
            re.IGNORECASE
        ),
        'suggested': re.compile(
            r'\*?\s*(?:suggested|suggestion|remark|remarks|notes?|comment)(?:\s*project\s*name)?\s*\*?[-–:.]?\s*(.*)',
            re.IGNORECASE
        ),
    }

    @classmethod
    def extract_multiple(cls, raw_text: str) -> List[Dict]:
        """
        Splits pasted text into individual leads and extracts each one.
        Handles multiple leads separated by 'Forwarded' markers or 'Clint name' boundaries.
        """
        if not raw_text or not raw_text.strip():
            return []

        # Strategy 1: Split on "Forwarded" markers
        blocks = re.split(
            r'(?:>{1,2}\s*Forwarded\s*\n?)',
            raw_text,
            flags=re.IGNORECASE
        )

        # Strategy 2: If only one block, try splitting on "Clint name" / "Client name" boundaries
        if len(blocks) <= 1:
            blocks = re.split(
                r'(?=\*?\s*(?:clint|client|cline|clinet|name)\s*(?:name)?\s*\*?[-–:.])',
                raw_text,
                flags=re.IGNORECASE
            )

        leads = []
        for block in blocks:
            block = block.strip()
            if not block:
                continue
            # Try to extract the lead directly
            lead = cls.extract_single(block)
            if lead.get('phone'):  # Must have phone to be valid
                leads.append(lead)

        return leads

    @classmethod
    def extract_single(cls, text: str) -> Dict:
        """Extracts lead data from a single lead block."""
        result = {
            'first_name': '',
            'last_name': '',
            'phone': '',
            'bhk_preference': '',
            'location': '',
            'budget': '',
            'source_detail': '',
            'channel_partner': '',
            'suggested_project': '',
            'notes': '',
            'raw_message': text.strip(),
        }

        lines = text.strip().split('\n')
        unmatched_lines = []
        extracted_keys = set()

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # --- Name ---
            if 'name' not in extracted_keys:
                match = cls.FIELD_PATTERNS['name'].match(line)
                if match:
                    name_str = match.group(1).strip().rstrip('-').strip()
                    if name_str:
                        parts = name_str.split(None, 1)
                        result['first_name'] = parts[0].title()
                        result['last_name'] = parts[1].title() if len(parts) > 1 else ''
                    else:
                        result['first_name'] = 'Unknown'
                    extracted_keys.add('name')
                    continue

            # --- Phone ---
            match = cls.FIELD_PATTERNS['phone'].match(line)
            if match:
                phone_raw = match.group(1)
                # Clean: keep only digits and leading +
                cleaned = re.sub(r'[^\d+]', '', phone_raw)
                if cleaned and len(cleaned) >= 10:
                    result['phone'] = cleaned
                continue

            # --- BHK ---
            match = cls.FIELD_PATTERNS['bhk'].match(line)
            if match:
                bhk_str = match.group(1).strip().rstrip('-').strip()
                if bhk_str:
                    bhk_match = re.search(r'(\d)\s*(?:bhk|b\.?h\.?k)?', bhk_str, re.IGNORECASE)
                    if bhk_match:
                        result['bhk_preference'] = f"{bhk_match.group(1)}BHK"
                    else:
                        result['bhk_preference'] = bhk_str.strip()
                continue

            # --- Location ---
            match = cls.FIELD_PATTERNS['location'].match(line)
            if match:
                loc = match.group(1).strip().strip(',').strip().rstrip('-').strip()
                if loc:
                    result['location'] = loc.title()
                continue

            # --- Budget ---
            match = cls.FIELD_PATTERNS['budget'].match(line)
            if match:
                budget_str = match.group(1).strip().rstrip('-').strip()
                if budget_str:
                    result['budget'] = cls._parse_budget(budget_str)
                continue

            # --- Source ---
            match = cls.FIELD_PATTERNS['source'].match(line)
            if match:
                # Group 1 is the generic value, Group 2 is the exact match if it was just the string
                src = (match.group(1) or match.group(2) or '').strip().rstrip('-').strip()
                if src:
                    result['source_detail'] = src
                continue

            # --- Channel Partner ---
            match = cls.FIELD_PATTERNS['cp'].match(line)
            if match:
                cp = match.group(1).strip().rstrip('-').strip()
                if cp:
                    result['channel_partner'] = cp
                continue

            # --- Suggested / Notes ---
            match = cls.FIELD_PATTERNS['suggested'].match(line)
            if match:
                suggested = match.group(1).strip()
                if suggested:
                    result['suggested_project'] = suggested
                    if result['notes']:
                        result['notes'] += f"\nSuggested: {suggested}"
                    else:
                        result['notes'] = suggested
                continue

            # If no key matches, save it as an unmatched note
            unmatched_lines.append(line)

        # Append any remaining unparsed text into notes
        if unmatched_lines:
            notes_addon = "\n".join(unmatched_lines)
            if result['notes']:
                result['notes'] += f"\n\nAdditional Details:\n{notes_addon}"
            else:
                result['notes'] = notes_addon

        # Failsafe: if we still don't have a first name, default to Unknown
        if not result['first_name'] and result['phone']:
            result['first_name'] = 'Unknown'

        return result

    @staticmethod
    def _parse_budget(budget_str: str) -> str:
        """Parses Indian budget formats: 85 lakhs, 1.2 crore, 85L, 1.2Cr, etc."""
        if not budget_str:
            return ''

        budget_str_lower = budget_str.lower().strip()

        # Try: "85 lakhs" / "85L" / "85 lac"
        match = re.search(r'(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)\b', budget_str_lower)
        if match:
            return str(int(float(match.group(1)) * 100000))

        # Try: "1.2 crore" / "1.2Cr"
        match = re.search(r'(\d+(?:\.\d+)?)\s*(?:crore|cr)\b', budget_str_lower)
        if match:
            return str(int(float(match.group(1)) * 10000000))

        # Try: plain number (with optional commas)
        match = re.search(r'[\d,]+', budget_str_lower)
        if match:
            return match.group().replace(',', '')

        return budget_str.strip()  # Return as-is if can't parse

#!/usr/bin/env python3
"""GET-only comparison for the seven nullable payment recovery columns."""
import argparse
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit

from snapshot_cap_data import ENTITIES, read_entity, validate_snapshot

RECOVERY_FIELDS = {'recoveryStatus', 'recoveredAt', 'recoveredBy', 'recoveryReason',
                   'recoveryEvidence', 'originalAuditUnavailable', 'sourceAuditUnavailable'}


def compare_rows(entity, before, after, phase):
    expected = {r['ID']: r for r in before}
    actual = {r['ID']: r for r in after}
    if len(expected) != len(before) or len(actual) != len(after) or set(expected) != set(actual):
        raise ValueError(entity + ': IDs or row count changed.')
    for identity, row in actual.items():
        original = expected[identity]
        allowed = RECOVERY_FIELDS if entity == 'MurabahaPayment' and phase == 'after' else set()
        if allowed:
            if not allowed.issubset(row) or any(row[field] is not None for field in allowed):
                raise ValueError(entity + ': new recovery fields must all be present and null on existing rows.')
            if allowed.intersection(original):
                raise ValueError('Use the pre-column-migration snapshot, not a later snapshot.')
        if set(row) != set(original) | allowed:
            raise ValueError(entity + ': unexpected fields added or removed.')
        for field, value in original.items():
            if row[field] != value:
                raise ValueError(entity + ': changed existing value for ' + identity + ', field ' + field)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', required=True)
    parser.add_argument('--phase', required=True, choices=['before', 'after'])
    args = parser.parse_args()
    directory = Path(args.snapshot).resolve()
    manifest, snapshot = validate_snapshot(directory)
    app = os.environ.get('APP_URL', '').rstrip('/')
    token = os.environ.get('XSUAA_TOKEN', '')
    parsed = urlsplit(app)
    if (parsed.scheme != 'https' or not parsed.netloc or parsed.username or
            parsed.query or parsed.fragment or not token or app != manifest.get('appUrl', '').rstrip('/')):
        raise ValueError('Set APP_URL to the snapshot application and XSUAA_TOKEN in this terminal.')
    base = app + '/service/NHBCAP01Service/'
    counts = {}
    for entity in ENTITIES:
        actual = read_entity(base, token, entity)
        compare_rows(entity, snapshot[entity], actual, args.phase)
        counts[entity] = len(actual)
        suffix = '; seven new fields are null' if entity == 'MurabahaPayment' and args.phase == 'after' else ''
        print(f'{entity}: existing values UNCHANGED ({len(actual)}){suffix}')
    result = {'mode': 'GET_ONLY_MIGRATION_VERIFICATION', 'phase': args.phase, 'counts': counts,
              'existingValuesUnchanged': True,
              'onlyPermittedChange': 'Seven nullable recovery fields on existing payments.' if args.phase == 'after' else 'None.'}
    target = directory / ('recovery-column-migration-' + args.phase + '-verification.json')
    target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print('All seven collections verified. No writes or SAP postings performed.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError, KeyError, TypeError, OSError) as error:
        print('Migration verification stopped: ' + str(error), file=sys.stderr)
        sys.exit(1)

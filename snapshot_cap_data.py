#!/usr/bin/env python3
"""Capture or compare CAP records using GET only. Stores snapshots outside the project."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

ENTITIES = ['Customer', 'Account', 'MurabahaFinancing', 'MurabahaInstallment',
            'MurabahaPayment', 'MurabahaPaymentReversal', 'MurabahaAccountingEvent']


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def digest(rows):
    rows = sorted(rows, key=lambda row: str(row['ID']))
    return hashlib.sha256(json.dumps(rows, sort_keys=True, separators=(',', ':'),
                                    ensure_ascii=False).encode('utf-8')).hexdigest()


def read_entity(base, token, entity):
    expected = urlsplit(base)
    url = base + entity
    seen_urls, ids, rows = set(), set(), []
    opener = build_opener(NoRedirect())
    for _ in range(10000):
        parsed = urlsplit(url)
        if (parsed.scheme != expected.scheme or parsed.netloc != expected.netloc
                or parsed.path != expected.path + entity or parsed.fragment
                or url in seen_urls):
            raise RuntimeError('Unsafe or repeated continuation URL for ' + entity)
        seen_urls.add(url)
        request = Request(url, headers={'Authorization': 'Bearer ' + token,
                                       'Accept': 'application/json'}, method='GET')
        try:
            with opener.open(request, timeout=100) as response:
                data = json.load(response)
        except HTTPError as error:
            raise RuntimeError(f'{entity}: HTTP {error.code}; snapshot incomplete.') from None
        except (URLError, TimeoutError, json.JSONDecodeError):
            raise RuntimeError(entity + ': request failed; snapshot incomplete.') from None
        if not isinstance(data, dict) or not isinstance(data.get('value'), list):
            raise RuntimeError(entity + ': missing collection value.')
        for row in data['value']:
            identity = row.get('ID')
            if not identity or identity in ids:
                raise RuntimeError(entity + ': missing or repeated ID.')
            ids.add(identity)
            rows.append(row)
        next_link = data.get('@odata.nextLink')
        if not next_link:
            return rows
        if not isinstance(next_link, str):
            raise RuntimeError(entity + ': invalid continuation link.')
        url = urljoin(url, next_link)
    raise RuntimeError(entity + ': page limit reached.')


def validate_snapshot(directory):
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    if set(manifest['entities']) != set(ENTITIES):
        raise RuntimeError('Snapshot entity list is incomplete.')
    records = {}
    for entity in ENTITIES:
        rows = json.loads((directory / (entity + '.json')).read_text(encoding='utf-8'))
        if (len(rows) != manifest['entities'][entity]['count']
                or digest(rows) != manifest['entities'][entity]['sha256']):
            raise RuntimeError('Snapshot validation failed: ' + entity)
        records[entity] = rows
    return manifest, records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['capture', 'compare'])
    parser.add_argument('--directory', required=True)
    args = parser.parse_args()
    app = os.environ.get('APP_URL', '').rstrip('/')
    token = os.environ.get('XSUAA_TOKEN', '')
    parsed = urlsplit(app)
    if (parsed.scheme != 'https' or not parsed.netloc or parsed.username
            or parsed.query or parsed.fragment or not token):
        raise RuntimeError('Set APP_URL (HTTPS) and XSUAA_TOKEN in this terminal.')
    base = app + '/service/NHBCAP01Service/'
    directory = Path(args.directory).resolve()
    if directory == Path.cwd().resolve() or Path.cwd().resolve() in directory.parents:
        raise RuntimeError('Choose a snapshot directory outside the project to avoid committing customer data.')
    if args.mode == 'capture':
        if directory.exists() and any(directory.iterdir()):
            raise RuntimeError('Snapshot directory is not empty; choose a new one.')
        directory.mkdir(parents=True, exist_ok=True)
        manifest = {'appUrl': app, 'capturedAt': datetime.now(timezone.utc).isoformat(),
                    'entities': {}, 'note': 'Sequential API reads; not a transactional database backup.'}
        for entity in ENTITIES:
            rows = read_entity(base, token, entity)
            (directory / (entity + '.json')).write_text(json.dumps(rows, indent=2, ensure_ascii=False),
                                                       encoding='utf-8')
            manifest['entities'][entity] = {'count': len(rows), 'sha256': digest(rows)}
            print(entity + ': ' + str(len(rows)), flush=True)
        (directory / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
        validate_snapshot(directory)
        print('Snapshot complete and validated: ' + str(directory))
    else:
        manifest, before = validate_snapshot(directory)
        if manifest['appUrl'] != app:
            raise RuntimeError('Snapshot belongs to a different APP_URL.')
        failed = False
        for entity in ENTITIES:
            after = read_entity(base, token, entity)
            if digest(before[entity]) == digest(after):
                print(entity + ': UNCHANGED (' + str(len(after)) + ')', flush=True)
            else:
                failed = True
                old = {r['ID']: r for r in before[entity]}
                new = {r['ID']: r for r in after}
                print(json.dumps({'entity': entity, 'status': 'DIFFERENT',
                    'beforeCount': len(old), 'afterCount': len(new),
                    'missingIds': sorted(old.keys() - new.keys()),
                    'addedIds': sorted(new.keys() - old.keys()),
                    'changedIds': sorted(key for key in old.keys() & new.keys() if old[key] != new[key])}), flush=True)
        if failed:
            raise RuntimeError('Snapshot comparison found changes. Inspect before proceeding.')
        print('All seven collections unchanged. No writes performed.')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError, TypeError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)

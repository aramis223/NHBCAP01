#!/usr/bin/env python3
"""Check production build after the completed fixture-import retirement."""
import json
from pathlib import Path
import shlex

ENTITIES = ['MurabahaPayment', 'Account', 'Customer', 'MurabahaInstallment', 'MurabahaFinancing']

def main():
    package = json.loads(Path('gen/db/package.json').read_text())
    tokens = shlex.split(package['scripts']['start'])
    undeploy = json.loads(Path('gen/db/undeploy.json').read_text())
    if '--undeploy' in tokens or '--path-parameter' in tokens or any('skip_data_deletion' in t for t in tokens):
        raise SystemExit('Completed one-time retirement options still present; stop.')
    if any('.hdbtabledata' in item for item in undeploy):
        raise SystemExit('Unexpected fixture import removal in undeploy.json; stop.')
    for name in ENTITIES:
        for extension in ['csv', 'hdbtabledata']:
            if list(Path('gen/db').rglob('NHBCAP01-' + name + '.' + extension)):
                raise SystemExit('Production fixture artifact still present: ' + name)
        if not Path('test/data/NHBCAP01-' + name + '.csv').is_file():
            raise SystemExit('Test fixture missing: ' + name)
        if not list(Path('gen/db').rglob('NHBCAP01.' + name + '.hdbtable')):
            raise SystemExit('Generated table definition missing: ' + name)
    print('Production fixture imports absent; all five table definitions retained.')
    print('Completed one-time import-removal options are absent from the deployer.')

if __name__ == '__main__':
    main()

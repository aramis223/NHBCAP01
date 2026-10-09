#!/usr/bin/env python3
"""Check generated production artifacts before building/deploying the retirement migration."""
import json
from pathlib import Path
import shlex

ENTITIES = ['MurabahaPayment', 'Account', 'Customer', 'MurabahaInstallment', 'MurabahaFinancing']


def main():
    package = json.loads(Path('gen/db/package.json').read_text())
    tokens = shlex.split(package['scripts']['start'])
    undeploy = json.loads(Path('gen/db/undeploy.json').read_text())
    if '--undeploy' not in tokens or '--path-parameter' not in tokens:
        raise SystemExit('Preservation flags missing from generated deployer.')
    start = tokens.index('--undeploy') + 1
    end = tokens.index('--path-parameter')
    expected = {'src/gen/data/NHBCAP01-' + name + '.hdbtabledata' for name in ENTITIES}
    if set(tokens[start:end]) != expected:
        raise SystemExit('Unexpected undeploy artifact set. Stop for review.')
    if set(tokens[end + 1:]) != {path + ':skip_data_deletion=true' for path in expected}:
        raise SystemExit('Per-artifact data preservation flags missing or unexpected.')
    if not expected.issubset(set(undeploy)):
        raise SystemExit('Exact legacy imports missing from undeploy.json.')
    for name in ENTITIES:
        for extension in ['csv', 'hdbtabledata']:
            filename = 'NHBCAP01-' + name + '.' + extension
            if list(Path('gen/db').rglob(filename)):
                raise SystemExit('Production build still contains fixture artifact: ' + filename)
        if not Path('test/data/NHBCAP01-' + name + '.csv').is_file():
            raise SystemExit('Test fixture missing: ' + name)
        if not list(Path('gen/db').rglob('NHBCAP01.' + name + '.hdbtable')):
            raise SystemExit('Generated table definition missing: ' + name)
    print('Production build verified: five fixture imports absent; table definitions retained.')
    print('All five retired imports have skip_data_deletion=true in the generated deployer.')


if __name__ == '__main__':
    main()

from pathlib import Path
import json, hashlib, csv, xml.etree.ElementTree as ET
p=Path(__file__).resolve().parents[1]
b=json.loads((p/'backlog.json').read_text())['packages']; a=json.loads((p/'acceptance.json').read_text())['items']
ids={x['id'] for x in b}; aids={x['id'] for x in a}
assert len(ids)==len(b) and len(aids)==len(a)
seen=set()
for x in b:
 assert (p/x['spec']).is_file(),x['spec']
 assert set(x['depends_on']) <= seen, 'dependency missing or not topological'
 assert set(x['acceptance']) <= aids
 assert all(y['spec']==x['id'] for y in a if y['id'] in x['acceptance'])
 seen.add(x['id'])
assert {f'B{i:02}' for i in range(1,21)} == {i for x in b for i in x['brand_inventory']}
assert {y for x in b for y in x['acceptance']} == aids
for name in ['state-matrix.csv','icon-map.csv']:
 rows=list(csv.DictReader((p/name).open())); assert rows and all(None not in r for r in rows)
svgs=list((p/'assets/brand-candidate').glob('*.svg'));assert len(svgs)==8
for f in svgs:
 tree=ET.parse(f);s=f.read_text();assert tree.getroot().get('viewBox')
 assert '<script' not in s and '<image' not in s
for line in (p/'SHA256SUMS.txt').read_text().splitlines():
 h,name=line.split('  ',1);assert hashlib.sha256((p/name).read_bytes()).hexdigest()==h,name
print(f'PASS: {len(b)} packages, {len(a)} AC, B01-B20 coverage, dependency graph, 8 SVG and package hashes. Product tests NOT run.')

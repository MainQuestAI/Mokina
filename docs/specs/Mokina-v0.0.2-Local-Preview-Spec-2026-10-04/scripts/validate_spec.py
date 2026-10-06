#!/usr/bin/env python3
"""Validate this specification package; NEVER execute or mark Mokina app tests.
Usage: python scripts/validate_spec.py
Requires the Python jsonschema package. Does not access networks or credentials.
"""
from __future__ import annotations
import csv
import hashlib
import json
import re
import sys
from decimal import Decimal
from pathlib import Path
from urllib.parse import unquote
try:
    from jsonschema import Draft202012Validator, FormatChecker
except ImportError as exc:
    raise SystemExit("Missing Python dependency: jsonschema. No validation was performed.") from exc
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def require(condition: bool, message: str) -> None:
    if not condition: raise AssertionError(message)
def read(path: str):
    return json.loads((ROOT/path).read_text(encoding='utf-8'))
def sha(data: bytes) -> str: return hashlib.sha256(data).hexdigest()
def canonical_hash(value) -> str:
    data=json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False)
    return sha(data.encode('utf-8'))
def validate() -> None:
    jsonfiles=list(ROOT.rglob('*.json'))
    for f in jsonfiles: json.loads(f.read_text(encoding='utf-8'))
    checks.append(f'JSON parse: {len(jsonfiles)} files')
    pairs=[('contracts/prepare-context.schema.json','examples/prepare-context.json'),
           ('contracts/context-snapshot.schema.json','examples/context-snapshot.json'),
           ('contracts/continuation-v2.schema.json','examples/continuation-v2.json'),
           ('contracts/recovery-manifest.schema.json','fixtures/recovery-example/mokina-recovery.json')]
    for schemafile, examplefile in pairs:
        schema=read(schemafile); Draft202012Validator.check_schema(schema)
        Draft202012Validator(schema,format_checker=FormatChecker()).validate(read(examplefile))
    checks.append('JSON Schema: 4 schemas and corresponding examples validated')
    tasks=read('backlog.json')['tasks']; cases=read('acceptance.json')['cases']
    task_ids={t['id'] for t in tasks}; case_ids={c['id'] for c in cases}
    require(len(task_ids)==len(tasks)==20,'Task IDs/count mismatch')
    require(len(case_ids)==len(cases)==57,'Acceptance IDs/count mismatch')
    allreq={f'R{i:02d}' for i in range(1,25)}
    require(set.union(*(set(t['requirements']) for t in tasks))==allreq,'Task requirement coverage mismatch')
    require(set.union(*(set(c['requirements']) for c in cases))==allreq,'Acceptance requirement coverage mismatch')
    visited=set(); active=set(); byid={t['id']:t for t in tasks}
    def visit(tid):
        require(tid in task_ids,f'Unknown dependency {tid}')
        require(tid not in active,f'Dependency cycle at {tid}')
        if tid in visited:return
        active.add(tid)
        for dep in byid[tid]['dependsOn']: visit(dep)
        active.remove(tid);visited.add(tid)
    for t in tasks:
        visit(t['id'])
        require(t['status']=='planned','Spec must not claim task implemented')
        require(set(t['acceptance'])<=case_ids and bool(t['acceptance']),'Invalid acceptance mapping')
    for c in cases:
        require(set(c['tasks'])<=task_ids,'Unknown task mapping')
        require(c['status']=='not_run' and c['evidence']==[],'Spec must not fabricate app results')
        for tid in c['tasks']:
            require(c['id'] in byid[tid]['acceptance'],'Non-reciprocal test mapping')
    checks.append('Traceability: 24 requirements, 20 tasks, 57 cases; DAG and reciprocal coverage valid')
    snapshot=read('examples/context-snapshot.json')
    payload={k:v for k,v in snapshot.items() if k!='fingerprint'}
    require(canonical_hash(payload)==snapshot['fingerprint'],'Snapshot fingerprint mismatch')
    req=read('examples/prepare-context.json')
    require(canonical_hash({'selections':req['selections'],'excluded':req['excluded']})==snapshot['selectionFingerprint'],
            'Selection fingerprint mismatch')
    require(req['snapshotId']==snapshot['snapshotId'],'Snapshot identity mismatch')
    itemids=[i['itemId'] for i in snapshot['items']]
    require(len(set(itemids))==len(itemids),'Duplicate context item IDs')
    text_units=0
    for item in snapshot['items']:
        if 'text' in item:
            require(sha(item['text'].encode('utf-8'))==item['textDigest'],'Excerpt digest mismatch')
            text_units+=len(item['text'].encode('utf-16-le'))//2
        if item['kind']=='asset':
            blob=(ROOT/'fixtures/brand-mark.svg').read_bytes()
            require(sha(blob)==item['sourceDigest']==item['blobId'],'Asset digest mismatch')
            require(len(blob)==item['byteLength'],'Asset size mismatch')
    require(text_units<=24000,'Example violates context text budget')
    cont=read('examples/continuation-v2.json')
    require(cont['contextSnapshotId']==snapshot['snapshotId'] and cont['targetProjectId']==snapshot['projectId'],
            'Continuation/snapshot target mismatch')
    for s in cont['sections']:
        require(sha(s['text'].encode('utf-8'))==s['textDigest'],'Continuation excerpt digest mismatch')
    checks.append('Snapshots: canonical fingerprints, source asset hash, excerpt hashes and target references valid')
    recovery=read('fixtures/recovery-example/mokina-recovery.json')
    recovery_root=ROOT/'fixtures/recovery-example'
    filemap={f['path']:f for f in recovery['files']}
    require(len(filemap)==len(recovery['files']),'Duplicate recovery path')
    for f in recovery['files']:
        rel=Path(f['path'])
        require(not rel.is_absolute() and '..' not in rel.parts and '\\' not in f['path'],'Unsafe recovery path')
        full=recovery_root/rel
        require(full.is_file() and not full.is_symlink(),'Missing/symlink recovery file')
        blob=full.read_bytes()
        require(len(blob)==f['byteLength'] and sha(blob)==f['sha256'],'Recovery content/size mismatch')
    ids={v['originalVersionId'] for v in recovery['versions']}
    counts={}
    for version in recovery['versions']:
        require(version['contentPath'] in filemap,'Missing version file')
        require(version['contentDigest']==filemap[version['contentPath']]['sha256'],'Version digest mismatch')
        require(not(version['current'] and version['candidate']),'Candidate cannot be current')
        counts[version['entry']]=counts.get(version['entry'],0)+int(version['current'])
        for key in ['parentOriginalVersionId','baseOriginalVersionId']:
            require(key not in version or version[key] in ids,'Broken version relation')
    require(all(n<=1 for n in counts.values()),'Multiple current versions')
    for context in recovery['contexts']:
        inner=json.loads((recovery_root/context['payloadPath']).read_text(encoding='utf-8'))
        require(inner['fingerprint']==context['fingerprint'],'Restoration context fingerprint mismatch')
    base=(ROOT/'fixtures/structure-only-plan-v2.html').read_text(encoding='utf-8')
    candidate=(ROOT/'fixtures/structure-only-plan-v3.html').read_text(encoding='utf-8')
    pattern=r'(<section id="strategy" data-mokina-id="strategy">).*?(</section>)'
    require(re.sub(pattern,r'\1__SELECTED__\2',base,flags=re.S)==re.sub(pattern,r'\1__SELECTED__\2',candidate,flags=re.S),
            'Candidate fixture modified non-selected region')
    checks.append('Recovery fixture: all bytes, hashes, version graph, current pointer and single-section candidate valid')
    with (ROOT/'fixtures/channel-performance.csv').open(newline='',encoding='utf-8') as fp:
        records=list(csv.DictReader(fp))
    expected=read('fixtures/expected-metrics.json')
    require(len(records)==8==expected['recordCount'],'CSV logical row count must be 8')
    require(len({r['record_id'] for r in records})==8,'Duplicate CSV record')
    require(any(',' in r['channel'] for r in records) and any('\n' in r['notes'] for r in records),'CSV quoting cases missing')
    for period in ['A','B']:
        rows=[r for r in records if r['period']==period]
        online=[r for r in rows if r['impressions']!='' and r['clicks']!='']
        def total(key, rr=rows): return sum((Decimal(r[key]) for r in rr),Decimal(0))
        actual={'spendCny':total('spend_cny'),'qualifiedLeads':total('qualified_leads'),
                'salesCny':total('sales_cny'),'onlineImpressions':total('impressions',online),
                'onlineClicks':total('clicks',online),'onlineLeads':total('qualified_leads',online)}
        actual.update(CTR=actual['onlineClicks']/actual['onlineImpressions'],
                      CVR=actual['onlineLeads']/actual['onlineClicks'],
                      CPL=actual['spendCny']/actual['qualifiedLeads'],ROAS=actual['salesCny']/actual['spendCny'])
        for key,value in actual.items():
            require(abs(value-Decimal(str(expected['periods'][period][key])))<Decimal('1e-8'),f'CSV metric mismatch {period}/{key}')
    require(expected['periods']['A']['qualifiedLeads']==565 and expected['periods']['B']['qualifiedLeads']==503,'Known independent totals changed')
    require(sum(expected['leadChange']['byChannel'].values())==-62,'Channel lead change decomposition mismatch')
    zero=next(r for r in records if r['record_id']=='B04')
    require(zero['clicks']=='0' and zero['qualified_leads']=='0','True zero fixture changed')
    require(all(r['clicks']=='' for r in records if r['channel']=='线下门店'),'Missing offline clicks fixture changed')
    checks.append('Synthetic CSV: independent Decimal recomputation; missing/zero, weighted ratios and -62 lead delta valid')
    sources={s['id'] for s in read('sources.json')['sources']}
    for md in ROOT.rglob('*.md'):
        text=md.read_text(encoding='utf-8')
        for target in re.findall(r'\]\(([^)]+)\)',text):
            if target.startswith(('http:','https:','mailto:','#')):continue
            rel=unquote(target.split('#')[0])
            if not rel:continue
            require((md.parent/rel).exists(),f'Broken link in {md.relative_to(ROOT)}: {target}')
        for ref in re.findall(r'\b(?:S\d{2}|E\d{2})\b',text):
            require(ref in sources,f'Unknown source reference {ref}')
    checks.append('Markdown: internal file links and source IDs resolve')
    release=read('examples/release-evidence.json')
    require(release['status']=='not_run' and all(g['status']=='not_run' for g in release['gates'].values()),'Fake release result')
    checks.append('Evidence boundary: release/app tests remain not_run; no fabricated user acceptance')
    sums=ROOT/'SHA256SUMS.txt'
    if sums.exists():
        for line in sums.read_text(encoding='utf-8').splitlines():
            h,rel=line.split('  ',1)
            require(sha((ROOT/rel).read_bytes())==h,f'Package file checksum mismatch: {rel}')
        checks.append('Package SHA256SUMS verified')
if __name__=='__main__':
    try:
        validate()
    except Exception as error:
        print(f'SPEC VALIDATION FAILED: {error}',file=sys.stderr)
        raise SystemExit(1) from error
    print('SPEC VALIDATION PASSED — this is NOT a Mokina application test result.')
    for check in checks:print('OK:',check)

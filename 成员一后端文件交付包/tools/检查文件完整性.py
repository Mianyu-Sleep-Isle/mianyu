from pathlib import Path
import json, hashlib, uuid

base = Path(__file__).resolve().parents[1]
assets = json.loads((base/'config/音频详细信息.json').read_text(encoding='utf-8'))['assets']
mapping = json.loads((base/'config/音频路径对照表.json').read_text(encoding='utf-8'))
expected = {'A01':3,'A02':3,'A05':3,'A06':3,'A09':3,'A12':4}
assert len(assets)==19
assert len({a['assetId'] for a in assets})==19
for code,count in expected.items():
    group=[a for a in assets if a['soundCode']==code]
    assert len(group)==count
    assert sum(a['isDefaultCandidate'] for a in group)==(0 if code=='A12' else 1)
for a in assets:
    uuid.UUID(a['assetId'])
    p=(base/a['resourceAddress']).resolve()
    assert p.is_relative_to(base.resolve())
    data=p.read_bytes()
    assert len(data)==a['sizeBytes']
    assert hashlib.sha256(data).hexdigest()==a['sha256']
    assert a['durationSec']>0 and a['frameCount']>0 and a['format']=='mp3'
    assert a['contentId']==a['assetId']
    assert mapping['byContentId'][a['assetId']]['resourceKey']==a['resourceKey']
    if a['soundCode']=='A02':assert a['spaceType']=='indoor'
    if a['soundCode']=='A12':
        assert a['exclusionTestOnly'] and 'thunder' in a['tags']
        assert not any(a[k] for k in ('isDefault','isDefaultCandidate','allowRecommendation','enabled'))
        assert a['purpose']=='仅用于不要打雷的排除验证'
        assert a['contentId'] not in mapping['defaultContentIds']+mapping['provisionalDefaultContentIds']
    if a['copyrightStatus']=='pending_review':
        assert not a['enabled'] and not a['allowRecommendation'] and not a['isDefault']
assert len(list((base/'assets').rglob('*.mp3')))==19
print('PASS: 19 assets; hashes, sizes, UUIDs, paths, categories, pending-review gates and A12 exclusion verified.')

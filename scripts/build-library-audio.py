"""Build the original Little Library stories as same-site neural narration.

Requires edge-tts 7.3.1 and Node. No keys or speech service are used by players.
Only the public, fixed story text is sent to Microsoft's online speech service.
Use --runtime for an existing isolated Python dependency directory, if needed.
Generation verifies spoken word boundaries and complete MP3 frames before saving.
"""
import argparse
import asyncio
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def inspect_mp3(data):
    offset = frames = 0
    seconds = 0.0
    while offset < len(data):
        header = int.from_bytes(data[offset:offset + 4], 'big')
        assert (header >> 21) & 0x7ff == 0x7ff, f'Invalid frame at {offset}'
        version, layer = (header >> 19) & 3, (header >> 17) & 3
        bi, si, pad = (header >> 12) & 15, (header >> 10) & 3, (header >> 9) & 1
        assert version in (0, 2, 3) and layer == 1 and 0 < bi < 15 and si < 3
        sr = [44100, 48000, 32000][si] // (1 if version == 3 else 2 if version == 2 else 4)
        rates = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320] if version == 3 else [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160]
        size = (144000 if version == 3 else 72000) * rates[bi] // sr + pad
        assert offset + size <= len(data), 'Truncated MP3 frame'
        seconds += (1152 if version == 3 else 576) / sr
        offset += size
        frames += 1
    assert frames > 0
    return {'seconds': round(seconds, 3), 'frames': frames}


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path)
    parser.add_argument('--out', type=Path, default=ROOT / 'game/assets/library-audio/ava-v1')
    parser.add_argument('--voice', default='en-US-AvaMultilingualNeural')
    parser.add_argument('--sample', action='store_true', help='Generate only the first page as a preview')
    args = parser.parse_args()
    if args.runtime:
        sys.path.insert(0, str(args.runtime))
    import edge_tts

    code = "const fs=require('fs'),vm=require('vm');const c=vm.createContext({});vm.runInContext(fs.readFileSync('game/library-books.js','utf8'),c);process.stdout.write(JSON.stringify(c.MYNE_LIBRARY.STORIES));"
    stories = json.loads(subprocess.check_output(['node', '-e', code], cwd=ROOT, text=True))
    args.out.mkdir(parents=True, exist_ok=True)
    manifest = {'voice': args.voice, 'label': 'Natural storyteller', 'provider': 'Microsoft online neural speech',
                'rate': '-4%', 'pitch': '+0Hz', 'generated': '2026-10-31',
                'content': 'Original MYnecraft Little Library stories; AI-generated narration.', 'pages': []}
    for story in stories:
        for index, text in enumerate(story['pages']):
            filename = f"{story['id']}-{index + 1}.mp3"
            for attempt in range(3):
                try:
                    data, words = bytearray(), []
                    stream = edge_tts.Communicate(text, args.voice, rate='-4%', pitch='+0Hz', boundary='WordBoundary')
                    async for item in stream.stream():
                        if item['type'] == 'audio':
                            data.extend(item['data'])
                        elif item['type'] == 'WordBoundary':
                            words.append(item['text'])
                    normalize = lambda value: re.findall(r'[a-z0-9]+', value.lower())
                    assert normalize(text) == normalize(' '.join(words)), f'Word mismatch: {filename}'
                    integrity = inspect_mp3(data)
                    assert 2 < integrity['seconds'] < 30, f'Unexpected page duration: {filename}'
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(1 + attempt)
            (args.out / filename).write_bytes(data)
            manifest['pages'].append({'book': story['id'], 'page': index + 1, 'file': filename,
                                      'textSha256': hashlib.sha256(text.encode()).hexdigest(),
                                      'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
                                      'verifiedWords': len(words), **integrity})
            print(f"{filename}: {integrity['seconds']} seconds, text verified", flush=True)
            if args.sample:
                (args.out / 'sample-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
                return
    (args.out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(f"Saved {len(manifest['pages'])} verified pages.", flush=True)


if __name__ == '__main__':
    asyncio.run(main())

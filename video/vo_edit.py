# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile", "scipy"]
# ///
"""Cut a narration take into lines and place each line on the film's beat grid.

    uv run vo_edit.py <film>          reads <film>/audio/vo/plan.json, writes <film>/audio/vo.wav + <film>/vo.json

plan.json:
  {"take": "audio/vo/takeA.wav", "tempo": 1.0,
   "segments": [[t0, t1, "text"], ...],              # speech between pauses in the take (seconds)
   "lines": [[first_seg, last_seg, beat], ...]}      # a line = consecutive segments, placed at a beat
vo.json: {"lines": [{"text", "t0", "t1", "words": [{"w", "t0", "t1"}]}]}  (film seconds)
Word times inside a segment are spread by character count: good to ~0.1 s, enough for words that
appear as they are spoken.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 48000
film = Path(sys.argv[1])
plan = json.loads((film / "audio/vo/plan.json").read_text())
grid = json.loads((film / "beats.json").read_text())
cfg = json.loads((film / "film.json").read_text())
period, offset = grid["period"], grid["offset"]
tempo = float(plan.get("tempo", 1.0))

# Decode the take to 48 kHz mono, slowed (pitch kept) if tempo < 1.
src = film / plan["take"]
tmp = film / "audio/vo/_take.wav"
af = f"atempo={tempo}" if abs(tempo - 1) > 1e-6 else "anull"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", af, "-ac", "1", "-ar", str(SR), str(tmp)], check=True)
take, _ = sf.read(tmp)
segs = [[a / tempo, b / tempo, txt] for a, b, txt in plan["segments"]]

dur = float(cfg["duration"])
out = np.zeros(int(dur * SR) + SR)
lines = []
pad0, pad1 = 0.05, 0.14
for first, last, beat in plan["lines"]:
    a, b = segs[first][0] - pad0, segs[last][1] + pad1
    a = max(0.0, a)
    piece = take[int(a * SR):int(b * SR)].copy()
    fade = int(0.012 * SR)
    piece[:fade] *= np.linspace(0, 1, fade)
    piece[-fade:] *= np.linspace(1, 0, fade)
    # the first word's onset (segment start) lands on the beat
    at = offset + beat * period - pad0
    i = int(at * SR)
    out[i:i + len(piece)] += piece
    shift = at - a
    words = []
    for s0, s1, txt in segs[first:last + 1]:
        ws = txt.split()
        weights = np.array([len(w) + 2 for w in ws], float)
        edges = np.concatenate([[0], np.cumsum(weights)]) / weights.sum()
        for k, w in enumerate(ws):
            words.append({"w": w, "t0": round(s0 + shift + edges[k] * (s1 - s0), 3), "t1": round(s0 + shift + edges[k + 1] * (s1 - s0), 3)})
    text = " ".join(t for _, _, t in segs[first:last + 1])
    lines.append({"text": text, "t0": words[0]["t0"], "t1": words[-1]["t1"], "beat": beat, "words": words})

# overlap check
for x, y in zip(lines, lines[1:]):
    gap = y["t0"] - x["t1"]
    flag = "  <-- OVERLAP" if gap < 0.15 else ""
    print(f"{x['t1']:7.2f} -> {y['t0']:7.2f}  gap {gap:5.2f}s{flag}")
end = lines[-1]["t1"]
print(f"last word ends {end:.2f}s of {dur:.2f}s")

out = out[: int(dur * SR)]
peak = np.max(np.abs(out)) or 1
out = out / peak * 0.89
sf.write(film / "audio/vo.wav", np.stack([out, out], 1), SR, subtype="PCM_24")
(film / "vo.json").write_text(json.dumps({"lines": lines}, indent=1))
tmp.unlink()
print(f"-> {film}/audio/vo.wav, {film}/vo.json ({len(lines)} lines)")

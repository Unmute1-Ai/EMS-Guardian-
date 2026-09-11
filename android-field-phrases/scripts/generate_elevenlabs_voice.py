#!/usr/bin/env python3
import json, os, pathlib, urllib.request

root = pathlib.Path(__file__).resolve().parents[1]
phrase_file = root / "app/src/main/assets/phrases.json"
data = json.loads(phrase_file.read_text(encoding="utf-8"))

api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb").strip()
if not api_key:
    raise SystemExit("ELEVENLABS_API_KEY is required for the voice-enabled build")

for language in data["languages"]:
    out_dir = root / "app/src/main/assets/voice" / language["id"]
    out_dir.mkdir(parents=True, exist_ok=True)
    for index, text in enumerate(language["phrases"], 1):
        output = out_dir / f"p{index:02d}.mp3"
        body = json.dumps({
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.55,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True
            }
        }, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            data=body,
            headers={
                "xi-api-key": api_key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg"
            },
            method="POST"
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            audio = response.read()
        if len(audio) < 1000:
            raise RuntimeError(f"Voice generation failed for {language['id']} phrase {index}")
        output.write_bytes(audio)
        print(language["id"], index, len(audio))

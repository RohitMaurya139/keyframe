# KEYFRAME local STT worker. Reads an audio file, prints one JSON object to
# stdout: { "transcript": str, "segments": [{start, end, text}], "language": str }.
# Invoked by src/services/ingest/transcribe.js as:
#   python scripts/transcribe.py <audio.wav> [model_size]
# Model files cache under ~/.cache/huggingface (first run downloads them).

import json
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: transcribe.py <audio> [model_size]"}))
        return 2

    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "small"

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({"error": "faster-whisper not installed (pip install faster-whisper)"}))
        return 3

    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        segments_iter, info = model.transcribe(audio_path, beam_size=5, vad_filter=True)
        segments = [
            {"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()}
            for s in segments_iter
        ]
        transcript = " ".join(s["text"] for s in segments).strip()
        print(json.dumps({
            "transcript": transcript,
            "segments": segments,
            "language": info.language,
            "durationSec": round(info.duration, 2),
        }, ensure_ascii=False))
        return 0
    except Exception as e:  # noqa: BLE001 — single JSON error surface for the caller
        print(json.dumps({"error": f"{type(e).__name__}: {e}"}))
        return 1


if __name__ == "__main__":
    sys.exit(main())

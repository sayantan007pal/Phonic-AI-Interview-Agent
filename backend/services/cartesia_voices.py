CARTESIA_VOICES = {
    "us": {
        "voice_id": "a0e99841-438c-4a64-b679-ae501e7d6091",
        "label": "US English — Neutral Midwestern",
        "model_id": "sonic-english"
    },
    "uk": {
        "voice_id": "bf991597-6c13-47e4-8411-91ec2de5c466",
        "label": "UK English — Received Pronunciation",
        "model_id": "sonic-english"
    },
    "au": {
        "voice_id": "79a125e8-cd45-4c13-8a67-188112f4dd22",
        "label": "Australian English",
        "model_id": "sonic-english"
    },
    "in": {
        "voice_id": "694f9389-aac1-45b6-b726-9d9369183238",
        "label": "Indian English — Neutral",
        "model_id": "sonic-english"
    },
    "custom": {
        "voice_id": None,  # Set via settings page
        "label": "Custom Brand Voice",
        "model_id": "sonic-english"
    }
}


def get_voice_id(accent: str, custom_voice_id: str = None) -> str:
    import os
    if accent == "custom":
        return custom_voice_id or os.getenv("CARTESIA_CUSTOM_VOICE_ID") or CARTESIA_VOICES["us"]["voice_id"]
    voice = CARTESIA_VOICES.get(accent, CARTESIA_VOICES["us"])
    return voice["voice_id"]

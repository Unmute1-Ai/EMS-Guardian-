# U1 Field v0.1

One-way, on-device EMS phrase transcription and translation for NYC's 10 designated Local Law 30 languages: Spanish, Chinese, Russian, Bengali, Haitian Creole, Korean, Arabic, Urdu, French, and Polish.

Direction: patient language → English.

Privacy contract:
- microphone is the only runtime permission;
- Android `INTERNET` permission is absent;
- inference uses bundled whisper.cpp + multilingual Whisper Base;
- audio remains in RAM and is zeroed after processing;
- transcript/translation are memory-only and cleared when the app leaves foreground;
- backups and device-transfer extraction are disabled;
- screenshots and recent-app previews are blocked.

This is a communication aid / field prototype, not diagnostic or clinical decision-support software. Critical information must be confirmed with the patient using normal EMS procedures.

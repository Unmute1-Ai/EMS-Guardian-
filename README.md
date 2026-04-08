# Guardian EMS Tactical Medical Suite

Guardian EMS is a cutting-edge, AI-powered tactical medical suite designed for first responders. It integrates real-time computer vision, linguistic intelligence, and tactical navigation to enhance field performance and patient care.

## Features

### 1. Field Assistant (FIELD Mode)
- **Real-time AI Support**: Uses Gemini Live to provide clinical guidance, protocol reminders, and scene safety alerts.
- **Computer Vision**: Analyzes the field via webcam to identify hazards and patient status.
- **Tactical Lookup**: Quick access to standard EMS 10-codes and local hospital trauma levels/diversion status.
- **Vital Signs HUD**: Real-time display of simulated patient vitals (Heart Rate, SpO2, Respiration).

### 2. Universal Translator (TRANSLATE Mode)
- **Auto-Detection**: Automatically identifies patient language.
- **Bi-directional Translation**: Facilitates clear communication between responders and patients in dozens of languages.
- **Medical Context**: Prioritizes medical terminology for accurate clinical handoffs.

### 3. ASL Bridge (ASL Mode)
- **Hand Tracking**: Uses MediaPipe for real-time hand landmark detection.
- **Sign-to-Text**: Translates American Sign Language (ASL) glosses into natural English.
- **Text-to-Sign**: Converts responder English into ASL gloss sequences.

### 4. Tactical Navigation (EN ROUTE Mode)
- **Dynamic Mapping**: Real-time tactical map with scene destination tracking.
- **Cross-Street Awareness**: Displays the nearest major cross-streets using Google Maps grounding.
- **GPS Accuracy HUD**: Visual feedback on GPS signal quality and accuracy.

### 5. Training Simulator (TRAINING Mode)
- **Multimodal Scenarios**: Generates complex medical emergencies with visual prompts.
- **Interactive Feedback**: Responders can practice actions and receive immediate AI critique.
- **Visual Context**: AI-generated images of the simulated scene for immersive training.

### 6. Handoff Report Generator (REPORT Mode)
- **Automated Documentation**: Converts field notes and observations into professional medical handoff reports.
- **Standardized Format**: Ensures all critical patient data is captured for hospital transfer.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Animations**: Motion (Framer Motion)
- **Icons**: Lucide React
- **AI/ML**: 
  - **Gemini API**: Powers the Live Assistant, Translators, and Simulator.
  - **MediaPipe**: Handles hand tracking for ASL.
  - **Google Maps Grounding**: Provides real-time location and cross-street data.
- **Styling**: Modern "Tactical Dark" aesthetic with high-contrast HUD elements.

## Getting Started

1. **Initialize Unit**: Click the "Initialize Unit" button in Field mode to start the AI session.
2. **Navigation**: Use the Map view while en route. Click "Arrived at Scene" to switch to clinical mode.
3. **Lookup**: Use the "Lookup" button in the Protocol Intelligence panel for 10-codes and hospitals.
4. **Support**: Click the floating sparkles icon for the Support Assistant (Therapy, Study, or Chat).

## Security & Privacy

- **Referrer Policy**: All external images are loaded with `no-referrer` for privacy.
- **Local Processing**: Sensitive vision and audio processing are handled via secure AI streams.

---
*Guardian EMS: Intelligence at the Edge.*

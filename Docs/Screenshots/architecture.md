# 🏗 ASHENRITUAL AI Try-On Architecture

## System Flow

Camera
↓
Camera Manager
↓
MediaPipe Pose Detection
↓
Pose Data Processing
↓
Garment Engine
↓
Canvas Renderer
↓
Video Recorder
↓
Export

---

## Folder Structure

src/

components/
- camera/
- layout/
- ui/
- tryon/

hooks/
- useCamera.ts
- usePose.ts
- useRecorder.ts

ai/
- PoseDetector.ts
- ClothingEngine.ts

pages/
- Landing.tsx
- TryOn.tsx
- About.tsx

utils/

types/

assets/

---

## Technology Stack

Frontend
- React
- TypeScript
- Vite

Styling
- TailwindCSS
- Framer Motion

AI
- MediaPipe Tasks Vision

Camera
- react-webcam

Deployment
- Vercel

Repository
- GitHub
# CLIPVERSE AI

Free-first AI video clipping, multilingual captioning, anime font studio, and social media export platform.

## Architecture
- **Frontend**: React 19, Vite, Tailwind CSS v4, Motion (`motion/react`), Lucide Icons, Firebase Auth + Cloud Firestore.
- **Backend**: Node.js + Express (`server.ts`) on port `3000`, `@google/genai` (`gemini-3.5-transcribe`, `gemini-4-hydrogen`, `gemini-3.8-flash-lite-tts`), FFmpeg/FFprobe media pipeline, `qrcode` UPI generator, `firebase-admin`.

## Local Development & Production Deployment

### Prerequisites
- Node.js 22+
- `ffmpeg` and `ffprobe` installed on host (`apt-get install -y ffmpeg`)
- `GEMINI_API_KEY` set in environment / AI Studio Secrets

### Commands
```bash
npm install
npm run dev      # Starts Express + Vite dev middleware on port 3000
npm run lint     # TypeScript type check
npm run build    # Builds Vite production bundle to dist/
npm start        # Runs production server (NODE_ENV=production node server.ts)
```

## Android APK Build (Capacitor Wrapper)
```bash
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "CLIPVERSE AI" "ai.clipverse.app" --web-dir=dist
npx cap add android
npx cap sync android
cd android && ./gradlew assembleRelease
```
Configure `server.url` in `capacitor.config.ts` to point to your deployed Cloud Run HTTPS URL so mobile uploads, FFmpeg processing, and Firebase Auth work seamlessly inside the Android APK.

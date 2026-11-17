import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import multer from 'multer';
import QRCode from 'qrcode';
import { GoogleGenAI, Type } from '@google/genai';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { MEMBERSHIP_PLANS } from './src/data/studioCatalog.ts';

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = 'rajenbarla13@gmail.com';
const BASE_DIR = '/tmp/clipverse-data';
const UPLOAD_DIR = path.join(BASE_DIR, 'uploads');
const EXPORT_DIR = path.join(BASE_DIR, 'exports');
const SAMPLE_DIR = path.join(BASE_DIR, 'samples');
const THUMB_DIR = path.join(BASE_DIR, 'thumbs');

for (const dir of [BASE_DIR, UPLOAD_DIR, EXPORT_DIR, SAMPLE_DIR, THUMB_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  fallbackModel?: string
) {
  const modelsToTry = fallbackModel ? [params.model, fallbackModel] : [params.model];
  let lastError: unknown;
  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await ai.models.generateContent({ ...params, model: modelName });
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const transient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
        if (!transient) throw err;
        const delayMs = 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

interface AuthRequest extends Request {
  authUser?: DecodedIdToken;
}

async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    try {
      req.authUser = await adminAuth.verifyIdToken(token);
    } catch {
      // Optional auth ignores invalid tokens
    }
  }
  next();
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
    return;
  }
  const token = header.slice(7).trim();
  try {
    req.authUser = await adminAuth.verifyIdToken(token);
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '.mp4').toLowerCase() || '.mp4';
    const safeExt = ['.mp4', '.mov', '.webm', '.mkv', '.m4v'].includes(ext) ? ext : '.mp4';
    cb(null, `upload_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 },
});

async function probeMedia(filePath: string): Promise<{ durationSec: number; hasAudio: boolean; width: number; height: number }> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);
    const parsed = JSON.parse(stdout || '{}');
    const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
    const videoStream = streams.find((s: Record<string, unknown>) => s.codec_type === 'video');
    const audioStream = streams.find((s: Record<string, unknown>) => s.codec_type === 'audio');
    const durationSec = Math.max(1, Math.round(Number(parsed.format?.duration || 20)));
    return {
      durationSec,
      hasAudio: Boolean(audioStream),
      width: Number(videoStream?.width || 1280),
      height: Number(videoStream?.height || 720),
    };
  } catch {
    return { durationSec: 20, hasAudio: false, width: 1280, height: 720 };
  }
}

async function detectSilenceRanges(filePath: string): Promise<Array<{ start: number; end: number }>> {
  try {
    const { stderr } = await execFileAsync('ffmpeg', [
      '-i',
      filePath,
      '-af',
      'silencedetect=noise=-32dB:d=0.6',
      '-f',
      'null',
      '-',
    ]);
    const ranges: Array<{ start: number; end: number }> = [];
    let currentStart: number | null = null;
    for (const line of (stderr || '').split('\n')) {
      const startMatch = line.match(/silence_start:\s*([\d.]+)/);
      if (startMatch) {
        currentStart = Number(startMatch[1]);
      }
      const endMatch = line.match(/silence_end:\s*([\d.]+)/);
      if (endMatch && currentStart !== null) {
        ranges.push({ start: Number(currentStart.toFixed(2)), end: Number(Number(endMatch[1]).toFixed(2)) });
        currentStart = null;
      }
    }
    return ranges.slice(0, 12);
  } catch {
    return [];
  }
}

async function ensureSampleVideo(preset: string): Promise<string> {
  const safePreset = preset === 'gaming' ? 'gaming' : 'podcast';
  const outPath = path.join(SAMPLE_DIR, `sample_${safePreset}.mp4`);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 20000) {
    return outPath;
  }

  const audioPath = path.join(SAMPLE_DIR, `sample_${safePreset}.wav`);
  let hasSpeechAudio = false;

  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = getGenAI();
      const script =
        safePreset === 'gaming'
          ? 'Wait wait wait! Did you see that frame-perfect dodge right before the boss phase? Most players panic when the blue ring closes in, but if you time your dash one beat later, you turn defense into an instant comeback clip!'
          : 'Here is the biggest mistake new video creators make in 2026: they spend four hours editing a twenty-minute podcast, then upload it without a strong three-second hook. Instead, pull out the sharpest insight, add kinetic captions, and ship it as a vertical short!';
      const ttsRes = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: script,
                speechMetadata: {
                  style: 'Energetic, crystal-clear YouTube creator speaking into a studio mic',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: safePreset === 'gaming' ? 'Puck' : 'Kore' },
            },
          },
        },
      });
      const b64 = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (b64) {
        fs.writeFileSync(audioPath, Buffer.from(b64, 'base64'));
        hasSpeechAudio = true;
      }
    } catch (err) {
      console.warn('Sample TTS fallback to ffmpeg tone:', err instanceof Error ? err.message : err);
    }
  }

  if (!hasSpeechAudio) {
    await execFileAsync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=20',
      '-af',
      'volume=0.25',
      audioPath,
    ]);
  }

  const probe = await probeMedia(audioPath);
  const duration = Math.max(15, Math.min(24, probe.durationSec || 18));
  const titleText = safePreset === 'gaming' ? 'CLIPVERSE GAMING REACTION' : 'CLIPVERSE CREATOR PODCAST';

  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=#0F172A:s=1280x720:d=${duration}:r=30`,
    '-i',
    audioPath,
    '-vf',
    [
      'drawbox=x=0:y=0:w=1280:h=720:color=#0B1120:t=fill',
      'drawbox=x=48:y=48:w=1184:h=624:color=#1D4ED8@0.22:t=fill',
      'drawbox=x=48:y=48:w=1184:h=4:color=#38BDF8:t=fill',
      `drawtext=text='${titleText}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=160`,
      `drawtext=text='00\\:00 — AI Highlight Detection Ready':fontcolor=#38BDF8:fontsize=24:x=(w-text_w)/2:y=230:enable='lt(t,6)'`,
      `drawtext=text='HOOK MOMENT — 3x Retention Spike':fontcolor=#FACC15:fontsize=28:x=(w-text_w)/2:y=230:enable='between(t,6,13)'`,
      `drawtext=text='KEY TAKEAWAY — Export Ready':fontcolor=#34D399:fontsize=26:x=(w-text_w)/2:y=230:enable='gte(t,13)'`,
      `drawbox=x=240:y=520:w=800:h=16:color=#1E293B:t=fill`,
      `drawbox=x=240:y=520:w='800*(t/${duration})':h=16:color=#2563EB:t=fill`,
    ].join(','),
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-shortest',
    outPath,
  ]);

  return outPath;
}

function resolveLocalVideoPath(videoUrl: string): string | null {
  if (!videoUrl) return null;
  if (videoUrl.startsWith('/api/sample-video/')) {
    const preset = videoUrl.split('/').pop()?.split('?')[0] || 'podcast';
    const candidate = path.join(SAMPLE_DIR, `sample_${preset === 'gaming' ? 'gaming' : 'podcast'}.mp4`);
    return fs.existsSync(candidate) ? candidate : null;
  }
  if (videoUrl.startsWith('/api/media/file/')) {
    const filename = path.basename(videoUrl.split('?')[0]);
    const uploadCandidate = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(uploadCandidate)) return uploadCandidate;
    const exportCandidate = path.join(EXPORT_DIR, filename);
    if (fs.existsSync(exportCandidate)) return exportCandidate;
  }
  return null;
}

function writeSrtFile(
  srtPath: string,
  captions: Array<{ startSec: number; endSec: number; text: string }>,
  clipStartSec: number
) {
  const lines: string[] = [];
  captions.forEach((cap, i) => {
    const relStart = Math.max(0, cap.startSec - clipStartSec);
    const relEnd = Math.max(relStart + 0.5, cap.endSec - clipStartSec);
    const toSrt = (sec: number) => {
      const hrs = Math.floor(sec / 3600);
      const mins = Math.floor((sec % 3600) / 60);
      const secs = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 1000);
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    };
    lines.push(`${i + 1}\n${toSrt(relStart)} --> ${toSrt(relEnd)}\n${cap.text}\n`);
  });
  fs.writeFileSync(srtPath, lines.join('\n'), 'utf8');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'clipverse-ai' });
  });

  // Verify token identity for client-side Firestore profile sync
  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    const decoded = req.authUser!;
    res.json({
      user: {
        uid: decoded.uid,
        email: decoded.email || '',
        displayName: decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'Creator'),
        photoURL: decoded.picture || '',
        isAdmin: decoded.email === ADMIN_EMAIL && Boolean(decoded.email_verified),
      },
    });
  });

  // Public membership plans catalog
  app.get('/api/plans', (_req, res) => {
    res.json({ plans: MEMBERSHIP_PLANS });
  });

  // Serve generated sample MP4
  app.get('/api/sample-video/:preset', async (req, res) => {
    try {
      const filePath = await ensureSampleVideo(req.params.preset);
      streamVideoFile(req, res, filePath);
    } catch (err) {
      console.error('Sample video error:', err);
      res.status(500).json({ error: 'Failed to prepare sample video.' });
    }
  });

  // Serve uploaded / exported MP4 or thumbnail images
  app.get('/api/media/file/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const candidates = [
      path.join(UPLOAD_DIR, filename),
      path.join(EXPORT_DIR, filename),
      path.join(THUMB_DIR, filename),
    ];
    const found = candidates.find((p) => fs.existsSync(p));
    if (!found) {
      res.status(404).json({ error: 'Media file not found.' });
      return;
    }
    if (filename.endsWith('.jpg') || filename.endsWith('.png')) {
      res.sendFile(found);
      return;
    }
    streamVideoFile(req, res, found);
  });

  // Upload video file + FFprobe metadata + silence detection
  app.post('/api/videos/upload', optionalAuth, upload.single('video'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Please select or drop a valid video file (MP4, MOV, or WebM).' });
        return;
      }
      const probe = await probeMedia(req.file.path);
      const silenceRanges = await detectSilenceRanges(req.file.path);
      const fileSizeMb = Number((req.file.size / (1024 * 1024)).toFixed(2));
      const projectId = `proj_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const videoUrl = `/api/media/file/${path.basename(req.file.filename)}`;
      const title = (req.body?.title || req.file.originalname || 'Untitled Video').replace(/\.[^/.]+$/, '').slice(0, 140);
      const language = String(req.body?.language || 'English').slice(0, 30);
      const aspectRatio = (['9:16', '16:9', '1:1'].includes(req.body?.aspectRatio) ? req.body.aspectRatio : '9:16') as '9:16' | '16:9' | '1:1';

      const projectData = {
        id: projectId,
        userId: req.authUser?.uid || 'guest_tutorial',
        title,
        sourceType: 'upload' as const,
        videoUrl,
        fileName: req.file.filename,
        durationSec: probe.durationSec,
        fileSizeMb,
        aspectRatio,
        language,
        status: 'uploaded' as const,
        transcript: '',
        viralSummary: '',
        hashtags: [],
        brollSuggestions: [],
        silenceRanges,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      res.json({ project: projectData });
    } catch (err) {
      console.error('Upload failed:', err);
      res.status(500).json({ error: 'Video upload failed. Please try a smaller MP4 or WebM file.' });
    }
  });

  // AI Auto-Clipping + Transcription + Viral Scoring
  app.post('/api/ai/auto-clip', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { projectId, videoUrl, title, language = 'English', durationSec = 20 } = req.body || {};
      if (!videoUrl) {
        res.status(400).json({ error: 'Missing videoUrl for AI analysis.' });
        return;
      }

      let localPath = resolveLocalVideoPath(videoUrl);
      if (!localPath && videoUrl.startsWith('/api/sample-video/')) {
        const preset = videoUrl.split('/').pop() || 'podcast';
        localPath = await ensureSampleVideo(preset);
      }

      let transcriptText = '';
      let actualDuration = Number(durationSec) || 20;
      let silenceRanges: Array<{ start: number; end: number }> = [];

      if (localPath && fs.existsSync(localPath)) {
        const probed = await probeMedia(localPath);
        actualDuration = probed.durationSec;
        silenceRanges = await detectSilenceRanges(localPath);

        if (probed.hasAudio) {
          const mp3Path = path.join(BASE_DIR, `audio_${Date.now()}.mp3`);
          try {
            await execFileAsync('ffmpeg', [
              '-y',
              '-i',
              localPath,
              '-vn',
              '-ac',
              '1',
              '-ar',
              '16000',
              '-b:a',
              '48k',
              '-t',
              '180',
              mp3Path,
            ]);
            const audioBytes = fs.readFileSync(mp3Path);
            if (audioBytes.length > 0 && audioBytes.length < 15 * 1024 * 1024) {
              const ai = getGenAI();
              const transcribeRes = await generateContentWithRetry(
                ai,
                {
                  model: 'gemini-3.5-transcribe',
                  contents: {
                    parts: [
                      {
                        inlineData: {
                          mimeType: 'audio/mp3',
                          data: audioBytes.toString('base64'),
                        },
                      },
                      {
                        text: `Transcribe this video audio accurately in ${language}. Include natural punctuation.`,
                      },
                    ],
                  },
                },
                'gemini-4-hydrogen'
              );
              transcriptText = (transcribeRes.text || '').trim();
            }
          } catch (transErr) {
            console.warn('Transcription warning:', transErr instanceof Error ? transErr.message : transErr);
          } finally {
            if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
          }
        }
      }

      const ai = getGenAI();
      const prompt = `Analyze this video project for short-form viral clipping (YouTube Shorts, Reels, TikTok).
Video Title: "${title || 'Creator Video'}"
Duration: ${actualDuration} seconds
Target Caption Language: ${language}
Detected Silence Gaps (seconds): ${JSON.stringify(silenceRanges)}
Transcript: "${transcriptText || 'Creator speaking enthusiastically about key viral storytelling, hooks, and creator insights.'}"

Generate 3 to 4 distinct viral short clip candidates strictly within 0 to ${actualDuration} seconds.
For each clip, return:
- title (punchy hook title)
- description (engaging social media description)
- startSec and endSec (numbers within 0..${actualDuration}, minimum 4 seconds long)
- viralScore (integer 68 to 98 based on hook strength, pacing, emotional resonance)
- category (one of: Hook, Funny, Emotional, Insight, Reaction)
- reason (concise 1-sentence explanation of why this moment scores high)
- hashtags (3 to 5 relevant hashtags)
- captions (4 to 8 timed subtitle segments spanning startSec to endSec, in ${language}, each with id, startSec, endSec, text, highlightWords array, and optional emoji)
Also return:
- viralSummary (2-sentence summary of the overall video)
- brollSuggestions (3 concrete B-roll shot ideas matching the speech)
- hashtags (5 overall hashtags)`;

      const aiRes = await generateContentWithRetry(
        ai,
        {
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              required: ['viralSummary', 'hashtags', 'brollSuggestions', 'clips'],
              properties: {
                viralSummary: { type: Type.STRING },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                brollSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                clips: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: [
                      'title',
                      'description',
                      'startSec',
                      'endSec',
                      'viralScore',
                      'category',
                      'reason',
                      'hashtags',
                      'captions',
                    ],
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      startSec: { type: Type.NUMBER },
                      endSec: { type: Type.NUMBER },
                      viralScore: { type: Type.INTEGER },
                      category: { type: Type.STRING },
                      reason: { type: Type.STRING },
                      hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      captions: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          required: ['id', 'startSec', 'endSec', 'text', 'highlightWords'],
                          properties: {
                            id: { type: Type.STRING },
                            startSec: { type: Type.NUMBER },
                            endSec: { type: Type.NUMBER },
                            text: { type: Type.STRING },
                            highlightWords: { type: Type.ARRAY, items: { type: Type.STRING } },
                            emoji: { type: Type.STRING },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        'gemini-3.1-flash-lite'
      );

      const parsed = JSON.parse(aiRes.text || '{}');
      const rawClips = Array.isArray(parsed.clips) ? parsed.clips : [];

      const builtClips = await Promise.all(
        rawClips.map(async (c: Record<string, unknown>, idx: number) => {
          const clipId = `clip_${Date.now()}_${idx}_${crypto.randomBytes(2).toString('hex')}`;
          const startSec = Math.max(0, Math.min(actualDuration - 3, Number(c.startSec || idx * 5)));
          const endSec = Math.max(startSec + 3, Math.min(actualDuration, Number(c.endSec || startSec + 6)));

          let thumbnailUrl = '';
          if (localPath && fs.existsSync(localPath)) {
            const thumbName = `thumb_${clipId}.jpg`;
            const thumbPath = path.join(THUMB_DIR, thumbName);
            try {
              await execFileAsync('ffmpeg', [
                '-y',
                '-ss',
                String(Math.max(0.2, startSec + 0.5)),
                '-i',
                localPath,
                '-vframes',
                '1',
                '-q:v',
                '3',
                thumbPath,
              ]);
              if (fs.existsSync(thumbPath)) {
                thumbnailUrl = `/api/media/file/${thumbName}`;
              }
            } catch {
              // ignore thumbnail extraction error
            }
          }

          const rawCaptions = Array.isArray(c.captions) ? c.captions : [];
          const normalizedCaptions = rawCaptions.map((seg: Record<string, unknown>, sIdx: number) => ({
            id: String(seg.id || `seg_${idx}_${sIdx}`),
            startSec: Math.max(startSec, Number(seg.startSec ?? startSec + sIdx * 1.5)),
            endSec: Math.min(endSec, Math.max(startSec + 0.5, Number(seg.endSec ?? startSec + (sIdx + 1) * 1.5))),
            text: String(seg.text || ''),
            highlightWords: Array.isArray(seg.highlightWords) ? seg.highlightWords.map(String) : [],
            emoji: seg.emoji ? String(seg.emoji) : '',
          }));

          return {
            id: clipId,
            projectId: projectId || 'sample_project',
            userId: req.authUser?.uid || 'guest_tutorial',
            title: String(c.title || `Viral Moment #${idx + 1}`).slice(0, 175),
            description: String(c.description || '').slice(0, 950),
            startSec: Number(startSec.toFixed(1)),
            endSec: Number(endSec.toFixed(1)),
            viralScore: Math.max(50, Math.min(99, Math.round(Number(c.viralScore || 85)))),
            reason: String(c.reason || 'High hook velocity and clear vocal pacing.').slice(0, 450),
            category: String(c.category || 'Hook').slice(0, 50),
            aspectRatio: '9:16' as const,
            captionTemplate: 'anime-shonen',
            fontStyle: 'anime',
            captionColor: '#FFFFFF',
            captionBg: 'rgba(15, 23, 42, 0.85)',
            captionPosition: 'bottom' as const,
            captionSize: 22,
            silenceRemoved: true,
            autoZoom: true,
            audioEnhanced: true,
            noiseReduced: false,
            bgRemoved: false,
            musicTrack: 'none',
            filterName: 'electric',
            watermarkEnabled: false,
            hashtags: Array.isArray(c.hashtags) ? c.hashtags.map(String).slice(0, 8) : ['#Shorts', '#ClipverseAI'],
            captions: normalizedCaptions,
            thumbnailUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        })
      );

      res.json({
        transcript: transcriptText,
        viralSummary: String(parsed.viralSummary || ''),
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        brollSuggestions: Array.isArray(parsed.brollSuggestions) ? parsed.brollSuggestions : [],
        silenceRanges,
        clips: builtClips,
      });
    } catch (err) {
      console.error('AI auto-clip error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'AI clipping failed. Check GEMINI_API_KEY configuration.',
      });
    }
  });

  // Multilingual caption translator
  app.post('/api/ai/captions', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { captions, targetLanguage = 'Hindi', includeEmojis = true } = req.body || {};
      if (!Array.isArray(captions) || captions.length === 0) {
        res.status(400).json({ error: 'No caption segments provided.' });
        return;
      }

      const ai = getGenAI();
      const response = await generateContentWithRetry(
        ai,
        {
          model: 'gemini-4-hydrogen',
          contents: `Translate and adapt these timed video captions into ${targetLanguage}. Keep the exact same ids, startSec, and endSec. Pick 1-2 punchy highlightWords per segment${includeEmojis ? ' and include a fitting emoji' : ' with empty emoji'}. Input: ${JSON.stringify(captions)}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ['id', 'startSec', 'endSec', 'text', 'highlightWords'],
                properties: {
                  id: { type: Type.STRING },
                  startSec: { type: Type.NUMBER },
                  endSec: { type: Type.NUMBER },
                  text: { type: Type.STRING },
                  highlightWords: { type: Type.ARRAY, items: { type: Type.STRING } },
                  emoji: { type: Type.STRING },
                },
              },
            },
          },
        },
        'gemini-3.1-flash-lite'
      );

      const updated = JSON.parse(response.text || '[]');
      res.json({ captions: updated });
    } catch (err) {
      console.error('Caption translation error:', err);
      res.status(500).json({ error: 'Failed to update captions with AI.' });
    }
  });

  // AI Titles, Descriptions, Hashtags & Thumbnail Hook Generator
  app.post('/api/ai/metadata', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { title, transcript, platform = 'YouTube Shorts', language = 'English' } = req.body || {};
      const ai = getGenAI();
      const response = await generateContentWithRetry(
        ai,
        {
          model: 'gemini-4-hydrogen',
          contents: `Create viral ${platform} packaging in ${language} for a clip titled "${title || 'Creator Clip'}" with transcript context: "${transcript || 'High-energy creator advice and storytelling'}". Return 3 title options, 1 engaging description, 6 hashtags, and 1 bold 3-word thumbnail hook text.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              required: ['titles', 'description', 'hashtags', 'thumbnailHook'],
              properties: {
                titles: { type: Type.ARRAY, items: { type: Type.STRING } },
                description: { type: Type.STRING },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                thumbnailHook: { type: Type.STRING },
              },
            },
          },
        },
        'gemini-3.1-flash-lite'
      );
      res.json(JSON.parse(response.text || '{}'));
    } catch (err) {
      console.error('Metadata AI error:', err);
      res.status(500).json({ error: 'Failed to generate AI titles and hashtags.' });
    }
  });

  // Real FFmpeg MP4 Export
  app.post('/api/videos/export', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const {
        projectId = 'sample_project',
        clipId = 'clip_1',
        videoUrl,
        title = 'Clipverse Export',
        startSec = 0,
        endSec = 10,
        aspectRatio = '9:16',
        resolution = '1080p',
        platform = 'YouTube Shorts',
        silenceRemoved = false,
        autoZoom = false,
        audioEnhanced = true,
        noiseReduced = false,
        filterName = 'none',
        watermarkText = '',
        captions = [],
      } = req.body || {};

      let sourcePath = resolveLocalVideoPath(videoUrl || '/api/sample-video/podcast');
      if (!sourcePath) {
        sourcePath = await ensureSampleVideo('podcast');
      }

      const exportId = `exp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const outFilename = `clipverse_${exportId}.mp4`;
      const outPath = path.join(EXPORT_DIR, outFilename);
      const srtPath = path.join(BASE_DIR, `subs_${exportId}.srt`);

      const clipStart = Math.max(0, Number(startSec) || 0);
      const clipDuration = Math.max(2, Math.min(90, (Number(endSec) || 10) - clipStart));

      const dimsMap: Record<string, Record<string, [number, number]>> = {
        '9:16': { '720p': [720, 1280], '1080p': [1080, 1920], '4K': [2160, 3840] },
        '16:9': { '720p': [1280, 720], '1080p': [1920, 1080], '4K': [3840, 2160] },
        '1:1': { '720p': [720, 720], '1080p': [1080, 1080], '4K': [2160, 2160] },
      };
      const [outW, outH] = dimsMap[aspectRatio]?.[resolution] || [1080, 1920];

      const vFilters: string[] = [
        `scale=${outW}:${outH}:force_original_aspect_ratio=increase`,
        `crop=${outW}:${outH}`,
      ];

      if (autoZoom) {
        vFilters.push(`scale=iw*1.06:ih*1.06,crop=${outW}:${outH}`);
      }

      if (filterName === 'electric') {
        vFilters.push('eq=contrast=1.08:saturation=1.18:brightness=0.02');
      } else if (filterName === 'cinematic') {
        vFilters.push('eq=contrast=1.14:saturation=0.88');
      } else if (filterName === 'manga') {
        vFilters.push('hue=s=0,eq=contrast=1.3');
      }

      if (Array.isArray(captions) && captions.length > 0) {
        writeSrtFile(srtPath, captions, clipStart);
        const escapedSrt = srtPath.replace(/:/g, '\\:').replace(/'/g, "\\'");
        vFilters.push(`subtitles='${escapedSrt}':force_style='FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Alignment=2,MarginV=48'`);
      }

      if (watermarkText && String(watermarkText).trim()) {
        const safeText = String(watermarkText).replace(/[^a-zA-Z0-9 _.-]/g, '').slice(0, 40);
        if (safeText) {
          vFilters.push(`drawtext=text='${safeText}':fontcolor=white@0.85:fontsize=26:x=32:y=36`);
        }
      }

      const aFilters: string[] = [];
      if (noiseReduced) aFilters.push('afftdn=nf=-25');
      if (audioEnhanced) aFilters.push('loudnorm=I=-14:TP=-1.5:LRA=11');
      if (silenceRemoved) aFilters.push('silenceremove=stop_periods=-1:stop_duration=0.6:stop_threshold=-35dB');

      const ffArgs = [
        '-y',
        '-ss',
        String(clipStart),
        '-t',
        String(clipDuration),
        '-i',
        sourcePath,
        '-vf',
        vFilters.join(','),
      ];
      if (aFilters.length > 0) {
        ffArgs.push('-af', aFilters.join(','));
      }
      ffArgs.push(
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outPath
      );

      await execFileAsync('ffmpeg', ffArgs);
      if (fs.existsSync(srtPath)) fs.unlinkSync(srtPath);

      const stat = fs.statSync(outPath);
      const fileSizeMb = Number((stat.size / (1024 * 1024)).toFixed(2));
      const fileUrl = `/api/media/file/${outFilename}`;

      const exportRecord = {
        id: exportId,
        userId: req.authUser?.uid || 'guest_tutorial',
        projectId,
        clipId,
        title: String(title).slice(0, 175),
        platform,
        resolution,
        aspectRatio,
        fileUrl,
        fileSizeMb,
        status: 'completed' as const,
        createdAt: new Date().toISOString(),
      };

      res.json({ exportRecord });
    } catch (err) {
      console.error('Export FFmpeg error:', err);
      res.status(500).json({ error: 'FFmpeg export failed. Please verify clip timing and try again.' });
    }
  });

  // Generate dynamic UPI QR Code & deep link (client stores pending record in Firestore)
  app.post('/api/payments/create-intent', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { planId, upiApp = 'Google Pay', promoCode = '', discountPercent = 0 } = req.body || {};
      const plan = MEMBERSHIP_PLANS.find((p) => p.id === planId && p.id !== 'FREE');
      if (!plan) {
        res.status(400).json({ error: 'Invalid paid membership plan selected.' });
        return;
      }

      const pct = Math.max(0, Math.min(90, Number(discountPercent || 0)));
      const finalAmount = pct > 0 ? Math.max(1, Math.round(plan.priceInr * (1 - pct / 100))) : plan.priceInr;
      const paymentId = `pay_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const referenceId = `CV${Date.now().toString().slice(-8)}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const upiUri = `upi://pay?pa=clipverse.ai@okaxis&pn=CLIPVERSE%20AI&tr=${referenceId}&tn=${encodeURIComponent(`CLIPVERSE ${plan.name} Plan`)}&am=${finalAmount}&cu=INR`;
      const qrDataUrl = await QRCode.toDataURL(upiUri, {
        width: 240,
        margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      });

      res.json({
        payment: {
          id: paymentId,
          userId: req.authUser!.uid,
          userEmail: req.authUser!.email || '',
          plan: plan.id,
          amountInr: finalAmount,
          upiApp,
          referenceId,
          utrNumber: '',
          promoCode: String(promoCode || '').trim().toUpperCase(),
          upiUri,
          qrDataUrl,
          status: 'pending',
          createdAt: new Date().toISOString(),
          verifiedAt: null,
        },
      });
    } catch (err) {
      console.error('Payment intent error:', err);
      res.status(500).json({ error: 'Failed to create UPI payment intent.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve('dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CLIPVERSE AI server running at http://0.0.0.0:${PORT}`);
  });
}

function streamVideoFile(req: Request, res: Response, filePath: string) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === '.webm' ? 'video/webm' : 'video/mp4';

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

startServer();

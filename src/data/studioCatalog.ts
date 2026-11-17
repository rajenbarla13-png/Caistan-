import type {
  CaptionTemplate,
  ExportPlatform,
  MembershipPlan,
  TutorialStepDef,
} from '../types/clipverse';

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: 'FREE',
    name: 'Free Starter',
    audience: 'For new creators & daily clippers',
    priceInr: 0,
    billingCycle: 'Forever',
    durationDays: 36500,
    dailyProjectsLimit: 10,
    dailyMinutesLimit: 30,
    storageGb: 5,
    maxResolution: '1080p',
    captionStylesCount: 24,
    watermarkFree: true,
    aiBroll: false,
    priorityProcessing: false,
    customBranding: false,
    features: [
      '10 AI clipping projects every day',
      '30 minutes daily video processing',
      'Automatic multilingual AI captions',
      '24 caption styles & basic anime fonts',
      '720p and 1080p MP4 export (no forced watermark)',
      '5 GB cloud project storage + basic AI thumbnails',
    ],
  },
  {
    id: 'STARTER',
    name: 'Starter',
    audience: 'For growing Shorts & Reels channels',
    priceInr: 49,
    billingCycle: 'Week',
    durationDays: 7,
    dailyProjectsLimit: 35,
    dailyMinutesLimit: 120,
    storageGb: 20,
    maxResolution: '1080p',
    captionStylesCount: 55,
    watermarkFree: true,
    aiBroll: false,
    priorityProcessing: false,
    customBranding: false,
    features: [
      '35 AI clipping projects per day',
      '120 minutes daily video processing',
      '55+ caption styles & premium viral fonts',
      '1080p high-bitrate MP4 exports',
      '20 GB cloud project storage',
      'Hindi, English & Hinglish karaoke captions',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro Studio',
    audience: 'For full-time creators & editors',
    priceInr: 299,
    billingCycle: 'Month',
    durationDays: 30,
    dailyProjectsLimit: 150,
    dailyMinutesLimit: 600,
    storageGb: 100,
    maxResolution: '4K',
    captionStylesCount: 108,
    watermarkFree: true,
    aiBroll: true,
    priorityProcessing: true,
    customBranding: true,
    features: [
      'Advanced AI scene & emotion selection',
      'Unlimited captions within fair-use limits',
      'All 108+ caption templates & anime fonts',
      'AI B-roll suggestions & smart reframing',
      '4K export support with zero watermark',
      '100 GB cloud video storage',
    ],
  },
  {
    id: 'ULTIMATE',
    name: 'Ultimate',
    audience: 'For agencies & multi-channel teams',
    priceInr: 799,
    billingCycle: '3 Months',
    durationDays: 90,
    dailyProjectsLimit: 400,
    dailyMinutesLimit: 1500,
    storageGb: 250,
    maxResolution: '4K',
    captionStylesCount: 108,
    watermarkFree: true,
    aiBroll: true,
    priorityProcessing: true,
    customBranding: true,
    features: [
      'All Pro Studio capabilities included',
      'Priority AI queue & fast FFmpeg rendering',
      'Custom channel branding & watermark controls',
      'Advanced AI audio & voice enhancement',
      '250 GB cloud video storage',
      'Dedicated priority support',
    ],
  },
  {
    id: 'YEARLY',
    name: 'Yearly Max',
    audience: 'Best value for year-round studios',
    priceInr: 1999,
    billingCycle: 'Year',
    durationDays: 365,
    dailyProjectsLimit: 1000,
    dailyMinutesLimit: 3600,
    storageGb: 500,
    maxResolution: '4K',
    captionStylesCount: 108,
    watermarkFree: true,
    aiBroll: true,
    priorityProcessing: true,
    customBranding: true,
    features: [
      'All Ultimate & Pro features unlocked for 365 days',
      'Highest daily processing limits',
      'Priority Gemini AI & FFmpeg workers',
      '500 GB cloud video storage',
      'Full 4K exports across all social platforms',
      'Save 44% compared to monthly billing',
    ],
  },
];

// Build 108 distinct caption templates across 8 categories (24 FREE, 31 STARTER, 53 PRO)
const BASE_TEMPLATES: CaptionTemplate[] = [
  {
    id: 'anime-shonen',
    name: 'Shonen Impact',
    category: 'Anime',
    tier: 'FREE',
    fontClass: 'caption-font-anime',
    fontName: 'Bangers',
    textColor: '#FFFFFF',
    highlightColor: '#38BDF8',
    bgColor: 'rgba(15, 23, 42, 0.85)',
    strokeColor: '#0F172A',
    animation: 'pop',
    uppercase: true,
  },
  {
    id: 'anime-tokyo',
    name: 'Tokyo Electric',
    category: 'Anime',
    tier: 'FREE',
    fontClass: 'caption-font-anime',
    fontName: 'Bangers',
    textColor: '#F8FAFC',
    highlightColor: '#2563EB',
    bgColor: 'rgba(255, 255, 255, 0.94)',
    strokeColor: '#1E3A8A',
    animation: 'bounce',
    uppercase: true,
  },
  {
    id: 'karaoke-blue',
    name: 'Electric Karaoke',
    category: 'Karaoke',
    tier: 'FREE',
    fontClass: 'caption-font-viral',
    fontName: 'Anton',
    textColor: '#E2E8F0',
    highlightColor: '#0EA5E9',
    bgColor: 'rgba(15, 23, 42, 0.78)',
    strokeColor: '#020617',
    animation: 'karaoke',
    uppercase: true,
  },
  {
    id: 'viral-hormozi',
    name: 'Viral Punch',
    category: 'Bold Viral',
    tier: 'FREE',
    fontClass: 'caption-font-viral',
    fontName: 'Anton',
    textColor: '#FFFFFF',
    highlightColor: '#FACC15',
    bgColor: 'transparent',
    strokeColor: '#000000',
    animation: 'pop',
    uppercase: true,
  },
  {
    id: 'gaming-pixel',
    name: 'Arcade 8-Bit',
    category: 'Gaming',
    tier: 'FREE',
    fontClass: 'caption-font-gaming',
    fontName: 'Press Start 2P',
    textColor: '#FFFFFF',
    highlightColor: '#38BDF8',
    bgColor: 'rgba(15, 23, 42, 0.9)',
    strokeColor: '#1D4ED8',
    animation: 'typewriter',
    uppercase: true,
  },
  {
    id: 'cinematic-film',
    name: 'Silver Screen',
    category: 'Cinematic',
    tier: 'FREE',
    fontClass: 'caption-font-cinematic',
    fontName: 'Cinzel',
    textColor: '#F8FAFC',
    highlightColor: '#93C5FD',
    bgColor: 'rgba(15, 23, 42, 0.55)',
    strokeColor: '#0F172A',
    animation: 'slide',
    uppercase: false,
  },
  {
    id: 'neon-cyber',
    name: 'Cobalt Pulse',
    category: 'Neon',
    tier: 'FREE',
    fontClass: 'caption-font-neon',
    fontName: 'Orbitron',
    textColor: '#FFFFFF',
    highlightColor: '#60A5FA',
    bgColor: 'rgba(2, 6, 23, 0.8)',
    strokeColor: '#2563EB',
    animation: 'karaoke',
    uppercase: true,
  },
  {
    id: 'hindi-clean',
    name: 'Desi Creator',
    category: 'Hindi',
    tier: 'FREE',
    fontClass: 'caption-font-hindi',
    fontName: 'Noto Sans Devanagari',
    textColor: '#FFFFFF',
    highlightColor: '#38BDF8',
    bgColor: 'rgba(15, 23, 42, 0.82)',
    strokeColor: '#0F172A',
    animation: 'karaoke',
    uppercase: false,
  },
];

const CATEGORIES: CaptionTemplate['category'][] = [
  'Anime',
  'Karaoke',
  'Bold Viral',
  'Gaming',
  'Cinematic',
  'Neon',
  'Minimal',
  'Hindi',
];

const COLOR_PALETTES = [
  { name: 'Cobalt', text: '#FFFFFF', highlight: '#38BDF8', bg: 'rgba(15, 23, 42, 0.82)', stroke: '#0F172A' },
  { name: 'Solar', text: '#FFFFFF', highlight: '#FACC15', bg: 'rgba(15, 23, 42, 0.72)', stroke: '#000000' },
  { name: 'Glacier', text: '#0F172A', highlight: '#2563EB', bg: 'rgba(255, 255, 255, 0.92)', stroke: '#E2E8F0' },
  { name: 'Crimson', text: '#FFFFFF', highlight: '#FB7185', bg: 'rgba(15, 23, 42, 0.85)', stroke: '#000000' },
  { name: 'Emerald', text: '#FFFFFF', highlight: '#34D399', bg: 'rgba(2, 6, 23, 0.78)', stroke: '#064E3B' },
  { name: 'Pure', text: '#FFFFFF', highlight: '#60A5FA', bg: 'transparent', stroke: '#000000' },
];

const ANIMATIONS: CaptionTemplate['animation'][] = ['pop', 'karaoke', 'slide', 'bounce', 'typewriter'];

function buildCaptionTemplates(): CaptionTemplate[] {
  const templates: CaptionTemplate[] = [...BASE_TEMPLATES];
  const fontByCategory: Record<CaptionTemplate['category'], { fontClass: string; fontName: string; uppercase: boolean }> = {
    Anime: { fontClass: 'caption-font-anime', fontName: 'Bangers', uppercase: true },
    Karaoke: { fontClass: 'caption-font-viral', fontName: 'Anton', uppercase: true },
    'Bold Viral': { fontClass: 'caption-font-viral', fontName: 'Anton', uppercase: true },
    Gaming: { fontClass: 'caption-font-gaming', fontName: 'Press Start 2P', uppercase: true },
    Cinematic: { fontClass: 'caption-font-cinematic', fontName: 'Cinzel', uppercase: false },
    Neon: { fontClass: 'caption-font-neon', fontName: 'Orbitron', uppercase: true },
    Minimal: { fontClass: 'font-sans', fontName: 'Plus Jakarta Sans', uppercase: false },
    Hindi: { fontClass: 'caption-font-hindi', fontName: 'Noto Sans Devanagari', uppercase: false },
  };

  let idx = 1;
  while (templates.length < 108) {
    const category = CATEGORIES[idx % CATEGORIES.length];
    const palette = COLOR_PALETTES[idx % COLOR_PALETTES.length];
    const anim = ANIMATIONS[idx % ANIMATIONS.length];
    const fontInfo = fontByCategory[category];
    const totalCount = templates.length;
    const tier: CaptionTemplate['tier'] = totalCount < 24 ? 'FREE' : totalCount < 55 ? 'STARTER' : 'PRO';

    templates.push({
      id: `tpl-${category.toLowerCase().replace(/\s+/g, '-')}-${idx}`,
      name: `${category} ${palette.name} #${idx}`,
      category,
      tier,
      fontClass: fontInfo.fontClass,
      fontName: fontInfo.fontName,
      textColor: palette.text,
      highlightColor: palette.highlight,
      bgColor: palette.bg,
      strokeColor: palette.stroke,
      animation: anim,
      uppercase: fontInfo.uppercase,
    });
    idx++;
  }
  return templates;
}

export const CAPTION_TEMPLATES: CaptionTemplate[] = buildCaptionTemplates();

export const FONT_STUDIO_PRESETS = [
  { id: 'anime', label: 'Anime Studio', fontClass: 'caption-font-anime', sample: 'NEXT LEVEL CLIP!', tier: 'FREE' },
  { id: 'viral', label: 'Bold Viral', fontClass: 'caption-font-viral', sample: 'WATCH TILL END', tier: 'FREE' },
  { id: 'minimal', label: 'Clean Sans', fontClass: 'font-display', sample: 'Smart Captions', tier: 'FREE' },
  { id: 'hindi', label: 'Hindi / Hinglish', fontClass: 'caption-font-hindi', sample: 'वायरल क्लिप तैयार', tier: 'FREE' },
  { id: 'gaming', label: 'Gaming 8-Bit', fontClass: 'caption-font-gaming', sample: 'CRITICAL HIT!', tier: 'STARTER' },
  { id: 'cinematic', label: 'Cinematic Serif', fontClass: 'caption-font-cinematic', sample: 'The Untold Story', tier: 'STARTER' },
  { id: 'neon', label: 'Electric Cyber', fontClass: 'caption-font-neon', sample: 'HYPER FOCUS', tier: 'PRO' },
] as const;

export const MUSIC_LIBRARY = [
  { id: 'none', name: 'Original Audio Only', genre: 'Clean', bpm: 0 },
  { id: 'lofi-tokyo', name: 'Tokyo Rain Lo-Fi', genre: 'Chill / Anime', bpm: 84 },
  { id: 'electric-drive', name: 'Electric Blue Synth', genre: 'Tech / Upbeat', bpm: 122 },
  { id: 'podcast-warm', name: 'Studio Bed Warmth', genre: 'Documentary', bpm: 92 },
  { id: 'shonen-rush', name: 'Shonen Sprint', genre: 'High Energy', bpm: 140 },
] as const;

export const SFX_LIBRARY = [
  { id: 'whoosh', name: 'Anime Whoosh', duration: '0.6s', freqStart: 900, freqEnd: 180 },
  { id: 'ding', name: 'Insight Ding', duration: '0.4s', freqStart: 1046, freqEnd: 1318 },
  { id: 'impact', name: 'Viral Bass Hit', duration: '0.5s', freqStart: 160, freqEnd: 45 },
  { id: 'pop', name: 'Caption Pop', duration: '0.2s', freqStart: 620, freqEnd: 880 },
] as const;

export const VISUAL_FILTERS = [
  { id: 'none', name: 'Natural Crisp', cssFilter: 'none' },
  { id: 'electric', name: 'Electric Studio', cssFilter: 'contrast(1.08) saturate(1.18) brightness(1.03)' },
  { id: 'tokyo', name: 'Tokyo Daylight', cssFilter: 'contrast(1.04) saturate(1.1) hue-rotate(-6deg)' },
  { id: 'cinematic', name: 'Cinematic Warm', cssFilter: 'contrast(1.14) saturate(0.92) sepia(0.12)' },
  { id: 'manga', name: 'Manga Ink', cssFilter: 'grayscale(1) contrast(1.35) brightness(1.05)' },
] as const;

export const SOCIAL_EXPORT_PRESETS: Array<{
  platform: ExportPlatform;
  recommendedRatio: '9:16' | '1:1';
  maxDurationSec: number;
  note: string;
}> = [
  { platform: 'YouTube Shorts', recommendedRatio: '9:16', maxDurationSec: 60, note: 'Vertical HD/4K MP4 with loudnorm audio' },
  { platform: 'Instagram Reels', recommendedRatio: '9:16', maxDurationSec: 90, note: 'Safe-margin captions above bottom UI' },
  { platform: 'Facebook Reels', recommendedRatio: '9:16', maxDurationSec: 90, note: 'High-engagement hook framing' },
  { platform: 'TikTok', recommendedRatio: '9:16', maxDurationSec: 180, note: 'Word-pop karaoke & rapid pacing' },
  { platform: 'WhatsApp Status', recommendedRatio: '9:16', maxDurationSec: 30, note: 'Compact 30s crisp mobile delivery' },
];

export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: 'step-welcome',
    stepNumber: 1,
    title: 'Welcome to CLIPVERSE AI',
    subtitle: 'Free-first AI video studio walkthrough',
    targetSection: 'welcome',
    highlightSelector: '[data-tour="welcome-hero"]',
    instruction: 'Meet your anime studio co-pilot. You get 10 free AI clipping projects and 30 minutes of video processing every day with zero forced watermarks.',
    actionHint: 'Click "Next Step" or jump straight to Upload Video to start your first clip.',
    checkLabel: 'Studio workspace ready',
  },
  {
    id: 'step-upload',
    stepNumber: 2,
    title: 'Upload or Load a Video',
    subtitle: 'Drag-and-drop MP4, MOV, or WebM',
    targetSection: 'upload',
    highlightSelector: '[data-tour="upload-dropzone"]',
    instruction: 'Drop any long-form video here, or click "Load Sample Creator Video" to test real FFmpeg + Gemini AI processing instantly.',
    actionHint: 'Load the sample video or upload your own file to unlock AI Auto-Clipping.',
    checkLabel: 'Source video loaded',
  },
  {
    id: 'step-autoclip',
    stepNumber: 3,
    title: 'Run AI Auto-Clipping',
    subtitle: 'Viral highlight detection & scoring',
    targetSection: 'autoclip',
    highlightSelector: '[data-tour="autoclip-trigger"]',
    instruction: 'Gemini AI analyzes speech, pacing, humor, and reactions while FFmpeg detects silence gaps to extract multiple high-scoring short clips.',
    actionHint: 'Click "Detect Viral Clips with AI" to generate scored clips and transcripts.',
    checkLabel: 'AI clips & viral scores generated',
  },
  {
    id: 'step-captions',
    stepNumber: 4,
    title: 'Customize AI Captions & Anime Fonts',
    subtitle: '108+ templates & multilingual subtitles',
    targetSection: 'captions',
    highlightSelector: '[data-tour="caption-studio-panel"]',
    instruction: 'Switch between Anime, Karaoke, Bold Viral, Gaming, and Hindi caption templates. Adjust caption size, highlight colors, and vertical position live.',
    actionHint: 'Select any caption template or change the font style and watch the live player update.',
    checkLabel: 'Caption template customized',
  },
  {
    id: 'step-editor',
    stepNumber: 5,
    title: 'Basic Editing & Smart Reframing',
    subtitle: 'Trim handles, 9:16/16:9/1:1 & audio polish',
    targetSection: 'editor',
    highlightSelector: '[data-tour="editor-controls"]',
    instruction: 'Fine-tune your clip start/end sliders, toggle Silence Removal, Auto Zoom, or Audio Enhancement, and pick a target social format.',
    actionHint: 'Adjust the trim range or aspect ratio, then export a real MP4.',
    checkLabel: 'Clip edited & ready for export',
  },
  {
    id: 'step-export',
    stepNumber: 6,
    title: 'Export Watermark-Free MP4',
    subtitle: 'Shorts, Reels, TikTok & WhatsApp Status',
    targetSection: 'editor',
    highlightSelector: '[data-tour="export-button"]',
    instruction: 'Export in 720p or 1080p MP4 completely free with no forced watermark, or choose 4K on Pro. Your rendered files appear in Export History.',
    actionHint: 'Click "Render & Export MP4" or mark the tutorial complete!',
    checkLabel: 'Ready to publish anywhere',
  },
];

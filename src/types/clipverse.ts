export type PlanId = 'FREE' | 'STARTER' | 'PRO' | 'ULTIMATE' | 'YEARLY';

export type AspectRatio = '9:16' | '16:9' | '1:1';

export type ExportResolution = '720p' | '1080p' | '4K';

export type ExportPlatform =
  | 'YouTube Shorts'
  | 'Instagram Reels'
  | 'Facebook Reels'
  | 'TikTok'
  | 'WhatsApp Status';

export type CaptionPosition = 'bottom' | 'center' | 'top';

export type CaptionAnimation = 'pop' | 'karaoke' | 'slide' | 'bounce' | 'typewriter';

export interface CaptionSegment {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  highlightWords: string[];
  emoji?: string;
}

export interface CaptionTemplate {
  id: string;
  name: string;
  category: 'Anime' | 'Karaoke' | 'Bold Viral' | 'Gaming' | 'Cinematic' | 'Neon' | 'Minimal' | 'Hindi';
  tier: 'FREE' | 'STARTER' | 'PRO';
  fontClass: string;
  fontName: string;
  textColor: string;
  highlightColor: string;
  bgColor: string;
  strokeColor: string;
  animation: CaptionAnimation;
  uppercase?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  plan: PlanId;
  planExpiresAt: string | null;
  credits: number;
  dailyProjectsUsed: number;
  dailyMinutesUsed: number;
  storageUsedMb: number;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  tutorialCompleted: boolean;
  tutorialStep: number;
  preferredLanguage: string;
  watermarkText: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VideoProject {
  id: string;
  userId: string;
  title: string;
  sourceType: 'upload' | 'sample';
  videoUrl: string;
  fileName?: string;
  durationSec: number;
  fileSizeMb: number;
  aspectRatio: AspectRatio;
  language: string;
  status: 'uploaded' | 'processing' | 'ready' | 'failed';
  transcript: string;
  viralSummary: string;
  hashtags: string[];
  brollSuggestions: string[];
  silenceRanges?: Array<{ start: number; end: number }>;
  createdAt: string;
  updatedAt: string;
}

export interface VideoClip {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  description: string;
  startSec: number;
  endSec: number;
  viralScore: number;
  reason: string;
  category: string;
  aspectRatio: AspectRatio;
  captionTemplate: string;
  fontStyle: string;
  captionColor: string;
  captionBg: string;
  captionPosition: CaptionPosition;
  captionSize: number;
  silenceRemoved: boolean;
  autoZoom: boolean;
  audioEnhanced: boolean;
  noiseReduced: boolean;
  bgRemoved: boolean;
  musicTrack: string;
  filterName: string;
  watermarkEnabled: boolean;
  hashtags: string[];
  captions: CaptionSegment[];
  thumbnailUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExportRecord {
  id: string;
  userId: string;
  projectId: string;
  clipId: string;
  title: string;
  platform: ExportPlatform;
  resolution: ExportResolution;
  aspectRatio: AspectRatio;
  fileUrl: string;
  fileSizeMb: number;
  status: 'rendering' | 'completed' | 'failed';
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  userEmail?: string;
  plan: Exclude<PlanId, 'FREE'>;
  amountInr: number;
  upiApp: 'Google Pay' | 'PhonePe' | 'Paytm' | 'Other UPI';
  referenceId: string;
  utrNumber?: string;
  promoCode?: string;
  upiUri?: string;
  qrDataUrl?: string;
  status: 'pending' | 'awaiting_verification' | 'verified' | 'rejected';
  createdAt: string;
  verifiedAt?: string | null;
}

export interface MembershipPlan {
  id: PlanId;
  name: string;
  audience: string;
  priceInr: number;
  billingCycle: string;
  durationDays: number;
  dailyProjectsLimit: number;
  dailyMinutesLimit: number;
  storageGb: number;
  maxResolution: ExportResolution;
  captionStylesCount: number;
  watermarkFree: boolean;
  aiBroll: boolean;
  priorityProcessing: boolean;
  customBranding: boolean;
  features: string[];
}

export interface PromoCode {
  id: string;
  code: string;
  discountPercent: number;
  active: boolean;
  usesCount: number;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  adminReply?: string;
  createdAt: string;
  updatedAt: string;
}

export type DashboardSection =
  | 'welcome'
  | 'upload'
  | 'autoclip'
  | 'captions'
  | 'editor'
  | 'projects'
  | 'exports'
  | 'credits'
  | 'membership'
  | 'settings'
  | 'admin';

export interface TutorialStepDef {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  targetSection: DashboardSection;
  highlightSelector: string;
  instruction: string;
  actionHint: string;
  checkLabel: string;
}

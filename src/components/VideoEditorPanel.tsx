import React, { useState } from 'react';
import {
  Scissors,
  Sliders,
  Music,
  Download,
  Sparkles,
  Volume2,
  Wand2,
  Hash,
  Image as ImageIcon,
  Lock,
} from 'lucide-react';
import type {
  AspectRatio,
  ExportPlatform,
  ExportResolution,
  PlanId,
  VideoClip,
} from '../types/clipverse';
import {
  MUSIC_LIBRARY,
  SFX_LIBRARY,
  SOCIAL_EXPORT_PRESETS,
  VISUAL_FILTERS,
} from '../data/studioCatalog';

interface VideoEditorPanelProps {
  clip: VideoClip;
  projectDurationSec: number;
  transcript: string;
  brollSuggestions: string[];
  userPlan: PlanId;
  customWatermarkText: string;
  onUpdateClip: (patch: Partial<VideoClip>) => void;
  onUpdateWatermarkText: (text: string) => void;
  onExportClip: (platform: ExportPlatform, resolution: ExportResolution) => Promise<void>;
  onGenerateAiMetadata: (platform: ExportPlatform) => Promise<{
    titles: string[];
    description: string;
    hashtags: string[];
    thumbnailHook: string;
  } | null>;
  exporting: boolean;
  onRequestUpgrade: () => void;
}

function playSynthSfx(freqStart: number, freqEnd: number) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.36);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.38);
  } catch {
    // ignore Web Audio block
  }
}

export const VideoEditorPanel: React.FC<VideoEditorPanelProps> = ({
  clip,
  projectDurationSec,
  brollSuggestions,
  userPlan,
  customWatermarkText,
  onUpdateClip,
  onUpdateWatermarkText,
  onExportClip,
  onGenerateAiMetadata,
  exporting,
  onRequestUpgrade,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<ExportPlatform>('YouTube Shorts');
  const [selectedResolution, setSelectedResolution] = useState<ExportResolution>('1080p');
  const [aiMetaLoading, setAiMetaLoading] = useState(false);
  const [aiMeta, setAiMeta] = useState<{
    titles: string[];
    description: string;
    hashtags: string[];
    thumbnailHook: string;
  } | null>(null);

  const isPro = ['PRO', 'ULTIMATE', 'YEARLY'].includes(userPlan);

  const handleGenerateMeta = async () => {
    setAiMetaLoading(true);
    try {
      const res = await onGenerateAiMetadata(selectedPlatform);
      if (res) setAiMeta(res);
    } finally {
      setAiMetaLoading(false);
    }
  };

  return (
    <div data-tour="editor-controls" className="space-y-6">
      {/* Trim & Aspect Ratio */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Scissors className="w-4 h-4 text-blue-600" />
            <span>Smart Clip Trimmer &amp; Reframing</span>
          </h3>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {(['9:16', '16:9', '1:1'] as AspectRatio[]).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => onUpdateClip({ aspectRatio: ratio })}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg tabular-nums cursor-pointer transition-colors ${
                  clip.aspectRatio === ratio
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Start Time</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {clip.startSec.toFixed(1)}s
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(1, clip.endSec - 2)}
              step={0.5}
              value={clip.startSec}
              onChange={(e) => onUpdateClip({ startSec: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>End Time</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {clip.endSec.toFixed(1)}s
              </span>
            </div>
            <input
              type="range"
              min={Math.min(projectDurationSec, clip.startSec + 2)}
              max={Math.max(4, projectDurationSec)}
              step={0.5}
              value={clip.endSec}
              onChange={(e) => onUpdateClip({ endSec: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* AI Enhancement Toggles & Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-600" />
          <span>AI Audio, Face Tracking &amp; Visual Enhancements</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {[
            { key: 'silenceRemoved', label: 'Auto Silence Removal', desc: 'Cuts dead-air gaps via FFmpeg' },
            { key: 'autoZoom', label: 'Auto Zoom & Face Track', desc: 'Dynamic punch-in framing' },
            { key: 'audioEnhanced', label: 'Voice & Loudness Boost', desc: 'EBU R128 broadcast norm' },
            { key: 'noiseReduced', label: 'AI Noise Reduction', desc: 'FFT room-hum cleanup' },
            { key: 'bgRemoved', label: 'AI Subject Spotlight', desc: 'Crisp foreground separation' },
            { key: 'watermarkEnabled', label: 'Custom Brand Watermark', desc: 'Optional (Free has no forced mark)' },
          ].map((item) => {
            const active = Boolean(clip[item.key as keyof VideoClip]);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onUpdateClip({ [item.key]: !active })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  active
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">{item.label}</span>
                  <span
                    className={`w-8 h-4.5 rounded-full p-0.5 transition-colors flex items-center ${
                      active ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{item.desc}</p>
              </button>
            );
          })}
        </div>

        {clip.watermarkEnabled && (
          <div className="pt-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Custom Channel Branding Text
            </label>
            <input
              type="text"
              value={customWatermarkText}
              onChange={(e) => onUpdateWatermarkText(e.target.value)}
              placeholder="@YourChannel"
              maxLength={40}
              className="w-full sm:w-72 px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-blue-600"
            />
          </div>
        )}

        {/* Visual Filters + Music + SFX */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Visual Color Filter</label>
            <div className="flex flex-wrap gap-1.5">
              {VISUAL_FILTERS.map((flt) => (
                <button
                  key={flt.id}
                  type="button"
                  onClick={() => onUpdateClip({ filterName: flt.id })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    clip.filterName === flt.id
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {flt.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-blue-600" />
              <span>Background Music &amp; Sound Effects</span>
            </label>
            <select
              value={clip.musicTrack}
              onChange={(e) => onUpdateClip({ musicTrack: e.target.value })}
              className="w-full min-h-[38px] rounded-xl border border-slate-200 px-3 text-xs text-slate-800 outline-none focus:border-blue-600 mb-2"
            >
              {MUSIC_LIBRARY.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.bpm > 0 ? `(${m.genre} · ${m.bpm} BPM)` : ''}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1.5">
              {SFX_LIBRARY.map((sfx) => (
                <button
                  key={sfx.id}
                  type="button"
                  onClick={() => playSynthSfx(sfx.freqStart, sfx.freqEnd)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>{sfx.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI Packaging: Titles, Descriptions, Hashtags, B-roll & Thumbnail Hook */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-blue-600" />
              <span>AI Titles, Hashtags, B-Roll &amp; Thumbnail Studio</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate platform-tailored hooks, descriptions, and B-roll cues via Gemini AI.
            </p>
          </div>
          <button
            type="button"
            disabled={aiMetaLoading}
            onClick={handleGenerateMeta}
            className="min-h-[38px] px-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{aiMetaLoading ? 'Generating...' : 'Generate AI Packaging'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* AI Thumbnail Card */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-950 relative aspect-video lg:aspect-auto min-h-[150px]">
            <img
              src={clip.thumbnailUrl || '/src/assets/images/anime_clip_preview_thumb_1794746975714.jpg'}
              alt={clip.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-85"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent p-3 flex flex-col justify-end">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-300 flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> AI Thumbnail Preview
              </span>
              <div className="caption-font-anime text-xl text-white tracking-wide leading-tight mt-0.5">
                {aiMeta?.thumbnailHook || clip.title.slice(0, 28).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Titles + Description + Hashtags */}
          <div className="lg:col-span-2 space-y-2.5">
            {aiMeta ? (
              <>
                <div className="text-xs font-semibold text-slate-700">Suggested Viral Titles:</div>
                <div className="space-y-1">
                  {aiMeta.titles.map((t, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onUpdateClip({ title: t })}
                      className="w-full text-left px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-500 text-xs text-slate-800 cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-600">{aiMeta.description}</p>
                <div className="text-xs text-blue-700 font-medium flex items-center gap-1 flex-wrap">
                  <Hash className="w-3.5 h-3.5" />
                  <span>{aiMeta.hashtags.join(' ')}</span>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Clip Title &amp; AI B-Roll Ideas</div>
                <input
                  type="text"
                  value={clip.title}
                  onChange={(e) => onUpdateClip({ title: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-blue-600"
                />
                {brollSuggestions.length > 0 && (
                  <div className="text-xs text-slate-600 space-y-1 pt-1">
                    <span className="font-semibold text-slate-700">AI B-Roll Suggestions:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                      {brollSuggestions.slice(0, 3).map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Social Media Export Bar */}
      <div
        data-tour="export-button"
        className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/50 p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Export Optimized MP4</h3>
            <p className="text-xs text-slate-500">
              720p &amp; 1080p MP4 exports are 100% free with zero forced watermark.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-600 tabular-nums">
            Duration: {Math.max(1, clip.endSec - clip.startSec).toFixed(1)}s · {clip.aspectRatio}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {SOCIAL_EXPORT_PRESETS.map((preset) => (
            <button
              key={preset.platform}
              type="button"
              onClick={() => {
                setSelectedPlatform(preset.platform);
                onUpdateClip({ aspectRatio: preset.recommendedRatio });
              }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedPlatform === preset.platform
                  ? 'border-blue-600 bg-white ring-2 ring-blue-600/15'
                  : 'border-slate-200 bg-white/80 hover:border-slate-300'
              }`}
            >
              <div className="text-xs font-semibold text-slate-900 truncate">{preset.platform}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                {preset.recommendedRatio} · ≤{preset.maxDurationSec}s
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl w-fit">
            {(['720p', '1080p', '4K'] as ExportResolution[]).map((res) => {
              const locked = res === '4K' && !isPro;
              return (
                <button
                  key={res}
                  type="button"
                  onClick={() => {
                    if (locked) {
                      onRequestUpgrade();
                      return;
                    }
                    setSelectedResolution(res);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors ${
                    selectedResolution === res
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{res}</span>
                  {locked && <Lock className="w-3 h-3" />}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={exporting}
            onClick={() => onExportClip(selectedPlatform, selectedResolution)}
            className="min-h-[44px] px-6 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>{exporting ? 'Rendering MP4 via FFmpeg...' : `Render & Export ${selectedResolution} MP4`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

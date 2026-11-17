import React, { useMemo, useState } from 'react';
import { Languages, Search, Lock, Type as TypeIcon, Sparkles, Check } from 'lucide-react';
import type { CaptionPosition, CaptionSegment, CaptionTemplate, PlanId, VideoClip } from '../types/clipverse';
import { CAPTION_TEMPLATES, FONT_STUDIO_PRESETS } from '../data/studioCatalog';

interface CaptionStudioProps {
  clip: VideoClip;
  userPlan: PlanId;
  onUpdateClip: (patch: Partial<VideoClip>) => void;
  onTranslateCaptions: (targetLanguage: string, includeEmojis: boolean) => Promise<void>;
  translating: boolean;
  onRequestUpgrade: () => void;
}

const CATEGORIES: Array<'All' | CaptionTemplate['category']> = [
  'All',
  'Anime',
  'Karaoke',
  'Bold Viral',
  'Gaming',
  'Cinematic',
  'Neon',
  'Minimal',
  'Hindi',
];

export const CaptionStudio: React.FC<CaptionStudioProps> = ({
  clip,
  userPlan,
  onUpdateClip,
  onTranslateCaptions,
  translating,
  onRequestUpgrade,
}) => {
  const [category, setCategory] = useState<'All' | CaptionTemplate['category']>('All');
  const [search, setSearch] = useState('');
  const [targetLang, setTargetLang] = useState('Hindi');
  const [includeEmojis, setIncludeEmojis] = useState(true);

  const canUseTier = (tier: CaptionTemplate['tier']) => {
    if (tier === 'FREE') return true;
    if (tier === 'STARTER') return ['STARTER', 'PRO', 'ULTIMATE', 'YEARLY'].includes(userPlan);
    return ['PRO', 'ULTIMATE', 'YEARLY'].includes(userPlan);
  };

  const filteredTemplates = useMemo(() => {
    return CAPTION_TEMPLATES.filter((t) => {
      if (category !== 'All' && t.category !== category) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.fontName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [category, search]);

  const handleSegmentEdit = (idx: number, patch: Partial<CaptionSegment>) => {
    const next = clip.captions.map((seg, i) => (i === idx ? { ...seg, ...patch } : seg));
    onUpdateClip({ captions: next });
  };

  return (
    <div data-tour="caption-studio-panel" className="space-y-6">
      {/* Multilingual AI Translation Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Languages className="w-4 h-4 text-blue-600" />
            <span>AI Multilingual Captions & Punctuation</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatically adapt subtitles to Hindi, Hinglish, English, Spanish, or Japanese with keyword highlights.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-600"
          >
            <option value="English">English</option>
            <option value="Hindi">Hindi (हिन्दी)</option>
            <option value="Hinglish">Hinglish</option>
            <option value="Spanish">Spanish</option>
            <option value="Japanese">Japanese (日本語)</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 px-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeEmojis}
              onChange={(e) => setIncludeEmojis(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>Emoji Captions</span>
          </label>
          <button
            type="button"
            disabled={translating}
            onClick={() => onTranslateCaptions(targetLang, includeEmojis)}
            className="min-h-[40px] px-4 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white text-xs font-semibold hover:from-blue-700 hover:to-sky-600 disabled:opacity-60 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{translating ? 'Translating...' : 'Apply AI Language'}</span>
          </button>
        </div>
      </div>

      {/* Font & Design Studio Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <TypeIcon className="w-4 h-4 text-blue-600" />
            <span>Font & Design Studio</span>
          </h3>
          <span className="text-xs text-slate-500">
            Position · Size · Color · Outline
          </span>
        </div>

        {/* Font Presets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {FONT_STUDIO_PRESETS.map((preset) => {
            const unlocked = canUseTier(preset.tier);
            const active = clip.fontStyle === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  if (!unlocked) {
                    onRequestUpgrade();
                    return;
                  }
                  onUpdateClip({ fontStyle: preset.id });
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  active
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/15'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[11px] font-medium text-slate-500">
                  <span className="truncate">{preset.label}</span>
                  {!unlocked && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
                </div>
                <div className={`text-sm font-bold text-slate-900 mt-1 truncate ${preset.fontClass}`}>
                  {preset.sample}
                </div>
              </button>
            );
          })}
        </div>

        {/* Position, Size, Text/Bg Colors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Caption Position</label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
              {(['top', 'center', 'bottom'] as CaptionPosition[]).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => onUpdateClip({ captionPosition: pos })}
                  className={`py-1.5 text-xs font-medium rounded-lg capitalize transition-colors cursor-pointer ${
                    clip.captionPosition === pos
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 tabular-nums">
              Font Size ({clip.captionSize}px)
            </label>
            <input
              type="range"
              min={14}
              max={34}
              value={clip.captionSize}
              onChange={(e) => onUpdateClip({ captionSize: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer mt-2"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Text Color</label>
            <div className="flex items-center gap-2">
              {['#FFFFFF', '#FACC15', '#38BDF8', '#0F172A', '#FB7185'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onUpdateClip({ captionColor: c })}
                  className={`w-7 h-7 rounded-full border cursor-pointer ${
                    clip.captionColor === c ? 'ring-2 ring-blue-600 ring-offset-1' : 'border-slate-300'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Set caption color ${c}`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Caption Backdrop</label>
            <div className="flex items-center gap-1.5">
              {[
                { label: 'Dark', val: 'rgba(15, 23, 42, 0.85)' },
                { label: 'Blue', val: 'rgba(37, 99, 235, 0.88)' },
                { label: 'White', val: 'rgba(255, 255, 255, 0.92)' },
                { label: 'None', val: 'transparent' },
              ].map((bg) => (
                <button
                  key={bg.label}
                  type="button"
                  onClick={() => onUpdateClip({ captionBg: bg.val })}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    clip.captionBg === bg.val
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {bg.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 108 Caption Templates Catalog */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">108 Caption Templates</h3>
            <p className="text-xs text-slate-500 tabular-nums">
              24 Free · 55 Starter · 108 Pro &amp; Anime Styles
            </p>
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                category === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Template Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1">
          {filteredTemplates.map((tpl) => {
            const unlocked = canUseTier(tpl.tier);
            const active = clip.captionTemplate === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  if (!unlocked) {
                    onRequestUpgrade();
                    return;
                  }
                  onUpdateClip({
                    captionTemplate: tpl.id,
                    captionColor: tpl.textColor,
                    captionBg: tpl.bgColor,
                  });
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  active
                    ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/15'
                    : 'border-slate-200 hover:border-blue-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500">
                  <span className="truncate">{tpl.category} · {tpl.tier}</span>
                  {active ? (
                    <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  ) : !unlocked ? (
                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : null}
                </div>
                <div
                  className={`mt-2 px-2 py-1 rounded text-xs font-bold truncate text-center ${tpl.fontClass}`}
                  style={{
                    backgroundColor: tpl.bgColor === 'transparent' ? '#0f172a' : tpl.bgColor,
                    color: tpl.textColor,
                  }}
                >
                  {tpl.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline Subtitle Line Editor */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Timed Subtitle Script</h3>
          <span className="text-xs text-slate-500 tabular-nums">{clip.captions.length} segments</span>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {clip.captions.map((seg, idx) => (
            <div
              key={seg.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5"
            >
              <span className="text-[11px] font-mono text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                {seg.startSec.toFixed(1)}s – {seg.endSec.toFixed(1)}s
              </span>
              <input
                type="text"
                value={seg.text}
                onChange={(e) => handleSegmentEdit(idx, { text: e.target.value })}
                className="flex-1 text-xs bg-white rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-900 outline-none focus:border-blue-600"
              />
              <input
                type="text"
                value={seg.emoji || ''}
                onChange={(e) => handleSegmentEdit(idx, { emoji: e.target.value })}
                placeholder="Emoji"
                className="w-16 text-xs text-center bg-white rounded-lg border border-slate-200 px-2 py-1.5 outline-none focus:border-blue-600"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

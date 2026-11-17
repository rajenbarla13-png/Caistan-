import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import type { CaptionTemplate, VideoClip } from '../types/clipverse';
import { CAPTION_TEMPLATES, VISUAL_FILTERS } from '../data/studioCatalog';

interface VideoPreviewPlayerProps {
  videoUrl: string;
  clip: VideoClip;
  customWatermarkText?: string;
  compact?: boolean;
}

export const VideoPreviewPlayer: React.FC<VideoPreviewPlayerProps> = ({
  videoUrl,
  clip,
  customWatermarkText = '',
  compact = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(clip.startSec || 0);

  const template: CaptionTemplate =
    CAPTION_TEMPLATES.find((t) => t.id === clip.captionTemplate) || CAPTION_TEMPLATES[0];
  const filterDef = VISUAL_FILTERS.find((f) => f.id === clip.filterName) || VISUAL_FILTERS[0];

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.currentTime < clip.startSec || vid.currentTime > clip.endSec) {
      vid.currentTime = clip.startSec;
      setCurrentTime(clip.startSec);
    }
  }, [clip.id, clip.startSec, clip.endSec]);

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const t = vid.currentTime;
    setCurrentTime(t);
    if (t >= clip.endSec) {
      vid.currentTime = clip.startSec;
      if (!playing) vid.pause();
    }
  };

  const togglePlay = async () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      if (vid.currentTime < clip.startSec || vid.currentTime >= clip.endSec) {
        vid.currentTime = clip.startSec;
      }
      await vid.play();
      setPlaying(true);
    } else {
      vid.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setMuted(vid.muted);
  };

  const activeCaption = clip.captions?.find(
    (c) => currentTime >= c.startSec && currentTime <= c.endSec
  ) || clip.captions?.[0];

  const aspectClass =
    clip.aspectRatio === '9:16'
      ? 'aspect-[9/16] max-w-[270px] sm:max-w-[300px]'
      : clip.aspectRatio === '1:1'
      ? 'aspect-square max-w-[340px]'
      : 'aspect-video max-w-full';

  const positionClass =
    clip.captionPosition === 'top'
      ? 'top-5'
      : clip.captionPosition === 'center'
      ? 'top-1/2 -translate-y-1/2'
      : 'bottom-12';

  const fontClass =
    clip.fontStyle === 'anime'
      ? 'caption-font-anime'
      : clip.fontStyle === 'viral'
      ? 'caption-font-viral'
      : clip.fontStyle === 'gaming'
      ? 'caption-font-gaming'
      : clip.fontStyle === 'cinematic'
      ? 'caption-font-cinematic'
      : clip.fontStyle === 'neon'
      ? 'caption-font-neon'
      : clip.fontStyle === 'hindi'
      ? 'caption-font-hindi'
      : template.fontClass;

  const clipDuration = Math.max(1, clip.endSec - clip.startSec);
  const progressPct = Math.max(0, Math.min(100, ((currentTime - clip.startSec) / clipDuration) * 100));

  const renderWords = () => {
    if (!activeCaption) return null;
    const words = activeCaption.text.split(/\s+/).filter(Boolean);
    const segDuration = Math.max(0.5, activeCaption.endSec - activeCaption.startSec);
    const elapsedInSeg = Math.max(0, currentTime - activeCaption.startSec);
    const activeWordIndex = Math.floor((elapsedInSeg / segDuration) * words.length);

    return (
      <div
        className={`inline-block px-3 py-1.5 rounded-xl text-center leading-tight transition-transform duration-150 ${fontClass}`}
        style={{
          backgroundColor: clip.captionBg || template.bgColor,
          color: clip.captionColor || template.textColor,
          fontSize: `${Math.max(13, Math.min(34, clip.captionSize || 20))}px`,
          textShadow: `0 2px 6px ${template.strokeColor}, -1px -1px 0 ${template.strokeColor}, 1px -1px 0 ${template.strokeColor}, -1px 1px 0 ${template.strokeColor}, 1px 1px 0 ${template.strokeColor}`,
        }}
      >
        {words.map((w, i) => {
          const clean = w.replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '').toLowerCase();
          const isKeyword = activeCaption.highlightWords?.some(
            (hw) => hw.toLowerCase() === clean || clean.includes(hw.toLowerCase())
          );
          const isKaraokeActive = template.animation === 'karaoke' && i <= activeWordIndex;
          const highlighted = isKeyword || isKaraokeActive;

          return (
            <span
              key={`${activeCaption.id}-${i}`}
              className="inline-block mx-0.5 transition-colors duration-100"
              style={{
                color: highlighted ? template.highlightColor : undefined,
                transform:
                  template.animation === 'pop' && i === activeWordIndex ? 'scale(1.08)' : undefined,
              }}
            >
              {template.uppercase ? w.toUpperCase() : w}
            </span>
          );
        })}
        {activeCaption.emoji ? <span className="ml-1.5">{activeCaption.emoji}</span> : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div
        className={`relative w-full mx-auto rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 shadow-lg ${aspectClass} ${
          compact ? 'max-h-[420px]' : ''
        }`}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setPlaying(false)}
          onClick={togglePlay}
          className={`w-full h-full object-cover cursor-pointer transition-transform duration-500 ${
            clip.autoZoom && playing ? 'scale-[1.05]' : 'scale-100'
          }`}
          style={{
            filter: `${filterDef.cssFilter}${clip.bgRemoved ? ' drop-shadow(0 0 12px rgba(37,99,235,0.45))' : ''}`,
          }}
        />

        {/* Custom user watermark (only rendered when user enables custom branding) */}
        {clip.watermarkEnabled && customWatermarkText ? (
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-slate-950/60 text-white/90 text-[11px] font-semibold tracking-wide pointer-events-none">
            {customWatermarkText}
          </div>
        ) : null}

        {/* Aspect ratio frame indicator */}
        <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-slate-950/60 text-white text-[11px] font-mono tabular-nums pointer-events-none">
          {clip.aspectRatio}
        </div>

        {/* Animated AI Caption Overlay */}
        <div className={`absolute inset-x-3 flex justify-center pointer-events-none z-10 ${positionClass}`}>
          {renderWords()}
        </div>

        {/* Bottom Scrubber & Controls */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent p-3 pt-6 space-y-2">
          <div
            className="w-full h-1.5 rounded-full bg-white/25 cursor-pointer overflow-hidden"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const nextTime = clip.startSec + ratio * clipDuration;
              if (videoRef.current) {
                videoRef.current.currentTime = nextTime;
                setCurrentTime(nextTime);
              }
            }}
          >
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-sky-400"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-white text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={togglePlay}
                className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer"
                aria-label={playing ? 'Pause clip' : 'Play clip'}
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = clip.startSec;
                    setCurrentTime(clip.startSec);
                  }
                }}
                className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Restart clip"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] tabular-nums ml-1">
                {currentTime.toFixed(1)}s / {clip.endSec.toFixed(1)}s
              </span>
            </div>

            <button
              type="button"
              onClick={toggleMute}
              className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer"
              aria-label={muted ? 'Unmute video' : 'Mute video'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

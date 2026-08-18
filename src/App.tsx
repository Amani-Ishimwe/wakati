import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTimer } from './useTimer';
import { useAudio } from './useAudio';
import { KnobDial } from './KnobDial';

// Standard presets in seconds
const PRESETS = [
  { label: '5m', value: 5 * 60 },
  { label: '10m', value: 10 * 60 },
  { label: '15m', value: 15 * 60 },
  { label: '20m', value: 20 * 60 },
  { label: '30m', value: 30 * 60 },
  { label: '45m', value: 45 * 60 },
  { label: '60m', value: 60 * 60 },
];

export default function App() {
  // --- STATE & PERSISTENCE ---
  const [initialDuration] = useState<number>(() => {
    const saved = localStorage.getItem('timer_last_duration');
    return saved ? parseInt(saved, 10) : 15 * 60; // 15 mins default
  });

  const [overtimeEnabled, setOvertimeEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('timer_overtime_enabled');
    return saved !== 'false'; // true default
  });

  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('timer_audio_enabled');
    return saved !== 'false'; // true default
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [customSeconds, setCustomSeconds] = useState('');
  
  // Parallax glass shifting state
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const casingRef = useRef<HTMLDivElement>(null);

  // Audio Hook
  const { playTick, playClick, playWarning, playAlarm, stopAlarm } = useAudio(audioEnabled);

  // Timer callbacks
  const handleWarning = useCallback((_type: 'warning' | 'urgent') => {
    playWarning();
  }, [playWarning]);


  const handleExpire = useCallback(() => {
    playAlarm();
  }, [playAlarm]);

  const handleTick = useCallback(() => {
    // Play subtle mechanical gear click on every second decrement
    playTick();
  }, [playTick]);

  // Timer Hook
  const {
    timeLeft,
    duration,
    status,
    start,
    pause,
    reset,
    setDuration,
  } = useTimer({
    initialDuration,
    overtimeEnabled,
    onWarning: handleWarning,
    onExpire: handleExpire,
    onTick: handleTick,
  });

  // --- SAVE PREFERENCES ON CHANGE ---
  useEffect(() => {
    localStorage.setItem('timer_last_duration', duration.toString());
  }, [duration]);

  // Synchronize customMinutes and customSeconds inputs with current duration selection
  useEffect(() => {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    setCustomMinutes(mins.toString().padStart(2, '0'));
    setCustomSeconds(secs.toString().padStart(2, '0'));
  }, [duration]);

  useEffect(() => {
    localStorage.setItem('timer_overtime_enabled', overtimeEnabled.toString());
  }, [overtimeEnabled]);

  useEffect(() => {
    localStorage.setItem('timer_audio_enabled', audioEnabled.toString());
    if (!audioEnabled) {
      stopAlarm();
    }
  }, [audioEnabled, stopAlarm]);

  // Stop alarm if status goes away from overtime
  useEffect(() => {
    if (status !== 'overtime') {
      stopAlarm();
    }
  }, [status, stopAlarm]);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key shortcuts if focused on text input
      if (document.activeElement?.tagName === 'INPUT') return;

      const key = e.key.toLowerCase();
      if (e.code === 'Space' || key === ' ') {
        e.preventDefault();
        playClick();
        if (status === 'running' || status === 'warning' || status === 'urgent' || status === 'overtime') {
          pause();
        } else {
          start();
        }
      } else if (key === 'r') {
        e.preventDefault();
        playClick();
        reset();
      } else if (key === 'f') {
        e.preventDefault();
        playClick();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, start, pause, reset, playClick]);

  // --- FULLSCREEN LOGIC ---
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // --- PARALLAX REFLECTION MOUSE LISTENER ---
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!casingRef.current || isFullscreen) return;
    const rect = casingRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    
    // Normalize mouse position relative to center of the casing (-1 to 1)
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);

    setParallax({ x: dx, y: dy });
  };

  const handleMouseLeave = () => {
    setParallax({ x: 0, y: 0 });
  };

  // --- HELPERS ---
  const formatTime = (secs: number) => {
    const isNegative = secs < 0;
    const absoluteSecs = Math.abs(secs);
    const mins = Math.floor(absoluteSecs / 60);
    const remainingSecs = absoluteSecs % 60;

    const sign = isNegative ? '+' : '';
    const formattedMins = mins.toString().padStart(2, '0');
    const formattedSecs = remainingSecs.toString().padStart(2, '0');

    return `${sign}${formattedMins}:${formattedSecs}`;
  };

  const handlePresetClick = (seconds: number) => {
    playClick();
    setDuration(seconds);
  };

  const handleCustomMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2); // Max 2 digits
    setCustomMinutes(val);
    const mins = val ? parseInt(val, 10) : 0;
    const secs = customSeconds ? parseInt(customSeconds, 10) : 0;
    setDuration(mins * 60 + secs);
  };

  const handleCustomSecondsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2); // Max 2 digits
    setCustomSeconds(val);
    const mins = customMinutes ? parseInt(customMinutes, 10) : 0;
    const secs = val ? parseInt(val, 10) : 0;
    const clampedSecs = Math.min(59, secs); // clamp to max 59 seconds
    setDuration(mins * 60 + clampedSecs);
  };

  const handleCustomInputBlur = () => {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    setCustomMinutes(mins.toString().padStart(2, '0'));
    setCustomSeconds(secs.toString().padStart(2, '0'));
  };

  return (
    <div 
      className={`app-container flex flex-col items-center justify-center w-full min-h-screen ${isFullscreen ? 'fullscreen-stage-mode' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Outer casing */}
      <div 
        ref={casingRef}
        className={`deck-timer-casing ${status}`}
        style={{
          // Custom properties for parallax shifting in CSS
          transform: isFullscreen 
            ? 'scale(1.8)' 
            : `perspective(1000px) rotateX(${parallax.y * -4}deg) rotateY(${parallax.x * 4}deg)`,
        }}
      >
        {/* Metal highlights and shadows shift under the glass face */}
        <div 
          className="glass-specular-rim glass-shift"
          style={{
            transform: `translate(${parallax.x * 1.5}px, ${parallax.y * 1.5}px)`,
          }}
        />

        {/* Vintage screws in four corners */}
        <div className="casing-screw top-left"></div>
        <div className="casing-screw top-right"></div>
        <div className="casing-screw bottom-left"></div>
        <div className="casing-screw bottom-right"></div>

        {/* Alarm Bell and striking mechanism */}
        <div className={`alarm-bell-assembly ${status === 'overtime' ? 'ringing' : ''}`}>
          <div className="bell-gong"></div>
          <div className="bell-stem"></div>
          <div className="bell-striker-pivot"></div>
          <div className="bell-striker-arm">
            <div className="bell-striker-hammer"></div>
          </div>
        </div>

        {/* Plunger controls at the top */}
        <div className="timer-plungers-container">
          {/* Start / Pause crown button */}
          <button 
            type="button"
            className={`metal-plunger-trigger plunger-trigger-start ${
              status === 'running' || status === 'warning' || status === 'urgent' ? 'running-active' : ''
            }`}
            onClick={() => {
              playClick();
              if (status === 'running' || status === 'warning' || status === 'urgent' || status === 'overtime') {
                pause();
              } else {
                start();
              }
            }}
            title={status === 'running' ? 'Pause' : 'Start'}
            aria-label={status === 'running' ? 'Pause countdown' : 'Start countdown'}
          >
            <div className="plunger-collar"></div>
            <div className="plunger-shaft"></div>
            <div className="plunger-cap"></div>
          </button>

          {/* Reset Plunger button */}
          <button 
            type="button"
            className="metal-plunger-trigger plunger-trigger-reset"
            onClick={() => {
              playClick();
              reset();
            }}
            title="Reset"
            aria-label="Reset countdown timer"
          >
            <div className="plunger-collar"></div>
            <div className="plunger-shaft"></div>
            <div className="plunger-cap"></div>
          </button>
        </div>

        {/* VFD Screen display inside debossed bezel */}
        <div className="vfd-screen-bezel">
          <div className="vfd-screen-glass">
            {/* The parallax glare overlay */}
            <div 
              className="absolute inset-0 pointer-events-none z-[4]"
              style={{
                background: `linear-gradient(${135 + parallax.x * 10}deg, 
                  rgba(255, 255, 255, 0.16) 0%, 
                  rgba(255, 255, 255, 0.03) 45%, 
                  transparent 45.1%, 
                  rgba(255, 255, 255, 0.04) 100%)`,
              }}
            />
            
            {/* Outline 88:88 background segments */}
            <div className="vfd-bg-shadow" aria-hidden="true">
              {timeLeft < 0 ? '+88:88' : '88:88'}
            </div>

            {/* Active glowing text digits */}
            <div className="vfd-text-container">
              {status === 'overtime' && <span className="overtime-indicator">+</span>}
              <span>
                {formatTime(timeLeft).replace('+', '') /* Plus sign handled separately */}
              </span>
            </div>
          </div>
        </div>

        {/* Preset selections */}
        <div className="presets-grid" role="group" aria-label="Time presets">
          {PRESETS.map((p) => {
            const isActive = duration === p.value && status === 'idle';
            return (
              <button
                key={p.value}
                type="button"
                className={`preset-button ${isActive ? 'active' : ''}`}
                onClick={() => handlePresetClick(p.value)}
                aria-pressed={isActive}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom Physical Settings Panel */}
        <div className="custom-input-panel">
          <span className="custom-input-label">Custom Setting (MM:SS)</span>
          <div className="custom-input-row">
            {/* Decrement Plunger Button */}
            <button
              type="button"
              className="metal-btn-round"
              onClick={() => {
                playClick();
                const nextSecs = Math.max(10, duration - 10);
                setDuration(nextSecs);
              }}
              title="Decrease by 10 seconds"
              aria-label="Decrease duration by ten seconds"
            >
              -
            </button>

            {/* Debossed LCD Window */}
            <div className="debossed-lcd-window">
              <input
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={2}
                value={customMinutes}
                onChange={handleCustomMinutesChange}
                onBlur={handleCustomInputBlur}
                className="lcd-input-field mins"
                aria-label="Custom duration minutes input"
              />
              <span className="lcd-colon">:</span>
              <input
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={2}
                value={customSeconds}
                onChange={handleCustomSecondsChange}
                onBlur={handleCustomInputBlur}
                className="lcd-input-field secs"
                aria-label="Custom duration seconds input"
              />
            </div>

            {/* Increment Plunger Button */}
            <button
              type="button"
              className="metal-btn-round"
              onClick={() => {
                playClick();
                const nextSecs = Math.min(3600, duration + 10);
                setDuration(nextSecs);
              }}
              title="Increase by 10 seconds"
              aria-label="Increase duration by ten seconds"
            >
              +
            </button>
          </div>
        </div>

        {/* Central interactive physical drag dial */}
        <div className="dial-interactive-section">
          <KnobDial
            value={timeLeft}
            status={status}
            onChange={(newSecs) => {
              setDuration(newSecs);
            }}
            onPlayClickSound={playClick}
          />
        </div>

        {/* Toggle switches at the bottom */}
        <div className="toggle-switch-group">
          {/* Audio Alert switch */}
          <div className="toggle-switch-item">
            <span className="toggle-switch-label">Audio</span>
            <label 
              className="retro-switch-wrapper" 
              aria-label="Toggle audio alarms"
            >
              <input
                type="checkbox"
                checked={audioEnabled}
                onChange={(e) => {
                  setAudioEnabled(e.target.checked);
                  playClick();
                }}
                className="retro-switch-input"
              />
              <div className="switch-lever-plate"></div>
              <div className="switch-lever-handle"></div>
            </label>
          </div>

          {/* Overtime count up switch */}
          <div className="toggle-switch-item">
            <span className="toggle-switch-label">Overtime</span>
            <label 
              className="retro-switch-wrapper" 
              aria-label="Toggle overtime count-up"
            >
              <input
                type="checkbox"
                checked={overtimeEnabled}
                onChange={(e) => {
                  setOvertimeEnabled(e.target.checked);
                  playClick();
                }}
                className="retro-switch-input"
              />
              <div className="switch-lever-plate"></div>
              <div className="switch-lever-handle"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Fullscreen stage mode button */}
      {!isFullscreen && (
        <button 
          type="button"
          onClick={() => {
            playClick();
            toggleFullscreen();
          }}
          className="stage-mode-btn"
          aria-label="Toggle fullscreen stage mode"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          Stage Mode (F)
        </button>
      )}

      {/* Audio Context Unlock Prompt */}
      {audioEnabled && status === 'idle' && (
        <div className="mt-4 text-center text-[10px] text-zinc-600 select-none">
          Click anywhere or press SPACE to unlock tick & alarm sounds
        </div>
      )}
    </div>
  );
}

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
  { label: '2h', value: 120 * 60 },
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
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  const [customSeconds, setCustomSeconds] = useState('');
  const [isHoursFocused, setIsHoursFocused] = useState(false);
  const [isMinsFocused, setIsMinsFocused] = useState(false);
  const [isSecsFocused, setIsSecsFocused] = useState(false);
  
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

  // Synchronize customHours, customMinutes, and customSeconds inputs with current duration selection
  useEffect(() => {
    const hrs = Math.floor(duration / 3600);
    const mins = Math.floor((duration % 3600) / 60);
    const secs = duration % 60;
    if (!isHoursFocused) setCustomHours(hrs.toString().padStart(2, '0'));
    if (!isMinsFocused) setCustomMinutes(mins.toString().padStart(2, '0'));
    if (!isSecsFocused) setCustomSeconds(secs.toString().padStart(2, '0'));
  }, [duration, isHoursFocused, isMinsFocused, isSecsFocused]);

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
    const hrs = Math.floor(absoluteSecs / 3600);
    const mins = Math.floor((absoluteSecs % 3600) / 60);
    const remainingSecs = absoluteSecs % 60;

    const sign = isNegative ? '+' : '';
    const formattedHrs = hrs.toString().padStart(2, '0');
    const formattedMins = mins.toString().padStart(2, '0');
    const formattedSecs = remainingSecs.toString().padStart(2, '0');

    return `${sign}${formattedHrs}:${formattedMins}:${formattedSecs}`;
  };

  const handlePresetClick = (seconds: number) => {
    playClick();
    setDuration(seconds);
  };

  const handleCustomHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2); // Max 2 digits
    setCustomHours(val);
    const hrs = val ? parseInt(val, 10) : 0;
    const mins = customMinutes ? parseInt(customMinutes, 10) : 0;
    const secs = customSeconds ? parseInt(customSeconds, 10) : 0;
    setDuration(hrs * 3600 + mins * 60 + secs);
  };

  const handleCustomMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2); // Max 2 digits
    let mins = val ? parseInt(val, 10) : 0;
    if (mins > 59) {
      mins = 59;
      val = '59';
    }
    setCustomMinutes(val);
    const hrs = customHours ? parseInt(customHours, 10) : 0;
    const secs = customSeconds ? parseInt(customSeconds, 10) : 0;
    setDuration(hrs * 3600 + mins * 60 + secs);
  };

  const handleCustomSecondsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2); // Max 2 digits
    let secs = val ? parseInt(val, 10) : 0;
    if (secs > 59) {
      secs = 59;
      val = '59';
    }
    setCustomSeconds(val);
    const hrs = customHours ? parseInt(customHours, 10) : 0;
    const mins = customMinutes ? parseInt(customMinutes, 10) : 0;
    setDuration(hrs * 3600 + mins * 60 + secs);
  };

  const handleCustomInputBlur = () => {
    const hrs = Math.floor(duration / 3600);
    const mins = Math.floor((duration % 3600) / 60);
    const secs = duration % 60;
    setCustomHours(hrs.toString().padStart(2, '0'));
    setCustomMinutes(mins.toString().padStart(2, '0'));
    setCustomSeconds(secs.toString().padStart(2, '0'));
  };

  return (
    <div 
      className={`app-container flex flex-col items-center justify-center w-full min-h-screen ${isFullscreen ? 'fullscreen-stage-mode' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {isFullscreen && (
        <button
          type="button"
          onClick={() => {
            playClick();
            toggleFullscreen();
          }}
          className="stage-mode-exit-btn"
          aria-label="Exit Stage Mode"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
      )}
      {/* Outer casing */}
      <div 
        ref={casingRef}
        className={`deck-timer-casing ${status}`}
        style={{
          // Custom properties for parallax shifting in CSS
          transform: isFullscreen 
            ? 'none' 
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

        {/* Printed Plunger Labels on the casing face */}
        <div className="plunger-label plunger-label-left">START / STOP</div>
        <div className="plunger-label plunger-label-right">RESET</div>

        {/* Brand Logo in top center of casing */}
        <div 
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            top: '10px',
            pointerEvents: 'none',
            zIndex: 5,
            userSelect: 'none',
          }}
        >
          <img src="/logo.svg" style={{ height: '20px', opacity: 0.8, objectFit: 'contain' }} alt="Brand Logo" />
        </div>

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

        {/* Two-Column Side-by-Side Console Grid */}
        <div className="casing-grid-container">
          {/* Left Column: Fixed Analog watch dial */}
          <div className="casing-left-column">
            <KnobDial
              value={timeLeft}
              status={status}
              onChange={(newSecs) => {
                setDuration(newSecs);
              }}
              onPlayClickSound={playClick}
            />
          </div>

          {/* Right Column: Digital Console Controls */}
          <div className="casing-right-column">
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
                
                {/* Outline 88:88:88 background segments */}
                <div className="vfd-bg-shadow" aria-hidden="true">
                  {timeLeft < 0 ? '+88:88:88' : '88:88:88'}
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

            {/* Tactile Control Buttons Labeled START/STOP and RESET */}
            <div className="panel-controls-row">
              <button 
                type="button"
                className={`panel-btn-tactile start-stop-btn ${
                  status === 'running' || status === 'warning' || status === 'urgent' ? 'active' : ''
                }`}
                onClick={() => {
                  playClick();
                  if (status === 'running' || status === 'warning' || status === 'urgent' || status === 'overtime') {
                    pause();
                  } else {
                    start();
                  }
                }}
                aria-label="Start or Stop countdown timer"
              >
                {status === 'running' || status === 'warning' || status === 'urgent' ? 'STOP' : 'START'}
              </button>
              
              <button 
                type="button"
                className="panel-btn-tactile reset-btn"
                onClick={() => {
                  playClick();
                  reset();
                }}
                aria-label="Reset countdown timer"
              >
                RESET
              </button>
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
              <span className="custom-input-label">Custom Setting (HH:MM:SS)</span>
              <div className="custom-input-row">
                {/* Tiny analog clock status indicator */}
                <div className="small-square-watch" aria-hidden="true" title="Custom hour indicator">
                  <svg width="30" height="30" viewBox="0 0 30 30">
                    <rect x="0.5" y="0.5" width="29" height="29" rx="3.5" fill="#ffffff" stroke="#c7c7cc" strokeWidth="1" />
                    <circle cx="15" cy="15" r="11" fill="#f4f4f7" stroke="#e5e5ea" strokeWidth="0.8" />
                    {/* 12, 3, 6, 9 ticks */}
                    <line x1="15" y1="4" x2="15" y2="6.5" stroke="#444" strokeWidth="1" />
                    <line x1="26" y1="15" x2="23.5" y2="15" stroke="#444" strokeWidth="1" />
                    <line x1="15" y1="26" x2="15" y2="23.5" stroke="#444" strokeWidth="1" />
                    <line x1="4" y1="15" x2="6.5" y2="15" stroke="#444" strokeWidth="1" />
                    {/* Hour needle rotates based on custom hours */}
                    <g style={{ transform: `rotate(${(duration / 43200) * 360}deg)`, transformOrigin: '15px 15px' }}>
                      <line x1="15" y1="15" x2="15" y2="7.5" stroke="#1c1c1e" strokeWidth="1.6" strokeLinecap="round" />
                    </g>
                    <circle cx="15" cy="15" r="2.2" fill="#222" stroke="#fff" strokeWidth="0.5" />
                  </svg>
                </div>

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
                    value={customHours}
                    onChange={handleCustomHoursChange}
                    onFocus={(e) => {
                      setIsHoursFocused(true);
                      e.target.select();
                    }}
                    onBlur={() => {
                      setIsHoursFocused(false);
                      handleCustomInputBlur();
                    }}
                    className="lcd-input-field hours"
                    placeholder="00"
                    aria-label="Custom duration hours input"
                  />
                  <span className="lcd-colon">:</span>
                  <input
                    type="text"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    maxLength={2}
                    value={customMinutes}
                    onChange={handleCustomMinutesChange}
                    onFocus={(e) => {
                      setIsMinsFocused(true);
                      e.target.select();
                    }}
                    onBlur={() => {
                      setIsMinsFocused(false);
                      handleCustomInputBlur();
                    }}
                    className="lcd-input-field mins"
                    placeholder="00"
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
                    onFocus={(e) => {
                      setIsSecsFocused(true);
                      e.target.select();
                    }}
                    onBlur={() => {
                      setIsSecsFocused(false);
                      handleCustomInputBlur();
                    }}
                    className="lcd-input-field secs"
                    placeholder="00"
                    aria-label="Custom duration seconds input"
                  />
                </div>

                {/* Increment Plunger Button */}
                <button
                  type="button"
                  className="metal-btn-round"
                  onClick={() => {
                    playClick();
                    const nextSecs = Math.min(359999, duration + 10);
                    setDuration(nextSecs);
                  }}
                  title="Increase by 10 seconds"
                  aria-label="Increase duration by ten seconds"
                >
                  +
                </button>
              </div>
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


    </div>
  );
}

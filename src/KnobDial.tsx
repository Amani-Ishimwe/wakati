import React, { useState, useEffect, useRef } from 'react';

interface KnobDialProps {
  value: number; // current time left in seconds
  status: string; // timer status
  onChange: (newValue: number) => void;
  onPlayClickSound: () => void;
}

export const KnobDial: React.FC<KnobDialProps> = ({
  value,
  status,
  onChange,
  onPlayClickSound,
}) => {
  const dialRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const prevStepRef = useRef<number>(Math.round(value / 60));

  // A full 360 degrees (2*PI) corresponds to 60 minutes (3600 seconds)
  const displaySeconds = Math.max(0, value);
  
  // Minute hand angle (0 to 60 minutes)
  const minutesSecondsRemainder = displaySeconds % 3600;
  const currentAngleRad = (minutesSecondsRemainder / 3600) * 2 * Math.PI;
  
  // Hour hand angle (12 hours = 43200 seconds)
  const hourAngleRad = (displaySeconds / 43200) * 2 * Math.PI;

  // Sweep second hand angle
  const secondAngleRad = ((displaySeconds % 60) / 60) * 2 * Math.PI;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dialRef.current) {
      dialRef.current.setPointerCapture(e.pointerId);
      setIsDragging(true);
      onPlayClickSound();
      updateValueFromCoords(e.clientX, e.clientY);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateValueFromCoords(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    if (dialRef.current) {
      dialRef.current.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
    onPlayClickSound();
  };

  const updateValueFromCoords = (clientX: number, clientY: number) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = clientX - cx;
    const dy = clientY - cy;

    // We want 12 o'clock to be 0 and increase clockwise.
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) {
      angle += 2 * Math.PI;
    }

    // Convert angle to minutes (0 - 60)
    let minutes = (angle / (2 * Math.PI)) * 60;
    
    // Snap to 1-minute steps for tactile "clicks"
    const steppedMinutes = Math.round(minutes);
    const snappedSeconds = Math.max(0, Math.min(60, steppedMinutes)) * 60;

    // Play tactile mechanical tick sound when changing steps
    if (steppedMinutes !== prevStepRef.current) {
      prevStepRef.current = steppedMinutes;
      onPlayClickSound();
    }

    // Support adjusting minutes while preserving the current hours portion
    const currentHours = Math.floor(value / 3600);
    const minutesPortionSeconds = snappedSeconds % 3600;
    let nextTotalSeconds = currentHours * 3600 + minutesPortionSeconds;
    
    if (nextTotalSeconds === 0) {
      nextTotalSeconds = 60; // default to 1 min if everything is zero
    }
    
    onChange(nextTotalSeconds);
  };

  // Generate SVG tick marks for the perimeter of the dial (fixed face)
  const renderTicks = () => {
    const ticks = [];
    const radius = 110; // outer edge of dial (relative to 240x240 size)
    
    for (let i = 0; i < 60; i++) {
      const angleDeg = i * 6;
      const isMajor = i % 5 === 0;
      const isQuarter = i % 15 === 0;
      
      const strokeWidth = isQuarter ? 2.2 : isMajor ? 1.5 : 0.7;
      const length = isQuarter ? 12 : isMajor ? 8 : 4;

      const angleRad = (angleDeg * Math.PI) / 180;
      const x1 = 120 + radius * Math.sin(angleRad);
      const y1 = 120 - radius * Math.cos(angleRad);
      const x2 = 120 + (radius - length) * Math.sin(angleRad);
      const y2 = 120 - (radius - length) * Math.cos(angleRad);

      ticks.push(
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#3a3a3c"
          strokeWidth={strokeWidth}
          opacity={isQuarter ? 0.9 : isMajor ? 0.7 : 0.4}
        />
      );

      // Add numeric markers for major numbers (5, 10, 15... 60)
      if (isMajor && i > 0) {
        const textRadius = radius - length - 11;
        const tx = 120 + textRadius * Math.sin(angleRad);
        const ty = 120 - textRadius * Math.cos(angleRad);
        ticks.push(
          <text
            key={`text-${i}`}
            x={tx}
            y={ty + 4} // Center offset correction
            fill="#3a3a3c"
            fontSize="10px"
            fontWeight="600"
            fontFamily="Inter, sans-serif"
            textAnchor="middle"
            className="select-none"
          >
            {i}
          </text>
        );
      }
    }

    // Add visual '60' or indicator tick at the 12 o'clock mark
    ticks.push(
      <text
        key="text-60"
        x="120"
        y="21"
        fill="#1c1c1e"
        fontSize="11px"
        fontWeight="800"
        fontFamily="Inter, sans-serif"
        textAnchor="middle"
        className="select-none"
      >
        60
      </text>
    );

    return ticks;
  };

  // Prevent default touch scrolling when dragging the dial
  useEffect(() => {
    const dial = dialRef.current;
    if (!dial) return;
    const preventDefault = (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault();
      }
    };
    dial.addEventListener('touchmove', preventDefault, { passive: false });
    return () => {
      dial.removeEventListener('touchmove', preventDefault);
    };
  }, [isDragging]);

  return (
    <div className="dial-container flex flex-col items-center justify-center relative select-none">
      {/* Outer Dial Graduation Ring & Stationary Face */}
      <div 
        ref={dialRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="dial-stationary-face relative flex items-center justify-center cursor-grab active:cursor-grabbing rounded-full"
        style={{
          width: '240px',
          height: '240px',
          background: 'radial-gradient(circle, #ffffff 60%, #f4f4f7 100%)',
          border: '1.5px solid #d1d1d6',
          boxShadow: 'inset 0 2px 5px rgba(0, 0, 0, 0.08), 0 4px 10px rgba(0, 0, 0, 0.05)',
          touchAction: 'none',
        }}
        role="slider"
        aria-valuemin={10}
        aria-valuemax={359999}
        aria-valuenow={value}
        aria-label="Stopwatch dial face. Drag anywhere on the face to set minutes."
      >
        <svg 
          width="240" 
          height="240" 
          className="absolute inset-0 pointer-events-none select-none z-[1]"
          aria-hidden="true"
        >
          {renderTicks()}

          {/* Hour Hand (slow, short) */}
          <g style={{ transform: `rotate(${hourAngleRad}rad)`, transformOrigin: '120px 120px' }}>
            <line x1="120" y1="120" x2="120" y2="78" stroke="#1c1c1e" strokeWidth="4.5" strokeLinecap="round" />
          </g>

          {/* Minute Hand (long, thin, representing minutes) */}
          <g style={{ transform: `rotate(${currentAngleRad}rad)`, transformOrigin: '120px 120px' }}>
            <line x1="120" y1="120" x2="120" y2="35" stroke="#2c2c2e" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="120" cy="35" r="3.5" fill="#2c2c2e" />
          </g>

          {/* Sweep Second Hand (ticking) */}
          <g style={{ transform: `rotate(${secondAngleRad}rad)`, transformOrigin: '120px 120px' }}>
            <line x1="120" y1="135" x2="120" y2="25" stroke="#7a7a7c" strokeWidth="1" strokeLinecap="round" />
            <circle cx="120" cy="135" r="3" fill="#7a7a7c" />
          </g>

          {/* Center silver pin cap */}
          <circle cx="120" cy="120" r="5" fill="#e5e5ea" stroke="#8e8e93" strokeWidth="1" />
          <circle cx="120" cy="120" r="1.5" fill="#3a3a3c" />
        </svg>
      </div>
    </div>
  );
};

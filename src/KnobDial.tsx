import React, { useRef, useState, useEffect } from 'react';

interface KnobDialProps {
  value: number; // current time left in seconds
  status: 'idle' | 'running' | 'paused' | 'warning' | 'urgent' | 'overtime';
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

  // Determine current display angle based on value
  // A full 360 degrees (2*PI) corresponds to 60 minutes (3600 seconds)
  // Clamp value to 0-3600 seconds
  const displaySeconds = Math.max(0, Math.min(3600, value));
  const currentAngleRad = (displaySeconds / 3600) * 2 * Math.PI;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (status === 'running' || status === 'warning' || status === 'urgent' || status === 'overtime') {
      // If timer is active, dragging the dial pauses it first to allow adjustment
      // We'll let the App component handle the status state, but we allow drag interaction.
    }
    
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

    // Calculate angle: standard atan2 has 3 o'clock as 0. 
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

    onChange(snappedSeconds === 0 ? 60 : snappedSeconds); // If user drags to exactly 0, default to 60 or let them go down to 1
  };

  // Generate SVG tick marks for the perimeter of the dial
  const renderTicks = () => {
    const ticks = [];
    // 60 tick marks for 60 minutes
    for (let i = 0; i < 60; i++) {
      const angleDeg = i * 6;
      const isMajor = i % 5 === 0;
      const isQuarter = i % 15 === 0;
      
      const strokeWidth = isQuarter ? 2.5 : isMajor ? 1.5 : 0.8;
      const length = isQuarter ? 14 : isMajor ? 10 : 6;
      const radius = 135; // tick starting radius

      const angleRad = (angleDeg * Math.PI) / 180;
      const x1 = 150 + radius * Math.sin(angleRad);
      const y1 = 150 - radius * Math.cos(angleRad);
      const x2 = 150 + (radius - length) * Math.sin(angleRad);
      const y2 = 150 - (radius - length) * Math.cos(angleRad);

      ticks.push(
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#444"
          strokeWidth={strokeWidth}
          opacity={isQuarter ? 0.9 : isMajor ? 0.7 : 0.4}
        />
      );

      // Add numeric markers for major numbers (5, 10, 15... 60)
      if (isMajor && i > 0) {
        const textRadius = radius - length - 12;
        const tx = 150 + textRadius * Math.sin(angleRad);
        const ty = 150 - textRadius * Math.cos(angleRad);
        ticks.push(
          <text
            key={`text-${i}`}
            x={tx}
            y={ty + 4} // Center offset correction
            fill="#333"
            fontSize="10px"
            fontFamily="Inter, sans-serif"
            fontWeight="bold"
            textAnchor="middle"
            opacity="0.8"
          >
            {i}
          </text>
        );
      }
    }
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
      {/* Outer Dial Graduation Ring */}
      <svg 
        width="300" 
        height="300" 
        className="absolute pointer-events-none select-none"
        aria-hidden="true"
      >
        {renderTicks()}
        {/* Dial border highlight rings */}
        <circle cx="150" cy="150" r="142" stroke="#222" strokeWidth="1" fill="none" opacity="0.1" />
        <circle cx="150" cy="150" r="138" stroke="#fff" strokeWidth="1" fill="none" opacity="0.3" />
      </svg>

      {/* Main Rotatable Physical Dial */}
      <div
        ref={dialRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`dial-knob rounded-full cursor-grab active:cursor-grabbing relative flex items-center justify-center`}
        style={{
          width: '210px',
          height: '210px',
          transform: `rotate(${currentAngleRad}rad)`,
          touchAction: 'none',
          transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
        aria-label="Timer setting dial. Drag to change timer duration."
        role="slider"
        aria-valuemin={60}
        aria-valuemax={3600}
        aria-valuenow={value}
      >
        {/* Knurled Grip Edge Overlay */}
        <div className="absolute inset-0 rounded-full knob-knurled-edge"></div>

        {/* Brushed Radial Metal Center face */}
        <div className="absolute inset-1 rounded-full knob-brushed-face flex items-center justify-center">
          {/* Inner debossed well */}
          <div className="w-[85%] h-[85%] rounded-full knob-inner-well flex items-center justify-center">
            {/* Physical indicator notch pointing to value */}
            <div className="absolute top-[8px] w-2.5 h-6 bg-black rounded-b-sm border-t border-white/20 shadow-inner"></div>
            
            {/* Center steel logo cap */}
            <div className="w-12 h-12 rounded-full knob-center-cap flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-black/10 shadow-inner"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

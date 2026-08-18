import { useRef, useCallback, useEffect } from 'react';

export const useAudio = (enabled: boolean) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<number | null>(null);

  // Lazy-initialize and resume AudioContext on interaction
  const getAudioContext = useCallback((): AudioContext | null => {
    if (!enabled) return null;
    
    if (!audioCtxRef.current) {
      // Support standard and webkit prefix
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }
    
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    
    return audioCtxRef.current;
  }, [enabled]);

  // Clean up any running alarm intervals
  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current !== null) {
      window.clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAlarm();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, [stopAlarm]);

  // 1. Play Mechanical Tick (High-pass filtered noise pop)
  const playTick = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Create a tiny noise buffer (10ms)
    const bufferSize = ctx.sampleRate * 0.01; // 10ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buffer;

    // Highpass filter for the metallic "catch"
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2500, now);
    filter.Q.setValueAtTime(1, now);

    // Envelope
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.06, now); // Low click volume
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.006);

    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noiseNode.start(now);
    noiseNode.stop(now + 0.01);
  }, [getAudioContext]);

  // 2. Play Plunger Click (Low mechanical thump + transient click)
  const playClick = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // A low pitch thump oscillator
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.04);

    // High-pass filter noise for the tactile metal click sound
    const bufferSize = ctx.sampleRate * 0.02; // 20ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1800, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    // Plunger thump envelope
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
    noise.start(now);
    noise.stop(now + 0.02);
  }, [getAudioContext]);

  // 3. Play Warning Beep (Retro dual-beeper)
  const playWarning = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Single beep function
    const beep = (startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(750, startTime);

      // bandpass filter to soften the harshness of the square wave
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(750, startTime);
      filter.Q.setValueAtTime(3, startTime);

      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.setValueAtTime(0.15, startTime + duration - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    beep(now, 0.08);
    beep(now + 0.12, 0.08);
  }, [getAudioContext]);

  // Play a single metal bell ring strike
  const playBellStrike = useCallback((ctx: AudioContext, time: number) => {
    // Metal bell is simulated by summing multiple non-harmonic sine waves
    const frequencies = [640, 890, 1150, 1550, 2400];
    const gains = [0.4, 0.3, 0.25, 0.15, 0.1];
    
    // Master envelope for the single strike
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.35, time);
    masterGain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
    masterGain.connect(ctx.destination);

    // Apply a fast tremolo amplitude modulation to sound like the hammer shaking against the bell
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 16; // 16 Hz rapid rattle
    lfoGain.gain.value = 0.45; // modulate volume by 45%

    lfo.connect(lfoGain);
    lfoGain.connect(masterGain.gain);
    lfo.start(time);
    lfo.stop(time + 1.2);

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const nodeGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      
      // Slight pitch wobble for vintage bell ring character
      osc.frequency.linearRampToValueAtTime(freq - (idx * 2), time + 1.2);

      nodeGain.gain.setValueAtTime(gains[idx], time);
      nodeGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.8);

      osc.connect(nodeGain);
      nodeGain.connect(masterGain);

      osc.start(time);
      osc.stop(time + 1.2);
    });
  }, []);

  // 4. Play Continuous Alarm Bell (repeating strikes like physical hammer rattle)
  const playAlarm = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Prevent starting multiple intervals
    if (alarmIntervalRef.current !== null) return;

    // Start repeating bell strikes immediately, and then every 200ms (metallic chatter)
    const ring = () => {
      const currentCtx = getAudioContext();
      if (currentCtx) {
        playBellStrike(currentCtx, currentCtx.currentTime);
      }
    };

    ring();
    alarmIntervalRef.current = window.setInterval(ring, 400); // strike every 400ms
  }, [getAudioContext, playBellStrike]);

  return {
    playTick,
    playClick,
    playWarning,
    playAlarm,
    stopAlarm,
  };
};

'use client';

import { useCallback, useRef, useEffect } from 'react';

export function useSoundEffects() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Initialize AudioContext on first user interaction to comply with browser autoplay policies
    const initAudio = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } else if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };
    window.addEventListener('click', initAudio);
    window.addEventListener('touchstart', initAudio);
    window.addEventListener('pointerdown', initAudio);
    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
      window.removeEventListener('pointerdown', initAudio);
    };
  }, []);

  const playTone = useCallback((frequency: number, type: OscillatorType, duration: number, volume = 0.1) => {
    if (!audioCtxRef.current) return;
    
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  }, []);

  const playClick = useCallback(() => {
    playTone(800, 'sine', 0.1, 0.05);
  }, [playTone]);

  const playError = useCallback(() => {
    playTone(150, 'sawtooth', 0.3, 0.1);
    setTimeout(() => playTone(100, 'sawtooth', 0.4, 0.1), 100);
  }, [playTone]);

  const playSuccess = useCallback(() => {
    playTone(400, 'sine', 0.1, 0.05);
    setTimeout(() => playTone(600, 'sine', 0.2, 0.05), 100);
    setTimeout(() => playTone(800, 'sine', 0.4, 0.05), 200);
  }, [playTone]);

  return {
    playClick,
    playError,
    playSuccess
  };
}

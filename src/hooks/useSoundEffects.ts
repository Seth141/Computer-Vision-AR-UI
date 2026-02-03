'use client';

import { useCallback, useRef } from 'react';

/**
 * Minimal futuristic sound effects using Web Audio API
 * Clean crystalline chimes, soft gongs, elegant tones
 */
export function useSoundEffects() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  /**
   * Menu open - quick techy blip with deep punch
   * Fast, chipper, digital, with bass weight
   */
  const playMenuOpen = useCallback(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.45, now);

    // Deep bass punch - gives weight
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    
    bass.type = 'sine';
    bass.frequency.setValueAtTime(80, now);
    bass.frequency.exponentialRampToValueAtTime(55, now + 0.08);

    bassGain.gain.setValueAtTime(0.5, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    bass.connect(bassGain);
    bassGain.connect(masterGain);

    bass.start(now);
    bass.stop(now + 0.18);

    // Quick chipper blips - ascending digital sequence
    const blips = [
      { freq: 440, delay: 0 },      // A4
      { freq: 554.37, delay: 0.04 }, // C#5
      { freq: 659.25, delay: 0.08 }, // E5
    ];

    blips.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle'; // Slightly more digital/techy than sine
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0.3, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + delay);
      osc.stop(now + delay + 0.08);
    });

    // Techy high accent
    const accent = ctx.createOscillator();
    const accentGain = ctx.createGain();
    
    accent.type = 'square';
    accent.frequency.setValueAtTime(1318.5, now + 0.08); // E6

    // Filter to soften the square wave
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, now);

    accentGain.gain.setValueAtTime(0.08, now + 0.08);
    accentGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    accent.connect(filter);
    filter.connect(accentGain);
    accentGain.connect(masterGain);

    accent.start(now + 0.08);
    accent.stop(now + 0.18);
  }, [getAudioContext]);

  /**
   * Menu close - soft descending tone
   * Gentle, settling, minimal
   */
  const playMenuClose = useCallback(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.35, now);

    // Single tone with gentle pitch drop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(698.5, now); // F5
    osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.15); // Down to C5

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.45);

    // Soft sub-octave for warmth
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    
    sub.type = 'sine';
    sub.frequency.setValueAtTime(349.23, now); // F4
    sub.frequency.exponentialRampToValueAtTime(261.63, now + 0.15); // C4

    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.15, now + 0.01);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    sub.connect(subGain);
    subGain.connect(masterGain);

    sub.start(now);
    sub.stop(now + 0.4);
  }, [getAudioContext]);

  /**
   * Notification dismiss - soft metallic gong with bounce
   * Elegant resonance, subtle playful decay
   */
  const playNotificationDismiss = useCallback(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.45, now);

    // Primary gong tone
    const gong = ctx.createOscillator();
    const gongGain = ctx.createGain();
    
    gong.type = 'sine';
    gong.frequency.setValueAtTime(220, now); // A3 - deep but not too low

    gongGain.gain.setValueAtTime(0.5, now);
    gongGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    gong.connect(gongGain);
    gongGain.connect(masterGain);

    gong.start(now);
    gong.stop(now + 0.85);

    // Metallic shimmer overtone
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(880, now); // A5
    shimmer.frequency.exponentialRampToValueAtTime(660, now + 0.3);

    shimmerGain.gain.setValueAtTime(0.25, now);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    shimmer.connect(shimmerGain);
    shimmerGain.connect(masterGain);

    shimmer.start(now);
    shimmer.stop(now + 0.4);

    // Playful bouncy tail - subtle pitch wobble
    const bounce = ctx.createOscillator();
    const bounceGain = ctx.createGain();
    
    bounce.type = 'sine';
    bounce.frequency.setValueAtTime(440, now + 0.1); // A4
    bounce.frequency.exponentialRampToValueAtTime(330, now + 0.25); // E4
    bounce.frequency.exponentialRampToValueAtTime(220, now + 0.45); // A3

    bounceGain.gain.setValueAtTime(0, now + 0.1);
    bounceGain.gain.linearRampToValueAtTime(0.12, now + 0.12);
    bounceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    bounce.connect(bounceGain);
    bounceGain.connect(masterGain);

    bounce.start(now + 0.1);
    bounce.stop(now + 0.55);

    // Very subtle fifth harmonic for complexity
    const fifth = ctx.createOscillator();
    const fifthGain = ctx.createGain();
    
    fifth.type = 'sine';
    fifth.frequency.setValueAtTime(330, now); // E4 (fifth of A)

    fifthGain.gain.setValueAtTime(0.1, now);
    fifthGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    fifth.connect(fifthGain);
    fifthGain.connect(masterGain);

    fifth.start(now);
    fifth.stop(now + 0.65);
  }, [getAudioContext]);

  /**
   * Option select - quick crystalline tap
   * Clean, precise, minimal
   */
  const playOptionSelect = useCallback(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.35, now);

    // Clean click tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, now); // A6

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.1);

    // Soft body tone
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    
    body.type = 'sine';
    body.frequency.setValueAtTime(880, now); // A5

    bodyGain.gain.setValueAtTime(0.2, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    body.connect(bodyGain);
    bodyGain.connect(masterGain);

    body.start(now);
    body.stop(now + 0.15);
  }, [getAudioContext]);

  /**
   * Soft hover chime - very subtle
   */
  const playHoverChime = useCallback(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1318.5, now); // E6

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }, [getAudioContext]);

  /**
   * Menu scroll/hover sound - quick techy tick
   * Short, subtle, futuristic scroll feel
   */
  const playMenuHover = useCallback(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.3, now);

    // Quick high tick
    const tick = ctx.createOscillator();
    const tickGain = ctx.createGain();
    
    tick.type = 'triangle';
    tick.frequency.setValueAtTime(1800, now);
    tick.frequency.exponentialRampToValueAtTime(1200, now + 0.03);

    tickGain.gain.setValueAtTime(0.3, now);
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    tick.connect(tickGain);
    tickGain.connect(masterGain);

    tick.start(now);
    tick.stop(now + 0.06);

    // Subtle low body
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    
    body.type = 'sine';
    body.frequency.setValueAtTime(200, now);

    bodyGain.gain.setValueAtTime(0.15, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    body.connect(bodyGain);
    bodyGain.connect(masterGain);

    body.start(now);
    body.stop(now + 0.05);
  }, [getAudioContext]);

  /**
   * Reply open - soft ascending tone with depth
   * Quick, inviting, techy
   */
  const playReplyOpen = useCallback(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.4, now);

    // Deep foundation
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    
    bass.type = 'sine';
    bass.frequency.setValueAtTime(110, now);

    bassGain.gain.setValueAtTime(0.3, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    bass.connect(bassGain);
    bassGain.connect(masterGain);

    bass.start(now);
    bass.stop(now + 0.25);

    // Ascending blips
    const notes = [
      { freq: 330, delay: 0 },
      { freq: 440, delay: 0.05 },
      { freq: 550, delay: 0.1 },
    ];

    notes.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0.25, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + delay);
      osc.stop(now + delay + 0.1);
    });
  }, [getAudioContext]);

  /**
   * Voice start - quick activation blip
   */
  const playVoiceStart = useCallback(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.35, now);

    // Rising tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.18);

    // High ping
    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(1200, now + 0.05);

    pingGain.gain.setValueAtTime(0.15, now + 0.05);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    ping.connect(pingGain);
    pingGain.connect(masterGain);

    ping.start(now + 0.05);
    ping.stop(now + 0.12);
  }, [getAudioContext]);

  /**
   * Voice end - falling tone
   */
  const playVoiceEnd = useCallback(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.3, now);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.18);
  }, [getAudioContext]);

  /**
   * Send message - satisfying confirmation
   * Quick, deep, with shimmer
   */
  const playSendMessage = useCallback(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.45, now);

    // Deep punch
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    
    bass.type = 'sine';
    bass.frequency.setValueAtTime(100, now);
    bass.frequency.exponentialRampToValueAtTime(60, now + 0.1);

    bassGain.gain.setValueAtTime(0.4, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    bass.connect(bassGain);
    bassGain.connect(masterGain);

    bass.start(now);
    bass.stop(now + 0.18);

    // Success chime - two quick notes
    const chime1 = ctx.createOscillator();
    const chime1Gain = ctx.createGain();
    
    chime1.type = 'triangle';
    chime1.frequency.setValueAtTime(523.25, now); // C5

    chime1Gain.gain.setValueAtTime(0.3, now);
    chime1Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    chime1.connect(chime1Gain);
    chime1Gain.connect(masterGain);

    chime1.start(now);
    chime1.stop(now + 0.12);

    const chime2 = ctx.createOscillator();
    const chime2Gain = ctx.createGain();
    
    chime2.type = 'triangle';
    chime2.frequency.setValueAtTime(659.25, now + 0.06); // E5

    chime2Gain.gain.setValueAtTime(0.35, now + 0.06);
    chime2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    chime2.connect(chime2Gain);
    chime2Gain.connect(masterGain);

    chime2.start(now + 0.06);
    chime2.stop(now + 0.2);

    // High shimmer
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(1318.5, now + 0.06); // E6

    shimmerGain.gain.setValueAtTime(0.1, now + 0.06);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    shimmer.connect(shimmerGain);
    shimmerGain.connect(masterGain);

    shimmer.start(now + 0.06);
    shimmer.stop(now + 0.18);
  }, [getAudioContext]);

  /**
   * Window open - expansive rising whoosh with depth
   * Quick, spacious, techy
   */
  const playWindowOpen = useCallback(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.45, now);

    // Deep foundation sweep
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    
    bass.type = 'sine';
    bass.frequency.setValueAtTime(55, now);
    bass.frequency.exponentialRampToValueAtTime(80, now + 0.15);

    bassGain.gain.setValueAtTime(0.4, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    bass.connect(bassGain);
    bassGain.connect(masterGain);

    bass.start(now);
    bass.stop(now + 0.3);

    // Rising whoosh - filtered noise-like sweep
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    const sweepFilter = ctx.createBiquadFilter();
    
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(100, now);
    sweep.frequency.exponentialRampToValueAtTime(400, now + 0.12);

    sweepFilter.type = 'lowpass';
    sweepFilter.frequency.setValueAtTime(800, now);
    sweepFilter.frequency.exponentialRampToValueAtTime(2000, now + 0.12);

    sweepGain.gain.setValueAtTime(0.15, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    sweep.connect(sweepFilter);
    sweepFilter.connect(sweepGain);
    sweepGain.connect(masterGain);

    sweep.start(now);
    sweep.stop(now + 0.18);

    // Sparkle accents - ascending blips
    const sparkles = [
      { freq: 800, delay: 0.03 },
      { freq: 1000, delay: 0.06 },
      { freq: 1200, delay: 0.09 },
      { freq: 1500, delay: 0.12 },
    ];

    sparkles.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0.12, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + delay);
      osc.stop(now + delay + 0.08);
    });
  }, [getAudioContext]);

  /**
   * Window stretch - subtle resize feedback
   * Subtle, elastic, satisfying
   */
  const playWindowStretch = useCallback(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.25, now);

    // Subtle pitch bend
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.05);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }, [getAudioContext]);

  /**
   * Window close - settling descend
   * Quick, gentle, conclusive
   */
  const playWindowClose = useCallback(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.35, now);

    // Descending tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.25);

    // Soft bass thud
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    
    bass.type = 'sine';
    bass.frequency.setValueAtTime(80, now + 0.05);
    bass.frequency.exponentialRampToValueAtTime(50, now + 0.15);

    bassGain.gain.setValueAtTime(0.25, now + 0.05);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    bass.connect(bassGain);
    bassGain.connect(masterGain);

    bass.start(now + 0.05);
    bass.stop(now + 0.22);
  }, [getAudioContext]);

  /**
   * Keyboard key click - subtle mechanical tap
   * Very short, crisp, not intrusive
   */
  const playKeyClick = useCallback(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.12, now);

    // Short click
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    
    click.type = 'sine';
    click.frequency.setValueAtTime(1800, now);
    click.frequency.exponentialRampToValueAtTime(800, now + 0.015);

    clickGain.gain.setValueAtTime(0.4, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    click.connect(clickGain);
    clickGain.connect(masterGain);

    click.start(now);
    click.stop(now + 0.04);

    // Subtle body thud
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    
    thud.type = 'sine';
    thud.frequency.setValueAtTime(150, now);

    thudGain.gain.setValueAtTime(0.15, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    thud.connect(thudGain);
    thudGain.connect(masterGain);

    thud.start(now);
    thud.stop(now + 0.03);
  }, [getAudioContext]);

  return {
    playMenuOpen,
    playMenuClose,
    playNotificationDismiss,
    playHoverChime,
    playOptionSelect,
    playMenuHover,
    playReplyOpen,
    playVoiceStart,
    playVoiceEnd,
    playSendMessage,
    playWindowOpen,
    playWindowStretch,
    playWindowClose,
    playKeyClick,
  };
}

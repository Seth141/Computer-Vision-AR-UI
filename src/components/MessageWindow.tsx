'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TwoHandGestureState } from '@/types/hand-tracking';
import { useSoundEffects } from '@/hooks/useSoundEffects';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface MessageWindowProps {
  twoHandGesture: TwoHandGestureState;
  onVisibilityChange?: (isVisible: boolean) => void;
}

// Constants for sizing
const MIN_WINDOW_WIDTH = 320;
const MAX_WINDOW_WIDTH = 720;
const MIN_WINDOW_HEIGHT = 200;
const MAX_WINDOW_HEIGHT = 480;

// Keyboard layout
const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['⇧', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
  ['123', '🌐', '␣', '.', '↵'],
];
// Pull distance mapped to window size (0.15 = threshold, 0.5 = full size)
// Lower max means window grows faster with less hand movement
const PULL_SCALE_MIN = 0.15;
const PULL_SCALE_MAX = 0.5;

// Incoming message (displayed as received)
const INCOMING_MESSAGE = "Hey can you still make the meeting? Some employees will be joining remotely.";

export default function MessageWindow({ twoHandGesture, onVisibilityChange }: MessageWindowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: MIN_WINDOW_WIDTH, height: MIN_WINDOW_HEIGHT });
  const [messageText, setMessageText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState(0);
  const [jellyPhase, setJellyPhase] = useState(0);
  const [isStretching, setIsStretching] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [emergeProgress, setEmergeProgress] = useState(0); // 0 = at sphere center, 1 = final position
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set()); // Keys currently being "pressed"
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const prevMessageLengthRef = useRef<number>(0);
  const wasOpenRef = useRef(false);
  const wasPullingRef = useRef(false);
  const openTimeRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevSizeRef = useRef({ width: MIN_WINDOW_WIDTH, height: MIN_WINDOW_HEIGHT });
  const jellyFrameRef = useRef<number>(0);
  const lastStretchTimeRef = useRef<number>(0);
  const emergeFrameRef = useRef<number>(0);
  const handsLostTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxPullDistanceRef = useRef<number>(0); // Track max pull to only grow, not shrink
  const keyAnimationTimeoutsRef = useRef<NodeJS.Timeout[]>([]); // Track all key animation timeouts
  
  const {
    playWindowOpen,
    playWindowStretch,
    playVoiceStart,
    playVoiceEnd,
    playSendMessage,
    playWindowClose,
    playKeyClick,
  } = useSoundEffects();

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
          setMessageText(transcript);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
          setActiveKeys(new Set()); // Clear all active keys
        };

        recognitionRef.current.onerror = () => {
          setIsListening(false);
          setActiveKeys(new Set()); // Clear all active keys
        };
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Animate keyboard keys as text is typed
  useEffect(() => {
    const currentLength = messageText.length;
    const prevLength = prevMessageLengthRef.current;
    
    // Only animate when text is being added (not deleted)
    if (currentLength > prevLength && isListening) {
      const newChars = messageText.slice(prevLength).toUpperCase();
      
      // Animate each new character with a staggered delay
      newChars.split('').forEach((char, index) => {
        const keyToActivate = char === ' ' ? '␣' : char;
        
        // Activate key and play click sound
        const activateTimeout = setTimeout(() => {
          setActiveKeys(prev => new Set(prev).add(keyToActivate));
          playKeyClick(); // Subtle click sound
        }, index * 40); // 40ms stagger between keys
        
        // Deactivate key after animation
        const deactivateTimeout = setTimeout(() => {
          setActiveKeys(prev => {
            const next = new Set(prev);
            next.delete(keyToActivate);
            return next;
          });
        }, index * 40 + 150); // Key stays active for 150ms
        
        keyAnimationTimeoutsRef.current.push(activateTimeout, deactivateTimeout);
      });
      
      prevMessageLengthRef.current = currentLength;
    } else {
      prevMessageLengthRef.current = currentLength;
    }
  }, [messageText, playKeyClick, isListening]);

  // Clear all key animations immediately when listening stops
  useEffect(() => {
    if (!isListening) {
      // Cancel all pending key animation timeouts
      keyAnimationTimeoutsRef.current.forEach(clearTimeout);
      keyAnimationTimeoutsRef.current = [];
      // Immediately clear all active keys
      setActiveKeys(new Set());
    }
  }, [isListening]);

  // Start voice input automatically when window opens
  const startVoiceInput = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    
    try {
      recognitionRef.current.start();
      setIsListening(true);
      playVoiceStart();
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
    }
  }, [isListening, playVoiceStart]);

  // Stop voice input
  const stopVoiceInput = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    
    try {
      recognitionRef.current.stop();
      setIsListening(false);
      playVoiceEnd();
    } catch (error) {
      console.error('Failed to stop voice recognition:', error);
    }
  }, [isListening, playVoiceEnd]);

  // Toggle voice input
  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      stopVoiceInput();
    } else {
      startVoiceInput();
    }
  }, [isListening, startVoiceInput, stopVoiceInput]);

  // Send message handler
  const handleSendMessage = useCallback(() => {
    if (!messageText.trim() || isSending) return;
    
    setIsSending(true);
    playSendMessage();
    
    // Simulate sending
    console.log('Message sent:', messageText);
    
    setTimeout(() => {
      setIsSending(false);
      setMessageText('');
      setIsOpen(false);
      if (isListening) {
        stopVoiceInput();
      }
    }, 500);
  }, [messageText, isSending, playSendMessage, isListening, stopVoiceInput]);

  // Handle two-hand pull gesture to open/resize window
  useEffect(() => {
    const justStartedPulling = twoHandGesture.isPulling && !wasPullingRef.current;
    const justStoppedPulling = !twoHandGesture.isPulling && wasPullingRef.current;
    wasPullingRef.current = twoHandGesture.isPulling;

    // If started pulling and window not open, begin opening
    if (justStartedPulling && !isOpen && !isOpening) {
      setIsOpening(true);
      setEmergeProgress(0); // Reset to start from sphere center
      maxPullDistanceRef.current = 0; // Reset max pull for new gesture
      openTimeRef.current = Date.now();
      playWindowOpen();
    }

    // If pulling, update window size based on pull distance
    if (twoHandGesture.isPulling) {
      // Track max pull distance - window only grows, never shrinks
      maxPullDistanceRef.current = Math.max(maxPullDistanceRef.current, twoHandGesture.pullDistance);
      
      // Map max pull distance to window size (only grows)
      const normalizedPull = Math.min(1, Math.max(0, 
        (maxPullDistanceRef.current - PULL_SCALE_MIN) / (PULL_SCALE_MAX - PULL_SCALE_MIN)
      ));
      
      const newWidth = MIN_WINDOW_WIDTH + (MAX_WINDOW_WIDTH - MIN_WINDOW_WIDTH) * normalizedPull;
      const newHeight = MIN_WINDOW_HEIGHT + (MAX_WINDOW_HEIGHT - MIN_WINDOW_HEIGHT) * normalizedPull;
      
      // Calculate resize velocity for jelly effect
      const deltaWidth = newWidth - prevSizeRef.current.width;
      const deltaHeight = newHeight - prevSizeRef.current.height;
      const resizeVelocity = Math.sqrt(deltaWidth * deltaWidth + deltaHeight * deltaHeight);
      
      // Trigger jelly ripple on significant resize
      if (resizeVelocity > 2) {
        const now = Date.now();
        if (now - lastStretchTimeRef.current > 50) {
          setIsStretching(true);
          // Update jelly phase for continuous wobble
          setJellyPhase(prev => (prev + 1) % 360);
          lastStretchTimeRef.current = now;
        }
      }
      
      prevSizeRef.current = { width: newWidth, height: newHeight };
      setWindowSize({ width: newWidth, height: newHeight });
      setPulseIntensity(normalizedPull);
      
      // Play stretch sound occasionally during resize
      if (isOpening && normalizedPull > 0.3) {
        setIsOpening(false);
        setIsOpen(true);
        // Auto-start voice input when window fully opens
        setTimeout(() => {
          startVoiceInput();
        }, 300);
      }
    }

    // If stopped pulling while window is open, either keep open or close
    if (justStoppedPulling) {
      if (isOpening) {
        // Didn't pull enough, close
        setIsOpening(false);
        setIsOpen(false);
        maxPullDistanceRef.current = 0; // Reset for next gesture
        setActiveKeys(new Set()); // Clear all active keys
        playWindowClose();
      } else if (isOpen) {
        // Window was open, trigger settle wobble
        setIsStretching(false);
        setPulseIntensity(0);
      }
    }

    wasOpenRef.current = isOpen;
  }, [twoHandGesture, isOpen, isOpening, playWindowOpen, playWindowClose, startVoiceInput]);

  // Jelly wobble animation during stretching
  useEffect(() => {
    if (!isStretching) return;
    
    const animate = () => {
      setJellyPhase(prev => (prev + 8) % 360);
      jellyFrameRef.current = requestAnimationFrame(animate);
    };
    
    jellyFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (jellyFrameRef.current) {
        cancelAnimationFrame(jellyFrameRef.current);
      }
    };
  }, [isStretching]);

  // Settle jelly effect after stopping stretch
  useEffect(() => {
    if (!twoHandGesture.isPulling && isStretching) {
      // Trigger settle animation
      setIsStretching(false);
      setIsSettling(true);
      
      // Clear settling state after animation completes
      const settleTimeout = setTimeout(() => {
        setIsSettling(false);
      }, 500);
      return () => clearTimeout(settleTimeout);
    }
  }, [twoHandGesture.isPulling, isStretching]);

  // Emerge animation - window emerges from sphere center
  useEffect(() => {
    if ((isOpening || isOpen) && emergeProgress < 1) {
      const startTime = Date.now();
      const duration = 180; // ms for emerge animation - fast pop out
      const startProgress = emergeProgress;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        // Ease out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - t, 3);
        const newProgress = startProgress + (1 - startProgress) * eased;
        
        setEmergeProgress(newProgress);
        
        if (t < 1) {
          emergeFrameRef.current = requestAnimationFrame(animate);
        }
      };
      
      emergeFrameRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (emergeFrameRef.current) {
          cancelAnimationFrame(emergeFrameRef.current);
        }
      };
    }
  }, [isOpening, isOpen, emergeProgress]);

  // Close window when both hands release (if no text)
  useEffect(() => {
    if (isOpen && !twoHandGesture.bothPinching && !messageText.trim()) {
      // Give a small grace period before closing
      const timer = setTimeout(() => {
        if (!twoHandGesture.bothPinching && !messageText.trim()) {
          setIsOpen(false);
          setIsOpening(false);
          maxPullDistanceRef.current = 0; // Reset for next gesture
          setActiveKeys(new Set()); // Clear all active keys
          if (isListening) {
            stopVoiceInput();
          }
          playWindowClose();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, twoHandGesture.bothPinching, messageText, isListening, stopVoiceInput, playWindowClose]);

  // Report visibility changes to parent
  useEffect(() => {
    const isVisible = isOpen || isOpening;
    onVisibilityChange?.(isVisible);
  }, [isOpen, isOpening, onVisibilityChange]);

  // Close window 0.5 seconds after speaking stops
  useEffect(() => {
    if (isOpen && !isListening) {
      const closeTimeout = setTimeout(() => {
        setIsOpen(false);
        setIsOpening(false);
        maxPullDistanceRef.current = 0;
        setActiveKeys(new Set()); // Ensure all keys are cleared
        playWindowClose();
      }, 500);
      
      return () => clearTimeout(closeTimeout);
    }
  }, [isOpen, isListening, playWindowClose]);

  // Close window when hands are not visible for 2 seconds
  useEffect(() => {
    const bothHandsVisible = twoHandGesture.leftHand !== null && twoHandGesture.rightHand !== null;
    
    if ((isOpen || isOpening) && !bothHandsVisible) {
      // Start timeout to close window
      if (!handsLostTimeoutRef.current) {
        handsLostTimeoutRef.current = setTimeout(() => {
          setIsOpen(false);
          setIsOpening(false);
          maxPullDistanceRef.current = 0; // Reset for next gesture
          setActiveKeys(new Set()); // Clear all active keys
          if (isListening) {
            stopVoiceInput();
          }
          playWindowClose();
          handsLostTimeoutRef.current = null;
        }, 300);
      }
    } else {
      // Hands are visible, clear any pending timeout
      if (handsLostTimeoutRef.current) {
        clearTimeout(handsLostTimeoutRef.current);
        handsLostTimeoutRef.current = null;
      }
    }
    
    return () => {
      if (handsLostTimeoutRef.current) {
        clearTimeout(handsLostTimeoutRef.current);
        handsLostTimeoutRef.current = null;
      }
    };
  }, [isOpen, isOpening, twoHandGesture.leftHand, twoHandGesture.rightHand, isListening, stopVoiceInput, playWindowClose]);

  // Don't render if not visible
  if (!isOpen && !isOpening) {
    return null;
  }

  // Calculate jelly deformation - subtle wobble
  const jellyScaleX = isStretching 
    ? 1 + Math.sin(jellyPhase * Math.PI / 180) * 0.02 
    : 1;
  const jellyScaleY = isStretching 
    ? 1 + Math.cos(jellyPhase * Math.PI / 180) * 0.015 
    : 1;
  const jellySkewX = isStretching 
    ? Math.sin((jellyPhase + 45) * Math.PI / 180) * 0.6 
    : 0;
  const jellySkewY = isStretching 
    ? Math.cos((jellyPhase + 90) * Math.PI / 180) * 0.4 
    : 0;

  // Emerge animation: window starts from sphere center (higher up, smaller) and moves to final position
  // The sphere is roughly at center of viewport, window final position is bottom: 400px
  // Calculate Y offset: start higher (closer to center), end at 0
  const emergeYOffset = (1 - emergeProgress) * 280; // 280px offset to start near sphere center
  const emergeScale = 0.2 + emergeProgress * 0.8; // Start at 20% scale, grow to 100%

  // Determine transform based on state
  const getTransform = () => {
    const baseTranslate = `translateX(-50%) translateY(${emergeYOffset}px)`;
    const scaleTransform = `scale(${emergeScale})`;
    
    if (isStretching) {
      return `${baseTranslate} ${scaleTransform} scaleX(${jellyScaleX}) scaleY(${jellyScaleY}) skew(${jellySkewX}deg, ${jellySkewY}deg)`;
    }
    return `${baseTranslate} ${scaleTransform}`;
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-50 flex flex-col"
      style={{
        bottom: '400px',
        left: '50%',
        transform: getTransform(),
        width: `${windowSize.width}px`,
        height: `${windowSize.height}px`,
        opacity: emergeProgress < 0.1 ? 0 : (isOpening ? 0.7 : 1),
        transition: twoHandGesture.isPulling 
          ? 'opacity 0.2s ease' 
          : 'width 0.3s ease, height 0.3s ease, opacity 0.3s ease',
        transformOrigin: 'center center',
        animation: isSettling ? 'jellySettle 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
      }}
    >
      {/* Outer glow effect - pulses with pull and wobbles with jelly */}
      <div
        className="absolute rounded-3xl pointer-events-none"
        style={{
          inset: '-20px',
          background: `radial-gradient(ellipse at center, 
            rgba(100, 180, 255, ${0.15 + pulseIntensity * 0.2}) 0%, 
            rgba(60, 140, 220, ${0.1 + pulseIntensity * 0.15}) 30%,
            transparent 70%
          )`,
          filter: 'blur(20px)',
          animation: isListening ? 'voicePulse 1.5s ease-in-out infinite' : 'none',
          // Glow wobbles opposite to container for depth
          transform: isStretching 
            ? `scaleX(${1 - Math.sin(jellyPhase * Math.PI / 180) * 0.03}) scaleY(${1 - Math.cos(jellyPhase * Math.PI / 180) * 0.025})`
            : 'none',
        }}
      />

      {/* Main window container */}
      <div
        className="relative flex-1 rounded-3xl overflow-hidden"
        style={{
          background: `
            linear-gradient(160deg, 
              rgba(120, 125, 135, 0.98) 0%,
              rgba(105, 110, 120, 0.95) 15%,
              rgba(90, 95, 105, 0.95) 40%,
              rgba(80, 85, 95, 0.96) 60%,
              rgba(85, 90, 100, 0.95) 80%,
              rgba(95, 100, 110, 0.98) 100%
            )
          `,
          boxShadow: `
            0 20px 60px rgba(0, 0, 0, 0.5),
            0 8px 24px rgba(0, 0, 0, 0.35),
            inset 0 2px 4px rgba(255, 255, 255, 0.15),
            inset 0 -2px 4px rgba(0, 0, 0, 0.2)
          `,
          border: '2px solid rgba(100, 105, 115, 0.6)',
          // Jelly border radius wobble
          borderRadius: isStretching 
            ? `${24 + Math.sin(jellyPhase * Math.PI / 180) * 6}px ${24 - Math.sin((jellyPhase + 60) * Math.PI / 180) * 5}px ${24 + Math.cos(jellyPhase * Math.PI / 180) * 6}px ${24 - Math.cos((jellyPhase + 60) * Math.PI / 180) * 5}px`
            : '24px',
          transition: isStretching ? 'none' : 'border-radius 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          animation: isSettling ? 'jellyRipple 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
        }}
      >
        {/* Chrome rim overlay */}
        <div 
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{
            background: `
              linear-gradient(145deg, 
                rgba(255, 255, 255, 0.15) 0%, 
                rgba(255, 255, 255, 0.05) 25%,
                transparent 50%,
                rgba(255, 255, 255, 0.03) 75%,
                rgba(255, 255, 255, 0.08) 100%
              )
            `,
          }}
        />
        
        {/* Top shine - wobbles with jelly */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
          style={{
            top: '3px',
            width: '80%',
            height: '40%',
            background: `
              radial-gradient(ellipse at center top, 
                rgba(255, 255, 255, 0.2) 0%, 
                rgba(255, 255, 255, 0.08) 40%,
                transparent 70%
              )
            `,
            // Shine wobbles to simulate light reflection on jelly surface
            transform: isStretching 
              ? `translateX(calc(-50% + ${Math.sin((jellyPhase + 20) * Math.PI / 180) * 8}px)) scaleX(${1 + Math.sin((jellyPhase) * Math.PI / 180) * 0.1}) scaleY(${1 + Math.cos((jellyPhase) * Math.PI / 180) * 0.08})`
              : 'translateX(-50%)',
            transition: isStretching ? 'none' : 'transform 0.4s ease',
          }}
        />

        {/* Header */}
        <div 
          className="relative flex items-center justify-between px-5 py-3 border-b"
          style={{
            borderColor: 'rgba(80, 85, 95, 0.5)',
            background: 'rgba(0, 0, 0, 0.2)',
            // Slight counter-wobble for header content
            transform: isStretching 
              ? `translateY(${Math.sin((jellyPhase + 30) * Math.PI / 180) * 2}px)` 
              : 'none',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Message icon */}
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: `
                  linear-gradient(160deg, 
                    rgba(100, 180, 255, 0.9) 0%,
                    rgba(60, 140, 220, 0.95) 50%,
                    rgba(80, 160, 240, 0.9) 100%
                  )
                `,
                boxShadow: `
                  inset 0 1px 2px rgba(255, 255, 255, 0.5),
                  inset 0 -1px 2px rgba(0, 0, 0, 0.15),
                  0 2px 6px rgba(60, 140, 220, 0.4)
                `,
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
            </div>
            <span 
              className="text-sm font-semibold"
              style={{ 
                color: 'rgba(255, 255, 255, 0.95)',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
              }}
            >
              New Message
            </span>
          </div>

          {/* Voice status indicator */}
          <div 
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: isListening 
                ? 'rgba(100, 180, 255, 0.25)'
                : 'rgba(0, 0, 0, 0.25)',
              border: `1px solid ${isListening ? 'rgba(100, 180, 255, 0.5)' : 'rgba(100, 105, 115, 0.4)'}`,
            }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: isListening 
                  ? 'linear-gradient(135deg, #4ade80, #22c55e)'
                  : 'rgba(150, 155, 165, 0.6)',
                boxShadow: isListening 
                  ? '0 0 8px rgba(34, 197, 94, 0.6)'
                  : 'none',
                animation: isListening ? 'voiceDot 1s ease-in-out infinite' : 'none',
              }}
            />
            <span 
              className="text-xs font-medium"
              style={{ color: isListening ? 'rgba(120, 190, 255, 0.95)' : 'rgba(180, 185, 195, 0.8)' }}
            >
              {isListening ? 'Listening...' : 'Voice Ready'}
            </span>
          </div>
        </div>

        {/* Message content area */}
        <div 
          className="flex-1 px-4 pt-3 pb-2 overflow-auto flex flex-col gap-2"
          style={{ 
            minHeight: '60px',
            // Content wobble - lagging behind the container
            transform: isStretching 
              ? `scale(${1 + Math.sin((jellyPhase - 20) * Math.PI / 180) * 0.008}, ${1 + Math.cos((jellyPhase - 20) * Math.PI / 180) * 0.006})` 
              : 'none',
          }}
        >
          {/* Received message (incoming) */}
          <div
            className="p-3 rounded-xl self-start max-w-[85%]"
            style={{
              background: 'rgba(100, 180, 255, 0.25)',
              border: '1px solid rgba(100, 180, 255, 0.4)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
              borderRadius: '12px 12px 12px 4px',
            }}
          >
            <p 
              className="text-sm leading-relaxed"
              style={{ 
                color: 'rgba(255, 255, 255, 0.95)',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
              }}
            >
              {INCOMING_MESSAGE}
            </p>
          </div>

          {/* Your reply (transcribed text display) */}
          <div
            className="p-3 rounded-xl self-end max-w-[85%]"
            style={{
              minHeight: '44px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(80, 85, 95, 0.4)',
              boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.15)',
              borderRadius: isStretching 
                ? `${12 + Math.sin((jellyPhase + 30) * Math.PI / 180) * 3}px ${12 - Math.cos((jellyPhase + 45) * Math.PI / 180) * 2}px ${4}px ${12 - Math.cos((jellyPhase + 75) * Math.PI / 180) * 2}px`
                : '12px 12px 4px 12px',
            }}
          >
            {messageText ? (
              <p 
                className="text-sm leading-relaxed"
                style={{ 
                  color: 'rgba(255, 255, 255, 0.95)',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                }}
              >
                {messageText}
                {isListening && (
                  <span 
                    className="inline-block ml-1 w-0.5 h-4 align-middle"
                    style={{
                      background: 'rgba(100, 180, 255, 0.9)',
                      animation: 'cursorBlink 1s ease-in-out infinite',
                    }}
                  />
                )}
              </p>
            ) : (
              <p 
                className="text-sm italic"
                style={{ color: 'rgba(180, 185, 195, 0.7)' }}
              >
                {isListening ? 'Speak your message...' : 'Tap microphone or speak'}
              </p>
            )}
          </div>

          {/* On-screen keyboard (visual only for v1) */}
          <div 
            className="mt-2 select-none flex-shrink-0"
            style={{
              opacity: windowSize.height > 260 ? Math.min(1, (windowSize.height - 260) / 80) : 0,
              transform: windowSize.height > 260 ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)',
              transition: 'opacity 0.2s ease, transform 0.2s ease',
              pointerEvents: 'none',
            }}
          >
            {KEYBOARD_ROWS.map((row, rowIndex) => (
              <div 
                key={rowIndex} 
                className="flex justify-center gap-1 mb-1"
                style={{
                  // Stagger the jelly effect per row
                  transform: isStretching 
                    ? `translateY(${Math.sin((jellyPhase + rowIndex * 25) * Math.PI / 180) * 1.5}px)` 
                    : 'none',
                }}
              >
                {row.map((key, keyIndex) => {
                  const isSpecialKey = ['⇧', '⌫', '123', '🌐', '↵'].includes(key);
                  const isSpaceBar = key === '␣';
                  const isActive = activeKeys.has(key);
                  
                  return (
                    <div
                      key={keyIndex}
                      className="flex items-center justify-center rounded-lg"
                      style={{
                        width: isSpaceBar ? '140px' : isSpecialKey ? '42px' : '28px',
                        height: '32px',
                        fontSize: isSpaceBar ? '10px' : isSpecialKey ? '12px' : '11px',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'rgba(255, 255, 255, 0.95)' : 'rgba(50, 55, 65, 0.9)',
                        textShadow: isActive 
                          ? '0 1px 2px rgba(0, 0, 0, 0.4)' 
                          : '0 1px 0 rgba(255, 255, 255, 0.6)',
                        background: isActive
                          ? `linear-gradient(180deg, 
                              rgba(130, 135, 145, 0.95) 0%,
                              rgba(100, 105, 115, 0.95) 50%,
                              rgba(80, 85, 95, 0.95) 100%
                            )`
                          : `linear-gradient(180deg, 
                              rgba(255, 255, 255, 0.95) 0%,
                              rgba(240, 242, 245, 0.9) 50%,
                              rgba(225, 228, 232, 0.95) 100%
                            )`,
                        boxShadow: isActive
                          ? `0 4px 12px rgba(80, 85, 95, 0.4),
                             0 2px 4px rgba(0, 0, 0, 0.25),
                             inset 0 1px 2px rgba(255, 255, 255, 0.2),
                             inset 0 -1px 1px rgba(0, 0, 0, 0.15)`
                          : `0 1px 3px rgba(0, 0, 0, 0.12),
                             0 2px 4px rgba(0, 0, 0, 0.08),
                             inset 0 1px 1px rgba(255, 255, 255, 0.9),
                             inset 0 -1px 1px rgba(0, 0, 0, 0.05)`,
                        border: isActive 
                          ? '1px solid rgba(100, 105, 115, 0.6)' 
                          : '1px solid rgba(200, 205, 215, 0.5)',
                        // Pop up animation when active, jelly wobble when stretching
                        transform: isActive
                          ? 'scale(1.25) translateY(-4px)'
                          : isStretching 
                            ? `scale(${1 + Math.sin((jellyPhase + keyIndex * 12 + rowIndex * 30) * Math.PI / 180) * 0.04})`
                            : 'scale(1)',
                        borderRadius: isStretching
                          ? `${6 + Math.sin((jellyPhase + keyIndex * 15) * Math.PI / 180) * 2}px`
                          : '6px',
                        transition: 'transform 0.08s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.08s ease, color 0.08s ease, box-shadow 0.08s ease, border 0.08s ease',
                        zIndex: isActive ? 10 : 1,
                        position: 'relative',
                      }}
                    >
                      {isSpaceBar ? 'space' : key}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Footer with controls */}
        <div 
          className="relative flex items-center justify-between px-4 py-2 border-t"
          style={{
            borderColor: 'rgba(80, 85, 95, 0.5)',
            background: 'rgba(0, 0, 0, 0.2)',
            // Footer counter-wobble
            transform: isStretching 
              ? `translateY(${Math.sin((jellyPhase - 15) * Math.PI / 180) * -2}px)` 
              : 'none',
          }}
        >
          {/* Microphone toggle */}
          <button
            onClick={toggleVoiceInput}
            className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
            style={{
              background: isListening 
                ? `linear-gradient(160deg, 
                    rgba(100, 180, 255, 0.4) 0%,
                    rgba(80, 160, 240, 0.35) 20%,
                    rgba(60, 140, 220, 0.3) 50%,
                    rgba(80, 160, 240, 0.35) 80%,
                    rgba(100, 180, 255, 0.4) 100%
                  )`
                : 'linear-gradient(160deg, rgba(80, 85, 95, 0.9) 0%, rgba(60, 65, 75, 0.85) 100%)',
              backdropFilter: isListening ? 'blur(12px)' : 'none',
              WebkitBackdropFilter: isListening ? 'blur(12px)' : 'none',
              boxShadow: isListening
                ? `0 0 25px rgba(100, 180, 255, 0.4),
                   0 0 50px rgba(100, 180, 255, 0.2),
                   inset 0 1px 2px rgba(255, 255, 255, 0.3)`
                : '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.1)',
              border: '1.5px solid rgba(100, 105, 115, 0.5)',
              transition: 'all 0.2s ease',
              animation: isListening ? 'chromePulse 1.5s ease-in-out infinite' : 'none',
              // Button jelly bounce
              transform: isStretching 
                ? `scale(${1 + Math.sin((jellyPhase + 90) * Math.PI / 180) * 0.08}) rotate(${Math.sin((jellyPhase + 60) * Math.PI / 180) * 2}deg)`
                : 'none',
            }}
          >
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke={isListening ? 'rgba(255, 255, 255, 0.95)' : 'rgba(180, 185, 195, 0.9)'} 
              strokeWidth="2" 
              className="w-4 h-4"
              style={{
                filter: isListening ? 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' : 'none',
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
          </button>

          {/* Hint text */}
          <div 
            className="text-center flex-1 mx-4"
            style={{
              fontSize: '11px',
              color: 'rgba(180, 185, 195, 0.8)',
            }}
          >
            {twoHandGesture.isPulling 
              ? 'Pull hands apart to resize' 
              : messageText.trim() 
                ? 'Pinch both hands to send' 
                : 'Keep both hands pinched to stay open'
            }
          </div>

          {/* Send button */}
          <button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || isSending}
            className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
            style={{
              background: messageText.trim() && !isSending
                ? 'linear-gradient(160deg, rgba(100, 180, 255, 0.95) 0%, rgba(60, 140, 220, 0.95) 100%)'
                : 'linear-gradient(160deg, rgba(200, 205, 215, 0.6) 0%, rgba(180, 185, 195, 0.6) 100%)',
              boxShadow: messageText.trim() && !isSending
                ? '0 4px 16px rgba(60, 140, 220, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                : '0 2px 6px rgba(0, 0, 0, 0.1)',
              border: '1.5px solid rgba(255, 255, 255, 0.5)',
              transition: 'all 0.2s ease',
              transform: isSending 
                ? 'scale(0.9)' 
                : isStretching 
                  ? `scale(${1 + Math.sin((jellyPhase + 120) * Math.PI / 180) * 0.08}) rotate(${Math.sin((jellyPhase + 90) * Math.PI / 180) * -2}deg)`
                  : 'scale(1)',
            }}
          >
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke={messageText.trim() && !isSending ? 'white' : 'rgba(120, 125, 135, 0.6)'} 
              strokeWidth="2" 
              className="w-4 h-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </div>

        {/* Pull handles visual indicator - shows at edges when pulling */}
        {twoHandGesture.isPulling && (
          <>
            <div 
              className="absolute left-2 top-1/2 -translate-y-1/2 w-1 rounded-full"
              style={{
                height: '40%',
                background: 'linear-gradient(180deg, transparent, rgba(100, 180, 255, 0.6), transparent)',
                animation: 'handlePulse 0.8s ease-in-out infinite',
              }}
            />
            <div 
              className="absolute right-2 top-1/2 -translate-y-1/2 w-1 rounded-full"
              style={{
                height: '40%',
                background: 'linear-gradient(180deg, transparent, rgba(100, 180, 255, 0.6), transparent)',
                animation: 'handlePulse 0.8s ease-in-out infinite 0.4s',
              }}
            />
          </>
        )}
      </div>

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes voicePulse {
          0%, 100% {
            opacity: 0.8;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
          }
        }
        
        @keyframes voiceDot {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.8;
          }
        }
        
        @keyframes cursorBlink {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }
        
        @keyframes chromePulse {
          0%, 100% {
            box-shadow: 0 0 25px rgba(255, 255, 255, 0.5), 0 0 50px rgba(255, 255, 255, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.6);
          }
          50% {
            box-shadow: 0 0 35px rgba(255, 255, 255, 0.7), 0 0 70px rgba(255, 255, 255, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.8);
          }
        }
        
        @keyframes handlePulse {
          0%, 100% {
            opacity: 0.4;
            transform: translateY(-50%) scaleY(1);
          }
          50% {
            opacity: 0.8;
            transform: translateY(-50%) scaleY(1.1);
          }
        }
        
        @keyframes jellySettle {
          0% {
            transform: translateX(-50%) scaleX(1.02) scaleY(0.98) skew(0.5deg, 0.3deg);
          }
          20% {
            transform: translateX(-50%) scaleX(0.98) scaleY(1.03) skew(-0.4deg, -0.2deg);
          }
          40% {
            transform: translateX(-50%) scaleX(1.015) scaleY(0.985) skew(0.3deg, 0.15deg);
          }
          60% {
            transform: translateX(-50%) scaleX(0.99) scaleY(1.01) skew(-0.15deg, -0.08deg);
          }
          80% {
            transform: translateX(-50%) scaleX(1.005) scaleY(0.995) skew(0.05deg, 0.03deg);
          }
          100% {
            transform: translateX(-50%) scaleX(1) scaleY(1) skew(0deg, 0deg);
          }
        }
        
        @keyframes jellyRipple {
          0% {
            border-radius: 24px 28px 20px 26px;
          }
          25% {
            border-radius: 26px 22px 28px 24px;
          }
          50% {
            border-radius: 22px 26px 24px 28px;
          }
          75% {
            border-radius: 28px 24px 26px 22px;
          }
          100% {
            border-radius: 24px 24px 24px 24px;
          }
        }
      `}</style>
    </div>
  );
}


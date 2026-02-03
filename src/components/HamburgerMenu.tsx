'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GestureState } from '@/types/hand-tracking';
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

interface HamburgerMenuProps {
  gesture: GestureState;
}

interface MenuOption {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

export default function HamburgerMenu({ gesture }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [hoveringOption, setHoveringOption] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [isExploding, setIsExploding] = useState(false);
  const [hoveringNotification, setHoveringNotification] = useState(false);
  const [wasExploded, setWasExploded] = useState(false);
  
  // Reply mode state
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const wasGrabbingRef = useRef(false);
  const lastToggleTimeRef = useRef(0);
  const notificationWasGrabbingRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Sound effects
  const { 
    playMenuOpen, 
    playMenuClose, 
    playNotificationDismiss, 
    playOptionSelect, 
    playMenuHover,
    playReplyOpen,
    playSendMessage,
  } = useSoundEffects();
  
  // Track previous hovering option to detect changes
  const prevHoveringOptionRef = useRef<string | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
          setReplyText(transcript);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current.onerror = () => {
          setIsListening(false);
        };
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Toggle voice listening
  const toggleVoiceInput = useCallback(() => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setReplyText('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  // Send message handler
  const handleSendMessage = useCallback(() => {
    if (!replyText.trim() || isSending) return;
    
    setIsSending(true);
    playSendMessage();
    
    // Simulate sending (in real app, this would be an API call)
    console.log('Message sent:', replyText);
    
    // Close reply mode after animation
    setTimeout(() => {
      setIsSending(false);
      setIsReplying(false);
      setReplyText('');
      setShowNotification(false);
      setWasExploded(true); // Skip exit animation
    }, 500);
  }, [replyText, isSending, playSendMessage]);

  // Show notification once after 3 seconds
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      if (!isExploding) {
        setWasExploded(false); // Reset so enter animation works
        setShowNotification(true);
      }
    }, 3000);

    return () => {
      clearTimeout(initialTimer);
    };
  }, [isExploding]);

  // Track hover state for notification
  useEffect(() => {
    if (!notificationRef.current || !showNotification) {
      setHoveringNotification(false);
      return;
    }
    // Reuse isHandOver with smaller padding for notification
    const screenPos = gesture.handPosition ? {
      x: ((gesture.handPosition.x + 1) / 2) * window.innerWidth,
      y: ((-gesture.handPosition.y + 1) / 2) * window.innerHeight,
    } : null;
    
    if (!screenPos) {
      setHoveringNotification(false);
      return;
    }
    
    const rect = notificationRef.current.getBoundingClientRect();
    const padding = 40;
    const isOver = (
      screenPos.x >= rect.left - padding &&
      screenPos.x <= rect.right + padding &&
      screenPos.y >= rect.top - padding &&
      screenPos.y <= rect.bottom + padding
    );
    setHoveringNotification(isOver);
  }, [gesture.handPosition, showNotification]);

  // Open reply mode when hovering over notification
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Clear any existing timer when hover state changes
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    
    // If hovering and not already replying, open reply mode after a short delay
    if (hoveringNotification && showNotification && !isReplying && !isExploding) {
      hoverTimerRef.current = setTimeout(() => {
        if (showNotification && !isExploding) {
          playReplyOpen();
          setIsReplying(true);
          
          // Automatically start dictation after reply mode opens
          setTimeout(() => {
            if (recognitionRef.current && !isListening) {
              setReplyText('');
              recognitionRef.current.start();
              setIsListening(true);
            }
          }, 200);
        }
      }, 400); // 400ms hover delay before opening reply
    }
    
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, [hoveringNotification, showNotification, isReplying, isExploding, isListening, playReplyOpen]);

  // Handle pinch on notification - send message if text exists, otherwise dismiss
  useEffect(() => {
    const justGrabbed = gesture.isGrabbing && !notificationWasGrabbingRef.current;
    notificationWasGrabbingRef.current = gesture.isGrabbing;

    if (!justGrabbed || !hoveringNotification || !showNotification) return;

    // Stop voice if listening
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    // If there's text, send the message
    if (replyText.trim()) {
      handleSendMessage();
    } else {
      // No text - dismiss the notification
      playNotificationDismiss();
      setIsExploding(true);
      setWasExploded(true);
      setShowNotification(false);
      setIsReplying(false);
      setReplyText('');
      
      setTimeout(() => {
        setIsExploding(false);
      }, 600);
    }
  }, [gesture.isGrabbing, hoveringNotification, showNotification, isListening, replyText, playNotificationDismiss, handleSendMessage]);

  // Menu options with icons
  const menuOptions: MenuOption[] = [
    {
      id: 'settings',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      ),
      label: 'Settings',
      onClick: () => console.log('Settings clicked'),
    },
    {
      id: 'info',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
      ),
      label: 'Info',
      onClick: () => console.log('Info clicked'),
    },
    {
      id: 'camera',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
        </svg>
      ),
      label: 'Camera',
      onClick: () => console.log('Camera clicked'),
    },
  ];

  // Convert hand position to screen coordinates
  const getScreenPosition = useCallback(() => {
    if (!gesture.handPosition) return null;
    
    const x = ((gesture.handPosition.x + 1) / 2) * window.innerWidth;
    const y = ((-gesture.handPosition.y + 1) / 2) * window.innerHeight;
    
    return { x, y };
  }, [gesture.handPosition]);

  // Check if hand is over an element - with customizable padding
  const isHandOver = useCallback((element: HTMLElement | null, padding: number = 80) => {
    if (!element || !gesture.handPosition) return false;
    
    const screenPos = getScreenPosition();
    if (!screenPos) return false;
    
    const rect = element.getBoundingClientRect();
    
    return (
      screenPos.x >= rect.left - padding &&
      screenPos.x <= rect.right + padding &&
      screenPos.y >= rect.top - padding &&
      screenPos.y <= rect.bottom + padding
    );
  }, [gesture.handPosition, getScreenPosition]);

  // Handle pinch detection for menu toggle
  useEffect(() => {
    const justGrabbed = gesture.isGrabbing && !wasGrabbingRef.current;
    wasGrabbingRef.current = gesture.isGrabbing;

    if (!justGrabbed) return;

    const now = Date.now();
    // Shorter debounce (300ms) for responsive toggling
    if (now - lastToggleTimeRef.current < 300) return;

    // When menu is open, options take priority over main button
    if (isOpen && hoveringOption) {
      const option = menuOptions.find(opt => opt.id === hoveringOption);
      option?.onClick?.();
      playOptionSelect();
      lastToggleTimeRef.current = now;
      return;
    }

    // Main button - toggle open/close
    if (isHovering) {
      setIsOpen(prev => {
        // Play appropriate sound based on new state
        if (!prev) {
          playMenuOpen();
        } else {
          playMenuClose();
        }
        return !prev;
      });
      lastToggleTimeRef.current = now;
      return;
    }
  }, [gesture.isGrabbing, isHovering, isOpen, hoveringOption, menuOptions, playMenuOpen, playMenuClose, playOptionSelect]);

  // Track hover state for main menu button - large hit area (130px padding)
  useEffect(() => {
    if (!menuRef.current) return;
    setIsHovering(isHandOver(menuRef.current, 130));
  }, [gesture.handPosition, isHandOver]);

  // Track hover state for menu options - smaller hit area (25px padding)
  useEffect(() => {
    if (!isOpen) {
      setHoveringOption(null);
      return;
    }

    // Check options first - they take priority when menu is open
    const optionElements = document.querySelectorAll('[data-menu-option]');
    let foundHover: string | null = null;

    optionElements.forEach((el) => {
      if (isHandOver(el as HTMLElement, 35)) { // Slightly larger hit area for better detection
        foundHover = el.getAttribute('data-menu-option');
      }
    });

    setHoveringOption(foundHover);
  }, [gesture.handPosition, isOpen, isHandOver]);

  // Play hover sound when hovering over a new option
  useEffect(() => {
    if (hoveringOption && hoveringOption !== prevHoveringOptionRef.current) {
      playMenuHover();
    }
    prevHoveringOptionRef.current = hoveringOption;
  }, [hoveringOption, playMenuHover]);

  return (
    <div className="fixed top-110 right-70 z-40">
      {/* Menu options - vertical stack to the left */}
      {menuOptions.map((option, index) => (
        <div
          key={option.id}
          data-menu-option={option.id}
          className="absolute flex items-center justify-center cursor-pointer"
          style={{
            width: '44px',
            height: '44px',
            top: '50%',
            right: '100%',
            marginRight: '16px',
            marginTop: '-22px',
            transform: isOpen 
              ? `translateY(${(index - 1) * 56}px)` 
              : 'translateY(0) scale(0.3)',
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? 'auto' : 'none',
            transition: `transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 60}ms, opacity 0.3s ease ${index * 60}ms`,
          }}
          onClick={() => {
            option?.onClick?.();
            playOptionSelect();
          }}
        >
          {/* Jello wrapper */}
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              animation: isOpen ? `jelloWobble 0.8s ease ${index * 60 + 100}ms` : 'none',
              transform: hoveringOption === option.id ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 0.2s ease',
            }}
          >
          {/* Glassy chrome background */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: hoveringOption === option.id 
                ? `linear-gradient(160deg, 
                    rgba(255, 255, 255, 0.35) 0%,
                    rgba(220, 225, 230, 0.25) 20%,
                    rgba(180, 190, 200, 0.2) 50%,
                    rgba(160, 170, 180, 0.25) 80%,
                    rgba(200, 210, 220, 0.35) 100%
                  )`
                : `linear-gradient(160deg, 
                    rgba(255, 255, 255, 0.95) 0%,
                    rgba(230, 232, 235, 0.9) 20%,
                    rgba(200, 205, 210, 0.85) 50%,
                    rgba(180, 185, 195, 0.9) 80%,
                    rgba(210, 215, 220, 0.95) 100%
                  )`,
              backdropFilter: hoveringOption === option.id ? 'blur(12px)' : 'none',
              WebkitBackdropFilter: hoveringOption === option.id ? 'blur(12px)' : 'none',
              boxShadow: hoveringOption === option.id
                ? `0 8px 24px rgba(0, 0, 0, 0.15),
                   0 2px 8px rgba(0, 0, 0, 0.1),
                   inset 0 1px 2px rgba(255, 255, 255, 0.6),
                   inset 0 -1px 2px rgba(0, 0, 0, 0.05)`
                : `0 8px 24px rgba(0, 0, 0, 0.25),
                   0 2px 8px rgba(0, 0, 0, 0.15),
                   inset 0 2px 4px rgba(255, 255, 255, 0.9),
                   inset 0 -2px 4px rgba(0, 0, 0, 0.1)`,
              transition: 'all 0.15s ease',
            }}
          />
          
          {/* Chrome rim */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: `
                linear-gradient(145deg, 
                  rgba(255, 255, 255, 0.8) 0%, 
                  rgba(255, 255, 255, 0.2) 30%,
                  transparent 50%,
                  rgba(255, 255, 255, 0.3) 100%
                )
              `,
              border: '1.5px solid rgba(255, 255, 255, 0.6)',
            }}
          />
          
          {/* Top highlight shine */}
          <div 
            className="absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{
              top: '2px',
              width: '65%',
              height: '40%',
              background: `
                radial-gradient(ellipse at center top, 
                  rgba(255, 255, 255, 0.95) 0%, 
                  rgba(255, 255, 255, 0.4) 50%,
                  transparent 80%
                )
              `,
            }}
          />
          
          {/* Icon */}
          <div 
            className="relative z-10 flex items-center justify-center"
            style={{
              color: hoveringOption === option.id 
                ? 'rgba(255, 255, 255, 0.95)' 
                : 'rgba(80, 85, 95, 0.9)',
              filter: hoveringOption === option.id
                ? 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4))'
                : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {option.icon}
          </div>
          
          {/* Hover glow */}
          {hoveringOption === option.id && (
            <div 
              className="absolute inset-0 rounded-full"
              style={{
                boxShadow: `0 0 30px rgba(255, 255, 255, 0.6),
                   0 0 60px rgba(255, 255, 255, 0.3),
                   inset 0 0 20px rgba(255, 255, 255, 0.2)`,
                transition: 'box-shadow 0.15s ease',
              }}
            />
          )}
          
          {/* Tooltip - to the left of the button */}
          <div 
            className="absolute right-full mr-3 px-3 py-1.5 rounded-lg whitespace-nowrap"
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(200, 205, 210, 0.8)',
              color: 'rgba(60, 65, 75, 0.95)',
              fontSize: '12px',
              fontWeight: 500,
              opacity: hoveringOption === option.id ? 1 : 0,
              transform: hoveringOption === option.id ? 'translateX(0)' : 'translateX(8px)',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
          >
            {option.label}
          </div>
          </div>
        </div>
      ))}

      {/* Main hamburger button - larger */}
      <div
        ref={menuRef}
        className="relative cursor-pointer"
        style={{
          width: '72px',
          height: '72px',
          transform: `scale(${isHovering ? 1.08 : 1})`,
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={() => {
          setIsOpen(prev => {
            if (!prev) {
              playMenuOpen();
            } else {
              playMenuClose();
            }
            return !prev;
          });
        }}
      >
        {/* Outer glow */}
        <div 
          className="absolute rounded-full"
          style={{
            inset: '-16px',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%)',
            opacity: isHovering || isOpen ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
        />
        
        {/* Glassy chrome base */}
        <div 
          className="absolute inset-0 rounded-full overflow-hidden"
          style={{
            background: `
              linear-gradient(160deg, 
                rgba(255, 255, 255, 0.98) 0%,
                rgba(235, 238, 242, 0.95) 15%,
                rgba(210, 215, 225, 0.9) 40%,
                rgba(185, 190, 205, 0.92) 60%,
                rgba(200, 205, 215, 0.95) 80%,
                rgba(225, 230, 235, 0.98) 100%
              )
            `,
            boxShadow: `
              0 12px 40px rgba(0, 0, 0, 0.3),
              0 4px 16px rgba(0, 0, 0, 0.2),
              inset 0 3px 6px rgba(255, 255, 255, 1),
              inset 0 -3px 6px rgba(0, 0, 0, 0.1)
            `,
          }}
        />
        
        {/* Chrome rim - outer edge */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: `
              linear-gradient(145deg, 
                rgba(255, 255, 255, 0.9) 0%, 
                rgba(255, 255, 255, 0.3) 25%,
                transparent 50%,
                rgba(255, 255, 255, 0.2) 75%,
                rgba(255, 255, 255, 0.5) 100%
              )
            `,
            border: '2px solid rgba(255, 255, 255, 0.7)',
          }}
        />
        
        {/* Top shine - main chrome highlight */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 rounded-full"
          style={{
            top: '3px',
            width: '75%',
            height: '45%',
            background: `
              radial-gradient(ellipse at center top, 
                rgb(255, 255, 255) 0%, 
                rgba(255, 255, 255, 0.6) 40%,
                rgba(224, 220, 220, 0.2) 60%,
                transparent 80%
              )
            `,
          }}
        />
        
        {/* Bottom reflection */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 rounded-full"
          style={{
            bottom: '5px',
            width: '55%',
            height: '25%',
            background: `
              radial-gradient(ellipse at center bottom, 
                rgba(255, 255, 255, 0.4) 0%, 
                transparent 70%
              )
            `,
          }}
        />

        {/* Hamburger lines / X - centered properly */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ padding: '22px' }}
        >
          <div className="relative w-full h-full">
            {/* Top line / X arm 1 */}
            <span 
              className="absolute left-0 right-0"
              style={{
                height: '4px',
                borderRadius: '2px',
                background: `linear-gradient(180deg, 
                  rgba(220, 225, 230, 1) 0%, 
                  rgba(180, 185, 195, 1) 30%,
                  rgba(140, 145, 155, 1) 50%,
                  rgba(170, 175, 185, 1) 70%,
                  rgba(200, 205, 215, 1) 100%
                )`,
                boxShadow: `
                  inset 0 1px 1px rgba(255, 255, 255, 0.9),
                  inset 0 -1px 1px rgba(0, 0, 0, 0.2),
                  0 1px 3px rgba(0, 0, 0, 0.3),
                  0 0 1px rgba(0, 0, 0, 0.2)
                `,
                top: isOpen ? '50%' : '15%',
                transform: isOpen 
                  ? 'translateY(-50%) rotate(45deg)' 
                  : 'translateY(0) rotate(0)',
                transformOrigin: 'center',
                transition: 'all 0.35s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
              }}
            />
            
            {/* Middle line */}
            <span 
              className="absolute left-0 right-0"
              style={{
                top: '50%',
                height: '4px',
                borderRadius: '2px',
                background: `linear-gradient(180deg, 
                  rgba(220, 225, 230, 1) 0%, 
                  rgba(180, 185, 195, 1) 30%,
                  rgba(140, 145, 155, 1) 50%,
                  rgba(170, 175, 185, 1) 70%,
                  rgba(200, 205, 215, 1) 100%
                )`,
                boxShadow: `
                  inset 0 1px 1px rgba(255, 255, 255, 0.9),
                  inset 0 -1px 1px rgba(0, 0, 0, 0.2),
                  0 1px 3px rgba(0, 0, 0, 0.3),
                  0 0 1px rgba(0, 0, 0, 0.2)
                `,
                transform: 'translateY(-50%)',
                opacity: isOpen ? 0 : 1,
                transition: 'opacity 0.2s ease',
              }}
            />
            
            {/* Bottom line / X arm 2 */}
            <span 
              className="absolute left-0 right-0"
              style={{
                height: '4px',
                borderRadius: '2px',
                background: `linear-gradient(180deg, 
                  rgba(220, 225, 230, 1) 0%, 
                  rgba(180, 185, 195, 1) 30%,
                  rgba(140, 145, 155, 1) 50%,
                  rgba(170, 175, 185, 1) 70%,
                  rgba(200, 205, 215, 1) 100%
                )`,
                boxShadow: `
                  inset 0 1px 1px rgba(255, 255, 255, 0.9),
                  inset 0 -1px 1px rgba(0, 0, 0, 0.2),
                  0 1px 3px rgba(0, 0, 0, 0.3),
                  0 0 1px rgba(0, 0, 0, 0.2)
                `,
                bottom: isOpen ? '50%' : '15%',
                transform: isOpen 
                  ? 'translateY(50%) rotate(-45deg)' 
                  : 'translateY(0) rotate(0)',
                transformOrigin: 'center',
                transition: 'all 0.35s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
              }}
            />
          </div>
        </div>

        {/* Hover pulse ring */}
        {isHovering && (
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              border: '2px solid rgba(255, 255, 255, 0.6)',
              animation: 'menuPulse 1.5s ease-out infinite',
            }}
          />
        )}
      </div>

      {/* Message Notification - fixed to left side of screen, aligned with hamburger menu */}
      <div
        ref={notificationRef}
        className="fixed flex items-center cursor-pointer"
        style={{
          top: '447px',
          left: '170px',
          transform: (showNotification || isExploding)
            ? 'translateX(0) scale(1)' 
            : 'translateX(-20px) scale(0.5)',
          opacity: (showNotification || isExploding) ? 1 : 0,
          // Disable ALL transitions if exploding or just exploded
          transition: (isExploding || wasExploded) ? 'none' : 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
          pointerEvents: showNotification && !isExploding ? 'auto' : 'none',
        }}
        onClick={() => {
          if (!showNotification || isExploding) return;
          
          // Stop voice if listening
          if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
          }
          
          // If there's text, send the message
          if (replyText.trim()) {
            handleSendMessage();
          } else {
            // No text - dismiss the notification with explosion
            playNotificationDismiss();
            setIsExploding(true);
            setWasExploded(true);
            setShowNotification(false);
            setIsReplying(false);
            setReplyText('');
            
            setTimeout(() => {
              setIsExploding(false);
            }, 600);
          }
        }}
      >
        {/* Liquid explosion particles */}
        {isExploding && (
          <>
            {[...Array(24)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: `${12 + Math.random() * 16}px`,
                  height: `${12 + Math.random() * 16}px`,
                  background: `linear-gradient(160deg, 
                    rgba(255, 255, 255, 0.95) 0%,
                    rgba(210, 215, 225, 0.9) 50%,
                    rgba(185, 190, 205, 0.85) 100%
                  )`,
                  boxShadow: `
                    inset 0 2px 4px rgba(255, 255, 255, 0.8),
                    0 4px 8px rgba(0, 0, 0, 0.2)
                  `,
                  left: '50%',
                  top: '50%',
                  animation: `liquidSplash${i % 8} 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
                }}
              />
            ))}
          </>
        )}

        {/* Jello wrapper - hidden immediately when exploding */}
        <div
          style={{
            animation: showNotification && !isExploding
                ? 'jelloWobble 0.8s ease 200ms' 
                : 'none',
            transform: hoveringNotification && !isExploding ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 0.2s ease',
            opacity: isExploding ? 0 : 1,
          }}
        >
          {/* Notification bubble */}
          <div
            className="relative px-5 py-3 rounded-2xl"
            style={{
              background: `
                linear-gradient(160deg, 
                  rgba(255, 255, 255, 0.98) 0%,
                  rgba(235, 238, 242, 0.95) 15%,
                  rgba(210, 215, 225, 0.9) 40%,
                  rgba(185, 190, 205, 0.92) 60%,
                  rgba(200, 205, 215, 0.95) 80%,
                  rgba(225, 230, 235, 0.98) 100%
                )
              `,
              boxShadow: `
                0 12px 40px rgba(0, 0, 0, 0.25),
                0 4px 16px rgba(0, 0, 0, 0.15),
                inset 0 2px 4px rgba(255, 255, 255, 1),
                inset 0 -2px 4px rgba(0, 0, 0, 0.08)
              `,
              border: '1.5px solid rgba(255, 255, 255, 0.7)',
              minWidth: '200px',
            }}
          >
            {/* Chrome rim overlay */}
            <div 
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                background: `
                  linear-gradient(145deg, 
                    rgba(255, 255, 255, 0.6) 0%, 
                    rgba(255, 255, 255, 0.15) 25%,
                    transparent 50%,
                    rgba(255, 255, 255, 0.1) 75%,
                    rgba(255, 255, 255, 0.3) 100%
                  )
                `,
              }}
            />
            
            {/* Top shine */}
            <div 
              className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
              style={{
                top: '2px',
                width: '70%',
                height: '30%',
                background: `
                  radial-gradient(ellipse at center top, 
                    rgba(255, 255, 255, 0.9) 0%, 
                    rgba(255, 255, 255, 0.4) 50%,
                    transparent 80%
                  )
                `,
              }}
            />

            {/* Message icon */}
            <div className="flex items-start gap-3">
              <div 
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
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
              
              {/* Message content */}
              <div className="flex flex-col">
                <span 
                  className="text-xs font-semibold"
                  style={{ color: 'rgba(80, 85, 95, 0.7)' }}
                >
                  New Message
                </span>
                <span 
                  className="text-sm font-medium"
                  style={{ 
                    color: 'rgba(50, 55, 65, 0.95)',
                    textShadow: '0 1px 0 rgba(255, 255, 255, 0.5)',
                  }}
                >
                  Let&apos;s meet for coffee at three?
                </span>
              </div>
            </div>

            {/* Reply UI */}
            <div
              style={{
                maxHeight: isReplying ? '120px' : '0px',
                opacity: isReplying ? 1 : 0,
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                marginTop: isReplying ? '12px' : '0px',
              }}
            >
              <div className="flex items-center gap-2">
                {/* Text input */}
                <div 
                  className="flex-1 relative"
                  style={{
                    background: 'rgba(255, 255, 255, 0.6)',
                    borderRadius: '20px',
                    border: '1px solid rgba(200, 205, 215, 0.5)',
                    boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <input
                    ref={replyInputRef}
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && replyText.trim()) {
                        handleSendMessage();
                      }
                    }}
                    placeholder={isListening ? 'Listening...' : 'Type or speak...'}
                    className="w-full px-4 py-2 bg-transparent outline-none text-sm"
                    style={{
                      color: 'rgba(50, 55, 65, 0.95)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Microphone button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVoiceInput();
                  }}
                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
                  style={{
                    background: isListening 
                      ? `linear-gradient(160deg, 
                          rgba(255, 255, 255, 0.35) 0%,
                          rgba(220, 225, 230, 0.25) 20%,
                          rgba(180, 190, 200, 0.2) 50%,
                          rgba(160, 170, 180, 0.25) 80%,
                          rgba(200, 210, 220, 0.35) 100%
                        )`
                      : 'linear-gradient(160deg, rgba(220, 225, 235, 0.95) 0%, rgba(190, 195, 210, 0.9) 100%)',
                    backdropFilter: isListening ? 'blur(12px)' : 'none',
                    WebkitBackdropFilter: isListening ? 'blur(12px)' : 'none',
                    boxShadow: isListening
                      ? `0 0 20px rgba(255, 255, 255, 0.5),
                         0 0 40px rgba(255, 255, 255, 0.25),
                         inset 0 1px 2px rgba(255, 255, 255, 0.6)`
                      : '0 2px 6px rgba(0, 0, 0, 0.15), inset 0 1px 2px rgba(255, 255, 255, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.6)',
                    transition: 'all 0.2s ease',
                    animation: isListening ? 'chromePulse 1.5s ease-in-out infinite' : 'none',
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke={isListening ? 'rgba(255, 255, 255, 0.95)' : 'rgba(80, 85, 95, 0.9)'} strokeWidth="2" className="w-4 h-4"
                    style={{
                      filter: isListening ? 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' : 'none',
                    }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                </button>

                {/* Send button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendMessage();
                  }}
                  disabled={!replyText.trim() || isSending}
                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
                  style={{
                    background: replyText.trim() && !isSending
                      ? 'linear-gradient(160deg, rgba(100, 180, 255, 0.95) 0%, rgba(60, 140, 220, 0.95) 100%)'
                      : 'linear-gradient(160deg, rgba(200, 205, 215, 0.6) 0%, rgba(180, 185, 195, 0.6) 100%)',
                    boxShadow: replyText.trim() && !isSending
                      ? '0 2px 8px rgba(60, 140, 220, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                      : '0 1px 3px rgba(0, 0, 0, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    transition: 'all 0.2s ease',
                    transform: isSending ? 'scale(0.95)' : 'scale(1)',
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke={replyText.trim() && !isSending ? 'white' : 'rgba(120, 125, 135, 0.6)'} strokeWidth="2" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                </button>
              </div>

              {/* Hint text */}
              <div 
                className="text-center mt-2"
                style={{
                  fontSize: '10px',
                  color: 'rgba(100, 105, 115, 0.7)',
                }}
              >
                {replyText.trim() ? 'Pinch to send' : 'Pinch to dismiss'}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes menuPulse {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        
        @keyframes chromePulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(255, 255, 255, 0.5), 0 0 40px rgba(255, 255, 255, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.6);
          }
          50% {
            box-shadow: 0 0 30px rgba(255, 255, 255, 0.7), 0 0 60px rgba(255, 255, 255, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.8);
          }
        }
        
        @keyframes jelloWobble {
          0% {
            transform: scale(1);
          }
          15% {
            transform: scale(1.15, 0.85);
          }
          30% {
            transform: scale(0.85, 1.15);
          }
          45% {
            transform: scale(1.1, 0.9);
          }
          60% {
            transform: scale(0.95, 1.05);
          }
          75% {
            transform: scale(1.03, 0.97);
          }
          100% {
            transform: scale(1);
          }
        }
        
        @keyframes liquidExplode {
          0% {
            transform: scale(1);
            opacity: 1;
            filter: blur(0px);
          }
          30% {
            transform: scale(1.3, 0.7);
            opacity: 0.9;
          }
          50% {
            transform: scale(0.8, 1.4);
            opacity: 0.7;
            filter: blur(2px);
          }
          70% {
            transform: scale(1.5);
            opacity: 0.4;
            filter: blur(4px);
          }
          100% {
            transform: scale(2);
            opacity: 0;
            filter: blur(8px);
          }
        }
        
        @keyframes liquidSplash0 {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% + 80px), calc(-50% - 60px)) scale(1.2);
            opacity: 0;
          }
        }
        
        @keyframes liquidSplash1 {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% - 70px), calc(-50% - 50px)) scale(1);
            opacity: 0;
          }
        }
        
        @keyframes liquidSplash2 {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% + 60px), calc(-50% + 70px)) scale(1.1);
            opacity: 0;
          }
        }
        
        @keyframes liquidSplash3 {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% - 80px), calc(-50% + 55px)) scale(0.9);
            opacity: 0;
          }
        }
        
        @keyframes liquidSplash4 {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% + 100px), calc(-50% + 20px)) scale(1.3);
            opacity: 0;
          }
        }
        
        @keyframes liquidSplash5 {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% - 90px), calc(-50% - 30px)) scale(0.8);
            opacity: 0;
          }
        }
        
        @keyframes liquidSplash6 {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% + 40px), calc(-50% - 90px)) scale(1.1);
            opacity: 0;
          }
        }
        
        @keyframes liquidSplash7 {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% - 50px), calc(-50% + 85px)) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

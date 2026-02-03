'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { HAND_LANDMARKS, HandLandmark, GestureState, TwoHandGestureState } from '@/types/hand-tracking';

// Pinch threshold - distance between thumb and index finger tips to consider as "grabbing"
// Tighter threshold = requires more deliberate pinch to grab
const PINCH_THRESHOLD = 0.055;
// Higher release threshold = requires more finger separation to release (prevents accidental drops)
const PINCH_RELEASE_THRESHOLD = 0.16;
// Minimum frames to confirm a state change (debouncing)
const STATE_CHANGE_FRAMES = 2;
// Smoothing factor for hand position (0-1, higher = more responsive, lower = smoother)
const POSITION_SMOOTHING = 0.4;
// Smoothing factor for pinch distance
const PINCH_SMOOTHING = 0.5;
// Minimum pull distance to consider as a valid pull gesture (normalized)
const MIN_PULL_DISTANCE = 0.15;

interface UseHandTrackingOptions {
  onGestureUpdate?: (gesture: GestureState) => void;
  onTwoHandGestureUpdate?: (gesture: TwoHandGestureState) => void;
}

interface UseHandTrackingReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  gesture: GestureState;
  twoHandGesture: TwoHandGestureState;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
}

export function useHandTracking(options: UseHandTrackingOptions = {}): UseHandTrackingReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gesture, setGesture] = useState<GestureState>({
    isGrabbing: false,
    handPosition: null,
    pinchDistance: 1,
    confidence: 0,
  });
  const [twoHandGesture, setTwoHandGesture] = useState<TwoHandGestureState>({
    bothPinching: false,
    pullDistance: 0,
    centerPosition: null,
    leftHand: null,
    rightHand: null,
    isPulling: false,
  });

  const wasGrabbingRef = useRef(false);
  const stateChangeCounterRef = useRef(0);
  const pendingStateRef = useRef<boolean | null>(null);
  
  // Two-hand tracking refs
  const wasGrabbingRefsPerHand = useRef<{ [key: number]: boolean }>({});
  const stateChangeCountersPerHand = useRef<{ [key: number]: number }>({});
  const pendingStatesPerHand = useRef<{ [key: number]: boolean | null }>({});
  const smoothedPositionsPerHand = useRef<{ [key: number]: { x: number; y: number; z: number } | null }>({});
  const smoothedPinchesPerHand = useRef<{ [key: number]: number }>({});
  const prevPullDistanceRef = useRef<number>(0);
  
  // Smoothed values for fluid movement
  const smoothedPositionRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const smoothedPinchRef = useRef<number>(1);

  const calculatePinchDistance = useCallback((landmarks: HandLandmark[]): number => {
    const thumbTip = landmarks[HAND_LANDMARKS.THUMB_TIP];
    const indexTip = landmarks[HAND_LANDMARKS.INDEX_TIP];
    
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const dz = thumbTip.z - indexTip.z;
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, []);

  const calculateHandCenter = useCallback((landmarks: HandLandmark[]): { x: number; y: number; z: number } => {
    // Use the midpoint between thumb tip and index tip as the grab point
    const thumbTip = landmarks[HAND_LANDMARKS.THUMB_TIP];
    const indexTip = landmarks[HAND_LANDMARKS.INDEX_TIP];
    
    return {
      x: (thumbTip.x + indexTip.x) / 2,
      y: (thumbTip.y + indexTip.y) / 2,
      z: (thumbTip.z + indexTip.z) / 2,
    };
  }, []);

  const processLandmarks = useCallback((landmarks: HandLandmark[]) => {
    const rawPinchDistance = calculatePinchDistance(landmarks);
    const rawHandPosition = calculateHandCenter(landmarks);
    
    // Convert raw position to centered coordinates
    const rawX = -(rawHandPosition.x * 2 - 1);
    const rawY = -(rawHandPosition.y * 2 - 1);
    const rawZ = rawHandPosition.z;
    
    // Apply exponential smoothing to position
    if (smoothedPositionRef.current === null) {
      smoothedPositionRef.current = { x: rawX, y: rawY, z: rawZ };
    } else {
      smoothedPositionRef.current = {
        x: smoothedPositionRef.current.x + POSITION_SMOOTHING * (rawX - smoothedPositionRef.current.x),
        y: smoothedPositionRef.current.y + POSITION_SMOOTHING * (rawY - smoothedPositionRef.current.y),
        z: smoothedPositionRef.current.z + POSITION_SMOOTHING * (rawZ - smoothedPositionRef.current.z),
      };
    }
    
    // Apply smoothing to pinch distance
    smoothedPinchRef.current = smoothedPinchRef.current + PINCH_SMOOTHING * (rawPinchDistance - smoothedPinchRef.current);
    const pinchDistance = smoothedPinchRef.current;
    
    // Determine what the new state should be based on thresholds
    let targetState = wasGrabbingRef.current;
    
    if (!wasGrabbingRef.current && pinchDistance < PINCH_THRESHOLD) {
      targetState = true;
    } else if (wasGrabbingRef.current && pinchDistance > PINCH_RELEASE_THRESHOLD) {
      targetState = false;
    }
    
    // Debouncing: require multiple consecutive frames to confirm state change
    if (targetState !== wasGrabbingRef.current) {
      if (pendingStateRef.current === targetState) {
        stateChangeCounterRef.current++;
        if (stateChangeCounterRef.current >= STATE_CHANGE_FRAMES) {
          wasGrabbingRef.current = targetState;
          pendingStateRef.current = null;
          stateChangeCounterRef.current = 0;
        }
      } else {
        pendingStateRef.current = targetState;
        stateChangeCounterRef.current = 1;
      }
    } else {
      // State matches, reset pending
      pendingStateRef.current = null;
      stateChangeCounterRef.current = 0;
    }

    const newGesture: GestureState = {
      isGrabbing: wasGrabbingRef.current,
      handPosition: smoothedPositionRef.current,
      pinchDistance,
      confidence: 1,
    };

    setGesture(newGesture);
    options.onGestureUpdate?.(newGesture);
  }, [calculatePinchDistance, calculateHandCenter, options]);

  // Process landmarks for a specific hand (for multi-hand tracking)
  const processHandLandmarks = useCallback((landmarks: HandLandmark[], handIndex: number): GestureState => {
    const rawPinchDistance = calculatePinchDistance(landmarks);
    const rawHandPosition = calculateHandCenter(landmarks);
    
    // Convert raw position to centered coordinates
    const rawX = -(rawHandPosition.x * 2 - 1);
    const rawY = -(rawHandPosition.y * 2 - 1);
    const rawZ = rawHandPosition.z;
    
    // Initialize refs for this hand if needed
    if (smoothedPositionsPerHand.current[handIndex] === undefined) {
      smoothedPositionsPerHand.current[handIndex] = null;
    }
    if (smoothedPinchesPerHand.current[handIndex] === undefined) {
      smoothedPinchesPerHand.current[handIndex] = 1;
    }
    if (wasGrabbingRefsPerHand.current[handIndex] === undefined) {
      wasGrabbingRefsPerHand.current[handIndex] = false;
    }
    if (stateChangeCountersPerHand.current[handIndex] === undefined) {
      stateChangeCountersPerHand.current[handIndex] = 0;
    }
    if (pendingStatesPerHand.current[handIndex] === undefined) {
      pendingStatesPerHand.current[handIndex] = null;
    }
    
    // Apply exponential smoothing to position
    if (smoothedPositionsPerHand.current[handIndex] === null) {
      smoothedPositionsPerHand.current[handIndex] = { x: rawX, y: rawY, z: rawZ };
    } else {
      const prev = smoothedPositionsPerHand.current[handIndex]!;
      smoothedPositionsPerHand.current[handIndex] = {
        x: prev.x + POSITION_SMOOTHING * (rawX - prev.x),
        y: prev.y + POSITION_SMOOTHING * (rawY - prev.y),
        z: prev.z + POSITION_SMOOTHING * (rawZ - prev.z),
      };
    }
    
    // Apply smoothing to pinch distance
    smoothedPinchesPerHand.current[handIndex] = 
      smoothedPinchesPerHand.current[handIndex] + PINCH_SMOOTHING * (rawPinchDistance - smoothedPinchesPerHand.current[handIndex]);
    const pinchDistance = smoothedPinchesPerHand.current[handIndex];
    
    // Determine what the new state should be based on thresholds
    let targetState = wasGrabbingRefsPerHand.current[handIndex];
    
    if (!wasGrabbingRefsPerHand.current[handIndex] && pinchDistance < PINCH_THRESHOLD) {
      targetState = true;
    } else if (wasGrabbingRefsPerHand.current[handIndex] && pinchDistance > PINCH_RELEASE_THRESHOLD) {
      targetState = false;
    }
    
    // Debouncing
    if (targetState !== wasGrabbingRefsPerHand.current[handIndex]) {
      if (pendingStatesPerHand.current[handIndex] === targetState) {
        stateChangeCountersPerHand.current[handIndex]++;
        if (stateChangeCountersPerHand.current[handIndex] >= STATE_CHANGE_FRAMES) {
          wasGrabbingRefsPerHand.current[handIndex] = targetState;
          pendingStatesPerHand.current[handIndex] = null;
          stateChangeCountersPerHand.current[handIndex] = 0;
        }
      } else {
        pendingStatesPerHand.current[handIndex] = targetState;
        stateChangeCountersPerHand.current[handIndex] = 1;
      }
    } else {
      pendingStatesPerHand.current[handIndex] = null;
      stateChangeCountersPerHand.current[handIndex] = 0;
    }

    return {
      isGrabbing: wasGrabbingRefsPerHand.current[handIndex],
      handPosition: smoothedPositionsPerHand.current[handIndex],
      pinchDistance,
      confidence: 1,
    };
  }, [calculatePinchDistance, calculateHandCenter]);

  // Process two-hand gesture
  const processTwoHandGesture = useCallback((
    hand0: GestureState | null, 
    hand1: GestureState | null,
    handedness0?: string,
    handedness1?: string
  ) => {
    // Determine which hand is left/right based on handedness
    let leftHand: GestureState | null = null;
    let rightHand: GestureState | null = null;
    
    if (hand0 && handedness0 === 'Left') {
      leftHand = hand0;
    } else if (hand0 && handedness0 === 'Right') {
      rightHand = hand0;
    } else if (hand0) {
      // Fallback: use x position to determine left/right
      if (hand0.handPosition && (!hand1?.handPosition || hand0.handPosition.x < hand1.handPosition.x)) {
        leftHand = hand0;
      } else {
        rightHand = hand0;
      }
    }
    
    if (hand1 && handedness1 === 'Left') {
      leftHand = hand1;
    } else if (hand1 && handedness1 === 'Right') {
      rightHand = hand1;
    } else if (hand1) {
      if (!leftHand) {
        leftHand = hand1;
      } else {
        rightHand = hand1;
      }
    }
    
    const bothPinching = !!(leftHand?.isGrabbing && rightHand?.isGrabbing);
    
    let pullDistance = 0;
    let centerPosition: { x: number; y: number } | null = null;
    
    if (leftHand?.handPosition && rightHand?.handPosition) {
      // Calculate distance between hands (in normalized coordinates)
      const dx = rightHand.handPosition.x - leftHand.handPosition.x;
      const dy = rightHand.handPosition.y - leftHand.handPosition.y;
      pullDistance = Math.sqrt(dx * dx + dy * dy);
      
      // Calculate center point
      centerPosition = {
        x: (leftHand.handPosition.x + rightHand.handPosition.x) / 2,
        y: (leftHand.handPosition.y + rightHand.handPosition.y) / 2,
      };
    }
    
    // Determine if this is a valid pull gesture
    // Both hands pinching AND distance above threshold
    const isPulling = bothPinching && pullDistance > MIN_PULL_DISTANCE;
    
    const newTwoHandGesture: TwoHandGestureState = {
      bothPinching,
      pullDistance,
      centerPosition,
      leftHand,
      rightHand,
      isPulling,
    };
    
    prevPullDistanceRef.current = pullDistance;
    setTwoHandGesture(newTwoHandGesture);
    options.onTwoHandGestureUpdate?.(newTwoHandGesture);
    
    return newTwoHandGesture;
  }, [options]);

  const drawLandmarks = useCallback((
    ctx: CanvasRenderingContext2D,
    landmarks: HandLandmark[],
    isGrabbing: boolean
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw connections
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [0, 9], [9, 10], [10, 11], [11, 12], // Middle
      [0, 13], [13, 14], [14, 15], [15, 16], // Ring
      [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [5, 9], [9, 13], [13, 17], // Palm
    ];

    ctx.strokeStyle = isGrabbing ? '#22c55e' : '#3b82f6';
    ctx.lineWidth = 2;
    
    for (const [start, end] of connections) {
      const startLandmark = landmarks[start];
      const endLandmark = landmarks[end];
      
      ctx.beginPath();
      ctx.moveTo(startLandmark.x * canvas.width, startLandmark.y * canvas.height);
      ctx.lineTo(endLandmark.x * canvas.width, endLandmark.y * canvas.height);
      ctx.stroke();
    }

    // Draw landmarks
    for (let i = 0; i < landmarks.length; i++) {
      const landmark = landmarks[i];
      const x = landmark.x * canvas.width;
      const y = landmark.y * canvas.height;
      
      // Highlight thumb and index tips
      const isKeyPoint = i === HAND_LANDMARKS.THUMB_TIP || i === HAND_LANDMARKS.INDEX_TIP;
      
      ctx.beginPath();
      ctx.arc(x, y, isKeyPoint ? 8 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isKeyPoint 
        ? (isGrabbing ? '#22c55e' : '#f59e0b')
        : (isGrabbing ? '#86efac' : '#93c5fd');
      ctx.fill();
      
      if (isKeyPoint) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw pinch indicator line
    const thumbTip = landmarks[HAND_LANDMARKS.THUMB_TIP];
    const indexTip = landmarks[HAND_LANDMARKS.INDEX_TIP];
    
    ctx.beginPath();
    ctx.moveTo(thumbTip.x * canvas.width, thumbTip.y * canvas.height);
    ctx.lineTo(indexTip.x * canvas.width, indexTip.y * canvas.height);
    ctx.strokeStyle = isGrabbing ? '#22c55e' : '#f59e0b';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  const onResults = useCallback((results: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      // Process first hand for backward compatibility (single hand gesture)
      const landmarks = results.multiHandLandmarks[0] as HandLandmark[];
      processLandmarks(landmarks);
      drawLandmarks(ctx, landmarks, wasGrabbingRef.current);
      
      // Process all hands for two-hand gesture
      const handGestures: (GestureState | null)[] = [];
      const handednessLabels: (string | undefined)[] = [];
      
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const handLandmarks = results.multiHandLandmarks[i] as HandLandmark[];
        const handGesture = processHandLandmarks(handLandmarks, i);
        handGestures.push(handGesture);
        
        // Get handedness if available
        const handedness = results.multiHandedness?.[i]?.label;
        handednessLabels.push(handedness);
        
        // Draw additional hands
        if (i > 0) {
          drawLandmarks(ctx, handLandmarks, handGesture.isGrabbing);
        }
      }
      
      // Process two-hand gesture
      processTwoHandGesture(
        handGestures[0] || null,
        handGestures[1] || null,
        handednessLabels[0],
        handednessLabels[1]
      );
    } else {
      setGesture({
        isGrabbing: false,
        handPosition: null,
        pinchDistance: 1,
        confidence: 0,
      });
      wasGrabbingRef.current = false;
      
      // Reset two-hand gesture
      setTwoHandGesture({
        bothPinching: false,
        pullDistance: 0,
        centerPosition: null,
        leftHand: null,
        rightHand: null,
        isPulling: false,
      });
      
      // Reset per-hand refs
      wasGrabbingRefsPerHand.current = {};
      stateChangeCountersPerHand.current = {};
      pendingStatesPerHand.current = {};
      smoothedPositionsPerHand.current = {};
      smoothedPinchesPerHand.current = {};
    }
  }, [processLandmarks, processHandLandmarks, processTwoHandGesture, drawLandmarks]);

  const startTracking = useCallback(async () => {
    if (isLoading || isReady) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Dynamically import MediaPipe to avoid SSR issues
      const { Hands } = await import('@mediapipe/hands');
      const { Camera } = await import('@mediapipe/camera_utils');

      const video = videoRef.current;
      if (!video) {
        throw new Error('Video element not found');
      }

      // Initialize MediaPipe Hands
      const hands = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        },
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      });

      hands.onResults(onResults);
      handsRef.current = hands;

      // Start camera
      const camera = new Camera(video, {
        onFrame: async () => {
          if (handsRef.current && videoRef.current) {
            await handsRef.current.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });

      await camera.start();
      cameraRef.current = camera;
      
      setIsReady(true);
    } catch (err) {
      console.error('Error starting hand tracking:', err);
      setError(err instanceof Error ? err.message : 'Failed to start hand tracking');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isReady, onResults]);

  const stopTracking = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    
    if (handsRef.current) {
      handsRef.current.close();
      handsRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setIsReady(false);
    setGesture({
      isGrabbing: false,
      handPosition: null,
      pinchDistance: 1,
      confidence: 0,
    });
    setTwoHandGesture({
      bothPinching: false,
      pullDistance: 0,
      centerPosition: null,
      leftHand: null,
      rightHand: null,
      isPulling: false,
    });
    wasGrabbingRef.current = false;
    wasGrabbingRefsPerHand.current = {};
    stateChangeCountersPerHand.current = {};
    pendingStatesPerHand.current = {};
    smoothedPositionsPerHand.current = {};
    smoothedPinchesPerHand.current = {};
  }, []);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    videoRef,
    canvasRef,
    isReady,
    isLoading,
    error,
    gesture,
    twoHandGesture,
    startTracking,
    stopTracking,
  };
}


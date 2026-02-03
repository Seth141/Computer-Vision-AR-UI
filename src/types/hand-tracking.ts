// MediaPipe Hand Landmark indices
export const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandData {
  landmarks: HandLandmark[];
  handedness: 'Left' | 'Right';
}

export interface GestureState {
  isGrabbing: boolean;
  handPosition: { x: number; y: number; z: number } | null;
  pinchDistance: number;
  confidence: number;
}

export interface TrackedHand {
  gesture: GestureState;
  rawLandmarks: HandLandmark[];
}

// Two-hand gesture state for bimanual interactions
export interface TwoHandGestureState {
  // Both hands detected and both pinching
  bothPinching: boolean;
  // Distance between the two pinch points (normalized 0-1, where 1 is full screen width)
  pullDistance: number;
  // Center point between both hands (for positioning)
  centerPosition: { x: number; y: number } | null;
  // Individual hand data
  leftHand: GestureState | null;
  rightHand: GestureState | null;
  // Is this a valid "pull" gesture (both pinching and hands moving apart)
  isPulling: boolean;
}


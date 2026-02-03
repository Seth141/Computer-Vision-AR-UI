'use client';

import { useState, useCallback, useEffect } from 'react';
import { useHandTracking } from '@/hooks/useHandTracking';
import Scene3D from '@/components/Scene3D';
import HamburgerMenu from '@/components/HamburgerMenu';
import MessageWindow from '@/components/MessageWindow';
import { GestureState, TwoHandGestureState } from '@/types/hand-tracking';

export default function Home() {
  const [latestGesture, setLatestGesture] = useState<GestureState>({
    isGrabbing: false,
    handPosition: null,
    pinchDistance: 1,
    confidence: 0,
  });
  
  const [latestTwoHandGesture, setLatestTwoHandGesture] = useState<TwoHandGestureState>({
    bothPinching: false,
    pullDistance: 0,
    centerPosition: null,
    leftHand: null,
    rightHand: null,
    isPulling: false,
  });
  
  const [isMessageWindowVisible, setIsMessageWindowVisible] = useState(false);

  const handleGestureUpdate = useCallback((gesture: GestureState) => {
    setLatestGesture(gesture);
  }, []);

  const handleTwoHandGestureUpdate = useCallback((gesture: TwoHandGestureState) => {
    setLatestTwoHandGesture(gesture);
  }, []);
  
  const handleWindowVisibilityChange = useCallback((isVisible: boolean) => {
    setIsMessageWindowVisible(isVisible);
  }, []);

  const {
    videoRef,
    canvasRef,
    isLoading,
    error,
    startTracking,
  } = useHandTracking({
    onGestureUpdate: handleGestureUpdate,
    onTwoHandGestureUpdate: handleTwoHandGestureUpdate,
  });

  // Auto-start tracking on mount
  useEffect(() => {
    startTracking();
  }, [startTracking]);

  return (
    <main className="h-screen w-screen overflow-hidden bg-black">
      {/* Hidden video and canvas for hand tracking processing - positioned off-screen */}
      <div className="absolute -left-[9999px] -top-[9999px] w-px h-px overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          width={640}
          height={480}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
        />
      </div>
      
      {/* Full screen 3D scene */}
      <Scene3D gesture={latestGesture} twoHandGesture={latestTwoHandGesture} isMessageWindowVisible={isMessageWindowVisible} />

      {/* Hamburger menu overlay */}
      <HamburgerMenu gesture={latestGesture} />

      {/* Message window - opens with two-hand pinch and pull */}
      <MessageWindow twoHandGesture={latestTwoHandGesture} onVisibilityChange={handleWindowVisibilityChange} />

      {/* Minimal loading indicator */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-500/30 rounded-full" />
              <div className="absolute inset-0 w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <span className="text-white/80 font-medium">Initializing hand tracking...</span>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-xl px-6 py-3">
            <p className="text-red-400 text-sm">
              <strong>Error:</strong> {error}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

'use client';

import { useEffect } from 'react';

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  isLoading: boolean;
}

export default function CameraFeed({ 
  videoRef, 
  canvasRef, 
  isReady,
  isLoading 
}: CameraFeedProps) {
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas) {
      // Ensure canvas matches video dimensions
      const updateCanvasSize = () => {
        if (video.videoWidth && video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
      };
      
      video.addEventListener('loadedmetadata', updateCanvasSize);
      return () => video.removeEventListener('loadedmetadata', updateCanvasSize);
    }
  }, [videoRef, canvasRef]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl bg-black/50 backdrop-blur-sm border border-white/10">
      {/* Video element (hidden, used for processing) */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
        playsInline
        muted
      />
      
      {/* Canvas overlay for hand visualization */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
        width={640}
        height={480}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-indigo-500/30 rounded-full" />
              <div className="absolute inset-0 w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <span className="text-white/80 font-medium">Loading hand tracking...</span>
          </div>
        </div>
      )}
      
      {/* Status indicator */}
      {isReady && (
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/50">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-green-400 text-sm font-medium">Tracking Active</span>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3 border border-white/10">
          <p className="text-white/70 text-sm text-center">
            <span className="text-amber-400">👆 Index</span> + <span className="text-amber-400">👍 Thumb</span> = Pinch to grab
          </p>
        </div>
      </div>
    </div>
  );
}


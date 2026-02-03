import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile MediaPipe packages for proper ESM support
  transpilePackages: [
    "@mediapipe/hands",
    "@mediapipe/camera_utils", 
    "@mediapipe/drawing_utils",
  ],
};

export default nextConfig;

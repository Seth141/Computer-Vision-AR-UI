'use client';

import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { GestureState, TwoHandGestureState } from '@/types/hand-tracking';

interface InteractiveSphereProps {
  gesture: GestureState;
  twoHandGesture: TwoHandGestureState;
  positionRef: React.RefObject<THREE.Vector3>;
  isMessageWindowVisible: boolean;
}

// Depth scaling factor - adjusts how much hand Z movement affects sphere depth
const DEPTH_SCALE = 50;
// Depth range limits to keep sphere visible
const MIN_DEPTH = -8;
const MAX_DEPTH = 4;

function InteractiveSphere({ gesture, twoHandGesture, positionRef, isMessageWindowVisible }: InteractiveSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const splitMeshRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null]);
  const { viewport } = useThree();
  
  const [position, setPosition] = useState<[number, number, number]>([0, 0, 0]);
  const [isHeld, setIsHeld] = useState(false);
  const [grabOffset, setGrabOffset] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  
  // Smoothed position for fluid movement
  const smoothPositionRef = useRef(new THREE.Vector3(0, 0, 0));
  
  // Split sphere positions (smoothed)
  const splitPositionsRef = useRef<THREE.Vector3[]>([
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()
  ]);
  const splitScaleRef = useRef(0);
  const mainOpacityRef = useRef(1);
  const splitRotationsRef = useRef<THREE.Euler[]>([
    new THREE.Euler(), new THREE.Euler(), new THREE.Euler(), new THREE.Euler()
  ]);
  const maxPullDistanceRef = useRef(0); // Track max pull to match window (only grows)
  const wasPullingRef = useRef(false);
  
  // Track previous grab state
  const wasGrabbingRef = useRef(false);

  useEffect(() => {
    if (!gesture.handPosition) return;

    // Convert normalized hand position to 3D world coordinates
    const handX = gesture.handPosition.x * (viewport.width / 2) * 1.2;
    const handY = gesture.handPosition.y * (viewport.height / 2) * 1.2;
    // MediaPipe Z is negative when closer to camera
    // Closer hand = more negative Z in scene (deeper into screen)
    const handZ = Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, gesture.handPosition.z * DEPTH_SCALE));

    // Check if hand is near the sphere (for grab initiation)
    const spherePos = smoothPositionRef.current;
    const distance = Math.sqrt(
      Math.pow(handX - spherePos.x, 2) + 
      Math.pow(handY - spherePos.y, 2)
    );

    const grabRadius = 0.8; // Distance threshold for grabbing

    if (gesture.isGrabbing && !wasGrabbingRef.current) {
      // Just started grabbing
      if (distance < grabRadius) {
        setIsHeld(true);
        setGrabOffset({
          x: spherePos.x - handX,
          y: spherePos.y - handY,
          z: spherePos.z - handZ,
        });
      }
    } else if (!gesture.isGrabbing && wasGrabbingRef.current) {
      // Just released
      if (isHeld) {
        setIsHeld(false);
      }
    }

    wasGrabbingRef.current = gesture.isGrabbing;

    // Update position if held
    if (isHeld && gesture.isGrabbing) {
      const newZ = Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, handZ + grabOffset.z));
      setPosition([
        handX + grabOffset.x,
        handY + grabOffset.y,
        newZ,
      ]);
    }
  }, [gesture, viewport, isHeld, grabOffset]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Check if we're in split mode (two-hand pull gesture or window visible)
    const isSplitting = twoHandGesture.isPulling;
    // Sphere should be hidden whenever the message window is visible
    const shouldHideSphere = isMessageWindowVisible || isSplitting;
    
    // Smooth position interpolation with adaptive speed
    // Faster when held for responsive control, slightly slower when idle
    const lerpSpeed = isHeld ? 18 : 10;
    const targetPos = new THREE.Vector3(...position);
    smoothPositionRef.current.lerp(targetPos, Math.min(delta * lerpSpeed, 1));
    
    meshRef.current.position.copy(smoothPositionRef.current);
    
    // Update the shared position ref for other components
    positionRef.current.copy(smoothPositionRef.current);

    // Calculate target visibility based on window visibility
    const targetMainOpacity = shouldHideSphere ? 0 : 1;
    const targetSplitScale = isSplitting ? 1 : 0;
    
    // Instant hide, smooth show
    if (shouldHideSphere) {
      mainOpacityRef.current = 0; // Instant disappear
    } else {
      mainOpacityRef.current += (targetMainOpacity - mainOpacityRef.current) * Math.min(delta * 10, 1);
    }
    splitScaleRef.current += (targetSplitScale - splitScaleRef.current) * Math.min(delta * 8, 1);
    
    // Hide/show main sphere based on split state
    const mainScale = isHeld ? 1.15 : 1;
    meshRef.current.scale.setScalar(mainScale * mainOpacityRef.current);
    meshRef.current.visible = mainOpacityRef.current > 0.01;

    // Smooth rotation
    meshRef.current.rotation.y += delta * (isHeld ? 1.5 : 0.3);
    meshRef.current.rotation.x += delta * (isHeld ? 0.8 : 0.15);
    
    // Track pull gesture state to reset max on new gesture
    const justStartedPulling = isSplitting && !wasPullingRef.current;
    wasPullingRef.current = isSplitting;
    
    if (justStartedPulling) {
      maxPullDistanceRef.current = 0; // Reset max pull for new gesture
    }
    
    // Reset max pull when window is no longer visible (ensures clean state)
    if (!isMessageWindowVisible && !isSplitting) {
      maxPullDistanceRef.current = 0;
    }
    
    // Track max pull distance - window only grows, never shrinks
    if (isSplitting) {
      maxPullDistanceRef.current = Math.max(maxPullDistanceRef.current, twoHandGesture.pullDistance);
    }
    
    // Calculate corner positions for split spheres based on max pull distance
    // Map max pull distance to window size (same as MessageWindow - only grows)
    // MUST MATCH MessageWindow.tsx PULL_SCALE values: min=0.15, max=0.5
    const pullNormalized = Math.min(1, Math.max(0, 
      (maxPullDistanceRef.current - 0.15) / (0.5 - 0.15)
    ));
    
    // Window dimensions in viewport units
    // MUST MATCH MessageWindow.tsx values exactly:
    // - bottom: 400px
    // - width: 320-720px
    // - height: 200-480px
    const WINDOW_BOTTOM_PX = 400;
    const windowWidthPx = 320 + (720 - 320) * pullNormalized;
    const windowHeightPx = 200 + (480 - 200) * pullNormalized;
    
    // Camera Z position (from AdaptiveCamera)
    const aspectRatio = window.innerWidth / window.innerHeight;
    const cameraZ = aspectRatio > 1 ? 7 : 6;
    
    // Place pieces at Z=0 to avoid perspective distortion
    // (viewport dimensions are calculated at Z=0)
    const windowZ = 0.1; // Just slightly in front of Z=0
    
    // Convert pixel dimensions to Three.js viewport units
    const windowWidth = (windowWidthPx / window.innerWidth) * viewport.width;
    const windowHeight = (windowHeightPx / window.innerHeight) * viewport.height;
    
    // Convert window position from CSS to Three.js coordinates
    // CSS bottom: 400px means bottom edge is 400px from screen bottom
    // In normalized screen coords (0 at bottom, 1 at top): bottomEdge = 400 / screenHeight
    // In Three.js Y coords: -viewport.height/2 is bottom, +viewport.height/2 is top
    const normalizedBottomY = WINDOW_BOTTOM_PX / window.innerHeight; // 0 to 1 from bottom
    const bottomEdgeY = -viewport.height / 2 + normalizedBottomY * viewport.height;
    const windowCenterY = bottomEdgeY + windowHeight / 2;
    const windowCenterX = 0;
    
    // Corner offsets - position pieces slightly inside corners so points are hidden behind window
    const halfW = windowWidth / 2 * 0.65;
    const halfH = windowHeight / 2 * 0.65;
    
    // Target positions for 4 corners: TL, TR, BL, BR
    const cornerTargets = [
      new THREE.Vector3(windowCenterX - halfW, windowCenterY + halfH, windowZ), // Top-left
      new THREE.Vector3(windowCenterX + halfW, windowCenterY + halfH, windowZ), // Top-right
      new THREE.Vector3(windowCenterX - halfW, windowCenterY - halfH, windowZ), // Bottom-left
      new THREE.Vector3(windowCenterX + halfW, windowCenterY - halfH, windowZ), // Bottom-right
    ];
    
    // Smoothly interpolate split piece positions
    // Each piece rotates so its "point" faces toward its corner
    // Geometry has point at 0° (right), so we rotate to face each corner direction
    const cornerZRotations = [
      Math.PI * 3 / 4,   // Top-left: 135°
      Math.PI / 4,       // Top-right: 45°
      -Math.PI * 3 / 4,  // Bottom-left: -135° (225°)
      -Math.PI / 4,      // Bottom-right: -45° (315°)
    ];
    
    for (let i = 0; i < 4; i++) {
      // When not splitting, pieces should be at the main sphere's position
      const targetPosition = isSplitting 
        ? cornerTargets[i] 
        : smoothPositionRef.current.clone();
      
      // If pieces are not visible yet, snap them to sphere position
      if (splitScaleRef.current < 0.1 && !isSplitting) {
        splitPositionsRef.current[i].copy(smoothPositionRef.current);
        splitRotationsRef.current[i].z = cornerZRotations[i]; // Pre-set rotation
      } else {
        splitPositionsRef.current[i].lerp(targetPosition, Math.min(delta * 12, 1));
      }
      
      // Update split mesh - rotation stays fixed to face corner
      const splitMesh = splitMeshRefs.current[i];
      if (splitMesh) {
        splitMesh.position.copy(splitPositionsRef.current[i]);
        splitMesh.scale.setScalar(splitScaleRef.current * 0.4); // 0.4 matches main sphere radius
        splitMesh.rotation.z = cornerZRotations[i]; // Fixed rotation facing corner
        splitMesh.visible = splitScaleRef.current > 0.05;
      }
    }
  });

  const isSplitting = twoHandGesture.isPulling;
  
  return (
    <>
      {/* Main sphere */}
      <Float
        speed={isHeld || isSplitting ? 0 : 2}
        rotationIntensity={isHeld || isSplitting ? 0 : 0.5}
        floatIntensity={isHeld || isSplitting ? 0 : 0.5}
      >
        <mesh ref={meshRef} castShadow receiveShadow>
          <sphereGeometry args={[0.4, 64, 64]} />
          <MeshDistortMaterial
            color="#ffffff"
            roughness={0.1}
            metalness={0.9}
            distort={isSplitting ? 0.6 : (isHeld ? 0.4 : 0.2)}
            speed={isSplitting ? 6 : (isHeld ? 4 : 2)}
            envMapIntensity={0.8}
          />
        </mesh>
      </Float>
      
      {/* Split pieces - 4 flat 2D pie slices, chrome material to match sphere */}
      {[0, 1, 2, 3].map((i) => (
        <mesh 
          key={i}
          ref={(el) => { splitMeshRefs.current[i] = el; }}
          castShadow 
          receiveShadow
          visible={false}
        >
          {/* Quarter circle - all identical, rotation applied in useFrame */}
          <circleGeometry args={[
            1,              // radius (scaled in useFrame)
            32,             // segments
            -Math.PI / 4,   // thetaStart: center the slice so "point" is at 0°
            Math.PI / 2     // thetaLength: 90 degrees
          ]} />
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.1}
            metalness={0.9}
            envMapIntensity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}

interface HandCursorProps {
  gesture: GestureState;
  twoHandGesture: TwoHandGestureState;
  spherePositionRef: React.RefObject<THREE.Vector3>;
}

function HandCursor({ gesture, twoHandGesture, spherePositionRef }: HandCursorProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();
  const smoothPosRef = useRef(new THREE.Vector3(0, 0, 0));
  const smoothScaleRef = useRef(0.06); // Smaller cursor for precision
  const smoothOpacityRef = useRef(0.5);

  useFrame((_, delta) => {
    if (!meshRef.current || !gesture.handPosition) {
      if (meshRef.current) {
        meshRef.current.visible = false;
      }
      return;
    }

    // Hide cursor when message window is open (two-hand pull gesture)
    if (twoHandGesture.isPulling) {
      meshRef.current.visible = false;
      smoothOpacityRef.current = 0;
      return;
    }

    const targetX = gesture.handPosition.x * (viewport.width / 2) * 1.2;
    const targetY = gesture.handPosition.y * (viewport.height / 2) * 1.2;
    // Add depth to cursor - same calculation as sphere
    const targetZ = Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, gesture.handPosition.z * DEPTH_SCALE)) + 0.5;
    
    // Smooth position with high responsiveness
    smoothPosRef.current.lerp(
      new THREE.Vector3(targetX, targetY, targetZ),
      Math.min(delta * 25, 1)
    );
    
    // Check distance to sphere
    const spherePos = spherePositionRef.current;
    const distanceToSphere = smoothPosRef.current.distanceTo(spherePos);
    const hideThreshold = 0.8; // Distance at which cursor starts to fade
    
    // Hide cursor when near sphere
    const targetOpacity = distanceToSphere < hideThreshold ? 0 : 0.5;
    smoothOpacityRef.current += (targetOpacity - smoothOpacityRef.current) * Math.min(delta * 10, 1);
    
    // Hide completely when opacity is very low
    meshRef.current.visible = smoothOpacityRef.current > 0.01;
    
    meshRef.current.position.copy(smoothPosRef.current);

    // Scale based on depth for visual feedback - smaller cursor for precision
    const depthScale = 1 + (targetZ / 10);
    const targetScale = 0.06 * depthScale;
    
    // Smooth scale transitions
    smoothScaleRef.current += (targetScale - smoothScaleRef.current) * Math.min(delta * 15, 1);
    meshRef.current.scale.setScalar(smoothScaleRef.current);
    
    // Update material opacity
    const material = meshRef.current.material as THREE.MeshBasicMaterial;
    material.opacity = smoothOpacityRef.current;
  });

  return (
    <mesh ref={meshRef} renderOrder={999}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial
        color="#8b8178"
        transparent
        opacity={0.4}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

// Shared vertex shader
const texturedVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Noise function for texture
const noiseFunction = `
  // Simple hash function
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  // Value noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  
  // Fractal brownian motion for organic texture
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
`;

// Simple soft 3D room - responsive to any aspect ratio
function SoftRoom() {
  const { viewport, size } = useThree();
  
  // Calculate aspect ratio
  const aspectRatio = size.width / size.height;
  const isLandscape = aspectRatio > 1;
  
  // Back wall z position
  const backWallZ = isLandscape ? -5 : -6;
  
  // Calculate perspective scale factor for back wall
  // Objects further from camera appear smaller, so we need to scale up the back wall
  const cameraZ = isLandscape ? 7 : 6;
  const distanceToBackWall = cameraZ - backWallZ;
  const distanceToViewportPlane = cameraZ; // viewport is calculated at z=0
  const perspectiveScale = distanceToBackWall / distanceToViewportPlane;
  
  // Side wall positions - based on viewport
  const sideWallX = viewport.width * (isLandscape ? 0.45 : 0.5);
  
  // Floor/ceiling position - adjust based on orientation
  const floorY = -viewport.height * (isLandscape ? 0.4 : 0.35);
  const ceilingY = viewport.height * (isLandscape ? 0.4 : 0.35);
  
  // Back wall dimensions - align with where walls meet, accounting for perspective
  // The back wall needs to be sized so its edges align with the side walls at that depth
  const backWallWidth = sideWallX * 2 * perspectiveScale;
  const backWallHeight = (ceilingY - floorY) * perspectiveScale;
  
  return (
    <group>
      {/* Back wall - rectangle that aligns with side walls */}
      <mesh position={[0, 0, backWallZ]}>
        <planeGeometry args={[backWallWidth, backWallHeight]} />
        <shaderMaterial
          vertexShader={texturedVertexShader}
          fragmentShader={`
            varying vec2 vUv;
            ${noiseFunction}
            void main() {
              vec2 uv = vUv * 8.0;
              
              // Base cream colors
              vec3 cream = vec3(0.95, 0.93, 0.89);
              vec3 warmCream = vec3(0.92, 0.89, 0.84);
              vec3 grassyTint = vec3(0.88, 0.91, 0.85);
              
              // Noise layers
              float n1 = fbm(uv);
              float n2 = fbm(uv * 2.0 + 5.0);
              float grassNoise = fbm(uv * 3.0 + vec2(10.0, 20.0));
              
              // Mix colors with noise
              vec3 color = mix(cream, warmCream, n1 * 0.6);
              color = mix(color, grassyTint, grassNoise * 0.15);
              
              // Add fine grain
              float grain = hash(vUv * 500.0) * 0.03;
              color += grain - 0.015;
              
              // Vignette
              float dist = length(vUv - 0.5) * 1.5;
              color *= 1.0 - dist * 0.15;
              
              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>
      
      {/* Floor with grassy cream texture */}
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 50]} />
        <shaderMaterial
          vertexShader={texturedVertexShader}
          fragmentShader={`
            varying vec2 vUv;
            varying vec3 vWorldPos;
            ${noiseFunction}
            void main() {
              vec2 uv = vWorldPos.xz * 0.5;
              
              // Floor colors - more grassy
              vec3 cream = vec3(0.82, 0.80, 0.75);
              vec3 grassyCream = vec3(0.78, 0.82, 0.73);
              vec3 warmTan = vec3(0.85, 0.81, 0.74);
              
              // Organic noise
              float n1 = fbm(uv);
              float n2 = fbm(uv * 1.5 + 3.0);
              float grassPattern = fbm(uv * 4.0);
              
              // Mix for organic grassy-cream look
              vec3 color = mix(cream, warmTan, n1 * 0.5);
              color = mix(color, grassyCream, n2 * 0.35);
              
              // Grass streaks
              float streaks = sin(uv.x * 20.0 + n1 * 5.0) * 0.5 + 0.5;
              streaks *= fbm(uv * 8.0);
              color = mix(color, grassyCream * 0.95, streaks * 0.12);
              
              // Fine grain texture
              float grain = hash(uv * 100.0) * 0.04;
              color += grain - 0.02;
              
              // Distance fade
              float depth = smoothstep(0.0, 1.0, vUv.y);
              color = mix(color * 0.92, color * 1.05, depth);
              
              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>
      
      {/* Ceiling with subtle texture */}
      <mesh position={[0, ceilingY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 50]} />
        <shaderMaterial
          vertexShader={texturedVertexShader}
          fragmentShader={`
            varying vec2 vUv;
            varying vec3 vWorldPos;
            ${noiseFunction}
            void main() {
              vec2 uv = vWorldPos.xz * 0.4;
              
              // Ceiling - lighter, subtle
              vec3 lightCream = vec3(0.92, 0.90, 0.87);
              vec3 warmWhite = vec3(0.94, 0.92, 0.88);
              vec3 subtleGrass = vec3(0.91, 0.93, 0.89);
              
              float n1 = fbm(uv);
              float n2 = fbm(uv * 2.0 + 7.0);
              
              vec3 color = mix(lightCream, warmWhite, n1 * 0.4);
              color = mix(color, subtleGrass, n2 * 0.1);
              
              // Very subtle grain
              float grain = hash(uv * 80.0) * 0.02;
              color += grain - 0.01;
              
              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>
      
      {/* Left wall with texture */}
      <mesh position={[-sideWallX, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[50, 50]} />
        <shaderMaterial
          vertexShader={texturedVertexShader}
          fragmentShader={`
            varying vec2 vUv;
            varying vec3 vWorldPos;
            ${noiseFunction}
            void main() {
              vec2 uv = vWorldPos.zy * 0.3;
              
              // Wall colors
              vec3 cream = vec3(0.88, 0.86, 0.82);
              vec3 grassyCream = vec3(0.85, 0.88, 0.82);
              vec3 shadow = vec3(0.82, 0.79, 0.75);
              
              float n1 = fbm(uv);
              float n2 = fbm(uv * 2.5 + 4.0);
              
              vec3 color = mix(cream, grassyCream, n1 * 0.3);
              color = mix(color, shadow, n2 * 0.2);
              
              // Grain
              float grain = hash(uv * 90.0) * 0.03;
              color += grain - 0.015;
              
              // Edge darkening
              float edge = smoothstep(0.0, 0.4, vUv.x);
              color *= 0.9 + edge * 0.1;
              
              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>
      
      {/* Right wall with texture */}
      <mesh position={[sideWallX, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[50, 50]} />
        <shaderMaterial
          vertexShader={texturedVertexShader}
          fragmentShader={`
            varying vec2 vUv;
            varying vec3 vWorldPos;
            ${noiseFunction}
            void main() {
              vec2 uv = vWorldPos.zy * 0.3;
              
              // Wall colors
              vec3 cream = vec3(0.88, 0.86, 0.82);
              vec3 grassyCream = vec3(0.85, 0.88, 0.82);
              vec3 shadow = vec3(0.82, 0.79, 0.75);
              
              float n1 = fbm(uv);
              float n2 = fbm(uv * 2.5 + 4.0);
              
              vec3 color = mix(cream, grassyCream, n1 * 0.3);
              color = mix(color, shadow, n2 * 0.2);
              
              // Grain
              float grain = hash(uv * 90.0) * 0.03;
              color += grain - 0.015;
              
              // Edge darkening
              float edge = smoothstep(1.0, 0.6, vUv.x);
              color *= 0.9 + edge * 0.1;
              
              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>
      
      {/* Subtle shadow under sphere */}
      <mesh position={[0, floorY + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 32]} />
        <meshBasicMaterial color="#b8b0a5" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}


// Camera controller that adjusts to aspect ratio
function AdaptiveCamera() {
  const { camera, size } = useThree();
  
  useEffect(() => {
    const aspectRatio = size.width / size.height;
    const isLandscape = aspectRatio > 1;
    
    // Adjust camera position and FOV based on orientation
    if (isLandscape) {
      // Landscape: pull camera back slightly and adjust FOV
      camera.position.z = 7;
      (camera as THREE.PerspectiveCamera).fov = 45;
    } else {
      // Portrait: standard setup
      camera.position.z = 6;
      (camera as THREE.PerspectiveCamera).fov = 50;
    }
    
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [camera, size]);
  
  return null;
}

interface Scene3DProps {
  gesture: GestureState;
  twoHandGesture: TwoHandGestureState;
  isMessageWindowVisible: boolean;
}

export default function Scene3D({ gesture, twoHandGesture, isMessageWindowVisible }: Scene3DProps) {
  const spherePositionRef = useRef(new THREE.Vector3(0, 0, 0));
  
  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        resize={{ scroll: false, debounce: { scroll: 50, resize: 50 } }}
      >
        {/* Fallback background color - soft cream */}
        <color attach="background" args={['#e8e4de']} />
        
        {/* Soft 3D Room environment - viewport aware */}
        <SoftRoom />
        
        {/* Studio environment for clean reflections */}
        <Environment preset="studio" background={false} />
        
        {/* Lighting setup for 3D depth */}
        <ambientLight intensity={0.3} />
        
        {/* Key light - main illumination */}
        <spotLight
          position={[5, 5, 5]}
          angle={0.4}
          penumbra={0.5}
          intensity={1.5}
          castShadow
          shadow-mapSize={2048}
        />
        
        {/* Fill light - softens shadows */}
        <pointLight position={[-5, 0, 5]} color="#ffffff" intensity={0.5} />
        
        {/* Rim/back light - creates edge definition */}
        <pointLight position={[0, -3, -5]} color="#ffffff" intensity={0.8} />
        
        {/* Top accent light */}
        <pointLight position={[0, 8, 0]} color="#ffffff" intensity={0.4} />
        
        {/* Adaptive camera for responsive layout */}
        <AdaptiveCamera />
        
        {/* Interactive elements */}
        <InteractiveSphere gesture={gesture} twoHandGesture={twoHandGesture} positionRef={spherePositionRef} isMessageWindowVisible={isMessageWindowVisible} />
        
        <HandCursor gesture={gesture} twoHandGesture={twoHandGesture} spherePositionRef={spherePositionRef} />
      </Canvas>
    </div>
  );
}

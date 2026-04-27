"use client";

import React, { useState, useEffect, useRef, useMemo, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { Preload, AdaptiveEvents } from '@react-three/drei';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Check, ArrowRight, Sparkles, X, Plus, Zap, Percent, Copy } from 'lucide-react';
import { toast } from 'sonner';


// --- MaskReveal.tsx ---

gsap.registerPlugin(ScrollTrigger);

function MaskReveal({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return;
    
    gsap.fromTo(contentRef.current, 
      { yPercent: 120, rotationZ: 3, opacity: 0 },
      { 
        yPercent: 0, 
        rotationZ: 0,
        opacity: 1,
        duration: 1.2, 
        ease: 'power4.out',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top 85%',
        }
      }
    );
  }, []);

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      <div ref={contentRef} className="origin-top-left will-change-transform">
        {children}
      </div>
    </div>
  );
}


// --- MagneticButton.tsx ---

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}

function MagneticButton({ children, className = '', strength = 0.2, ...props }: MagneticButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    // Check if the device has a fine pointer (mouse)
    const isMouseDevice = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!isMouseDevice) return;

    gsap.set(button, { clearProps: "all" });

    const handleMouseMove = (e: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const distX = e.clientX - centerX;
      const distY = e.clientY - centerY;
      
      const distance = Math.hypot(distX, distY);
      
      // If within 150px, attract
      if (distance < 150) {
        gsap.to(button, {
          x: distX * strength,
          y: distY * strength,
          force3D: true,
          duration: 0.6,
          ease: "power2.out",
          overwrite: "auto"
        });
      } else {
        gsap.to(button, {
          x: 0,
          y: 0,
          force3D: true,
          duration: 0.8,
          ease: "elastic.out(1, 0.3)",
          overwrite: "auto"
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [strength]);

  return (
    <button 
      ref={buttonRef} 
      className={`relative z-20 pointer-events-auto will-change-transform active:scale-95 transition-transform duration-150 ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
}


// --- ScrambleText.tsx ---

gsap.registerPlugin(ScrollTrigger);

const CHARS = '!<>-_\\\\/[]{}—=+*^?#_01';

function ScrambleText({ text, className = '', retriggerSignal = 0 }: { text: string, className?: string, retriggerSignal?: number }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number>(0);
  
  const playScramble = () => {
    if (!textRef.current) return;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    
    let frame = 0;
    const targetLength = text.length;
    
    const randomChar = () => CHARS[Math.floor(Math.random() * CHARS.length)];
    
    const animate = () => {
      frame++;
      let currentText = '';
      const progress = frame / 40; // 40 frames total for the scramble
      
      for(let i = 0; i < targetLength; i++) {
        if (progress * targetLength > i) {
          currentText += text[i];
        } else {
          currentText += text[i] === ' ' ? ' ' : randomChar();
        }
      }
      
      if (textRef.current) textRef.current.innerText = currentText;
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animate();
  };

  useEffect(() => {
    if (!textRef.current) return;
    
    let isRevealed = false;
    
    const st = ScrollTrigger.create({
      trigger: textRef.current,
      start: 'top 90%',
      onEnter: () => {
        if(!isRevealed) {
          isRevealed = true;
          playScramble();
        }
      }
    });
    
    return () => {
      st.kill();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [text]);

  useEffect(() => {
    if (retriggerSignal > 0) {
      playScramble();
    }
  }, [retriggerSignal, text]);

  return <span ref={textRef} className={className}>{text}</span>;
}


// --- HeroSection.tsx ---

// --- THREE.JS SHADER COMPONENTS ---

const HeroVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HeroFragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uIsMobile;
  uniform vec3 color1;
  uniform vec3 color2;
  uniform vec3 color3;
  
  varying vec2 vUv;
  
  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  void main() {
      // Normalize UV respect to aspect ratio
      vec2 uv = vUv;
      float aspect = uResolution.x / uResolution.y;
      uv.x *= aspect;
      
      // Auto-flowing wave movement (no mouse interaction)
      // Fractal noise mixing - creating high quality animation flow
      float n1 = snoise(uv * 1.5 + uTime * 0.15);
      float n2 = snoise(uv * 3.0 - uTime * 0.2 + n1);
      float n3 = uIsMobile > 0.5 ? 0.0 : snoise(uv * 2.0 + uTime * 0.1 - n2 * 0.5);
      
      float mix1 = smoothstep(-1.0, 1.0, n1);
      float mix2 = smoothstep(-1.0, 1.0, n2);
      float mix3 = smoothstep(-1.0, 1.0, n3);
      
      // Color interpolation
      vec3 finalColor = mix(color1, color2, mix1);
      finalColor = mix(finalColor, color3, mix2 * 0.6 + mix3 * 0.4);
      
      // Slight darkening and blending for depth without interactions
      finalColor *= 0.85 + 0.15 * smoothstep(-0.5, 0.5, n1);

      gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function LiquidMeshGradient({ isMobile }: { isMobile: boolean }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size, viewport } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uIsMobile: { value: isMobile ? 1.0 : 0.0 },
      color1: { value: new THREE.Color('#0a0b1e') }, // Deep Midnight Blue
      color2: { value: new THREE.Color('#bf00ff') }, // Neon Purple
      color3: { value: new THREE.Color('#00ffd1') }, // Cyber Teal
    }),
    [size, isMobile]
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uResolution.value.set(size.width, size.height);
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1, isMobile ? 8 : 32, isMobile ? 8 : 32]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={HeroVertexShader}
        fragmentShader={HeroFragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

function Scene() {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <Canvas 
      camera={{ position: [0, 0, 4], fov: 45 }} 
      dpr={[1, 2]}
      gl={{ powerPreference: "high-performance", antialias: false, alpha: true }}
      style={{ pointerEvents: 'none' }}
    >
      <AdaptiveEvents />
      <LiquidMeshGradient isMobile={isMobile} />
      <Preload all />
    </Canvas>
  );
}

function HeroSection() {
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const [blurPercent, setBlurPercent] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      // Exponential blur for a softer, dreamier transition
      const scrollRatio = Math.min(scrollY / 1000, 1);
      const blur = Math.pow(scrollRatio, 1.5) * 16;
      setBlurPercent(blur);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useGSAP(() => {
    if (!headlineRef.current) return;
    
    const lines = headlineRef.current.children;
    
    gsap.fromTo(lines, 
      { y: 60, opacity: 0, rotateX: -20, rotateZ: -2 },
      { 
        y: 0, 
        opacity: 1, 
        rotateX: 0, 
        rotateZ: 0, 
        duration: 1.2, 
        stagger: 0.15, 
        ease: 'back.out(1.5)',
        onComplete: () => {
          gsap.to(lines, {
            y: -6,
            rotateZ: 1,
            duration: 3,
            ease: 'sine.inOut',
            stagger: {
              each: 0.15,
              repeat: -1,
              yoyo: true
            }
          });
        }
      }
    );
  }, []);

  return (
    <section 
      className="relative w-full min-h-[100svh] flex flex-col justify-center items-center py-20 md:py-40 z-10"
    >
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.85]"
        style={{ filter: `blur(${blurPercent}px)`, transition: 'filter 0.1s ease-out' }}
      >
        <Scene />
      </div>
      
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.04] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" style={{ mixBlendMode: 'overlay'}}></div>

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-center w-full max-w-7xl mx-auto px-[clamp(1.5rem,4vw,4rem)] mt-[clamp(2rem,6vw,6rem)]">
        <div className="flex flex-col items-center text-center w-full">
          <div className="mb-[clamp(1.5rem,3vw,3rem)] inline-flex flex-col items-center gap-2">
            <span className="w-px h-16 bg-gradient-to-b from-transparent to-white/50"></span>
            <span className="text-[clamp(0.6rem,1vw,0.8rem)] tracking-[0.4em] text-white/90 uppercase font-sans bg-white/5 px-5 py-2 rounded-full border border-white/10 backdrop-blur-3xl shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
              World-Class Identity
            </span>
          </div>
          
          <div className="w-full relative z-10 flex flex-col items-center" style={{ perspective: "1000px" }}>
            <h1 ref={headlineRef} className="font-display font-medium tracking-tighter leading-[1.05] text-white text-[clamp(2.75rem,8vw,8.5rem)] flex flex-col items-center justify-center" style={{ textShadow: '0 15px 50px rgba(0,0,0,0.9), 0 5px 15px rgba(0,0,0,0.7)' }}>
               <span className="pb-2 block transform-gpu">Crafting</span>
               <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-white/40 pb-2 block transform-gpu" style={{ textShadow: 'none', filter: 'drop-shadow(0px 15px 30px rgba(0,0,0,0.8))' }}>High-Conversion</span>
               <span className="block transform-gpu">Sales Systems</span>
            </h1>
          </div>

          <div className="mt-[clamp(2rem,4vw,4rem)] mb-[clamp(3rem,6vw,6rem)] max-w-[clamp(35rem,50vw,48rem)] bg-white/5 backdrop-blur-3xl border border-white/10 p-[clamp(1.5rem,3vw,3rem)] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative">
            <p className="text-[clamp(1rem,1.5vw,1.125rem)] text-white/70 font-sans leading-relaxed tracking-wide text-center font-medium">
              We specialize in elite B2B digital architectures. By fusing high-end motion aesthetics, WebGL fluid simulations, and optimized conversion pathways, we transform generic landing pages into mesmerizing lead-generation machines.
            </p>
          </div>

          <div className="pointer-events-auto inline-block p-4">
            <MagneticButton 
              onClick={() => {
                const pricingSection = document.getElementById('pricing');
                if (pricingSection) {
                    pricingSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="relative px-10 py-4 bg-white/10 text-white font-medium tracking-wide text-sm overflow-hidden group rounded-full border border-white/20 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_32px_rgba(255,255,255,0.15)] hover:bg-white/20 transition-all duration-300"
            >
              <span className="relative z-[2] flex items-center gap-3">
                <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]"></span>
                Explore Operations
              </span>
            </MagneticButton>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-6 md:left-12 z-10 flex items-center gap-4 mix-blend-difference pointer-events-none">
         <div className="h-[1px] w-12 bg-white/50"></div>
         <p className="text-[9px] font-mono text-white uppercase tracking-[0.3em]">
           Pos: 40.7128N <br/>
           Status: Optimal
         </p>
      </div>

      <div className="absolute bottom-8 right-6 md:right-12 z-10 flex flex-col items-end mix-blend-difference hidden sm:flex pointer-events-none">
         <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest text-right">
           Scroll Sequence<br/>
           <span className="text-white">Active</span>
         </p>
      </div>
    </section>
  );
}


// --- ProcessSection.tsx ---


gsap.registerPlugin(ScrollTrigger);

// --- SHADERS FOR INTERACTIVE SPHERE ---
const ProcessVertexShader = `
  uniform float uTime;
  uniform vec2 uMouse;
  varying vec2 vUv;
  varying vec3 vNormal;
  
  // Simplex 3D noise for vertex displacement
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){ 
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0 ); 
    vec4 p = permute( permute( permute( 
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
    float n_ = 1.0/7.0;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  void main() {
    vUv = uv;
    vNormal = normal;
    
    vec2 objMouse = uMouse * 2.0 - 1.0;
    
    float distToMouse = distance(position.xy, objMouse * 2.0); 
    float mousePull = smoothstep(1.5, 0.0, distToMouse);
    
    float noise = snoise(position * 1.5 + uTime * 0.3) * 0.15;
    float wobble = snoise(position * 3.0 - uTime * 1.5) * 0.1 * mousePull;
    
    vec3 newPosition = position + normal * (noise + wobble);
    
    vec3 direction = vec3(objMouse * 2.0 - position.xy, 0.0);
    newPosition += normalize(direction) * mousePull * 0.2;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const ProcessFragmentShader = `
  uniform float uTime;
  uniform vec3 color1;
  uniform vec3 color2;
  uniform vec3 color3;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){ 
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0 ); 
    vec4 p = permute( permute( permute( 
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
    float n_ = 1.0/7.0;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  void main() {
      vec3 pos = normalize(vNormal) * 2.0;
      
      float n1 = snoise(pos * 1.2 + uTime * 0.2);
      float n2 = snoise(pos * 2.5 - uTime * 0.4 + n1);
      float n3 = snoise(pos * 1.8 + uTime * 0.1 - n2);
      
      float mix1 = smoothstep(-0.8, 1.0, n1);
      float mix2 = smoothstep(-1.0, 1.0, n2);
      float mix3 = smoothstep(-0.5, 1.0, n3);
      
      vec3 finalColor = mix(color1, color2, mix1);
      finalColor = mix(finalColor, color3, mix2 * 0.7 + mix3 * 0.5);
      
      float fresnel = dot(vNormal, vec3(0.0, 0.0, 1.0));
      fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
      fresnel = pow(fresnel, 3.0);
      
      finalColor += color3 * fresnel * 0.6; // Edge glow
      
      gl_FragColor = vec4(finalColor, 0.95);
  }
`;

function ParticleCloud() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const mousePos = useRef(new THREE.Vector2(0.5, 0.5));
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      // Update colors to feel more tech/data driven to match process
      color1: { value: new THREE.Color('#050510') }, // Dark
      color2: { value: new THREE.Color('#3b82f6') }, // Tech blue
      color3: { value: new THREE.Color('#bf00ff') }, // Neon Purple
    }),
    [size]
  );

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      mousePos.current.x = e.clientX / window.innerWidth;
      mousePos.current.y = 1.0 - (e.clientY / window.innerHeight); 
    };
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  useFrame((state) => {
    if (!materialRef.current || !meshRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uMouse.value.lerp(mousePos.current, 0.05);
    
    // Scale slightly by scroll if desired (optional pulse)
    const scaleAnim = 2.0 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    meshRef.current.scale.setScalar(scaleAnim);
    
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    meshRef.current.rotation.z = state.clock.elapsedTime * 0.05;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 128, 128]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={ProcessVertexShader}
        fragmentShader={ProcessFragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}


// --- MAIN REACT COMPONENT ---

function ProcessSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  // We map the ScrollTrigger to a proxy object that React Three Fiber can read inside useFrame, 
  // or we update the material uniform directly if we keep a ref.
  // We'll update a global state or dispatch event, but simpler: modify a global variable that the canvas reads
  const progressObj = useRef({ value: 0 });

  useGSAP(() => {
    if (!triggerRef.current) return;

    const sections = gsap.utils.toArray('.process-step');
    
    // Animate the text sliding up
    sections.forEach((sec: any) => {
      gsap.fromTo(sec, 
        { y: 100, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sec,
            start: "top 60%", // Activate when reaching middle of screen
            toggleActions: "play none none reverse"
          }
        }
      );
    });

    // Drive the particle morphing progress
    gsap.to(progressObj.current, {
      value: 2.0, // Maps from 0 to 2 for the 3 states
      ease: "none",
      scrollTrigger: {
        trigger: triggerRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 1, // Smooth scrub
        onUpdate: (self) => {
          // Pass proxy state to canvas if we had direct access.
          // For encapsulation bypass, we dispatch a custom event the canvas listens to.
          window.dispatchEvent(new CustomEvent('update-particle-progress', { detail: progressObj.current.value }));
        }
      }
    });

  }, { scope: containerRef });

  return (
    <section id="process" ref={containerRef} className="relative z-10 bg-[#000000] border-t border-white/5">
      
      {/* Fixed Sticky Canvas Background */}
      <div className="absolute inset-0 z-0 pointer-events-none h-full w-full">
         <div className="sticky top-0 h-[100dvh] w-full overflow-hidden">
             <Canvas 
                camera={{ position: [0, 0, 8], fov: 45 }}
                dpr={[1, 1.5]}
                gl={{ powerPreference: "high-performance", antialias: false }}
             >
                <ParticleCloud />
             </Canvas>
         </div>
      </div>

      <div className="absolute top-1/4 right-[10%] z-20 pointer-events-none hidden md:block">
        <div className="animate-pulse flex items-center gap-3 backdrop-blur-xl bg-white/5 border border-white/10 px-4 py-2 rounded-full">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
          <span className="text-xs font-sans font-medium text-white/80">Move cursor to distort</span>
        </div>
      </div>

      {/* Tall container to allow scrolling */}
      <div ref={triggerRef} className="relative z-10 w-full flex flex-col py-10 md:py-0">
        
        {/* Content containers spaced out */}
        <div className="w-full min-h-[100dvh] flex flex-col justify-center items-center py-20 px-[clamp(1rem,4vw,4rem)] pointer-events-none">
          <div className="process-step w-full max-w-[clamp(40rem,60vw,64rem)] text-center backdrop-blur-3xl bg-white/5 p-[clamp(1.5rem,5vw,5rem)] rounded-[2rem] md:rounded-[3rem] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <span className="font-sans text-white/50 text-[clamp(0.6rem,1vw,0.8rem)] tracking-[0.2em] uppercase mb-[clamp(1rem,2vw,2rem)] block font-medium">
               <ScrambleText text="Phase 01" />
            </span>
            <MaskReveal>
              <h2 className="text-[clamp(2.2rem,8vw,5.5rem)] font-display font-medium text-white tracking-tighter leading-[1.05] mb-[clamp(1.5rem,3vw,3rem)]">
                Strategic Consultation
              </h2>
            </MaskReveal>
            <MaskReveal>
              <p className="font-sans text-[clamp(0.95rem,1.5vw,1.125rem)] text-white/70 tracking-wide leading-relaxed font-medium mb-[clamp(2rem,4vw,4rem)]">
                Every flawless architecture starts with a conversation. We deeply analyze your market positioning, establish the technical foundation, and explore unfiltered creative pathways. In this phase, we map out user journeys, define the aesthetic direction, and agree on core KPIs to ensure the end product drives measurable business value.
              </p>
            </MaskReveal>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pointer-events-auto mt-[clamp(2rem,4vw,4rem)]">
               <MagneticButton 
                  onClick={() => window.open(`https://wa.me/60146266292?text=${encodeURIComponent("Hi KaRJuN, I've reviewed your consultation phase and I'd like to book a strategy session.")}`, '_blank')}
                  className="relative group w-full sm:w-auto px-[clamp(1.5rem,3vw,3rem)] py-[clamp(1rem,2vw,2rem)] bg-white text-black font-semibold tracking-wide text-[clamp(0.8rem,1vw,1rem)] rounded-full shadow-[0_4px_24px_rgba(255,255,255,0.4)] hover:scale-105 transition-transform duration-300"
                >
                  <div className="absolute inset-0 rounded-full border border-black/10 shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-pulse opacity-100 pointer-events-none" />
                  <span className="relative z-10 flex items-center justify-center gap-2">Book Strategy Call <Zap className="w-4 h-4 fill-black" /></span>
               </MagneticButton>
               <MagneticButton 
                  onClick={() => setIsModalOpen(true)}
                  className="w-full sm:w-auto px-[clamp(1.5rem,3vw,3rem)] py-[clamp(1rem,2vw,2rem)] bg-white/10 text-white font-medium tracking-wide text-[clamp(0.8rem,1vw,1rem)] rounded-full border border-white/20 backdrop-blur-2xl hover:bg-white/20 transition-all duration-300"
                >
                  View Consulting Info
               </MagneticButton>
            </div>
          </div>
        </div>

        <div className="w-full min-h-[100dvh] flex flex-col justify-center items-center py-20 px-[clamp(1rem,4vw,4rem)] pointer-events-none">
          <div className="process-step w-full max-w-[clamp(40rem,60vw,64rem)] text-center backdrop-blur-3xl bg-white/5 p-[clamp(1.5rem,5vw,5rem)] rounded-[2rem] md:rounded-[3rem] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <span className="font-sans text-white/50 text-[clamp(0.6rem,1vw,0.8rem)] tracking-[0.2em] uppercase mb-[clamp(1rem,2vw,2rem)] block font-medium">
               <ScrambleText text="Phase 02" />
            </span>
            <h2 className="text-[clamp(2.2rem,8vw,5.5rem)] font-display font-medium text-white tracking-tighter leading-[1.05] mb-[clamp(1.5rem,3vw,3rem)]">
              Structural Framework
            </h2>
            <MaskReveal>
              <p className="font-sans text-[clamp(0.95rem,1.5vw,1.125rem)] text-white/70 tracking-wide leading-relaxed font-medium">
                Translating ideas into absolute order. We engineer the wireframes, logic flows, and robust full-stack architecture designed for infinite scalability. With cutting-edge technologies like React, Next.js, and highly optimized WebGL shaders, we build a foundation that is as visually breathtaking as it is structurally secure and performant.
              </p>
            </MaskReveal>
          </div>
        </div>

        <div className="w-full min-h-[100dvh] flex flex-col justify-center items-center py-20 px-[clamp(1rem,4vw,4rem)] pointer-events-none">
          <div className="process-step w-full max-w-[clamp(40rem,60vw,64rem)] text-center backdrop-blur-3xl bg-white/5 p-[clamp(1.5rem,5vw,5rem)] rounded-[2rem] md:rounded-[3rem] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <span className="font-sans text-white/50 text-[clamp(0.6rem,1vw,0.8rem)] tracking-[0.2em] uppercase mb-[clamp(1rem,2vw,2rem)] block font-medium">
               <ScrambleText text="Phase 03" />
            </span>
            <h2 className="text-[clamp(2.2rem,8vw,5.5rem)] font-display font-medium text-white tracking-tighter leading-[1.05] mb-[clamp(1.5rem,3vw,3rem)]">
              Digital Deployment
            </h2>
            <MaskReveal>
              <p className="font-sans text-[clamp(0.95rem,1.5vw,1.125rem)] text-white/70 tracking-wide leading-relaxed font-medium">
                The finalized product. Highly optimized, seamlessly animated, and delivered to the elite market with flawless precision. Post-launch, we monitor analytics, conduct A/B testing on interactive elements, and refine performance metrics to guarantee an unyielding return on your digital investment.
              </p>
            </MaskReveal>
          </div>
        </div>

      </div>

      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[999999] flex justify-end bg-black/60 backdrop-blur-sm pointer-events-auto"
              onClick={() => setIsModalOpen(false)}
            >
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-full md:max-w-md h-[100dvh] bg-[#050505] border-l border-white/10 flex flex-col relative shadow-2xl pointer-events-auto mt-0"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="p-8 pb-6 pt-24 md:pt-12 flex justify-between items-start shrink-0 border-b border-white/5">
                  <div className="pr-4">
                    <span className="text-xs font-mono text-white/40 tracking-[0.2em] uppercase mb-2 block">Framework Overview</span>
                    <h3 className="text-2xl md:text-3xl font-display font-medium text-white tracking-tight">Strategic Consultation</h3>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="w-10 h-10 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors pointer-events-auto relative z-[100]"
                  >
                    <X className="w-5 h-5 text-white/50 hover:text-white transition-colors" />
                  </button>
                </div>

                {/* Scrollable Body */}
                <div 
                  className="flex-1 overflow-y-auto overscroll-contain p-8 /* Hide scrollbar for standard look */ [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  data-lenis-prevent="true"
                >
                  <p className="text-white/60 font-sans leading-relaxed text-sm mb-10">
                    Our methodology for market domination. We don't just ask what you want; we discover what your market demands.
                  </p>

                  <div className="space-y-10">
                    {[
                      {
                        title: "Market Positioning Analysis",
                        desc: "Deep-dive into your competitors, audience psychographics, and unique brand advantages."
                      },
                      {
                        title: "Technical Architecture",
                        desc: "Determining the exact tech stack required for optimal performance, scaling, and security."
                      },
                      {
                        title: "Aesthetic Direction",
                        desc: "Aligning visual identity with brand strategy to produce high-conversion, premium designs."
                      },
                      {
                        title: "KPI & Goal Alignment",
                        desc: "Establishing highly measurable parameters to ensure maximum return on investment."
                      }
                    ].map((item, idx) => (
                      <div key={idx} className="flex gap-4 items-start">
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-1">
                          <span className="text-xs font-mono text-white/60">0{idx + 1}</span>
                        </div>
                        <div>
                          <h4 className="text-white font-medium mb-1.5 font-sans tracking-wide">{item.title}</h4>
                          <p className="text-white/40 text-sm font-sans leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sticky Footer */}
                <div className="p-8 pt-6 border-t border-white/10 shrink-0 bg-gradient-to-t from-[#050505] to-[#050505]/90 backdrop-blur-xl">
                  <button
                     onClick={() => {
                        setIsModalOpen(false);
                        window.open(`https://wa.me/60146266292?text=${encodeURIComponent("Hi KaRJuN, I've reviewed your consultation phase and I'd like to book a strategy session.")}`, '_blank');
                     }}
                     className="w-full py-4 bg-white text-black font-semibold tracking-wide text-sm rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-[1.02] transition-transform duration-300"
                  >
                     Book Strategy Call 
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </section>
  );
}




// --- PricingSection.tsx ---

const servicesConfig = [
  {
    id: "logo",
    name: "Logo Design",
    min: 50,
    max: 300,
    desc: "Professional brand identity & mark.",
  },
  {
    id: "poster",
    name: "Poster Design",
    min: 50,
    max: 200,
    desc: "High-impact visual content.",
  },
  {
    id: "copywriting",
    name: "Strategic Copywriting",
    min: 50,
    max: 500,
    desc: "Conversion-optimized sales copy.",
  },
  {
    id: "landing",
    name: "Performance Landing Page",
    min: 300,
    max: 1000,
    desc: "High-ROI single-page architecture.",
  },
  {
    id: "website",
    name: "Bespoke Website Architecture",
    min: 1000,
    max: 4000,
    desc: "Full premium digital ecosystem.",
  },
];

function PricingSection() {
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const minPriceRef = useRef({ val: 0 });
  const maxPriceRef = useRef({ val: 0 });
  const minDisplayRef = useRef<HTMLSpanElement>(null);
  const maxDisplayRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let rawMin = 0;
    let rawMax = 0;
    selectedServices.forEach((id) => {
      const s = servicesConfig.find((x) => x.id === id);
      if (s) {
        rawMin += s.min;
        rawMax += s.max;
      }
    });

    const isBundle = selectedServices.length >= 3;
    const finalMin = isBundle ? rawMin * 0.85 : rawMin;
    const finalMax = isBundle ? rawMax * 0.85 : rawMax;

    if (minDisplayRef.current) {
      gsap.to(minPriceRef.current, {
        val: finalMin,
        duration: 0.8,
        ease: "power2.out",
        onUpdate: () => {
          if (minDisplayRef.current)
            minDisplayRef.current.innerText = Math.round(
              minPriceRef.current.val,
            ).toString();
        },
      });
    }

    if (maxDisplayRef.current) {
      gsap.to(maxPriceRef.current, {
        val: finalMax,
        duration: 0.8,
        ease: "power2.out",
        onUpdate: () => {
          if (maxDisplayRef.current)
            maxDisplayRef.current.innerText = Math.round(
              maxPriceRef.current.val,
            ).toString();
        },
      });
    }
  }, [selectedServices]);

  const toggleService = (id: string) =>
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const isBundle = selectedServices.length >= 3;
  let rawMax = 0,
    rawMin = 0;
  selectedServices.forEach((id) => {
    const s = servicesConfig.find((x) => x.id === id);
    if (s) {
      rawMin += s.min;
      rawMax += s.max;
    }
  });
  const finalMax = isBundle ? rawMax * 0.85 : rawMax;
  const finalMin = isBundle ? rawMin * 0.85 : rawMin;

  const handleCTA = () => {
    if (selectedServices.length === 0) return;
    const serviceNames = selectedServices
      .map((id) => servicesConfig.find((s) => s.id === id)?.name)
      .filter(Boolean);
    window.dispatchEvent(
      new CustomEvent("open-contact-funnel", {
        detail: {
          services: serviceNames,
          minEstimate: Math.round(finalMin),
          maxEstimate: Math.round(finalMax),
          discountApplied: isBundle,
        },
      }),
    );
  };

  return (
    <section
      id="pricing"
      className="py-24 md:py-40 relative z-20 w-full bg-[#040404] border-t border-white/5 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="max-w-4xl mx-auto px-6 w-full relative z-10">
        <div className="text-center mb-16">
          <MaskReveal>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-display text-white tracking-tight leading-[1.1] mb-6">
              Dynamic Estimator
            </h2>
          </MaskReveal>
          <p className="text-white/50 font-sans max-w-xl mx-auto">
            Select the high-impact assets you require. Real-time calculations
            for complete transparency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 relative z-20">
          {servicesConfig.map((service) => {
            const isSelected = selectedServices.includes(service.id);
            return (
              <button
                key={service.id}
                onClick={() => toggleService(service.id)}
                className={`text-left p-6 rounded-2xl border transition-all duration-300 relative z-10 hover:z-20 ${isSelected ? "border-purple-500/50 bg-white/[0.08] shadow-[0_0_30px_rgba(168,85,247,0.15)] backdrop-blur-xl" : "border-white/10 bg-black/40 backdrop-blur-md hover:bg-white/[0.06] hover:backdrop-blur-lg"}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg md:text-xl font-display text-white">
                    {service.name}
                  </h3>
                  <div
                    className={`w-6 h-6 md:w-5 md:h-5 rounded border flex items-center justify-center transition-colors shrink-0 ml-4 ${isSelected ? "bg-purple-500 border-purple-500" : "border-white/20"}`}
                  >
                    <motion.div
                      initial={false}
                      animate={{
                        scale: isSelected ? 1 : 0.5,
                        opacity: isSelected ? 1 : 0,
                      }}
                      transition={{
                        ease: [0.175, 0.885, 0.32, 1.275],
                        duration: 0.4,
                      }}
                    >
                      <Check className="w-4 h-4 md:w-3.5 md:h-3.5 text-white" />
                    </motion.div>
                  </div>
                </div>
                <p className="text-sm font-sans text-white/50 mb-4">
                  {service.desc}
                </p>
                <div className="text-xs font-mono text-purple-300/80 tracking-widest">
                  ${service.min} - ${service.max}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="sticky bottom-0 md:bottom-6 mt-8 md:mt-0 z-[30] w-full max-w-4xl mx-auto px-0 md:px-6">
        <div className="bg-[#050505]/95 md:bg-white/5 border-t md:border border-white/10 rounded-t-3xl md:rounded-3xl p-5 md:p-8 backdrop-blur-2xl relative overflow-hidden shadow-2xl transition-all duration-300 w-full">
          <div
            className={`absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 transition-opacity duration-1000 ${isBundle ? "opacity-100" : "opacity-0"} pointer-events-none`}
          />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="w-full md:w-auto text-left flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 md:gap-3 mb-1 mt-1 md:mt-0">
                <p className="text-[10px] md:text-xs font-mono tracking-widest text-white/60 uppercase">
                  Estimated Investment
                </p>
                <AnimatePresence>
                  {isBundle && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center gap-1.5 w-fit"
                    >
                      <Percent className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] font-mono text-purple-400 tracking-widest uppercase shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                        Bundle Discount: -15% Applied
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="text-3xl sm:text-4xl md:text-5xl font-display text-white tracking-tight flex items-baseline gap-2 mt-1 md:mt-2">
                $<span ref={minDisplayRef}>0</span>{" "}
                <span className="text-xl md:text-3xl text-white/40">-</span> $
                <span ref={maxDisplayRef}>0</span>
              </div>
            </div>

            <div className="w-full md:w-auto shrink-0 mt-4 md:mt-0">
              <button
                onClick={handleCTA}
                disabled={selectedServices.length === 0}
                className={`w-full md:w-[280px] py-4 px-6 rounded-full font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300 relative overflow-hidden group ${selectedServices.length === 0 ? "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed" : "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:scale-[1.02]"}`}
              >
                {selectedServices.length > 0 && (
                  <div className="absolute inset-0 rounded-full border border-black/10 shadow-[0_0_15px_rgba(255,255,255,0.5)] animate-pulse opacity-100 pointer-events-none" />
                )}
                {selectedServices.length === 0 ? (
                  <span>Select Services</span>
                ) : (
                  <>
                    <span className="relative z-10 text-[11px] md:text-xs">
                      Start Project
                    </span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 relative z-10" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


// --- FloatingCTA.tsx ---

function FloatingCTA() {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    const handleOpen = () => setIsVisible(false);
    const handleClose = () => setIsVisible(true);
    
    window.addEventListener('open-contact-funnel', handleOpen);
    window.addEventListener('close-contact-funnel', handleClose);
    
    return () => {
      window.removeEventListener('open-contact-funnel', handleOpen);
      window.removeEventListener('close-contact-funnel', handleClose);
    };
  }, []);

  const handleTriggerModal = () => {
    window.dispatchEvent(new CustomEvent('open-contact-funnel', { 
      detail: { 
        tier: 'Custom Inquiry', 
        preselectedServices: [] 
      } 
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 50, scale: isVisible ? 1 : 0.9 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`fixed bottom-4 right-4 md:bottom-10 md:right-10 z-[40] flex flex-col items-end gap-3 ${isVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
    >
      <button 
        onClick={handleTriggerModal}
        className="relative group flex items-center justify-center gap-3 px-5 py-3 md:px-6 md:py-4 rounded-full overflow-hidden transition-all duration-500 scale-90 md:scale-100 origin-bottom-right"
      >
        {/* Animated Background Layers */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-2xl border border-white/20 rounded-full transition-all duration-500 group-hover:bg-black/60 group-hover:border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-purple-500/20 opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>
        
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/30 to-blue-500/30 blur-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white transform group-hover:scale-110 transition-transform duration-500" />
            <span className="absolute w-2 h-2 rounded-full bg-purple-500 -top-1 -right-1 animate-ping"></span>
          </div>
          <span className="font-display font-medium text-sm tracking-wide text-white">
            Start Project
          </span>
        </div>
      </button>
    </motion.div>
  );
}


// --- ContactSection.tsx ---

function ContactSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [contact, setContact] = useState({
    name: "",
    email: "",
    ig: "",
    telegram: "",
  });

  const [services, setServices] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });
  const [discountApplied, setDiscountApplied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleOpen = (e: any) => {
      const detail = e.detail || {};
      setServices(detail.services || detail.preselectedServices || []);
      setPriceRange({
        min: detail.minEstimate || 0,
        max: detail.maxEstimate || 0,
      });
      setDiscountApplied(detail.discountApplied || false);

      setContact({ name: "", email: "", ig: "", telegram: "" });
      setIsOpen(true);
      document.body.style.overflow = "hidden";
    };
    window.addEventListener("open-contact-funnel", handleOpen);
    return () => window.removeEventListener("open-contact-funnel", handleOpen);
  }, []);

  const closeFunnel = () => {
    setIsOpen(false);
    document.body.style.overflow = "auto";
    window.dispatchEvent(new CustomEvent("close-contact-funnel"));
  };

  const servicesFormatted =
    services.length > 2
      ? services.slice(0, -1).join(", ") +
        ", and " +
        services[services.length - 1]
      : services.join(" and ");
  const servicesText =
    services.length > 0 ? servicesFormatted : "Creative Services";
  const priceText =
    priceRange.max > 0
      ? `$${priceRange.min} - $${priceRange.max}`
      : "Not specified";
  const discountText = discountApplied ? " (Includes 15% Bundle Discount)" : "";
  const finalMessage = `Hi KaRJuN! I'm interested in a ${servicesText} project. My dynamic quote is ${priceText}.${discountText} Let's initiate the protocol!`;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      Name: contact.name,
      Email: contact.email,
      Services: servicesText,
      QuoteRange: priceText,
      DiscountApplied: discountApplied ? "Yes (-15%)" : "No",
    };

    try {
      // Formspree endpoint (you need to replace YOUR_FORMSPREE_ID with your actual id e.g. xvgznqbw)
      await fetch("https://formspree.io/f/xzdyqvee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      closeFunnel();
    } catch (err) {
      console.error(err);
      // Fallback in case of an error just close it
      closeFunnel();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
        >
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            onClick={closeFunnel}
          />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
          >
            <div className="flex justify-between items-center p-5 md:p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-xs font-mono uppercase tracking-widest text-white/50">
                  Secure Sync
                </span>
              </div>
              <button
                onClick={closeFunnel}
                className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors shadow-lg"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto w-full relative">
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="text-2xl md:text-3xl font-display text-white mb-2">
                    Identify Yourself
                  </h3>
                  <p className="text-white/40 font-sans text-sm">
                    Enter your details to initiate the protocol.
                  </p>
                </div>

                <form className="space-y-3 mt-2" onSubmit={handleFormSubmit}>
                  <input
                    type="text"
                    required
                    placeholder="Your Name *"
                    value={contact.name}
                    onChange={(e) =>
                      setContact({ ...contact, name: e.target.value })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Your Email *"
                    value={contact.email}
                    onChange={(e) =>
                      setContact({ ...contact, email: e.target.value })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition-colors"
                  />

                  <button
                    type="submit"
                    disabled={!contact.name || !contact.email || isSubmitting}
                    className={`w-full py-4 mt-2 font-medium font-display rounded-xl transition-all shadow-lg text-sm border ${!contact.name || !contact.email ? "bg-purple-600/20 text-white/40 cursor-not-allowed border-purple-500/20" : "bg-purple-600 text-white border-purple-500 hover:bg-purple-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]"}`}
                  >
                    {isSubmitting
                      ? "Deploying..."
                      : `Deploy $${priceRange.min}-$${priceRange.max} Project Engine`}
                  </button>
                </form>

                <div className="mt-2 flex flex-col gap-3">
                  <div className="flex items-center gap-2 mb-1 text-[10px] uppercase font-mono text-white/40">
                    <Copy className="w-3 h-3" /> Connect Instantly
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href={`https://wa.me/60146266292?text=${encodeURIComponent(finalMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-3 font-medium font-sans rounded-xl transition-all flex justify-center items-center gap-2 text-sm border bg-[#25D366]/20 text-[#25D366] border-[#25D366]/50 hover:bg-[#25D366] hover:text-white hover:border-[#25D366] shadow-[0_0_20px_rgba(37,211,102,0.15)] hover:shadow-[0_0_20px_rgba(37,211,102,0.3)] !pointer-events-auto !cursor-pointer"
                    >
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                      </svg>
                      WhatsApp
                    </a>
                    <a
                      href={`https://t.me/leong061124?text=${encodeURIComponent(finalMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-3 font-medium font-sans rounded-xl transition-all flex justify-center items-center gap-2 text-sm border bg-[#229ED9]/20 text-[#229ED9] border-[#229ED9]/50 hover:bg-[#229ED9] hover:text-white hover:border-[#229ED9] shadow-[0_0_20px_rgba(34,158,217,0.15)] hover:shadow-[0_0_20px_rgba(34,158,217,0.3)] !pointer-events-auto !cursor-pointer"
                    >
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                      </svg>
                      Telegram
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}



// --- Unified Layout ---
export default function FullLandingPage() {
  return (
    <div className="bg-[#050505] min-h-screen text-white font-sans selection:bg-purple-500/30 overflow-x-hidden">
      <HeroSection />
      <ProcessSection />
      <PricingSection />
      <FloatingCTA />
      <ContactSection />
    </div>
  );
}

"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Preload, AdaptiveEvents } from '@react-three/drei';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger'; // 使用 dist 路径更稳定
import { useGSAP } from '@gsap/react';
import { Check, ArrowRight, Sparkles, X, Zap, Percent, Copy } from 'lucide-react';

// 只有在浏览器环境下才注册插件
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// --- MaskReveal.tsx ---
function MaskReveal({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (typeof window === 'undefined' || !containerRef.current || !contentRef.current) return;
    
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
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      <div ref={contentRef} className="origin-top-left will-change-transform">
        {children}
      </div>
    </div>
  );
}

// --- MagneticButton.tsx ---
function MagneticButton({ children, className = '', strength = 0.2, ...props }: any) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const button = buttonRef.current;
    if (!button) return;

    const isMouseDevice = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!isMouseDevice) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distX = e.clientX - centerX;
      const distY = e.clientY - centerY;
      const distance = Math.hypot(distX, distY);
      
      if (distance < 150) {
        gsap.to(button, {
          x: distX * strength,
          y: distY * strength,
          duration: 0.6,
          ease: "power2.out",
          overwrite: "auto"
        });
      } else {
        gsap.to(button, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.3)", overwrite: "auto" });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [strength]);

  return (
    <button ref={buttonRef} className={`relative z-20 pointer-events-auto will-change-transform ${className}`} {...props}>
      {children}
    </button>
  );
}

// --- ScrambleText.tsx ---
const CHARS = '!<>-_\\\\/[]{}—=+*^?#_01';
function ScrambleText({ text, className = '' }: { text: string, className?: string }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number>(0);
  
  const playScramble = () => {
    if (!textRef.current) return;
    let frame = 0;
    const targetLength = text.length;
    const animate = () => {
      frame++;
      let currentText = '';
      const progress = frame / 40;
      for(let i = 0; i < targetLength; i++) {
        if (progress * targetLength > i) { currentText += text[i]; }
        else { currentText += text[i] === ' ' ? ' ' : CHARS[Math.floor(Math.random() * CHARS.length)]; }
      }
      if (textRef.current) textRef.current.innerText = currentText;
      if (progress < 1) animationRef.current = requestAnimationFrame(animate);
    };
    animate();
  };

  useGSAP(() => {
    if (typeof window === 'undefined' || !textRef.current) return;
    ScrollTrigger.create({
      trigger: textRef.current,
      start: 'top 90%',
      onEnter: () => playScramble(),
      once: true
    });
  }, { scope: textRef });

  return <span ref={textRef} className={className}>{text}</span>;
}

// --- Hero Section Components ---
const HeroVertexShader = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const HeroFragmentShader = `
  uniform float uTime; uniform vec2 uResolution; uniform float uIsMobile; uniform vec3 color1; uniform vec3 color2; uniform vec3 color3; varying vec2 vUv;
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,-0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g);
  }
  void main() {
    vec2 uv = vUv; float aspect = uResolution.x / uResolution.y; uv.x *= aspect;
    float n1 = snoise(uv * 1.5 + uTime * 0.15); float n2 = snoise(uv * 3.0 - uTime * 0.2 + n1);
    float n3 = uIsMobile > 0.5 ? 0.0 : snoise(uv * 2.0 + uTime * 0.1 - n2 * 0.5);
    vec3 finalColor = mix(color1, color2, smoothstep(-1.0, 1.0, n1));
    finalColor = mix(finalColor, color3, smoothstep(-1.0, 1.0, n2) * 0.6 + smoothstep(-1.0, 1.0, n3) * 0.4);
    gl_FragColor = vec4(finalColor * 0.9, 1.0);
  }
`;

function LiquidMeshGradient() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size, viewport } = useThree();
  const isMobile = size.width < 768;

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uResolution: { value: new THREE.Vector2(size.width, size.height) }, uIsMobile: { value: isMobile ? 1.0 : 0.0 },
    color1: { value: new THREE.Color('#0a0b1e') }, color2: { value: new THREE.Color('#bf00ff') }, color3: { value: new THREE.Color('#00ffd1') },
  }), [size, isMobile]);

  useFrame((state) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1, 16, 16]} />
      <shaderMaterial ref={materialRef} vertexShader={HeroVertexShader} fragmentShader={HeroFragmentShader} uniforms={uniforms} transparent />
    </mesh>
  );
}

function HeroSection() {
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const [blur, setBlur] = useState(0);

  useEffect(() => {
    const handleScroll = () => setBlur(Math.min(window.scrollY / 50, 10));
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useGSAP(() => {
    if (!headlineRef.current) return;
    gsap.fromTo(headlineRef.current.children, 
      { y: 80, opacity: 0, rotateX: -30 }, 
      { y: 0, opacity: 1, rotateX: 0, duration: 1.5, stagger: 0.2, ease: 'power4.out' }
    );
  }, { scope: headlineRef });

  return (
    <section className="relative w-full h-screen flex flex-col justify-center items-center overflow-hidden">
      <div className="fixed inset-0 -z-10" style={{ filter: `blur(${blur}px)` }}>
        <Canvas gl={{ antialias: false }} dpr={[1, 1.5]}><LiquidMeshGradient /></Canvas>
      </div>
      <div className="relative z-10 text-center px-6">
        <div ref={headlineRef} className="perspective-1000">
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-white">
            <span className="block">Crafting</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-300">Conversion</span>
            <span className="block">Systems</span>
          </h1>
        </div>
        <p className="mt-8 text-white/60 max-w-lg mx-auto text-lg">We engineer elite B2B digital architectures that turn visitors into loyal clients.</p>
        <div className="mt-10">
          <MagneticButton onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-4 bg-white text-black rounded-full font-bold">Explore Operations</MagneticButton>
        </div>
      </div>
    </section>
  );
}

// --- Pricing Section ---
const services = [
  { id: 'logo', name: 'Logo Design', min: 50, max: 300 },
  { id: 'copy', name: 'Copywriting', min: 100, max: 500 },
  { id: 'landing', name: 'Landing Page', min: 500, max: 1500 },
  { id: 'web', name: 'Full Website', min: 1500, max: 5000 },
];

function PricingSection() {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  
  const totalMin = selected.reduce((acc, id) => acc + (services.find(s => s.id === id)?.min || 0), 0);
  const totalMax = selected.reduce((acc, id) => acc + (services.find(s => s.id === id)?.max || 0), 0);

  return (
    <section id="pricing" className="py-32 bg-black px-6">
      <div className="max-w-4xl mx-auto">
        <MaskReveal><h2 className="text-4xl md:text-6xl font-bold text-white mb-16 text-center">Dynamic Estimator</h2></MaskReveal>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map(s => (
            <button key={s.id} onClick={() => toggle(s.id)} className={`p-8 rounded-2xl border transition-all text-left ${selected.includes(s.id) ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 bg-white/5'}`}>
              <h3 className="text-xl font-bold text-white">{s.name}</h3>
              <p className="text-white/40 mt-2">${s.min} - ${s.max}</p>
            </button>
          ))}
        </div>
        <div className="mt-12 p-8 bg-white/5 rounded-3xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Estimated Investment</p>
            <div className="text-4xl font-bold text-white">${totalMin} - ${totalMax}</div>
          </div>
          <button onClick={() => window.open(`https://wa.me/60146266292?text=Hi, I want a project with ${selected.join(', ')}`, '_blank')} className="px-10 py-4 bg-purple-600 text-white rounded-full font-bold hover:bg-purple-500 transition-colors">Start Project</button>
        </div>
      </div>
    </section>
  );
}

// --- Main Page ---
export default function PortfolioPage() {
  return (
    <main className="bg-black min-h-screen">
      <HeroSection />
      <PricingSection />
      <footer className="py-10 text-center text-white/20 text-xs border-t border-white/5">© 2026 KA RJ UN. ALL RIGHTS RESERVED.</footer>
    </main>
  );
}
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { gsap } from 'gsap';

export interface FlyingBeeHandle {
  setProgress: (p: number) => void;
  show: () => void;
  hide: () => void;
  reset: () => void;
}

export interface FlyingBeeProps {
  getAnchor: () => { x: number; y: number; width: number; height: number } | null;
  headingRef: React.RefObject<HTMLElement | null>;
  toggleRef: React.RefObject<HTMLElement | null>;
  ctaRestRef: React.RefObject<HTMLElement | null>;
  onPatchOpacity?: (opacity: number) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxLife: number;
  life: number;
  color: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

const cubic = (a: number, b: number, c: number, d: number, t: number) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;

export const FlyingBee = forwardRef<FlyingBeeHandle, FlyingBeeProps>(function FlyingBee(
  { getAnchor, headingRef, toggleRef, ctaRestRef, onPatchOpacity },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);
  const forewingRef = useRef<HTMLDivElement>(null);
  const farwingRef = useRef<HTMLDivElement>(null);
  const wingBlurRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pure refs for zero-re-render 60fps/120fps flight engine
  const progressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const isVisibleRef = useRef(false);
  const scrollVelocityRef = useRef(0);
  const lastProgressRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const hasEmittedBurstRef = useRef(false);
  const particlesRef = useRef<Particle[]>([]);

  useImperativeHandle(ref, () => ({
    setProgress: (p: number) => {
      targetProgressRef.current = clamp01(p);
      isVisibleRef.current = p > 0.002;
    },
    show: () => {
      isVisibleRef.current = true;
      if (containerRef.current) gsap.set(containerRef.current, { autoAlpha: 1 });
    },
    hide: () => {
      isVisibleRef.current = false;
      if (containerRef.current) gsap.to(containerRef.current, { autoAlpha: 0, duration: 0.25, overwrite: true });
    },
    reset: () => {
      targetProgressRef.current = 0;
      progressRef.current = 0;
      isVisibleRef.current = false;
      hasEmittedBurstRef.current = false;
      if (containerRef.current) gsap.set(containerRef.current, { autoAlpha: 0 });
      onPatchOpacity?.(0);
    },
  }));

  // Track cursor for subtle 3D parallax
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  // Main high-performance flight engine loop
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animId: number;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    const updateCanvasSize = () => {
      if (!canvas) return;
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize, { passive: true });

    const emitPollen = (x: number, y: number, count = 1, isBurst = false) => {
      if (reducedMotion) return;
      const palette = ['#ffd452', '#ffbe26', '#ffe885', '#f59e0b', '#fffaf0'];
      for (let i = 0; i < count; i += 1) {
        const angle = isBurst ? Math.random() * Math.PI * 2 : (Math.random() - 0.5) * 1.8 + Math.PI;
        const speed = isBurst ? 1.8 + Math.random() * 5.2 : 0.8 + Math.random() * 2.4;
        particlesRef.current.push({
          x: x + (Math.random() - 0.5) * 16,
          y: y + (Math.random() - 0.5) * 14,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed + (isBurst ? -0.4 : 0.5),
          size: 1.3 + Math.random() * (isBurst ? 3.0 : 2.0),
          alpha: 0.9 + Math.random() * 0.1,
          maxLife: isBurst ? 50 + Math.random() * 35 : 32 + Math.random() * 22,
          life: 0,
          color: palette[Math.floor(Math.random() * palette.length)],
        });
      }
      if (particlesRef.current.length > 95) {
        particlesRef.current.splice(0, particlesRef.current.length - 95);
      }
    };

    const tick = (currentTime: number) => {
      const dt = Math.min(32, currentTime - lastTimeRef.current);
      lastTimeRef.current = currentTime;

      // Smooth progress interpolation
      const targetP = targetProgressRef.current;
      progressRef.current += (targetP - progressRef.current) * 0.18;
      const p = progressRef.current;

      const deltaP = Math.abs(p - lastProgressRef.current);
      lastProgressRef.current = p;
      scrollVelocityRef.current = scrollVelocityRef.current * 0.85 + (deltaP / (dt || 16)) * 140 * 0.15;

      // Cursor soft easing
      const m = mouseRef.current;
      m.x += (m.targetX - m.x) * 0.05;
      m.y += (m.targetY - m.y) * 0.05;

      const timeSec = currentTime * 0.001;

      const container = containerRef.current;
      const rig = rigRef.current;
      const shadow = shadowRef.current;
      const body = bodyRef.current;

      const cRect = ctaRestRef.current?.getBoundingClientRect();
      const isCardOffscreen = p >= 0.85 && Boolean(cRect && cRect.bottom <= 0);
      const isVisible = p > 0.002 && !isCardOffscreen && !reducedMotion;

      if (!isVisible) {
        if (container) gsap.set(container, { autoAlpha: 0 });
        if (p <= 0.002) onPatchOpacity?.(0);
      } else if (container && rig) {
        // --- 1. RESOLVE THE 4 TARGET WAYPOINTS ---
        // W0: 3D Canvas Stage (Start)
        const sourcePoint = getAnchor();
        const fallbackStart = {
          x: window.innerWidth * 0.68,
          y: window.innerHeight * 0.50,
          width: Math.min(500, window.innerWidth * 0.40),
          height: Math.min(420, window.innerWidth * 0.40 * (420 / 520)),
        };
        const w0 = sourcePoint && sourcePoint.width > 20 ? sourcePoint : fallbackStart;

        // W1: On top of heading "See the difference for yourself."
        const hRect = headingRef.current?.getBoundingClientRect();
        const w1 = hRect?.width
          ? {
              x: hRect.left + Math.min(220, hRect.width * 0.28),
              y: hRect.top - 20,
              width: 135,
              height: 135 * (420 / 520),
            }
          : {
              x: window.innerWidth * 0.35,
              y: window.innerHeight * 0.35,
              width: 135,
              height: 135 * (420 / 520),
            };

        // W2: On top of compare toggle "Side by side / Drag to compare"
        const tRect = toggleRef.current?.getBoundingClientRect();
        const w2 = tRect?.width
          ? {
              x: tRect.left + tRect.width * 0.5,
              y: tRect.top - 18,
              width: 108,
              height: 108 * (420 / 520),
            }
          : {
              x: window.innerWidth * 0.55,
              y: window.innerHeight * 0.52,
              width: 108,
              height: 108 * (420 / 520),
            };

        // W3: Final rest point on the RIGHT side of CTA section ("Bring it into focus")
        const cRect = ctaRestRef.current?.getBoundingClientRect();
        const targetCtaW = Math.min(430, window.innerWidth * 0.36);
        const w3 = cRect?.width
          ? {
              x: cRect.left + cRect.width * 0.5,
              y: cRect.top + cRect.height * 0.46,
              width: targetCtaW,
              height: targetCtaW * (420 / 520),
            }
          : {
              x: window.innerWidth * 0.72,
              y: window.innerHeight * 0.55,
              width: targetCtaW,
              height: targetCtaW * (420 / 520),
            };

        // --- 2. MULTI-STAGE TRAJECTORY & SMOOTH FLIGHT ROTATION ---
        let posX = w0.x;
        let posY = w0.y;
        let curWidth = w0.width;
        let curHeight = w0.height;
        let pitch = 0;
        let roll = 0;
        let popLift = 0;
        let isPerched = false;

        if (p <= 0.12) {
          // --- PHASE 0: 3D Canvas Awakening & Takeoff ---
          const pop = smooth(p / 0.12);
          popLift = pop;
          posX = w0.x;
          posY = w0.y - pop * 14;
          curWidth = w0.width;
          curHeight = w0.height;
          pitch = -pop * 6.0;
          roll = 0.0;
          onPatchOpacity?.(smooth(p / 0.10));

          // Takeoff pollen burst
          if (p >= 0.05 && !hasEmittedBurstRef.current) {
            emitPollen(posX, posY, 26, true);
            hasEmittedBurstRef.current = true;
          } else if (p < 0.03) {
            hasEmittedBurstRef.current = false;
          }
        } else if (p <= 0.38) {
          // --- PHASE 1: Flight from 3D Stage down to Heading text ---
          onPatchOpacity?.(1.0);
          const t = smooth((p - 0.12) / 0.22);
          const p0 = { x: w0.x, y: w0.y - 14 };
          const p1 = { x: w0.x - window.innerWidth * 0.08, y: w0.y - window.innerHeight * 0.16 };
          const p2 = { x: w1.x + window.innerWidth * 0.06, y: w1.y - window.innerHeight * 0.14 };
          const p3 = { x: w1.x, y: w1.y };

          posX = cubic(p0.x, p1.x, p2.x, p3.x, t);
          posY = cubic(p0.y, p1.y, p2.y, p3.y, t);

          // Gradually reduce size from 480px down to 135px
          curWidth = w0.width + (w1.width - w0.width) * t;
          curHeight = w0.height + (w1.height - w0.height) * t;

          // Smooth aerodynamic banking into the curve, fading to 0 as it settles on the text
          const bell = 4.0 * t * (1.0 - t);
          pitch = -6.0 * (1.0 - t) + 8.0 * bell;
          roll = -12.0 * bell;

          if (t >= 0.92) isPerched = true;
        } else if (p <= 0.65) {
          // --- PHASE 2: Glide from Heading down to Compare Toggle ---
          onPatchOpacity?.(1.0);
          const t = smooth((p - 0.38) / 0.18);
          const p0 = { x: w1.x, y: w1.y };
          const p1 = { x: w1.x + 45, y: w1.y - 30 };
          const p2 = { x: w2.x - 35, y: w2.y - 35 };
          const p3 = { x: w2.x, y: w2.y };

          posX = cubic(p0.x, p1.x, p2.x, p3.x, t);
          posY = cubic(p0.y, p1.y, p2.y, p3.y, t);

          // Size is compact (135px -> 108px)
          curWidth = w1.width + (w2.width - w1.width) * t;
          curHeight = w1.height + (w2.height - w1.height) * t;

          // Gentle banking hop
          const bell = 4.0 * t * (1.0 - t);
          pitch = 6.0 * bell;
          roll = 9.0 * bell;

          // Waits atop the toggle buttons while user compares images
          if (t >= 0.88 || p < 0.42) isPerched = true;
        } else {
          // --- PHASE 3: Takeoff from Toggle & Gradual Growth into CTA Section ---
          onPatchOpacity?.(1.0);
          const t = smooth((p - 0.65) / 0.26);
          const p0 = { x: w2.x, y: w2.y };
          const p1 = { x: w2.x + window.innerWidth * 0.10, y: w2.y + window.innerHeight * 0.12 };
          const p2 = { x: w3.x - window.innerWidth * 0.08, y: w3.y - window.innerHeight * 0.16 };
          const p3 = { x: w3.x, y: w3.y };

          posX = cubic(p0.x, p1.x, p2.x, p3.x, t);
          posY = cubic(p0.y, p1.y, p2.y, p3.y, t);

          // Gradually increases back to glorious macro scale (108px -> 420px)
          curWidth = w2.width + (w3.width - w2.width) * t;
          curHeight = w2.height + (w3.height - w2.height) * t;

          // Dynamic swoop and banking into the right-side rest area
          const bell = 4.0 * t * (1.0 - t);
          pitch = -5.0 * bell;
          roll = 14.0 * bell;

          if (t >= 0.90) isPerched = true;
        }

        const isFullyRested = p >= 0.88;
        if (isFullyRested) {
          isPerched = true;
          pitch = 0;
          roll = 0;
          posX = w3.x;
          posY = w3.y;
          curWidth = w3.width;
          curHeight = w3.height;
        }

        // Flight trail pollen particles while actively travelling
        if (!isPerched && p >= 0.12 && p < 0.90 && Math.random() < 0.35) {
          emitPollen(posX - curWidth * 0.18, posY - curHeight * 0.06, 1);
        }

        // Hover Lissajous Physics (gentle living breath even when stopped)
        const hoverIntensity = isFullyRested ? 0.15 : isPerched ? 0.35 : 1.0;
        const hoverX = Math.sin(timeSec * 3.0) * (4.5 * hoverIntensity);
        const hoverY = (Math.cos(timeSec * 3.8) * 5 + Math.sin(timeSec * 7.5) * 1.5) * hoverIntensity;
        const hoverTilt = Math.sin(timeSec * 3.2) * (1.8 * hoverIntensity);

        const finalX = posX + hoverX;
        const finalY = posY + hoverY;

        // Cursor parallax
        const mousePitch = m.y * 3.0;
        const mouseYaw = m.x * 4.5;

        // Z-Depth / Pop scale
        const zLift = isFullyRested ? 0 : Math.sin(popLift * Math.PI) * 0.18;
        const scale = 1.0 + zLift;

        const alpha = smooth(p / 0.015);

        // Update container transform
        gsap.set(container, {
          x: finalX,
          y: finalY,
          xPercent: -50,
          yPercent: -50,
          width: curWidth,
          height: curHeight,
          autoAlpha: alpha,
        });

        // 3D Rig orientation (continuous, zero sudden rotations)
        const finalRoll = isFullyRested ? 0 : (roll + hoverTilt).toFixed(2);
        const finalPitch = isFullyRested ? (mousePitch * 0.25).toFixed(2) : (pitch + mousePitch).toFixed(2);
        const finalYaw = isFullyRested ? (mouseYaw * 0.25).toFixed(2) : (mouseYaw - roll * 0.25).toFixed(2);

        rig.style.transform = `perspective(1000px) rotateZ(${finalRoll}deg) rotateY(${finalYaw}deg) rotateX(${finalPitch}deg) scale(${scale.toFixed(3)})`;

        // Abdomen breathing pulse
        if (body) {
          const breathRate = isFullyRested ? 3.2 : 4.5;
          const breathAmp = isFullyRested ? 0.008 : 0.012;
          const breath = 1.0 + Math.sin(timeSec * breathRate) * breathAmp;
          body.style.transform = `scale(${breath.toFixed(4)})`;
        }

        // Dynamic Cast / Contact Shadow
        if (shadow) {
          const shadowOffset = isFullyRested ? 4 : isPerched ? 6 : 8 + popLift * 24;
          const shadowBlur = isFullyRested ? 4 : isPerched ? 5 : 4 + popLift * 26;
          const shadowAlpha = isFullyRested ? 0.65 : isPerched ? 0.5 : 0.55 * (1 - popLift * 0.45);
          const shadowScale = isFullyRested ? 0.82 : isPerched ? 0.85 : 1.0 + popLift * 0.3;

          shadow.style.transform = `translate3d(0, ${shadowOffset}px, 0) scale(${shadowScale})`;
          shadow.style.filter = `blur(${shadowBlur}px)`;
          shadow.style.opacity = shadowAlpha.toFixed(3);
        }

        // --- 3. WING FLUTTER ENGINE ---
        // When fully rested on the card, wings are smoothly folded flat
        if (isFullyRested) {
          if (forewingRef.current) {
            forewingRef.current.style.transform = 'rotateZ(0deg) rotateX(0deg) scale(1)';
          }
          if (farwingRef.current) {
            farwingRef.current.style.transform = 'rotateZ(-3deg) rotateX(0deg) scale(0.96)';
          }
          if (wingBlurRef.current) {
            wingBlurRef.current.style.opacity = '0';
          }
        } else {
          let flapFrequency = 0;
          let flapAmplitude = 0;

          if (p >= 0.02) {
            if (isPerched) {
              // Calm living rest / breathing flutter while waiting on heading or toggle
              flapFrequency = 11;
              flapAmplitude = 6;
            } else {
              // Active flight
              const speedBoost = Math.min(18, scrollVelocityRef.current * 16);
              flapFrequency = 24 + speedBoost;
              flapAmplitude = 20 + Math.min(8, speedBoost * 0.35);
            }
          }

          const wingPhase = (timeSec * flapFrequency * Math.PI * 2) % (Math.PI * 2);
          const wingFlap = Math.sin(wingPhase) * flapAmplitude;
          const wingPitchVal = Math.cos(wingPhase) * (flapAmplitude * 0.35);
          const wingScaleY = 0.88 + Math.cos(wingPhase) * 0.20;

          if (forewingRef.current) {
            forewingRef.current.style.transform = `rotateZ(${-wingFlap.toFixed(2)}deg) rotateX(${wingPitchVal.toFixed(2)}deg) scaleY(${wingScaleY.toFixed(3)})`;
          }

          if (farwingRef.current) {
            const farFlap = Math.sin(wingPhase + 0.35) * (flapAmplitude * 0.9);
            const farPitch = Math.cos(wingPhase + 0.35) * (flapAmplitude * 0.3);
            farwingRef.current.style.transform = `rotateZ(${(-farFlap * 0.95 - 4).toFixed(2)}deg) rotateX(${farPitch.toFixed(2)}deg) scaleY(${(wingScaleY * 0.92).toFixed(3)})`;
          }

          if (wingBlurRef.current) {
            const blurIntensity = !isPerched && flapFrequency > 16 ? Math.min(0.85, (flapFrequency / 36) * 0.7 + Math.abs(Math.sin(wingPhase)) * 0.2) : 0;
            wingBlurRef.current.style.opacity = blurIntensity.toFixed(3);
            wingBlurRef.current.style.transform = `rotateZ(${(-wingFlap * 0.35).toFixed(2)}deg) scale(${(1.0 + Math.abs(Math.sin(wingPhase)) * 0.08).toFixed(3)})`;
          }
        }
      }

      // Render Pollen Particles
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const pt = particles[i];
          pt.life += 1;
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.vx *= 0.96;
          pt.vy += 0.035;
          const lifeProgress = pt.life / pt.maxLife;
          if (lifeProgress >= 1) {
            particles.splice(i, 1);
            continue;
          }
          const currentAlpha = pt.alpha * (1 - lifeProgress);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size * (1 - lifeProgress * 0.3), 0, Math.PI * 2);
          ctx.fillStyle = pt.color;
          ctx.globalAlpha = currentAlpha;
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#ffd452';
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [getAnchor, headingRef, toggleRef, ctaRestRef, onPatchOpacity]);

  return (
    <>
      {/* Fullscreen Golden Pollen Dust Canvas Layer */}
      <canvas ref={canvasRef} className="bee-pollen-canvas" aria-hidden="true" />

      {/* Main Flying Bee Rig */}
      <div ref={containerRef} className="bee-flight-rig-wrap" aria-hidden="true">
        {/* Dynamic Contact / Cast Shadow */}
        <div ref={shadowRef} className="bee-cast-shadow">
          <img src="/images/bee-shadow.png" alt="" />
        </div>

        {/* 3D Oriented Bee Rig */}
        <div ref={rigRef} className="bee-3d-rig">
          {/* Far Wing Layer (peeks behind thorax with 3D depth) */}
          <div ref={farwingRef} className="bee-wing-layer bee-wing-far">
            <img src="/images/bee-wings.png" alt="" />
          </div>

          {/* High-Resolution Bee Body Layer */}
          <div ref={bodyRef} className="bee-body-layer">
            <img src="/images/bee-body.png" className="bee-body-image" alt="" />
            {/* Shimmering specular glint highlight on emergence */}
            <div className="bee-specular-sheen" />
          </div>

          {/* Fore Wing Layer (in front of thorax, pivots at anatomical wing hinge) */}
          <div ref={forewingRef} className="bee-wing-layer bee-wing-fore">
            <img src="/images/bee-wings.png" alt="" />
          </div>

          {/* High-Speed Wing Flutter Motion Blur Fan Layer */}
          <div ref={wingBlurRef} className="bee-wing-layer bee-wing-blur-fan">
            <img src="/images/bee-wing-blur.png" alt="" />
          </div>
        </div>
      </div>
    </>
  );
});

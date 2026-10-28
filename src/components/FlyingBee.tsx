import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { gsap } from 'gsap';

export interface FlyingBeeHandle {
  setProgress: (p: number) => void;
  show: () => void;
  hide: () => void;
  reset: () => void;
  flyToScreenAndDepart: (onComplete: () => void, onFadeVeil?: () => void) => void;
  isTransitioning: () => boolean;
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

type TransitionMode = 'idle_scroll' | 'fly_to_screen' | 'sit_on_screen' | 'fly_away' | 'completed';

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
  const bellyVolumeRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);
  const reflectionRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);

  // Monitor glass surface and foot contact refs
  const glassPaneRef = useRef<HTMLDivElement>(null);
  const footShadowsRef = useRef<HTMLDivElement>(null);
  const footPad1Ref = useRef<HTMLDivElement>(null);
  const footPad2Ref = useRef<HTMLDivElement>(null);
  const footPad3Ref = useRef<HTMLDivElement>(null);

  // Pure refs for zero-re-render flight engine
  const progressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const isVisibleRef = useRef(false);
  const scrollVelocityRef = useRef(0);
  const lastProgressRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const hasEmittedBurstRef = useRef(false);
  const particlesRef = useRef<Particle[]>([]);

  // Cinematic screen-landing transition refs
  const transitionModeRef = useRef<TransitionMode>('idle_scroll');
  const transitionStartTimeRef = useRef(0);
  const sittingStartTimeRef = useRef(0);
  const flyAwayStartTimeRef = useRef(0);
  const onCompleteCallbackRef = useRef<(() => void) | null>(null);
  const onVeilFadeCallbackRef = useRef<(() => void) | null>(null);

  const hasEmittedTouchdownRef = useRef(false);
  const hasEmittedTakeoffRef = useRef(false);
  const hasTriggeredVeilRef = useRef(false);
  const lastSitPollenTimeRef = useRef(0);

  // Target 3D orientation for sitting: belly & feet angled directly toward viewer
  const TARGET_SIT_PITCH = 42.0; // rotateX: tilts bottom (belly & feet) forward toward camera
  const TARGET_SIT_YAW = -18.0;  // rotateY: angles body to reveal round 3D curvature of thorax
  const TARGET_SIT_ROLL = -18.0; // rotateZ: natural diagonal climbing/perched posture on vertical glass

  const startTransformRef = useRef({
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    roll: 0,
    pitch: 0,
    yaw: 0,
    scale: 1,
  });

  const currentTransformRef = useRef({
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    roll: 0,
    pitch: 0,
    yaw: 0,
    scale: 1,
  });

  useImperativeHandle(ref, () => ({
    setProgress: (p: number) => {
      if (transitionModeRef.current !== 'idle_scroll') return;
      targetProgressRef.current = clamp01(p);
      isVisibleRef.current = p > 0.002;
    },
    show: () => {
      isVisibleRef.current = true;
      if (containerRef.current) gsap.set(containerRef.current, { autoAlpha: 1 });
    },
    hide: () => {
      if (transitionModeRef.current !== 'idle_scroll') return;
      isVisibleRef.current = false;
      if (containerRef.current) gsap.to(containerRef.current, { autoAlpha: 0, duration: 0.25, overwrite: true });
    },
    reset: () => {
      targetProgressRef.current = 0;
      progressRef.current = 0;
      isVisibleRef.current = false;
      hasEmittedBurstRef.current = false;
      transitionModeRef.current = 'idle_scroll';
      if (containerRef.current) gsap.set(containerRef.current, { autoAlpha: 0 });
      if (vignetteRef.current) gsap.set(vignetteRef.current, { opacity: 0 });
      if (rippleRef.current) gsap.set(rippleRef.current, { opacity: 0, scale: 0.2 });
      if (reflectionRef.current) gsap.set(reflectionRef.current, { opacity: 0 });
      if (glassPaneRef.current) gsap.set(glassPaneRef.current, { opacity: 0 });
      if (footShadowsRef.current) gsap.set(footShadowsRef.current, { opacity: 0 });
      footPad1Ref.current?.classList.remove('is-pressed');
      footPad2Ref.current?.classList.remove('is-pressed');
      footPad3Ref.current?.classList.remove('is-pressed');
      onPatchOpacity?.(0);
    },
    flyToScreenAndDepart: (onComplete: () => void, onFadeVeil?: () => void) => {
      if (transitionModeRef.current !== 'idle_scroll' && transitionModeRef.current !== 'completed') {
        return;
      }

      transitionModeRef.current = 'fly_to_screen';
      transitionStartTimeRef.current = performance.now();
      onCompleteCallbackRef.current = onComplete;
      onVeilFadeCallbackRef.current = onFadeVeil || null;
      hasEmittedTouchdownRef.current = false;
      hasEmittedTakeoffRef.current = false;
      hasTriggeredVeilRef.current = false;

      footPad1Ref.current?.classList.remove('is-pressed');
      footPad2Ref.current?.classList.remove('is-pressed');
      footPad3Ref.current?.classList.remove('is-pressed');
      if (glassPaneRef.current) glassPaneRef.current.style.opacity = '0';
      if (footShadowsRef.current) footShadowsRef.current.style.opacity = '0';

      if (progressRef.current <= 0.002) {
        // Hero section inside 3D canvas
        const anchor = getAnchor();
        const fallbackStart = {
          x: window.innerWidth * 0.68,
          y: window.innerHeight * 0.50,
          width: Math.min(500, window.innerWidth * 0.40),
          height: Math.min(420, window.innerWidth * 0.40 * (420 / 520)),
        };
        const start = anchor && anchor.width > 20 ? anchor : fallbackStart;
        startTransformRef.current = {
          x: start.x,
          y: start.y,
          width: start.width,
          height: start.height,
          roll: 0,
          pitch: 0,
          yaw: 0,
          scale: 1,
        };
        onPatchOpacity?.(1.0);
        if (containerRef.current) gsap.set(containerRef.current, { autoAlpha: 1 });
        emitPollenHelper(start.x, start.y, 24, true);
      } else {
        startTransformRef.current = { ...currentTransformRef.current };
        if (containerRef.current) gsap.set(containerRef.current, { autoAlpha: 1 });
        emitPollenHelper(startTransformRef.current.x, startTransformRef.current.y, 16, true);
      }
    },
    isTransitioning: () =>
      transitionModeRef.current !== 'idle_scroll' && transitionModeRef.current !== 'completed',
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

  const emitPollenHelper = (x: number, y: number, count = 1, isBurst = false) => {
    const palette = ['#ffd452', '#ffbe26', '#ffe885', '#f59e0b', '#fffaf0'];
    for (let i = 0; i < count; i += 1) {
      const angle = isBurst ? Math.random() * Math.PI * 2 : (Math.random() - 0.5) * 1.8 + Math.PI;
      const speed = isBurst ? 2.0 + Math.random() * 5.4 : 0.8 + Math.random() * 2.4;
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 18,
        y: y + (Math.random() - 0.5) * 16,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + (isBurst ? -0.4 : 0.5),
        size: 1.4 + Math.random() * (isBurst ? 3.2 : 2.2),
        alpha: 0.9 + Math.random() * 0.1,
        maxLife: isBurst ? 55 + Math.random() * 35 : 32 + Math.random() * 22,
        life: 0,
        color: palette[Math.floor(Math.random() * palette.length)],
      });
    }
    if (particlesRef.current.length > 110) {
      particlesRef.current.splice(0, particlesRef.current.length - 110);
    }
  };

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
      emitPollenHelper(x, y, count, isBurst);
    };

    const tick = (currentTime: number) => {
      const dt = Math.min(32, currentTime - lastTimeRef.current);
      lastTimeRef.current = currentTime;
      const timeSec = currentTime * 0.001;

      // Cursor soft easing
      const m = mouseRef.current;
      m.x += (m.targetX - m.x) * 0.05;
      m.y += (m.targetY - m.y) * 0.05;

      const container = containerRef.current;
      const rig = rigRef.current;
      const shadow = shadowRef.current;
      const body = bodyRef.current;
      const reflection = reflectionRef.current;

      const mode = transitionModeRef.current;

      // =========================================================================
      // BRANCH 1: CINEMATIC SCREEN-LANDING TRANSITION
      // =========================================================================
      if (mode !== 'idle_scroll') {
        const targetX = window.innerWidth * 0.5;
        const targetY = window.innerHeight * 0.48;
        const targetWidth = Math.min(
          540,
          window.innerWidth * (window.innerWidth < 640 ? 0.90 : window.innerWidth < 1024 ? 0.65 : 0.42)
        );
        const targetHeight = targetWidth * (420 / 520);

        if (mode === 'fly_to_screen') {
          const elapsed = currentTime - transitionStartTimeRef.current;
          const DURATION = reducedMotion ? 450 : 1000;
          const t = clamp01(elapsed / DURATION);
          const easeT = smooth(t);

          const s = startTransformRef.current;

          // Natural aerodynamic 3D Bezier trajectory from current section to user screen
          const dx = targetX - s.x;
          const dy = targetY - s.y;
          const arcHeight = Math.max(75, Math.min(180, Math.hypot(dx, dy) * 0.22));
          const p0 = { x: s.x, y: s.y };
          const p1 = {
            x: s.x + dx * 0.25 + (s.x > targetX ? 45 : -45),
            y: Math.min(s.y, targetY) - arcHeight,
          };
          const p2 = {
            x: targetX - dx * 0.2,
            y: targetY - arcHeight * 0.4,
          };
          const p3 = { x: targetX, y: targetY };

          const posX = cubic(p0.x, p1.x, p2.x, p3.x, easeT);
          const posY = cubic(p0.y, p1.y, p2.y, p3.y, easeT);
          const curWidth = s.width + (targetWidth - s.width) * easeT;
          const curHeight = s.height + (targetHeight - s.height) * easeT;

          // Flight trajectory banking
          const curveBell = 4.0 * t * (1.0 - t);
          const bankingDir = s.x > targetX ? -1 : 1;
          const flightRoll = s.roll * (1 - easeT) + (reducedMotion ? 0 : curveBell * 15 * bankingDir);
          const flightPitch = s.pitch * (1 - easeT) - (reducedMotion ? 0 : curveBell * 8);
          const flightYaw = s.yaw * (1 - easeT);

          // As t approaches 1.0, rotate into the user-facing belly & feet orientation:
          // TARGET_SIT_PITCH (42deg) tilts belly & feet forward towards viewer
          // TARGET_SIT_YAW (-18deg) angles thorax & head
          // TARGET_SIT_ROLL (-18deg) diagonal clinging angle
          const roll = flightRoll * (1 - easeT) + TARGET_SIT_ROLL * easeT;
          const pitch = flightPitch * (1 - easeT) + TARGET_SIT_PITCH * easeT;
          const yaw = flightYaw * (1 - easeT) + TARGET_SIT_YAW * easeT;

          // Pop scale towards viewer glass
          const popLift = reducedMotion ? 0 : Math.sin(t * Math.PI) * 0.22;
          const scale = 1.0 + popLift;

          // Staggered Foot Contacts as feet touch the inside of the glass pane
          if (t >= 0.92) {
            footPad1Ref.current?.classList.add('is-pressed');
          }
          if (t >= 0.96) {
            footPad2Ref.current?.classList.add('is-pressed');
          }
          if (t >= 0.98) {
            footPad3Ref.current?.classList.add('is-pressed');
            if (footShadowsRef.current) footShadowsRef.current.style.opacity = '1';
            if (glassPaneRef.current) glassPaneRef.current.style.opacity = '1';
          }

          // Active flight wing flutter with motion blur
          const flapFrequency = 34;
          const flapAmplitude = 24;
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
            wingBlurRef.current.style.opacity = '0.84';
            wingBlurRef.current.style.transform = `rotateZ(${(-wingFlap * 0.35).toFixed(2)}deg) scale(1.06)`;
          }

          if (shadow) {
            const shadowOffset = 3 + popLift * 24;
            const shadowBlur = 2.5 + popLift * 22;
            const shadowAlpha = 0.74 * (1 - popLift * 0.35);
            const shadowScale = 0.92 + popLift * 0.2;
            shadow.style.transform = `translate3d(0, ${shadowOffset}px, 0) scale(${shadowScale})`;
            shadow.style.filter = `blur(${shadowBlur}px)`;
            shadow.style.opacity = shadowAlpha.toFixed(3);
          }

          if (!reducedMotion && Math.random() < 0.4) {
            emitPollen(posX - curWidth * 0.15, posY - curHeight * 0.05, 1);
          }

          if (container) {
            gsap.set(container, {
              x: posX,
              y: posY,
              xPercent: -50,
              yPercent: -50,
              width: curWidth,
              height: curHeight,
              autoAlpha: 1,
            });
          }

          if (rig) {
            rig.style.transform = `perspective(620px) rotateX(${pitch.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg) rotateZ(${roll.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
          }

          currentTransformRef.current = {
            x: posX,
            y: posY,
            width: curWidth,
            height: curHeight,
            roll,
            pitch,
            yaw,
            scale,
          };

          // TOUCHDOWN CHECK
          if (t >= 1.0) {
            transitionModeRef.current = 'sit_on_screen';
            sittingStartTimeRef.current = currentTime;
            lastSitPollenTimeRef.current = currentTime;

            footPad1Ref.current?.classList.add('is-pressed');
            footPad2Ref.current?.classList.add('is-pressed');
            footPad3Ref.current?.classList.add('is-pressed');
            if (glassPaneRef.current) glassPaneRef.current.style.opacity = '1';
            if (footShadowsRef.current) footShadowsRef.current.style.opacity = '1';

            if (rippleRef.current) {
              gsap.fromTo(
                rippleRef.current,
                { scale: 0.2, opacity: 0.85 },
                { scale: 1.8, opacity: 0, duration: 0.65, ease: 'power2.out' }
              );
            }
            if (sheenRef.current) {
              gsap.fromTo(
                sheenRef.current,
                { opacity: 0 },
                { opacity: 0.85, duration: 0.3, yoyo: true, repeat: 1 }
              );
            }
            if (vignetteRef.current) {
              gsap.to(vignetteRef.current, { opacity: 1, duration: 0.45 });
            }
            if (reflection) {
              reflection.style.opacity = '0.22';
            }
            emitPollen(targetX, targetY + targetHeight * 0.32, 10, false);
          }
        } else if (mode === 'sit_on_screen') {
          // ===================================================================
          // PHASE: SIT ON USER SCREEN FOR EXACTLY 2 SECONDS (2000 ms)
          // TRULY THREE-DIMENSIONAL & PHYSICALLY PRESENT
          // BELLY & FEET CLEARLY VISIBLE TOWARD VIEWER
          // ZERO FLOATING FEET, ZERO STICKER LOOK
          // ===================================================================
          const sitElapsed = currentTime - sittingStartTimeRef.current;
          const SIT_DURATION = 2000;

          if (sitElapsed < SIT_DURATION) {
            // Subtle living micro-tremors (breathing sway on glass)
            const microSwayX = Math.sin(sitElapsed * 0.0028) * 0.4;
            const microSwayY = Math.cos(sitElapsed * 0.0034) * 0.3;

            const posX = targetX + microSwayX;
            const posY = targetY + microSwayY;

            // Organic respiratory breathing: drives the belly forward towards the glass
            const breath = 1.0 + Math.sin(sitElapsed * 0.0035 * Math.PI * 2) * 0.015;
            if (body) {
              body.style.transform = `scale(${breath.toFixed(4)})`;
            }

            // Ventral belly volume pulses forward in 3D depth
            if (bellyVolumeRef.current) {
              const bellyPulse = Math.sin(sitElapsed * 0.0035 * Math.PI * 2) * 1.5;
              bellyVolumeRef.current.style.transform = `translateZ(${(-1 + bellyPulse).toFixed(2)}px) scale(${(1.0 + Math.sin(sitElapsed * 0.0035 * Math.PI * 2) * 0.018).toFixed(4)})`;
            }

            // Realistic micro-grip adjustments on slippery glass
            if (sitElapsed > 720 && sitElapsed < 880) {
              const microSlip = Math.sin((sitElapsed - 720) * 0.038) * 1.5;
              if (footPad3Ref.current) {
                footPad3Ref.current.style.transform = `scale(${1 + Math.abs(microSlip) * 0.15}) translate(${microSlip.toFixed(1)}px, ${-microSlip.toFixed(1)}px)`;
              }
            } else if (footPad3Ref.current) {
              footPad3Ref.current.style.transform = 'scale(1)';
            }

            if (sitElapsed > 1400 && sitElapsed < 1560) {
              const microSlip2 = Math.sin((sitElapsed - 1400) * 0.038) * 1.2;
              if (footPad2Ref.current) {
                footPad2Ref.current.style.transform = `scale(${1 + Math.abs(microSlip2) * 0.12}) translate(${microSlip2.toFixed(1)}px, ${-microSlip2.toFixed(1)}px)`;
              }
            } else if (footPad2Ref.current) {
              footPad2Ref.current.style.transform = 'scale(1)';
            }

            // Wings folded down with delicate lifelike grooming micro-twitches
            const twitch1 = sitElapsed > 550 && sitElapsed < 780;
            const twitch2 = sitElapsed > 1320 && sitElapsed < 1550;
            let wingTwitch = 0;
            if (twitch1) {
              wingTwitch = Math.sin((sitElapsed - 550) * 0.032) * 4.2;
            } else if (twitch2) {
              wingTwitch = Math.sin((sitElapsed - 1320) * 0.035) * 3.8;
            }

            if (forewingRef.current) {
              forewingRef.current.style.transform = `rotateZ(${-wingTwitch.toFixed(2)}deg) rotateX(0deg) scale(1)`;
            }
            if (farwingRef.current) {
              farwingRef.current.style.transform = `rotateZ(${(-wingTwitch * 0.85 - 3).toFixed(2)}deg) rotateX(0deg) scale(0.96)`;
            }
            if (wingBlurRef.current) {
              wingBlurRef.current.style.opacity = '0';
            }

            // Dynamic deep body shadow behind the bee
            if (shadow) {
              shadow.style.transform = 'translate3d(0, 4px, 0) scale(0.94)';
              shadow.style.filter = 'blur(4px)';
              shadow.style.opacity = '0.62';
            }

            // Cursor subtle 3D parallax
            const mousePitch = m.y * 2.0;
            const mouseYaw = m.x * 2.5;

            // 3D Perspective Transform:
            // TARGET_SIT_PITCH (42deg) tilts bottom (belly & legs) forward into view!
            // TARGET_SIT_YAW (-18deg) angles head/thorax towards viewer
            // TARGET_SIT_ROLL (-18deg) natural vertical glass posture
            const currentPitch = TARGET_SIT_PITCH + mousePitch;
            const currentYaw = TARGET_SIT_YAW + mouseYaw;
            const currentRoll = TARGET_SIT_ROLL;

            if (container) {
              gsap.set(container, {
                x: posX,
                y: posY,
                xPercent: -50,
                yPercent: -50,
                width: targetWidth,
                height: targetHeight,
                autoAlpha: 1,
              });
            }

            if (rig) {
              rig.style.transform = `perspective(620px) rotateX(${currentPitch.toFixed(2)}deg) rotateY(${currentYaw.toFixed(2)}deg) rotateZ(${currentRoll.toFixed(2)}deg) scale(1.08)`;
            }

            currentTransformRef.current = {
              x: posX,
              y: posY,
              width: targetWidth,
              height: targetHeight,
              roll: currentRoll,
              pitch: currentPitch,
              yaw: currentYaw,
              scale: 1.08,
            };

            if (!reducedMotion && currentTime - lastSitPollenTimeRef.current > 180) {
              lastSitPollenTimeRef.current = currentTime;
              emitPollen(
                targetX + (Math.random() - 0.5) * targetWidth * 0.6,
                targetY + (Math.random() - 0.5) * targetHeight * 0.5,
                1
              );
            }
          } else {
            transitionModeRef.current = 'fly_away';
            flyAwayStartTimeRef.current = currentTime;
            hasEmittedTakeoffRef.current = false;
            hasTriggeredVeilRef.current = false;
          }
        } else if (mode === 'fly_away') {
          // ===================================================================
          // PHASE: LEAVE SCREEN AND FLY AWAY LEADING USER TO THE NEW PAGE
          // ===================================================================
          const flyElapsed = currentTime - flyAwayStartTimeRef.current;
          const DEPART_DURATION = reducedMotion ? 350 : 800;
          const departT = clamp01(flyElapsed / DEPART_DURATION);

          if (!hasEmittedTakeoffRef.current) {
            hasEmittedTakeoffRef.current = true;
            emitPollen(targetX, targetY, 36, true);
            if (sheenRef.current) {
              gsap.fromTo(
                sheenRef.current,
                { opacity: 0 },
                { opacity: 1, duration: 0.25, yoyo: true, repeat: 1 }
              );
            }
            if (reflection) {
              reflection.style.opacity = '0';
            }
            footPad1Ref.current?.classList.remove('is-pressed');
            footPad2Ref.current?.classList.remove('is-pressed');
            footPad3Ref.current?.classList.remove('is-pressed');
            if (glassPaneRef.current) glassPaneRef.current.style.opacity = '0';
            if (footShadowsRef.current) footShadowsRef.current.style.opacity = '0';
          }

          if (departT >= 0.35 && !hasTriggeredVeilRef.current) {
            hasTriggeredVeilRef.current = true;
            onVeilFadeCallbackRef.current?.();
          }

          // Un-tilts smoothly from sitting orientation back to aerodynamic flight posture
          const flyRoll = TARGET_SIT_ROLL * (1 - departT) - 10 * departT;
          const flyPitch = TARGET_SIT_PITCH * (1 - departT) - 16 * departT;
          const flyYaw = TARGET_SIT_YAW * (1 - departT) + 6 * departT;

          const flyX = targetX + Math.sin(departT * Math.PI * 0.42) * (window.innerWidth * 0.22);
          const flyY = targetY - Math.pow(departT, 1.45) * (window.innerHeight * 0.68);
          const zoomScale = 1.08 + Math.pow(departT, 1.8) * (reducedMotion ? 0.5 : 3.0);
          const beeAlpha = departT > 0.72 ? 1 - (departT - 0.72) / 0.28 : 1.0;

          const flapFrequency = 42;
          const flapAmplitude = 26;
          const wingPhase = (timeSec * flapFrequency * Math.PI * 2) % (Math.PI * 2);
          const wingFlap = Math.sin(wingPhase) * flapAmplitude;
          const wingScaleY = 0.88 + Math.cos(wingPhase) * 0.20;

          if (forewingRef.current) {
            forewingRef.current.style.transform = `rotateZ(${-wingFlap.toFixed(2)}deg) rotateX(${wingFlap * 0.3}deg) scaleY(${wingScaleY.toFixed(3)})`;
          }
          if (farwingRef.current) {
            farwingRef.current.style.transform = `rotateZ(${(-wingFlap * 0.9 - 4).toFixed(2)}deg) rotateX(${wingFlap * 0.3}deg) scaleY(${wingScaleY.toFixed(3)})`;
          }
          if (wingBlurRef.current) {
            wingBlurRef.current.style.opacity = '0.90';
          }

          if (shadow) {
            const lift = departT * 32;
            shadow.style.transform = `translate3d(0, ${2 + lift}px, 0) scale(${0.92 + departT * 0.4})`;
            shadow.style.filter = `blur(${2 + departT * 24}px)`;
            shadow.style.opacity = Math.max(0, 0.78 * (1 - departT * 2.2)).toFixed(3);
          }

          if (vignetteRef.current && departT > 0.4) {
            vignetteRef.current.style.opacity = Math.max(0, 1 - (departT - 0.4) / 0.6).toFixed(3);
          }

          if (container) {
            gsap.set(container, {
              x: flyX,
              y: flyY,
              xPercent: -50,
              yPercent: -50,
              width: targetWidth,
              height: targetHeight,
              autoAlpha: Math.max(0, beeAlpha),
            });
          }

          if (rig) {
            rig.style.transform = `perspective(620px) rotateX(${flyPitch.toFixed(2)}deg) rotateY(${flyYaw.toFixed(2)}deg) rotateZ(${flyRoll.toFixed(2)}deg) scale(${zoomScale.toFixed(3)})`;
          }

          if (departT >= 1.0) {
            transitionModeRef.current = 'completed';
            if (container) gsap.set(container, { autoAlpha: 0 });
            if (vignetteRef.current) vignetteRef.current.style.opacity = '0';
            onCompleteCallbackRef.current?.();
            onCompleteCallbackRef.current = null;
          }
        }
      }

      // =========================================================================
      // BRANCH 2: NORMAL SCROLL-DRIVEN ENGINE
      // =========================================================================
      else {
        const targetP = targetProgressRef.current;
        progressRef.current += (targetP - progressRef.current) * 0.18;
        const p = progressRef.current;

        const deltaP = Math.abs(p - lastProgressRef.current);
        lastProgressRef.current = p;
        scrollVelocityRef.current =
          scrollVelocityRef.current * 0.85 + (deltaP / (dt || 16)) * 140 * 0.15;

        const cRect = ctaRestRef.current?.getBoundingClientRect();
        const isCardOffscreen = p >= 0.85 && Boolean(cRect && cRect.bottom <= 0);
        const isVisible = p > 0.002 && !isCardOffscreen && !reducedMotion;

        if (!isVisible) {
          if (container) gsap.set(container, { autoAlpha: 0 });
          if (p <= 0.002) onPatchOpacity?.(0);
        } else if (container && rig) {
          const sourcePoint = getAnchor();
          const fallbackStart = {
            x: window.innerWidth * 0.68,
            y: window.innerHeight * 0.50,
            width: Math.min(500, window.innerWidth * 0.40),
            height: Math.min(420, window.innerWidth * 0.40 * (420 / 520)),
          };
          const w0 = sourcePoint && sourcePoint.width > 20 ? sourcePoint : fallbackStart;

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

          let posX = w0.x;
          let posY = w0.y;
          let curWidth = w0.width;
          let curHeight = w0.height;
          let pitch = 0;
          let roll = 0;
          let popLift = 0;
          let isPerched = false;

          if (p <= 0.12) {
            const pop = smooth(p / 0.12);
            popLift = pop;
            posX = w0.x;
            posY = w0.y - pop * 14;
            curWidth = w0.width;
            curHeight = w0.height;
            pitch = -pop * 6.0;
            roll = 0.0;
            onPatchOpacity?.(smooth(p / 0.10));

            if (p >= 0.05 && !hasEmittedBurstRef.current) {
              emitPollen(posX, posY, 26, true);
              hasEmittedBurstRef.current = true;
            } else if (p < 0.03) {
              hasEmittedBurstRef.current = false;
            }
          } else if (p <= 0.38) {
            onPatchOpacity?.(1.0);
            const t = smooth((p - 0.12) / 0.22);
            const p0 = { x: w0.x, y: w0.y - 14 };
            const p1 = { x: w0.x - window.innerWidth * 0.08, y: w0.y - window.innerHeight * 0.16 };
            const p2 = { x: w1.x + window.innerWidth * 0.06, y: w1.y - window.innerHeight * 0.14 };
            const p3 = { x: w1.x, y: w1.y };

            posX = cubic(p0.x, p1.x, p2.x, p3.x, t);
            posY = cubic(p0.y, p1.y, p2.y, p3.y, t);

            curWidth = w0.width + (w1.width - w0.width) * t;
            curHeight = w0.height + (w1.height - w0.height) * t;

            const bell = 4.0 * t * (1.0 - t);
            pitch = -6.0 * (1.0 - t) + 8.0 * bell;
            roll = -12.0 * bell;

            if (t >= 0.92) isPerched = true;
          } else if (p <= 0.65) {
            onPatchOpacity?.(1.0);
            const t = smooth((p - 0.38) / 0.18);
            const p0 = { x: w1.x, y: w1.y };
            const p1 = { x: w1.x + 45, y: w1.y - 30 };
            const p2 = { x: w2.x - 35, y: w2.y - 35 };
            const p3 = { x: w2.x, y: w2.y };

            posX = cubic(p0.x, p1.x, p2.x, p3.x, t);
            posY = cubic(p0.y, p1.y, p2.y, p3.y, t);

            curWidth = w1.width + (w2.width - w1.width) * t;
            curHeight = w1.height + (w2.height - w1.height) * t;

            const bell = 4.0 * t * (1.0 - t);
            pitch = 6.0 * bell;
            roll = 9.0 * bell;

            if (t >= 0.88 || p < 0.42) isPerched = true;
          } else {
            onPatchOpacity?.(1.0);
            const t = smooth((p - 0.65) / 0.26);
            const p0 = { x: w2.x, y: w2.y };
            const p1 = { x: w2.x + window.innerWidth * 0.10, y: w2.y + window.innerHeight * 0.12 };
            const p2 = { x: w3.x - window.innerWidth * 0.08, y: w3.y - window.innerHeight * 0.16 };
            const p3 = { x: w3.x, y: w3.y };

            posX = cubic(p0.x, p1.x, p2.x, p3.x, t);
            posY = cubic(p0.y, p1.y, p2.y, p3.y, t);

            curWidth = w2.width + (w3.width - w2.width) * t;
            curHeight = w2.height + (w3.height - w2.height) * t;

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

          if (!isPerched && p >= 0.12 && p < 0.90 && Math.random() < 0.35) {
            emitPollen(posX - curWidth * 0.18, posY - curHeight * 0.06, 1);
          }

          const hoverIntensity = isFullyRested ? 0.15 : isPerched ? 0.35 : 1.0;
          const hoverX = Math.sin(timeSec * 3.0) * (4.5 * hoverIntensity);
          const hoverY = (Math.cos(timeSec * 3.8) * 5 + Math.sin(timeSec * 7.5) * 1.5) * hoverIntensity;
          const hoverTilt = Math.sin(timeSec * 3.2) * (1.8 * hoverIntensity);

          const finalX = posX + hoverX;
          const finalY = posY + hoverY;

          const mousePitch = m.y * 3.0;
          const mouseYaw = m.x * 4.5;

          const zLift = isFullyRested ? 0 : Math.sin(popLift * Math.PI) * 0.18;
          const scale = 1.0 + zLift;
          const alpha = smooth(p / 0.015);

          gsap.set(container, {
            x: finalX,
            y: finalY,
            xPercent: -50,
            yPercent: -50,
            width: curWidth,
            height: curHeight,
            autoAlpha: alpha,
          });

          const finalRoll = isFullyRested ? 0 : (roll + hoverTilt).toFixed(2);
          const finalPitch = isFullyRested ? (mousePitch * 0.25).toFixed(2) : (pitch + mousePitch).toFixed(2);
          const finalYaw = isFullyRested ? (mouseYaw * 0.25).toFixed(2) : (mouseYaw - roll * 0.25).toFixed(2);

          rig.style.transform = `perspective(1000px) rotateZ(${finalRoll}deg) rotateY(${finalYaw}deg) rotateX(${finalPitch}deg) scale(${scale.toFixed(3)})`;

          currentTransformRef.current = {
            x: finalX,
            y: finalY,
            width: curWidth,
            height: curHeight,
            roll: Number(finalRoll) || 0,
            pitch: Number(finalPitch) || 0,
            yaw: Number(finalYaw) || 0,
            scale,
          };

          if (body) {
            const breathRate = isFullyRested ? 3.2 : 4.5;
            const breathAmp = isFullyRested ? 0.008 : 0.012;
            const breath = 1.0 + Math.sin(timeSec * breathRate) * breathAmp;
            body.style.transform = `scale(${breath.toFixed(4)})`;
          }

          if (shadow) {
            const shadowOffset = isFullyRested ? 4 : isPerched ? 6 : 8 + popLift * 24;
            const shadowBlur = isFullyRested ? 4 : isPerched ? 5 : 4 + popLift * 26;
            const shadowAlpha = isFullyRested ? 0.65 : isPerched ? 0.5 : 0.55 * (1 - popLift * 0.45);
            const shadowScale = isFullyRested ? 0.82 : isPerched ? 0.85 : 1.0 + popLift * 0.3;

            shadow.style.transform = `translate3d(0, ${shadowOffset}px, 0) scale(${shadowScale})`;
            shadow.style.filter = `blur(${shadowBlur}px)`;
            shadow.style.opacity = shadowAlpha.toFixed(3);
          }

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
                flapFrequency = 11;
                flapAmplitude = 6;
              } else {
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
              const blurIntensity =
                !isPerched && flapFrequency > 16
                  ? Math.min(0.85, (flapFrequency / 36) * 0.7 + Math.abs(Math.sin(wingPhase)) * 0.2)
                  : 0;
              wingBlurRef.current.style.opacity = blurIntensity.toFixed(3);
              wingBlurRef.current.style.transform = `rotateZ(${(-wingFlap * 0.35).toFixed(2)}deg) scale(${(1.0 + Math.abs(Math.sin(wingPhase)) * 0.08).toFixed(3)})`;
            }
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

      {/* Atmospheric Screen Focus Vignette */}
      <div ref={vignetteRef} className="bee-screen-vignette" aria-hidden="true" />

      {/* Tactile Glass Contact Ripple Ring */}
      <div ref={rippleRef} className="bee-glass-ripple" aria-hidden="true" />

      {/* Main Flying Bee Rig */}
      <div ref={containerRef} className="bee-flight-rig-wrap" aria-hidden="true">
        {/* Dynamic Body Cast Shadow (deep, softly blurred inside the monitor) */}
        <div ref={shadowRef} className="bee-cast-shadow">
          <img src="/images/bee-shadow.png" alt="" />
        </div>

        {/* 3D Oriented Bee Rig */}
        <div ref={rigRef} className="bee-3d-rig">
          {/* Direct Foot Contact Shadows Layer (ZERO gap at foot tips on the glass) */}
          <div ref={footShadowsRef} className="bee-foot-contact-shadows">
            <div className="foot-shadow foot-shadow-1">
              <span className="foot-occlusion-core" />
            </div>
            <div className="foot-shadow foot-shadow-2">
              <span className="foot-occlusion-core" />
            </div>
            <div className="foot-shadow foot-shadow-3">
              <span className="foot-occlusion-core" />
            </div>
          </div>

          {/* Glass Contact Reflection Layer */}
          <div ref={reflectionRef} className="bee-glass-reflection">
            <img src="/images/bee-body.png" alt="" />
          </div>

          {/* Far Wing Layer (deep in background at translateZ(-38px)) */}
          <div ref={farwingRef} className="bee-wing-layer bee-wing-far">
            <img src="/images/bee-wings.png" alt="" />
          </div>

          {/* High-Resolution Bee Body Layer */}
          <div ref={bodyRef} className="bee-body-layer">
            <img src="/images/bee-body.png" className="bee-body-image" alt="" />
            {/* Shimmering specular glint highlight on emergence & touchdown */}
            <div ref={sheenRef} className="bee-specular-sheen" />
          </div>

          {/* Volumetric 3D Belly & Sternites Layer (forward in depth, angled toward viewer) */}
          <div ref={bellyVolumeRef} className="bee-belly-3d-volume">
            <div className="bee-belly-glow" />
            <div className="bee-sternite-shading" />
          </div>

          {/* Fore Wing Layer (folded over back at translateZ(-18px)) */}
          <div ref={forewingRef} className="bee-wing-layer bee-wing-fore">
            <img src="/images/bee-wings.png" alt="" />
          </div>

          {/* High-Speed Wing Flutter Motion Blur Fan Layer */}
          <div ref={wingBlurRef} className="bee-wing-layer bee-wing-blur-fan">
            <img src="/images/bee-wing-blur.png" alt="" />
          </div>

          {/* Monitor Screen Glass Overlay (IN FRONT of bee, locking the illusion of sitting from inside) */}
          <div ref={glassPaneRef} className="bee-monitor-glass-overlay">
            {/* Specular glare bar across front monitor glass */}
            <div className="glass-specular-glare" />

            {/* Individual Foot Contact Pads pressed on the inside surface of the screen glass */}
            <div className="bee-glass-foot-pads">
              <div ref={footPad1Ref} className="glass-foot-pad foot-pad-1">
                <span className="pad-ring" />
                <span className="pad-core" />
                <span className="pad-glint" />
                <span className="pad-reflection-tip" />
              </div>
              <div ref={footPad2Ref} className="glass-foot-pad foot-pad-2">
                <span className="pad-ring" />
                <span className="pad-core" />
                <span className="pad-glint" />
                <span className="pad-reflection-tip" />
              </div>
              <div ref={footPad3Ref} className="glass-foot-pad foot-pad-3">
                <span className="pad-ring" />
                <span className="pad-core" />
                <span className="pad-glint" />
                <span className="pad-reflection-tip" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStoryScene, type StoryScene } from './scene/createStoryScene';
import { FlyingBee, type FlyingBeeHandle } from './components/FlyingBee';
const StudioPage = lazy(() =>
  import('./components/StudioPage').then((module) => ({ default: module.StudioPage }))
);

gsap.registerPlugin(ScrollTrigger);

const BEFORE = '/images/sample-before.jpg';
const AFTER = '/images/sample-after.png';

function ArrowUpRight() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="icon-arrow">
      <path
        d="M4.5 15.5 15 5M6 5h9v9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RevealSection({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        element.querySelectorAll('[data-reveal]'),
        { y: 28, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: { trigger: element, start: 'top 78%', once: true },
        }
      );
    }, element);
    return () => ctx.revert();
  }, []);
  return (
    <section id={id} ref={ref} className={className}>
      {children}
    </section>
  );
}

function CompareViewer({
  moduleRef,
  landingRef,
  toggleRef,
}: {
  moduleRef: React.RefObject<HTMLDivElement | null>;
  landingRef: React.RefObject<HTMLDivElement | null>;
  toggleRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [mode, setMode] = useState<'side' | 'wipe'>('side');
  const [position, setPosition] = useState(50);
  return (
    <div className="compare-module" ref={moduleRef}>
      <div className="compare-toolbar">
        <div className="compare-key">
          <span className="status-dot" /> REAL IMAGE PAIR{' '}
          <span className="toolbar-divider">/</span> POLLINATOR DETAIL
        </div>
        <div className="compare-toggle" ref={toggleRef} role="group" aria-label="Comparison view">
          <button
            type="button"
            className={mode === 'side' ? 'active' : ''}
            onClick={() => setMode('side')}
            aria-pressed={mode === 'side'}
          >
            Side by side
          </button>
          <button
            type="button"
            className={mode === 'wipe' ? 'active' : ''}
            onClick={() => setMode('wipe')}
            aria-pressed={mode === 'wipe'}
          >
            Drag to compare
          </button>
        </div>
      </div>
      {mode === 'side' ? (
        <div className="compare-grid">
          <figure className="compare-figure">
            <div className="compare-image">
              <img
                src={BEFORE}
                alt="Original low-resolution close-up of a bee"
                loading="lazy"
              />
            </div>
            <figcaption>
              <span>01 / ORIGINAL</span>
              <span>Source image</span>
            </figcaption>
          </figure>
          <figure className="compare-figure enhanced-figure">
            <div className="compare-image" ref={landingRef}>
              <img
                src={AFTER}
                alt="Refined close-up of the same bee with more visible detail"
                loading="lazy"
              />
              <span className="image-corner-mark" aria-hidden="true">
                +
              </span>
            </div>
            <figcaption>
              <span>02 / ENHANCED</span>
              <span>Detail refinement</span>
            </figcaption>
          </figure>
        </div>
      ) : (
        <div className="wipe-wrap" ref={landingRef}>
          <img
            className="wipe-before"
            src={BEFORE}
            alt="Original low-resolution close-up of a bee"
            loading="lazy"
          />
          <div
            className="wipe-after"
            style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          >
            <img
              src={AFTER}
              alt="Refined close-up of the same bee with more visible detail"
              loading="lazy"
            />
          </div>
          <div
            className="wipe-divider"
            style={{ left: `${position}%` }}
            aria-hidden="true"
          >
            <svg className="wipe-handle-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m8.5 9-3 3 3 3M15.5 9l3 3-3 3M5.5 12h13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <label className="sr-only" htmlFor="compare-position">
            Move the comparison divider
          </label>
          <input
            id="compare-position"
            className="wipe-range"
            type="range"
            min="0"
            max="100"
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
            aria-valuetext={`Comparison divider at ${position} percent`}
          />
          <span className="wipe-label wipe-label-before">ORIGINAL</span>
          <span className="wipe-label wipe-label-after">ENHANCED</span>
        </div>
      )}
      <p className="demo-note">
        A matched source-to-result comparison showing detail, clarity, and tonal refinement.
      </p>
    </div>
  );
}

interface LandingViewProps {
  onOpenStudio: () => void;
  onStartVeilFade?: () => void;
}

function LandingView({ onOpenStudio, onStartVeilFade }: LandingViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const storyTrackRef = useRef<HTMLElement>(null);
  const storyStageRef = useRef<HTMLDivElement>(null);
  const beeRef = useRef<FlyingBeeHandle>(null);
  const compareModuleRef = useRef<HTMLDivElement>(null);
  const beeLandingRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const toggleRef = useRef<HTMLDivElement>(null);
  const ctaBeeRestRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const enhancedRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<StoryScene | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleOpenStudio = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    lenisRef.current?.stop();
    document.body.style.overflow = 'hidden';

    beeRef.current?.flyToScreenAndDepart(
      () => {
        document.body.style.overflow = '';
        setIsTransitioning(false);
        onOpenStudio();
      },
      () => {
        onStartVeilFade?.();
      }
    );
  };

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const lenis = new Lenis({
      autoRaf: false,
      duration: 1.15,
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.0,
    });
    lenisRef.current = lenis;
    const onScroll = () => ScrollTrigger.update();
    const tick = (time: number) => lenis.raf(time * 1000);
    lenis.on('scroll', onScroll);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      lenis.off('scroll', onScroll);
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!canvasRef.current || !storyTrackRef.current || !storyStageRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const story = storyTrackRef.current;
    const stage = storyStageRef.current;
    const ctx = gsap.context(() => {
      let scene: StoryScene | null = null;
      try {
        scene = createStoryScene(canvasRef.current!);
        sceneRef.current = scene;
      } catch (error) {
        console.error(
          'PrismHD 3D scene unavailable; keeping the page usable with the static fallback.',
          error
        );
        storyStageRef.current?.classList.add('scene-unavailable');
      }

      const intro = introRef.current;
      const source = sourceRef.current;
      const enhanced = enhancedRef.current;
      if (!intro || !source || !enhanced) return;

      if (reduceMotion) {
        document.body.dataset.story = 'light';
        return;
      }

      const state = { progress: 0 };
      gsap.set(source, { autoAlpha: 0, y: 22 });
      gsap.set(enhanced, { autoAlpha: 0, y: 22 });

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: story,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.75,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const p = self.progress;
            stage.dataset.chapter = p < 0.2 ? 'intro' : p < 0.45 ? 'source' : 'enhanced';
            document.body.dataset.story = p >= 0.39 && p < 0.89 ? 'dark' : 'light';
          },
          onLeave: () => {
            document.body.dataset.story = 'light';
          },
          onLeaveBack: () => {
            document.body.dataset.story = 'light';
          },
        },
      });

      timeline.to(
        state,
        {
          progress: 1,
          duration: 1,
          ease: 'none',
          onUpdate: () => scene?.setProgress(state.progress),
        },
        0
      );
      timeline.to(intro, { autoAlpha: 0, y: -24, duration: 0.11, ease: 'power1.inOut' }, 0.15);
      timeline.to(source, { autoAlpha: 1, y: 0, duration: 0.12, ease: 'power2.out' }, 0.17);
      timeline.to(source, { autoAlpha: 0, y: -16, duration: 0.12, ease: 'power1.inOut' }, 0.4);
      timeline.to(enhanced, { autoAlpha: 1, y: 0, duration: 0.14, ease: 'power2.out' }, 0.44);
      timeline.to(stage, { backgroundColor: '#252d23', duration: 0.12, ease: 'none' }, 0.4);
      timeline.to(stage, { backgroundColor: '#f6f0e5', duration: 0.13, ease: 'none' }, 0.88);
      timeline.fromTo(
        '.visual-caption',
        { x: 26, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.16, ease: 'power2.out' },
        0.26
      );
      timeline.to(enhanced, { color: '#181A1C', duration: 0.13, ease: 'none' }, 0.88);

      const compare = compareModuleRef.current;
      const cta = document.getElementById('cta');

      if (cta && !reduceMotion) {
        ScrollTrigger.create({
          id: 'cta-pin',
          trigger: cta,
          start: 'center center',
          end: '+=90%',
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
        });
      }

      if (compare && !reduceMotion) {
        ScrollTrigger.create({
          id: 'bee-flight',
          trigger: story,
          start: () =>
            story.getBoundingClientRect().top +
            window.scrollY +
            (story.offsetHeight - window.innerHeight) * 0.72,
          end: () => {
            const ctaEl = document.getElementById('cta');
            if (ctaEl) {
              const ctaTop = ctaEl.getBoundingClientRect().top + window.scrollY;
              return ctaTop - (window.innerHeight - ctaEl.offsetHeight) / 2;
            }
            return (
              compare.getBoundingClientRect().top +
              window.scrollY +
              compare.offsetHeight * 0.84
            );
          },
          scrub: 0.65,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            beeRef.current?.setProgress(self.progress);
          },
          onRefresh: (self) => {
            beeRef.current?.setProgress(self.progress);
          },
          onLeave: () => {
            beeRef.current?.setProgress(1);
          },
          onEnterBack: () => {
            beeRef.current?.show();
          },
          onLeaveBack: () => {
            beeRef.current?.reset();
            scene?.setFlightProgress(0);
          },
        });
      }

      ScrollTrigger.refresh();
    }, storyStageRef);

    return () => {
      ScrollTrigger.getById('cta-pin')?.kill();
      ScrollTrigger.getById('bee-flight')?.kill();
      ctx.revert();
      sceneRef.current?.dispose();
      sceneRef.current = null;
      storyStageRef.current?.classList.remove('scene-unavailable');
      delete document.body.dataset.story;
    };
  }, []);

  const scrollTo = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: -76 });
      return;
    }
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  const exploreStory = () => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(window.innerHeight * 0.78);
      return;
    }
    window.scrollTo({
      top: window.innerHeight * 0.78,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  return (
    <main className={isTransitioning ? 'is-transitioning' : ''}>
      <a className="skip-link" href="#story">
        Skip to experience
      </a>
      <header className="site-header">
        <a
          className="wordmark"
          href="#story"
          aria-label="PrismHD home"
          onClick={(e) => {
            e.preventDefault();
            scrollTo('story');
          }}
        >
          <span className="brand-glyph">
            <i />
            <i />
            <i />
          </span>
          <span>
            prism<span className="brand-hd">hd</span>
          </span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a
            href="#story"
            onClick={(e) => {
              e.preventDefault();
              scrollTo('story');
            }}
          >
            Method <span>01</span>
          </a>
          <a
            href="#comparison"
            onClick={(e) => {
              e.preventDefault();
              scrollTo('comparison');
            }}
          >
            Results <span>02</span>
          </a>
          <button type="button" className="nav-studio-btn" onClick={handleOpenStudio}>
            Studio <span>04</span>
          </button>
        </nav>
        <button type="button" className="header-cta" onClick={handleOpenStudio}>
          Open studio <ArrowUpRight />
        </button>
      </header>

      {/* 01 / STORY TRACK */}
      <section
        id="story"
        ref={storyTrackRef}
        className="story-track"
        aria-label="PrismHD image enhancement story"
      >
        <div ref={storyStageRef} className="story-stage" data-chapter="intro">
          <canvas ref={canvasRef} className="story-canvas" aria-hidden="true" />
          <div className="scene-fallback" aria-hidden="true">
            <img src={BEFORE} alt="" />
          </div>
          <div className="stage-grain" aria-hidden="true" />
          <div className="story-inner">
            <div className="story-copy-wrap">
              <div ref={introRef} className="chapter-copy copy-intro">
                <p className="eyebrow">
                  <span className="eyebrow-dot" /> IMAGE ENHANCEMENT, RECONSIDERED
                </p>
                <h1>
                  Make more
                  <br />
                  of every <em>image.</em>
                </h1>
                <p className="hero-description">
                  Thoughtful upscaling, refined detail, and a result that keeps the original in
                  focus.
                </p>
                <div className="hero-actions">
                  <button type="button" className="button button-primary" onClick={handleOpenStudio}>
                    Upscale an image <ArrowUpRight />
                  </button>
                  <button type="button" className="text-button" onClick={exploreStory}>
                    Explore the process <span>↓</span>
                  </button>
                </div>
                <div className="hero-meta">
                  <span>01 — 03</span>
                  <span>SCROLL TO DISCOVER</span>
                </div>
              </div>
              <div ref={sourceRef} className="chapter-copy copy-source">
                <p className="eyebrow">
                  <span className="eyebrow-dot" /> 01 / THE SOURCE
                </p>
                <h2>
                  Every detail
                  <br />
                  starts <em>here.</em>
                </h2>
                <p className="hero-description">
                  Begin with the image you have. The original sets the direction for everything that
                  follows.
                </p>
                <div className="chapter-foot">
                  <span>ORIGINAL IMAGE</span>
                  <span>KEEP SCROLLING ↓</span>
                </div>
              </div>
              <div ref={enhancedRef} className="chapter-copy copy-enhanced">
                <p className="eyebrow">
                  <span className="eyebrow-dot" /> 02 / THE REFINEMENT
                </p>
                <h2>
                  More resolution.
                  <br />
                  <em>Refined detail.</em>
                </h2>
                <p className="hero-description">
                  See the same scene emerge with clearer structure, finer detail, and a more resolved finish.
                </p>
                <div className="chapter-foot">
                  <span>ENHANCED IMAGE</span>
                  <span>SCROLL TO COMPARE ↓</span>
                </div>
              </div>
            </div>
            <div className="visual-caption">
              <span className="caption-rule" />
              <span>POLLINATOR DETAIL / REAL IMAGE STUDY</span>
              <span className="caption-number">FIG. 01</span>
            </div>
          </div>
          <div className="stage-bottom">
            <span>DESIGNED FOR YOUR ORIGINAL</span>
            <span className="scroll-cue">
              <i /> SCROLL TO REVEAL
            </span>
            <span>PRISMHD © 2026</span>
          </div>
        </div>
      </section>

      {/* 02 / COMPARISON SECTION */}
      <RevealSection id="comparison" className="comparison-section section-pad">
        <div className="section-topline" data-reveal>
          <span>03 / THE RESULT</span>
          <span>ORIGINAL × ENHANCED</span>
        </div>
        <div className="comparison-heading" data-reveal>
          <h2 ref={headingRef}>
            See the difference
            <br />
            <em>for yourself.</em>
          </h2>
          <p>
            Compare two views of the same subject to see how resolution, texture, and fine detail come forward.
          </p>
        </div>
        <div data-reveal>
          <CompareViewer
            moduleRef={compareModuleRef}
            landingRef={beeLandingRef}
            toggleRef={toggleRef}
          />
        </div>
      </RevealSection>

      {/* 03 / CTA SECTION */}
      <RevealSection id="cta" className="cta-section">
        <div className="cta-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="cta-container">
          <div className="cta-card" data-reveal>
            <p className="eyebrow">
              <span className="eyebrow-dot" /> YOUR IMAGE IS NEXT
            </p>
            <h2>
              Bring it
              <br />
              into <em>focus.</em>
            </h2>
            <p>
              Start with an image that matters. Choose your output, compare the details, and keep the result you love.
            </p>
            <button type="button" className="button button-light" onClick={handleOpenStudio}>
              Open your image <ArrowUpRight />
            </button>
          </div>
          <div ref={ctaBeeRestRef} className="cta-bee-stage" aria-hidden="true">
            <div className="cta-bee-halo" />
            <div className="cta-bee-perch-mark">
              <span className="perch-label">FINAL DESTINATION</span>
              <span className="perch-detail">RESOLVED DETAIL · 4× MACRO</span>
            </div>
          </div>
        </div>
        <div className="cta-side-note">
          <span>PRISMHD</span>
          <span>TOOLS FOR A CLOSER LOOK.</span>
        </div>
      </RevealSection>

      {/* Notice: The Studio is NOT rendered in the landing page scroll track.
          It is only accessible by clicking buttons on the landing page! */}

      <footer className="site-footer">
        <a
          className="wordmark"
          href="#story"
          onClick={(e) => {
            e.preventDefault();
            scrollTo('story');
          }}
        >
          <span className="brand-glyph">
            <i />
            <i />
            <i />
          </span>
          <span>
            prism<span className="brand-hd">hd</span>
          </span>
        </a>
        <p>MAKE MORE OF EVERY IMAGE.</p>
        <div>
          <button type="button" className="footer-link-btn" onClick={handleOpenStudio}>
            The Studio <span>04</span> <ArrowUpRight />
          </button>
          <a
            href="#story"
            onClick={(e) => {
              e.preventDefault();
              scrollTo('story');
            }}
          >
            Back to top ↑
          </a>
          <span>© PrismHD 2026</span>
        </div>
      </footer>

      <FlyingBee
        ref={beeRef}
        getAnchor={() => sceneRef.current?.getBeeAnchor() ?? null}
        headingRef={headingRef}
        toggleRef={toggleRef}
        ctaRestRef={ctaBeeRestRef}
        onPatchOpacity={(opacity) => sceneRef.current?.setFlightProgress(opacity)}
      />
    </main>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<'landing' | 'studio'>(() => {
    return window.location.hash === '#studio' || window.location.hash === '#/studio'
      ? 'studio'
      : 'landing';
  });
  const [isVeilActive, setIsVeilActive] = useState(false);

  useEffect(() => {
    const onHashChange = () => {
      const isStudio =
        window.location.hash === '#studio' || window.location.hash === '#/studio';
      setCurrentPage(isStudio ? 'studio' : 'landing');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (currentPage === 'studio') {
      document.title = 'PrismHD — The Studio Workspace';
    } else {
      document.title = 'PrismHD — Make more of every image';
    }
  }, [currentPage]);

  const openStudio = () => {
    window.location.hash = '#studio';
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setCurrentPage('studio');
    setTimeout(() => {
      setIsVeilActive(false);
    }, 100);
  };

  const closeStudio = () => {
    setIsVeilActive(true);
    setTimeout(() => {
      window.location.hash = '';
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      setCurrentPage('landing');
      setTimeout(() => {
        setIsVeilActive(false);
      }, 100);
    }, 280);
  };

  return (
    <>
      <div className={`app-transition-veil ${isVeilActive ? 'active' : ''}`} aria-hidden="true" />
      {currentPage === 'studio' ? (
        <Suspense fallback={<div className="route-loading" role="status">Opening PrismHD studio…</div>}>
          <StudioPage onBack={closeStudio} />
        </Suspense>
      ) : (
        <LandingView onOpenStudio={openStudio} onStartVeilFade={() => setIsVeilActive(true)} />
      )}
    </>
  );
}

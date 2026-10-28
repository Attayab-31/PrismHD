import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { enhanceImage, type UpscaleOptions } from '../lib/upscaler';

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

function ArrowLeft() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="icon-arrow">
      <path
        d="M15.5 10H4.5M10 4.5 4.5 10 10 15.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface StudioPageProps {
  onBack: () => void;
}

export function StudioPage({ onBack }: StudioPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [scale, setScale] = useState<UpscaleOptions['scale']>('4');
  const [format, setFormat] = useState<UpscaleOptions['format']>('png');
  const [quality, setQuality] = useState<UpscaleOptions['quality']>('balanced');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Choose an image to prepare your enhancement settings.');
  const [result, setResult] = useState('');
  const [resultDimensions, setResultDimensions] = useState<{ width: number; height: number } | null>(null);
  const [wipePosition, setWipePosition] = useState(50);
  const [viewMode, setViewMode] = useState<'wipe' | 'side' | 'single'>('wipe');
  const [canSimulate, setCanSimulate] = useState(false);

  // Revoke object URLs on cleanup
  useEffect(() => {
    return () => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
      if (result.startsWith('blob:')) URL.revokeObjectURL(result);
    };
  }, [preview, result]);

  // Read natural image dimensions when preview updates
  useEffect(() => {
    if (!preview) {
      setDimensions(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = preview;
  }, [preview]);

  const acceptFile = (selected?: File) => {
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      setMessage('Please select a supported image file.');
      return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      setMessage('This starter accepts files up to 20 MB. Adjust this limit to match your backend.');
      return;
    }
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    if (result.startsWith('blob:')) URL.revokeObjectURL(result);

    const objectUrl = URL.createObjectURL(selected);
    setFile(selected);
    setPreview(objectUrl);
    setResult('');
    setResultDimensions(null);
    setCanSimulate(false);
    setMessage(`${selected.name} is ready. Select output settings and click Enhance image.`);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0]);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.classList.remove('is-dragging');
    if (event.dataTransfer.files?.[0]) {
      acceptFile(event.dataTransfer.files[0]);
    }
  };

  const loadSampleImage = async () => {
    try {
      setMessage('Loading sample pollinator study…');
      const res = await fetch('/images/sample-before.jpg');
      const blob = await res.blob();
      const sampleFile = new File([blob], 'sample-pollinator-study.jpg', { type: 'image/jpeg' });
      acceptFile(sampleFile);
    } catch {
      setMessage('Unable to load sample asset. Please choose a local image.');
    }
  };

  const clearSelection = () => {
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    if (result.startsWith('blob:')) URL.revokeObjectURL(result);
    setFile(null);
    setPreview('');
    setDimensions(null);
    setResult('');
    setResultDimensions(null);
    setCanSimulate(false);
    setMessage('Choose an image to prepare your enhancement settings.');
    if (inputRef.current) inputRef.current.value = '';
  };

  // Client-side simulation fallback when backend endpoint is not configured
  const generateSimulatedOutput = async (sourceFile: File, scaleFactor: number): Promise<string> => {
    // If it's the bee sample, use high-res sample-after.png
    if (sourceFile.name.includes('pollinator') || sourceFile.name.includes('sample-before')) {
      return '/images/sample-after.png';
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetW = img.naturalWidth * scaleFactor;
        const targetH = img.naturalHeight * scaleFactor;
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(preview);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
        const q = quality === 'high' ? 0.95 : quality === 'small' ? 0.75 : 0.88;

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            resolve(preview);
          }
        }, mime, q);
      };
      img.src = preview;
    });
  };

  const runEnhancement = async () => {
    if (!file) {
      inputRef.current?.click();
      setMessage('Choose an image to prepare your enhancement settings.');
      return;
    }

    setBusy(true);
    setMessage('Sending the image to the enhancement pipeline…');
    setResult('');
    setResultDimensions(null);

    const scaleNum = Number(scale);
    const endpoint = import.meta.env.VITE_UPSCALER_ENDPOINT?.trim();

    if (endpoint) {
      try {
        const outputUrl = await enhanceImage(file, { scale, format, quality });
        setResult(outputUrl);
        if (dimensions) {
          setResultDimensions({ width: dimensions.width * scaleNum, height: dimensions.height * scaleNum });
        }
        setMessage('The configured API returned the enhanced output. Inspect it below.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Enhancement failed. Check your API configuration.');
        setCanSimulate(true);
      } finally {
        setBusy(false);
      }
    } else {
      // Friendly simulation demo for starter environment without backend endpoint
      setMessage('Processing preview through the starter demonstration engine…');
      setTimeout(async () => {
        try {
          const simUrl = await generateSimulatedOutput(file, scaleNum);
          setResult(simUrl);
          if (dimensions) {
            setResultDimensions({ width: dimensions.width * scaleNum, height: dimensions.height * scaleNum });
          }
          setMessage(`Simulated ${scale}× enhancement complete. Connect VITE_UPSCALER_ENDPOINT in .env for your private API.`);
        } catch {
          setMessage('Simulation failed. Check file format.');
        } finally {
          setBusy(false);
        }
      }, 750);
    }
  };

  const projectedWidth = dimensions ? dimensions.width * Number(scale) : null;
  const projectedHeight = dimensions ? dimensions.height * Number(scale) : null;

  return (
    <div className="studio-page-view">
      <header className="studio-page-header">
        <button
          type="button"
          className="wordmark wordmark-btn"
          onClick={onBack}
          aria-label="Return to PrismHD showcase"
        >
          <span className="brand-glyph">
            <i />
            <i />
            <i />
          </span>
          <span>
            prism<span className="brand-hd">hd</span>
          </span>
        </button>

        <div className="studio-badge">
          <span className="badge-dot" />
          <span>04 / THE STUDIO WORKSPACE</span>
        </div>

        <button type="button" className="studio-back-button" onClick={onBack}>
          <ArrowLeft />
          <span>Return to showcase</span>
        </button>
      </header>

      <main className="studio-page-main section-pad">
        <div className="section-topline">
          <span>04 / THE STUDIO</span>
          <span>YOUR WORKFLOW</span>
        </div>

        <div className="studio-heading">
          <h2>
            Your image,
            <br />
            <em>your direction.</em>
          </h2>
          <p>
            A focused workspace for preparing an image, choosing an output, and sending it through
            your enhancement pipeline.
          </p>
        </div>

        <div className="studio-panel">
          {/* Left Column: Image Preview & Work Area */}
          <div className="studio-preview-column">
            <div className="studio-preview-head">
              <span>IMAGE PREVIEW</span>
              <span className="studio-status-tag">
                {result
                  ? 'ENHANCED RESULT'
                  : busy
                    ? 'PROCESSING…'
                    : file
                      ? 'SOURCE LOADED'
                      : 'AWAITING SOURCE'}
              </span>
            </div>

            {!preview ? (
              <div
                className="upload-box"
                onDragOver={(event) => {
                  event.preventDefault();
                  event.currentTarget.classList.add('is-dragging');
                }}
                onDragLeave={(event) => event.currentTarget.classList.remove('is-dragging')}
                onDrop={onDrop}
              >
                <div className="upload-empty">
                  <span className="upload-cross">＋</span>
                  <strong>Bring an image into focus.</strong>
                  <span>Drag an image here, or browse your files.</span>
                  <small>Common image formats · up to 20 MB in this starter</small>
                  <div className="upload-actions">
                    <button
                      type="button"
                      className="browse-button-inline"
                      onClick={() => inputRef.current?.click()}
                    >
                      Choose image <ArrowUpRight />
                    </button>
                    <button
                      type="button"
                      className="sample-trigger-btn"
                      onClick={loadSampleImage}
                    >
                      ＋ Load sample pollinator study
                    </button>
                  </div>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  hidden
                />
              </div>
            ) : result ? (
              /* Enhanced Result Comparison Viewer */
              <div className="studio-result-module">
                <div className="studio-result-toolbar">
                  <div className="result-indicator">
                    <span className="status-dot active" />
                    <span>ENHANCED {scale}× OUTPUT READY</span>
                    {resultDimensions && (
                      <span className="resolution-chip">
                        {resultDimensions.width} × {resultDimensions.height} px
                      </span>
                    )}
                  </div>
                  <div className="compare-toggle" role="group" aria-label="Result view modes">
                    <button
                      type="button"
                      className={viewMode === 'wipe' ? 'active' : ''}
                      onClick={() => setViewMode('wipe')}
                    >
                      Wipe
                    </button>
                    <button
                      type="button"
                      className={viewMode === 'side' ? 'active' : ''}
                      onClick={() => setViewMode('side')}
                    >
                      Side by side
                    </button>
                    <button
                      type="button"
                      className={viewMode === 'single' ? 'active' : ''}
                      onClick={() => setViewMode('single')}
                    >
                      Result only
                    </button>
                  </div>
                </div>

                {viewMode === 'wipe' && (
                  <div className="wipe-wrap studio-wipe">
                    <img className="wipe-before" src={preview} alt="Original source" />
                    <div
                      className="wipe-after"
                      style={{ clipPath: `inset(0 0 0 ${wipePosition}%)` }}
                    >
                      <img src={result} alt="Enhanced result" />
                    </div>
                    <div
                      className="wipe-divider"
                      style={{ left: `${wipePosition}%` }}
                      aria-hidden="true"
                    >
                      <span>↔</span>
                    </div>
                    <label className="sr-only" htmlFor="studio-wipe-slider">
                      Compare source and enhanced
                    </label>
                    <input
                      id="studio-wipe-slider"
                      className="wipe-range"
                      type="range"
                      min="0"
                      max="100"
                      value={wipePosition}
                      onChange={(e) => setWipePosition(Number(e.target.value))}
                    />
                    <span className="wipe-label wipe-label-before">SOURCE</span>
                    <span className="wipe-label wipe-label-after">{scale}× ENHANCED</span>
                  </div>
                )}

                {viewMode === 'side' && (
                  <div className="compare-grid studio-compare-grid">
                    <figure className="compare-figure">
                      <div className="compare-image">
                        <img src={preview} alt="Original source" />
                      </div>
                      <figcaption>
                        <span>SOURCE IMAGE</span>
                        <span>
                          {dimensions ? `${dimensions.width}×${dimensions.height}` : 'Original'}
                        </span>
                      </figcaption>
                    </figure>
                    <figure className="compare-figure enhanced-figure">
                      <div className="compare-image">
                        <img src={result} alt="Enhanced result" />
                        <span className="image-corner-mark" aria-hidden="true">
                          +
                        </span>
                      </div>
                      <figcaption>
                        <span>{scale}× ENHANCED</span>
                        <span>
                          {resultDimensions
                            ? `${resultDimensions.width}×${resultDimensions.height}`
                            : 'Refined'}
                        </span>
                      </figcaption>
                    </figure>
                  </div>
                )}

                {viewMode === 'single' && (
                  <div className="studio-single-result">
                    <img src={result} alt="Enhanced output" />
                    <span className="image-corner-mark" aria-hidden="true">
                      +
                    </span>
                  </div>
                )}

                <div className="result-action-bar">
                  <a
                    href={result}
                    download={`prismhd-enhanced-${scale}x.${format}`}
                    className="button button-primary download-btn"
                  >
                    Download {scale}× enhanced image <ArrowUpRight />
                  </a>
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => {
                      setResult('');
                      setResultDimensions(null);
                    }}
                  >
                    Adjust settings
                  </button>
                  <button type="button" className="button-ghost" onClick={clearSelection}>
                    Upload another
                  </button>
                </div>
              </div>
            ) : (
              /* Loaded Preview Display */
              <div className="preview-active-wrap">
                <div className="preview-image-box">
                  <img src={preview} alt="Selected source preview" className="uploaded-preview" />
                  <span className="image-corner-mark" aria-hidden="true">
                    +
                  </span>
                  <div className="preview-box-actions">
                    <button
                      type="button"
                      className="browse-button"
                      onClick={() => inputRef.current?.click()}
                    >
                      Replace image <ArrowUpRight />
                    </button>
                    <button
                      type="button"
                      className="clear-button"
                      onClick={clearSelection}
                      title="Clear image"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  hidden
                />
              </div>
            )}

            {file && !result && (
              <div className="file-info-panel">
                <div className="file-row">
                  <span className="file-name" title={file.name}>
                    {file.name}
                  </span>
                  <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                {dimensions && (
                  <div className="spec-row">
                    <span className="spec-badge">
                      Source: {dimensions.width} × {dimensions.height} px
                    </span>
                    <span className="spec-badge target-badge">
                      Target: {projectedWidth} × {projectedHeight} px ({scale}×)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Output Settings */}
          <div className="studio-controls">
            <div className="control-heading">
              <span>OUTPUT SETTINGS</span>
              <span>01—03</span>
            </div>

            <label className="setting-label" htmlFor="scale-setting">
              Resolution
            </label>
            <div className="segmented" role="group" aria-label="Output scale">
              <button
                type="button"
                onClick={() => setScale('2')}
                className={scale === '2' ? 'selected' : ''}
                aria-pressed={scale === '2'}
              >
                2× <small>Faster</small>
              </button>
              <button
                type="button"
                onClick={() => setScale('4')}
                className={scale === '4' ? 'selected' : ''}
                aria-pressed={scale === '4'}
              >
                4× <small>More detail</small>
              </button>
            </div>

            <label className="setting-label" htmlFor="format-setting">
              Output format
            </label>
            <select
              id="format-setting"
              value={format}
              onChange={(event) => setFormat(event.target.value as UpscaleOptions['format'])}
            >
              <option value="png">PNG · Lossless</option>
              <option value="jpeg">JPEG · Photo</option>
              <option value="webp">WebP · Compact</option>
            </select>

            <label className="setting-label" htmlFor="quality-setting">
              Quality preference
            </label>
            <select
              id="quality-setting"
              value={quality}
              onChange={(event) => setQuality(event.target.value as UpscaleOptions['quality'])}
            >
              <option value="balanced">Balanced</option>
              <option value="high">Highest quality</option>
              <option value="small">Smaller file</option>
            </select>

            <button
              type="button"
              className="button button-primary enhance-button"
              onClick={runEnhancement}
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="button-spinner" aria-hidden="true" /> Enhancing image…
                </>
              ) : (
                <>
                  Enhance image <ArrowUpRight />
                </>
              )}
            </button>

            <p className="studio-status" role="status">
              {message}
            </p>

            {canSimulate && !result && (
              <div className="demo-simulate-banner">
                <button
                  type="button"
                  className="button button-light simulate-btn"
                  onClick={async () => {
                    if (!file) return;
                    setBusy(true);
                    setMessage('Rendering client-side simulated demonstration…');
                    const sim = await generateSimulatedOutput(file, Number(scale));
                    setResult(sim);
                    if (dimensions) {
                      setResultDimensions({
                        width: dimensions.width * Number(scale),
                        height: dimensions.height * Number(scale),
                      });
                    }
                    setMessage('Simulated preview rendered. Inspect or download the output.');
                    setBusy(false);
                  }}
                >
                  ⚡ Preview with Demonstration Engine
                </button>
              </div>
            )}

            <p className="api-notice">
              This downloadable starter includes the interface and an example API adapter, not your
              private processing backend. Configure the endpoint and adapt the request/response
              contract in <code>src/lib/upscaler.ts</code>.
            </p>
          </div>
        </div>
      </main>

      <footer className="studio-page-footer">
        <div className="footer-specs">
          <span>PRECISION UPSCALE ENGINE</span>
          <span>SRGB LOSSLESS PIPELINE</span>
          <span>UP TO 20 MB INPUT</span>
        </div>
        <div className="footer-links">
          <button type="button" className="text-button" onClick={onBack}>
            <ArrowLeft /> Return to showcase
          </button>
          <span>© PrismHD 2026</span>
        </div>
      </footer>
    </div>
  );
}

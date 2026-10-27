export type UpscaleOptions = {
  scale: '2' | '4';
  format: 'png' | 'jpeg' | 'webp';
  quality: 'balanced' | 'high' | 'small';
};

/**
 * Example adapter for an existing enhancement API.
 * Change the request fields and response parser to match your real backend.
 * The site never pretends to process an image when this endpoint is missing.
 */
export async function enhanceImage(file: File, options: UpscaleOptions): Promise<string> {
  const endpoint = import.meta.env.VITE_UPSCALER_ENDPOINT?.trim();
  if (!endpoint) {
    throw new Error('Studio preview only: set VITE_UPSCALER_ENDPOINT and adapt src/lib/upscaler.ts to your existing API before enabling processing.');
  }

  const payload = new FormData();
  payload.append('file', file);
  payload.append('scale', options.scale);
  payload.append('format', options.format);
  payload.append('quality', options.quality);

  const response = await fetch(endpoint, { method: 'POST', body: payload });
  if (!response.ok) {
    throw new Error(`Enhancement request failed (${response.status}). Check the configured API endpoint and server logs.`);
  }

  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('The API returned an unexpected response. Update the response parser in src/lib/upscaler.ts.');
  const record = data as Record<string, unknown>;
  const result = record.outputUrl ?? record.result_url ?? record.url;
  if (typeof result !== 'string' || !result) {
    throw new Error('No output URL was returned. Update the response parser in src/lib/upscaler.ts to match your backend.');
  }
  return result;
}

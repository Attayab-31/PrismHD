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
    throw new Error('Processing is not configured for this deployment. Add VITE_UPSCALER_ENDPOINT to connect your enhancement service.');
  }

  const payload = new FormData();
  payload.append('file', file);
  payload.append('scale', options.scale);
  payload.append('format', options.format);
  payload.append('quality', options.quality);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: payload,
      signal: controller.signal,
      credentials: 'omit',
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Enhancement request failed (${response.status}).${detail ? ` ${detail.slice(0, 160)}` : ''}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.startsWith('image/')) {
      return URL.createObjectURL(await response.blob());
    }

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') {
      throw new Error('The API returned an unexpected response. Update the response parser in src/lib/upscaler.ts.');
    }
    const record = data as Record<string, unknown>;
    const result = record.outputUrl ?? record.output_url ?? record.result_url ?? record.url;
    if (typeof result !== 'string' || !result) {
      throw new Error('No output URL was returned. Update the response parser in src/lib/upscaler.ts to match your backend.');
    }
    return result;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Enhancement timed out after 2 minutes. Try a smaller image or check the API service.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

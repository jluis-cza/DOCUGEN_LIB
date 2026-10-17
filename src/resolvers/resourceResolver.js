/**
 * Carga recursos desde Data URIs, URLs HTTP/HTTPS o rutas locales de Node.js.
 */

import fs from 'node:fs/promises';
import { decodeImageDataUri } from '../utils/images.js';
import { isValidUrl } from '../utils/helpers.js';
import { IMAGE_CONFIG, TIMEOUT_CONFIG } from '../utils/constants.js';

const readRemoteResource = async (src, timeout) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(src, {
      signal: controller.signal,
      headers: { 'User-Agent': 'docugen-lib/1.0.0' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > IMAGE_CONFIG.MAX_SIZE) {
      throw new Error(`Image size exceeds limit (${contentLength} > ${IMAGE_CONFIG.MAX_SIZE})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > IMAGE_CONFIG.MAX_SIZE) {
      throw new Error(`Image size exceeds limit (${buffer.length} > ${IMAGE_CONFIG.MAX_SIZE})`);
    }
    return buffer;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const readExternalResource = async (src, options = {}) => {
  if (!src) return null;
  const timeout = options.timeout || TIMEOUT_CONFIG.FETCH_RESOURCE;

  if (String(src).startsWith('data:')) {
    const image = decodeImageDataUri(src);
    if (!image) throw new Error('Unsupported or invalid image data URI.');
    if (image.size > IMAGE_CONFIG.MAX_SIZE) {
      throw new Error(`Image size exceeds limit (${image.size} > ${IMAGE_CONFIG.MAX_SIZE})`);
    }
    return image.buffer;
  }

  if (isValidUrl(src) && /^https?:\/\//i.test(src)) {
    return readRemoteResource(src, timeout);
  }

  const buffer = await fs.readFile(src);
  if (buffer.length > IMAGE_CONFIG.MAX_SIZE) {
    throw new Error(`Image size exceeds limit (${buffer.length} > ${IMAGE_CONFIG.MAX_SIZE})`);
  }
  return buffer;
};

export const validateResource = async (src) => {
  if (!src) return false;
  if (String(src).startsWith('data:')) return Boolean(decodeImageDataUri(src));

  if (isValidUrl(src) && /^https?:\/\//i.test(src)) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(src, { method: 'HEAD', signal: controller.signal });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  try {
    await fs.access(src);
    return true;
  } catch {
    return false;
  }
};

export const getResourceInfo = async (src) => {
  if (!src) return null;

  if (String(src).startsWith('data:')) {
    const image = decodeImageDataUri(src);
    if (!image) return null;
    return {
      type: 'data-uri',
      format: image.mimeType.slice('image/'.length),
      embedded: true,
      size: image.size,
    };
  }

  if (isValidUrl(src) && /^https?:\/\//i.test(src)) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(src, { method: 'HEAD', signal: controller.signal });
      return {
        type: 'remote-url',
        format: response.headers.get('content-type')?.match(/image\/(\w+)/)?.[1] || 'unknown',
        size: Number.parseInt(response.headers.get('content-length') || '0', 10),
        url: src,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  try {
    const file = await fs.stat(src);
    return { type: 'local-file', path: src, size: file.size };
  } catch {
    return null;
  }
};

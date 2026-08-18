/**
 * Resolvedor de recursos externos (imágenes, QR, etc.)
 * Carga recursos desde URLs, Data URIs, o rutas locales
 */

import { isDataUri, isValidUrl } from '../utils/helpers.js';
import { TIMEOUT_CONFIG, IMAGE_CONFIG } from '../utils/constants.js';

/**
 * Lee un recurso externo (imagen, etc.)
 * Soporta Data URIs, URLs HTTP/HTTPS y rutas locales de file system
 * @param {string} src - Fuente del recurso
 * @param {object} options - Opciones de configuración
 * @returns {Promise<Buffer|null>} - Buffer del recurso o null si falla
 */
export const readExternalResource = async (src, options = {}) => {
  if (!src) return null;

  const timeout = options.timeout || TIMEOUT_CONFIG.FETCH_RESOURCE;

  // Caso 1: Data URI (base64 embebido)
  if (isDataUri(src)) {
    try {
      const match = src.match(/^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.*)$/i);
      if (!match) return null;
      return Buffer.from(match[3], 'base64');
    } catch (error) {
      console.warn(`Failed to decode Data URI: ${error.message}`);
      return null;
    }
  }

  // Caso 2: URL HTTP/HTTPS
  if (isValidUrl(src) && (src.startsWith('http://') || src.startsWith('https://'))) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(src, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'docugen-lib/1.0.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.length > IMAGE_CONFIG.MAX_SIZE) {
        throw new Error(`Image size exceeds limit (${buffer.length} > ${IMAGE_CONFIG.MAX_SIZE})`);
      }

      return buffer;
    } catch (error) {
      console.warn(`Failed to fetch resource from ${src}: ${error.message}`);
      return null;
    }
  }

  // Caso 3: Ruta local de file system (solo si Node.js con fs disponible)
  if (typeof require !== 'undefined') {
    try {
      // Solo intentar en Node.js
      const fs = await import('node:fs/promises');
      const buffer = await fs.readFile(src);

      if (buffer.length > IMAGE_CONFIG.MAX_SIZE) {
        throw new Error(`Image size exceeds limit (${buffer.length} > ${IMAGE_CONFIG.MAX_SIZE})`);
      }

      return buffer;
    } catch (error) {
      console.warn(`Failed to read local file ${src}: ${error.message}`);
      return null;
    }
  }

  return null;
};

/**
 * Valida que un recurso sea accesible antes de usarlo
 * @param {string} src - Fuente del recurso
 * @returns {Promise<boolean>} - true si el recurso es accesible
 */
export const validateResource = async (src) => {
  if (!src) return false;

  // Data URIs son válidos por definición
  if (isDataUri(src)) return true;

  // URLs remotas: intentar fetch con HEAD
  if (isValidUrl(src) && (src.startsWith('http://') || src.startsWith('https://'))) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(src, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Archivos locales: intentar leer con fs
  if (typeof require !== 'undefined') {
    try {
      const fs = await import('node:fs/promises');
      await fs.access(src);
      return true;
    } catch {
      return false;
    }
  }

  return false;
};

/**
 * Obtiene información de un recurso sin descargarlo completamente
 * @param {string} src - Fuente del recurso
 * @returns {Promise<object|null>} - Información del recurso o null
 */
export const getResourceInfo = async (src) => {
  if (!src) return null;

  if (isDataUri(src)) {
    return {
      type: 'data-uri',
      format: src.match(/image\/(\w+)/)?.[1] || 'unknown',
      embeded: true,
    };
  }

  if (isValidUrl(src) && (src.startsWith('http://') || src.startsWith('https://'))) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(src, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return {
        type: 'remote-url',
        format: response.headers.get('content-type')?.match(/image\/(\w+)/)?.[1] || 'unknown',
        size: parseInt(response.headers.get('content-length') || '0'),
        url: src,
      };
    } catch (error) {
      return null;
    }
  }

  return {
    type: 'local-file',
    path: src,
  };
};

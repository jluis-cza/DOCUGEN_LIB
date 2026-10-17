/**
 * Resolvedor de placeholders dinámicos en plantillas
 * Reemplaza patrones {{variable}} con valores del objeto de datos
 */

import { normalizePlaceholderKey } from '../utils/helpers.js';

/**
 * Obtiene el valor de una clave del payload, con fallback
 * @param {string} key - Clave a buscar
 * @param {object} payload - Objeto de datos
 * @param {any} fallback - Valor por defecto
 * @returns {any} - Valor encontrado o fallback
 */
export const resolveFieldValue = (key, payload = {}, fallback = '') => {
  const value = payload?.[key];
  return value === undefined || value === null || value === '' ? fallback : value;
};

/**
 * Resuelve una cadena con placeholders {{variable}}
 * Reemplaza todos los placeholders con valores del payload
 * @param {string} value - Cadena con placeholders
 * @param {object} payload - Objeto de datos
 * @returns {string} - Cadena con placeholders resueltos
 */
export const resolveTemplateString = (value, payload = {}) => {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const replaced = resolveFieldValue(key, payload, '');
    return replaced === '' ? '' : String(replaced);
  });
};

/**
 * Extrae todas las claves de placeholder de una cadena
 * @param {string} value - Cadena con placeholders
 * @returns {string[]} - Array de claves encontradas
 */
export const extractPlaceholderKeys = (value) => {
  if (!value || typeof value !== 'string') return [];
  const matches = value.match(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g) || [];
  return matches.map((match) => normalizePlaceholderKey(match));
};

/**
 * Obtiene el texto de un elemento, resolviendo placeholder o template string
 * @param {object} element - Elemento de plantilla
 * @param {object} payload - Objeto de datos
 * @returns {string} - Texto resuelto
 */
export const getElementText = (element, payload = {}) => {
  const rawText = element?.text || '';
  const directPlaceholder = `{{${element?.placeholderKey || ''}}}`;
  if (element?.placeholderKey && rawText.trim() === directPlaceholder) {
    return resolveFieldValue(element.placeholderKey, payload, rawText);
  }
  return resolveTemplateString(rawText, payload);
};

/**
 * Obtiene el valor QR de un elemento, resolviendo placeholder o template string
 * @param {object} element - Elemento de plantilla
 * @param {object} payload - Objeto de datos
 * @returns {string} - Valor QR resuelto
 */
export const getElementQrValue = (element, payload = {}) => {
  const rawValue = element.placeholderKey
    ? resolveFieldValue(element.placeholderKey, payload, element.qrValue || element.text || '')
    : resolveTemplateString(element.qrValue || element.text || '', payload);

  return rawValue;
};

/**
 * Obtiene el valor de imagen de un elemento, resolviendo placeholder o template string
 * @param {object} element - Elemento de plantilla
 * @param {object} payload - Objeto de datos
 * @returns {string} - URL de imagen resuelta
 */
export const getElementImageSrc = (element, payload = {}) => {
  const rawSrc = element.placeholderKey
    ? resolveFieldValue(element.placeholderKey, payload, element.src || '')
    : resolveTemplateString(element.src || '', payload);

  return rawSrc;
};

/**
 * Obtiene el valor de una tabla, resolviendo placeholders
 * @param {object} element - Elemento de plantilla
 * @param {object} payload - Objeto de datos
 * @returns {string[][]} - Array de filas (cada fila es array de celdas)
 */
export const getTableRows = (element, payload = {}) => {
  const rawText = resolveTemplateString(element.text || '', payload);
  const rows = rawText.split('\n').map((row) => row.split('|').map((cell) => String(cell || '').trim()));
  return rows.filter((row) => row.some((cell) => cell));
};

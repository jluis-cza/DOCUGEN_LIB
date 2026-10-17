/**
 * Funciones auxiliares para DOCUGEN-LIB
 */

/**
 * Normaliza una clave de placeholder removiendo espacios en blanco y delimitadores
 * @param {string} value - Valor a normalizar
 * @returns {string} - Clave normalizada
 */
export const normalizePlaceholderKey = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/^\{\{\s*/, '')
    .replace(/\s*\}\}$/, '')
    .replace(/\s+/g, '_');
};

/**
 * Valida que un objeto tenga la estructura básica de plantilla
 * @param {object} template - Plantilla a validar
 * @returns {boolean} - true si es válida
 */
export const isValidTemplateStructure = (template) => {
  if (!template || typeof template !== 'object') return false;
  if (!template.name || typeof template.name !== 'string') return false;
  if (!template.dimensions || typeof template.dimensions !== 'object') return false;
  if (!Array.isArray(template.elements)) return false;
  return true;
};

/**
 * Valida que un valor sea una URL válida
 * @param {string} url - URL a validar
 * @returns {boolean} - true si es una URL válida
 */
export const isValidUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Valida que una cadena sea un Data URI válido
 * @param {string} dataUri - Data URI a validar
 * @returns {boolean} - true si es válido
 */
export const isDataUri = (dataUri) => {
  if (!dataUri || typeof dataUri !== 'string') return false;
  return /^data:image\/(png|jpeg);base64,/i.test(dataUri);
};

/**
 * Genera un ID único para documentos
 * @returns {string} - ID único
 */
export const generateUniqueId = () => {
  return `docugen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Convierte un objeto a JSON de forma segura
 * @param {any} obj - Objeto a serializar
 * @returns {string} - JSON string o cadena vacía si falla
 */
export const safeJsonStringify = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch {
    return '';
  }
};

/**
 * Parsea JSON de forma segura
 * @param {string} jsonStr - String a parsear
 * @param {any} fallback - Valor por defecto si falla
 * @returns {any} - Objeto parseado o fallback
 */
export const safeJsonParse = (jsonStr, fallback = null) => {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return fallback;
  }
};

/**
 * Obtiene el valor de una propiedad anidada de forma segura
 * @param {object} obj - Objeto a consultar
 * @param {string} path - Ruta de propiedad (ej: "user.profile.name")
 * @param {any} fallback - Valor por defecto
 * @returns {any} - Valor encontrado o fallback
 */
export const safeGet = (obj, path, fallback = undefined) => {
  if (!obj || typeof obj !== 'object') return fallback;
  const keys = String(path).split('.');
  let result = obj;
  for (const key of keys) {
    result = result?.[key];
    if (result === undefined) return fallback;
  }
  return result;
};

/**
 * Valida que un objeto tenga todas las propiedades requeridas
 * @param {object} obj - Objeto a validar
 * @param {string[]} requiredKeys - Claves requeridas
 * @returns {string[]} - Array de claves faltantes
 */
export const getMissingKeys = (obj, requiredKeys = []) => {
  if (!obj || typeof obj !== 'object') return requiredKeys;
  return requiredKeys.filter((key) => obj[key] === undefined || obj[key] === null);
};

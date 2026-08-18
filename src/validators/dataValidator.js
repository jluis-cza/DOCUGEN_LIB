/**
 * Validador de datos dinámicos
 * Verifica que los datos proporcionados sean válidos para una plantilla
 */

import { extractPlaceholderKeys } from '../resolvers/placeholderResolver.js';
import { getMissingKeys } from '../utils/helpers.js';

/**
 * Extrae todas las claves de parámetros requeridos de una plantilla
 * @param {object} template - Plantilla
 * @returns {object[]} - Array de parámetros { key, label, required, type, ... }
 */
export const extractTemplateParameters = (template = {}) => {
  const map = new Map();

  // Parámetros explícitos en metadatos
  const metadataParams = Array.isArray(template?.metadata?.dynamicParameters)
    ? template.metadata.dynamicParameters
    : [];

  metadataParams.forEach((param) => {
    const key = String(param?.key || param?.name || '').trim();
    if (!key) return;

    map.set(key, {
      key,
      label: param?.label || key,
      description: param?.description || '',
      required: Boolean(param?.required),
      type: param?.type || 'text',
      example: param?.example || '',
      allowedValues: Array.isArray(param?.allowedValues) ? param.allowedValues : undefined,
      source: 'metadata',
    });
  });

  // Parámetros implícitos en elementos
  const elements = Array.isArray(template?.elements) ? template.elements : [];
  elements.forEach((element) => {
    // Placeholders explícitos
    if (element?.placeholderKey) {
      const key = String(element.placeholderKey).trim();
      if (key && !map.has(key)) {
        map.set(key, {
          key,
          label: key,
          description: `Used in ${element?.type || 'element'}`,
          required: true,
          type: element?.type === 'checkbox' ? 'boolean' : 'text',
          example: '',
          source: 'placeholder',
        });
      }
    }

    // Placeholders en texto ({{key}})
    const textContent = [element?.text || '', element?.qrValue || '', element?.src || ''].join(' ');
    const placeholderKeys = extractPlaceholderKeys(textContent);

    placeholderKeys.forEach((key) => {
      if (key && !map.has(key)) {
        map.set(key, {
          key,
          label: key,
          description: `Used in ${element?.type || 'element'}`,
          required: true,
          type: element?.type === 'checkbox' ? 'boolean' : 'text',
          example: '',
          source: 'template-string',
        });
      }
    });
  });

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
};

/**
 * Valida que los datos proporcionados satisfagan los requisitos de la plantilla
 * @param {object} template - Plantilla
 * @param {object} data - Datos a validar
 * @returns {object} - { valid: boolean, errors: string[], missing: string[] }
 */
export const validateDataAgainstTemplate = (template, data = {}) => {
  const errors = [];
  const missing = [];

  if (!template || typeof template !== 'object') {
    errors.push('Template must be provided');
    return { valid: false, errors, missing };
  }

  if (!data || typeof data !== 'object') {
    errors.push('Data must be an object');
    return { valid: false, errors, missing };
  }

  const parameters = extractTemplateParameters(template);
  const requiredParams = parameters.filter((p) => p.required);

  // Verificar que todas las claves requeridas estén presentes
  requiredParams.forEach((param) => {
    const value = data[param.key];

    if (value === undefined || value === null) {
      missing.push(param.key);
      errors.push(`Missing required parameter: ${param.key}`);
      return;
    }

    // Validar tipo si es checkbox
    if (param.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Parameter '${param.key}' must be a boolean`);
    }

    // Validar valores permitidos si existen
    if (param.allowedValues && !param.allowedValues.includes(value)) {
      errors.push(
        `Parameter '${param.key}' must be one of: ${param.allowedValues.join(', ')}`
      );
    }

    // Validar que no sea vacío (string)
    if (typeof value === 'string' && value.trim() === '') {
      missing.push(param.key);
      errors.push(`Parameter '${param.key}' cannot be empty`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    missing,
  };
};

/**
 * Realiza una validación rápida de datos
 * @param {object} template - Plantilla
 * @param {object} data - Datos a validar
 * @returns {boolean} - true si los datos son válidos
 */
export const isValidData = (template, data) => {
  const result = validateDataAgainstTemplate(template, data);
  return result.valid;
};

/**
 * Obtiene un resumen de validación
 * @param {object} template - Plantilla
 * @param {object} data - Datos a validar
 * @returns {object} - Resumen detallado de validación
 */
export const getValidationSummary = (template, data) => {
  const parameters = extractTemplateParameters(template);
  const dataValidation = validateDataAgainstTemplate(template, data);

  return {
    templateInfo: {
      name: template?.name,
      totalParameters: parameters.length,
      requiredParameters: parameters.filter((p) => p.required).length,
      optionalParameters: parameters.filter((p) => !p.required).length,
    },
    parameters,
    dataValidation,
    isReady: dataValidation.valid,
  };
};

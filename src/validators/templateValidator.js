/**
 * Validador de plantillas JSON
 * Verifica que una plantilla tenga la estructura correcta
 */

import { SCHEMA_VERSION, SUPPORTED_ELEMENT_TYPES, ERROR_CODES } from '../utils/constants.js';
import { isValidTemplateStructure, getMissingKeys } from '../utils/helpers.js';

/**
 * Valida que una plantilla tenga la estructura básica requerida
 * @param {object} template - Plantilla a validar
 * @returns {object} - { valid: boolean, errors: string[] }
 */
export const validateTemplateStructure = (template) => {
  const errors = [];

  if (!template || typeof template !== 'object') {
    errors.push('Template must be an object');
    return { valid: false, errors };
  }

  // Campos requeridos
  const requiredFields = ['name', 'dimensions', 'elements'];
  const missing = getMissingKeys(template, requiredFields);
  if (missing.length) {
    errors.push(`Missing required fields: ${missing.join(', ')}`);
  }

  // Validar name
  if (template.name && typeof template.name !== 'string') {
    errors.push('Template name must be a string');
  }

  // Validar dimensions
  if (template.dimensions) {
    if (typeof template.dimensions !== 'object') {
      errors.push('Dimensions must be an object');
    } else {
      if (typeof template.dimensions.width !== 'number' || template.dimensions.width <= 0) {
        errors.push('Dimensions width must be a positive number');
      }
      if (typeof template.dimensions.height !== 'number' || template.dimensions.height <= 0) {
        errors.push('Dimensions height must be a positive number');
      }
    }
  }

  // Validar elements
  if (!Array.isArray(template.elements)) {
    errors.push('Elements must be an array');
  } else if (template.elements.length === 0) {
    errors.push('Template must have at least one element');
  } else {
    template.elements.forEach((element, index) => {
      if (!element.type) {
        errors.push(`Element at index ${index} is missing 'type' field`);
      } else if (!SUPPORTED_ELEMENT_TYPES.includes(element.type)) {
        errors.push(`Element at index ${index} has unsupported type: ${element.type}`);
      }

      // Validar campos geométricos básicos
      if (typeof element.x !== 'number') {
        errors.push(`Element at index ${index} is missing or invalid 'x' coordinate`);
      }
      if (typeof element.y !== 'number') {
        errors.push(`Element at index ${index} is missing or invalid 'y' coordinate`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Valida metadatos opcionales de la plantilla
 * @param {object} metadata - Metadatos a validar
 * @returns {object} - { valid: boolean, errors: string[] }
 */
export const validateTemplateMetadata = (metadata = {}) => {
  const errors = [];

  if (!metadata || typeof metadata !== 'object') {
    return { valid: true, errors }; // Opcional
  }

  // Validar dynamicParameters si existe
  if (metadata.dynamicParameters) {
    if (!Array.isArray(metadata.dynamicParameters)) {
      errors.push('Metadata.dynamicParameters must be an array');
    } else {
      metadata.dynamicParameters.forEach((param, index) => {
        if (!param.key || typeof param.key !== 'string') {
          errors.push(`Dynamic parameter at index ${index} is missing 'key' field`);
        }
        if (param.required && typeof param.required !== 'boolean') {
          errors.push(`Dynamic parameter at index ${index} has invalid 'required' field`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Valida una plantilla completa
 * @param {object} template - Plantilla a validar
 * @param {object} options - Opciones de validación
 * @returns {object} - { valid: boolean, errors: string[] }
 */
export const validateTemplate = (template, options = {}) => {
  const errors = [];

  // Validar estructura
  const structureValidation = validateTemplateStructure(template);
  if (!structureValidation.valid) {
    errors.push(...structureValidation.errors);
  }

  // Validar metadatos
  if (options.validateMetadata !== false) {
    const metadataValidation = validateTemplateMetadata(template.metadata);
    if (!metadataValidation.valid) {
      errors.push(...metadataValidation.errors);
    }
  }

  // Validar page config si existe
  if (template.page && typeof template.page !== 'object') {
    errors.push('Template page configuration must be an object');
  }

  // Validar canvas config si existe
  if (template.canvas && typeof template.canvas !== 'object') {
    errors.push('Template canvas configuration must be an object');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Realiza una validación rápida sin errores detallados
 * @param {object} template - Plantilla a validar
 * @returns {boolean} - true si es válida
 */
export const isValidTemplate = (template) => {
  const result = validateTemplate(template);
  return result.valid;
};

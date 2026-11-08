/**
 * Validador de plantillas JSON
 * Verifica que una plantilla tenga la estructura correcta
 */

import { SCHEMA_VERSION, SUPPORTED_ELEMENT_TYPES, ERROR_CODES, IMAGE_CONFIG } from '../utils/constants.js';
import { isValidTemplateStructure, getMissingKeys } from '../utils/helpers.js';
import { decodeImageDataUri } from '../utils/images.js';

const MIN_PAGE_DIMENSION_PX = 100;
const MAX_PAGE_DIMENSION_PX = 5000;

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
      for (const dimension of ['width', 'height']) {
        const value = Number(template.dimensions[dimension]);
        if (
          !Number.isInteger(value) ||
          value < MIN_PAGE_DIMENSION_PX ||
          value > MAX_PAGE_DIMENSION_PX
        ) {
          errors.push(
            `Dimensions ${dimension} must be an integer between ${MIN_PAGE_DIMENSION_PX} and ${MAX_PAGE_DIMENSION_PX} pixels`
          );
        }
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
      if (!element || typeof element !== 'object' || Array.isArray(element)) {
        errors.push(`Element at index ${index} must be an object`);
        return;
      }
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
        if (!param || typeof param !== 'object' || Array.isArray(param)) {
          errors.push(`Dynamic parameter at index ${index} must be an object`);
          return;
        }
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

const validateTemplateResources = (template) => {
  const errors = [];
  const resources = Array.isArray(template.metadata?.resources) ? template.metadata.resources : [];
  const resourceIds = new Set();
  let totalSize = 0;

  resources.forEach((resource, index) => {
    const image = decodeImageDataUri(resource?.dataUrl);
    if (
      !resource?.id ||
      !/^[A-Za-z0-9_.-]+$/.test(resource.id) ||
      resourceIds.has(resource.id) ||
      !image ||
      image.size === 0 ||
      image.size > IMAGE_CONFIG.MAX_SIZE ||
      resource.size !== image.size ||
      resource.mimeType !== image.mimeType ||
      !String(resource.name || '').trim() ||
      String(resource.name).length > 120
    ) {
      errors.push(`Template image resource at index ${index} is invalid or exceeds the 2 MB limit`);
      return;
    }
    resourceIds.add(resource.id);
    totalSize += image.size;
  });

  if (totalSize > IMAGE_CONFIG.MAX_TEMPLATE_TOTAL_SIZE) {
    errors.push('Template image resources exceed the 6 MB combined limit');
  }

  if (Array.isArray(template.elements)) {
    template.elements.forEach((element, index) => {
      if (element?.type !== 'image') return;
      const resourceId = element.resourceId ||
        (String(element.src || '').startsWith('resource:')
          ? String(element.src).slice('resource:'.length)
          : '');
      if (element.imageMode === 'static' && (!resourceId || !resourceIds.has(resourceId))) {
        errors.push(`Static image element at index ${index} must reference a valid template resource`);
      } else if (resourceId && !resourceIds.has(resourceId)) {
        errors.push(`Image element at index ${index} references an unknown resource: ${resourceId}`);
      }
    });
  }

  return errors;
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

  if (!template || typeof template !== 'object' || Array.isArray(template)) {
    return { valid: false, errors };
  }

  // Validar metadatos
  if (options.validateMetadata !== false) {
    const metadataValidation = validateTemplateMetadata(template.metadata);
    if (!metadataValidation.valid) {
      errors.push(...metadataValidation.errors);
    }
  }
  errors.push(...validateTemplateResources(template));

  // Validar page config si existe
  if (template.page && typeof template.page !== 'object') {
    errors.push('Template page configuration must be an object');
  }

  // Validar canvas config si existe
  if (template.canvas && typeof template.canvas !== 'object') {
    errors.push('Template canvas configuration must be an object');
  }

  if (template.page && typeof template.page === 'object') {
    const margin = template.page.margin;
    if (margin !== undefined && (!margin || typeof margin !== 'object' || Array.isArray(margin))) {
      errors.push('Template page margins must be an object');
    } else if (margin) {
      const values = ['top', 'right', 'bottom', 'left'].map((side) => Number(margin[side] ?? 40));
      if (values.some((value) => !Number.isInteger(value) || value < 0)) {
        errors.push('Template page margins must be non-negative integers');
      } else if (
        template.dimensions &&
        (values[1] + values[3] >= template.dimensions.width ||
          values[0] + values[2] >= template.dimensions.height)
      ) {
        errors.push('Template page margins must be smaller than page dimensions');
      }
    }
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

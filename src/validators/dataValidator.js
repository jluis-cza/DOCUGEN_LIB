/**
 * Descubre y valida los datos dinámicos que requiere una plantilla.
 */

import { decodeImageDataUri } from '../utils/images.js';
import { normalizePlaceholderKey } from '../utils/helpers.js';
import { IMAGE_CONFIG } from '../utils/constants.js';
import { extractPlaceholderKeys } from '../resolvers/placeholderResolver.js';

const inferParameterType = (element, field) => {
  if (field === 'text' && element?.type === 'checkbox') return 'text';
  if (field === 'src' && element?.type === 'image') return 'image';
  if (field === 'qrValue' && element?.type === 'qr') return 'qr';
  if (element?.type === 'checkbox') return 'boolean';
  if (element?.type === 'date') return 'date';
  if (element?.type === 'image') return 'image';
  if (element?.type === 'qr') return 'qr';
  if (['paragraph', 'list', 'footer'].includes(element?.type)) return 'textarea';
  return 'text';
};

const addParameter = (map, key, parameter) => {
  const normalizedKey = normalizePlaceholderKey(key);
  if (!normalizedKey || normalizedKey === 'page_number') return;
  map.set(normalizedKey, { key: normalizedKey, ...parameter });
};

export const extractTemplateParameters = (template = {}) => {
  const map = new Map();
  const metadataParams = Array.isArray(template?.metadata?.dynamicParameters)
    ? template.metadata.dynamicParameters
    : [];

  metadataParams.forEach((param) => {
    const key = normalizePlaceholderKey(param?.key || param?.name || '');
    if (!key || key === 'page_number') return;
    addParameter(map, key, {
      label: param?.label || key,
      description: param?.description || '',
      required: Boolean(param?.required),
      type: param?.type || inferParameterType({ type: param?.elementType }),
      example: param?.example || '',
      allowedValues: Array.isArray(param?.allowedValues) ? param.allowedValues : undefined,
      source: 'metadata',
    });
  });

  const elements = Array.isArray(template?.elements) ? template.elements : [];
  elements.forEach((element) => {
    if (!element || element.type === 'pageNumber') return;
    const explicitKey = normalizePlaceholderKey(element.placeholderKey);
    if (explicitKey) {
      if (element.type === 'image' && map.has(explicitKey)) {
        map.get(explicitKey).type = 'image';
      } else if (!map.has(explicitKey)) {
        addParameter(map, explicitKey, {
          label: explicitKey,
          description: `Used in ${element.type || 'element'}`,
          required: true,
          type: inferParameterType(element),
          example: '',
          source: 'placeholder',
        });
      }
    }

    ['text', 'qrValue', 'src'].forEach((field) => {
      extractPlaceholderKeys(String(element[field] || '')).forEach((key) => {
        const normalizedKey = normalizePlaceholderKey(key);
        if (!normalizedKey || normalizedKey === 'page_number') return;
        if (field === 'src' && element.type === 'image' && map.has(normalizedKey)) {
          map.get(normalizedKey).type = 'image';
          return;
        }
        if (map.has(normalizedKey)) return;
        addParameter(map, normalizedKey, {
          label: normalizedKey,
          description: `Used in ${element.type || 'element'}`,
          required: true,
          type: inferParameterType(element, field),
          example: '',
          source: 'template-string',
        });
      });
    });
  });

  return Array.from(map.values()).sort((left, right) => left.key.localeCompare(right.key));
};

const isHttpUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const validateParameterValue = (parameter, value) => {
  const text = String(value).trim();
  if (Array.isArray(parameter.allowedValues) && parameter.allowedValues.length > 0 &&
      !parameter.allowedValues.includes(text)) {
    return `Parameter '${parameter.key}' must be one of: ${parameter.allowedValues.join(', ')}`;
  }

  let valid = true;
  switch (parameter.type) {
    case 'number':
      valid = Number.isFinite(Number(text));
      break;
    case 'date':
      valid = !Number.isNaN(new Date(text).getTime());
      break;
    case 'boolean':
      valid = typeof value === 'boolean' ||
        ['true', 'false', '1', '0', 'yes', 'no'].includes(text.toLowerCase());
      break;
    case 'email':
      valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
      break;
    case 'url':
      try {
        new URL(text);
      } catch {
        valid = false;
      }
      break;
    case 'image': {
      const image = decodeImageDataUri(text);
      valid = isHttpUrl(text) || Boolean(image && image.size > 0 && image.size <= IMAGE_CONFIG.MAX_SIZE);
      break;
    }
    case 'qr':
      valid = text.length >= 3;
      break;
    case 'textarea':
      valid = text.length <= 4000;
      break;
    default:
      break;
  }

  return valid ? null : `Parameter '${parameter.key}' has an invalid ${parameter.type} value`;
};

export const validateDataAgainstTemplate = (template, data = {}) => {
  const errors = [];
  const missing = [];

  if (!template || typeof template !== 'object' || Array.isArray(template)) {
    errors.push('Template must be provided');
    return { valid: false, errors, missing };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('Data must be an object');
    return { valid: false, errors, missing };
  }

  extractTemplateParameters(template).forEach((parameter) => {
    const value = data[parameter.key];
    const empty = value === undefined || value === null || String(value).trim() === '';
    if (empty) {
      if (parameter.required) {
        missing.push(parameter.key);
        errors.push(`Missing required parameter: ${parameter.key}`);
      }
      return;
    }
    const error = validateParameterValue(parameter, value);
    if (error) errors.push(error);
  });

  return { valid: errors.length === 0, errors, missing };
};

export const isValidData = (template, data) =>
  validateDataAgainstTemplate(template, data).valid;

export const getValidationSummary = (template, data) => {
  const parameters = extractTemplateParameters(template);
  const dataValidation = validateDataAgainstTemplate(template, data);

  return {
    templateInfo: {
      name: template?.name,
      totalParameters: parameters.length,
      requiredParameters: parameters.filter((parameter) => parameter.required).length,
      optionalParameters: parameters.filter((parameter) => !parameter.required).length,
    },
    parameters,
    dataValidation,
    isReady: dataValidation.valid,
  };
};

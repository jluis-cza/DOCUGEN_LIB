/**
 * Constantes globales para DOCUGEN-LIB
 */

export const ELEMENT_TYPES = {
  TEXT: 'text',
  TITLE: 'title',
  SUBTITLE: 'subtitle',
  PARAGRAPH: 'paragraph',
  LIST: 'list',
  IMAGE: 'image',
  PLACEHOLDER: 'placeholder',
  DATE: 'date',
  PAGE_NUMBER: 'pageNumber',
  RECT: 'rect',
  LINE: 'line',
  FOOTER: 'footer',
  QR: 'qr',
  SIGNATURE: 'signature',
  SEPARATOR: 'separator',
  TABLE: 'table',
  CHECKBOX: 'checkbox',
};

export const SUPPORTED_ELEMENT_TYPES = Object.values(ELEMENT_TYPES);

export const DEFAULT_PAGE_DIMENSIONS = {
  width: 794,  // A4 width in pixels (210mm)
  height: 1123, // A4 height in pixels (297mm)
  unit: 'px',
};

export const DEFAULT_PAGE_CONFIG = {
  backgroundColor: '#ffffff',
  margin: { top: 40, right: 40, bottom: 40, left: 40 },
};

export const DEFAULT_CANVAS_CONFIG = {
  version: 1,
  zoom: 1,
  background: '#ffffff',
};

export const ERROR_CODES = {
  E1000: 'Template is required',
  E1001: 'Invalid template structure',
  E1002: 'Template not found in registry',
  E1003: 'Unsupported element type',
  E1004: 'Invalid data provided',
  E1005: 'Missing required parameters',
  E1006: 'Invalid placeholder format',
  E1007: 'Resource loading failed',
  E1008: 'PDF generation failed',
};

export const TIMEOUT_CONFIG = {
  FETCH_RESOURCE: 10000,      // 10 seconds for external resources
  PDF_GENERATION: 30000,      // 30 seconds for PDF generation
};

export const IMAGE_CONFIG = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB max
  SUPPORTED_FORMATS: ['png', 'jpeg', 'jpg', 'webp', 'gif'],
};

export const FONT_STYLES = {
  NORMAL: 'Helvetica',
  BOLD: 'Helvetica-Bold',
  ITALIC: 'Helvetica-Oblique',
  BOLD_ITALIC: 'Helvetica-BoldOblique',
};

export const SCHEMA_VERSION = 1;

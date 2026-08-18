/**
 * DOCUGEN-LIB
 * Librería JavaScript para generación de documentos PDF con plantillas dinámicas
 *
 * Uso básico:
 * ============
 *
 * import { DocugenEngine } from 'docugen-lib';
 *
 * const docugen = new DocugenEngine();
 * const template = JSON.parse(await fs.promises.readFile('template.json', 'utf-8'));
 *
 * docugen.registerTemplate(template, 'my-template');
 *
 * const pdfBuffer = await docugen.generatePDF({
 *   template: 'my-template',
 *   data: { name: 'John', date: '2026-08-18' }
 * });
 *
 * await fs.promises.writeFile('output.pdf', pdfBuffer);
 */

// Exportar clase principal
export { DocugenEngine } from './core/DocugenEngine.js';

// Exportar funciones de renderización
export { generatePdfBuffer, generatePdf } from './core/pdfRenderer.js';

// Exportar validadores
export {
  validateTemplateStructure,
  validateTemplateMetadata,
  validateTemplate,
  isValidTemplate,
  extractTemplateParameters,
  validateDataAgainstTemplate,
  isValidData,
  getValidationSummary,
} from './validators/index.js';

// Exportar resolvedores
export {
  resolveFieldValue,
  resolveTemplateString,
  extractPlaceholderKeys,
  getElementText,
  getElementQrValue,
  getElementImageSrc,
  getTableRows,
  readExternalResource,
  validateResource,
  getResourceInfo,
} from './resolvers/index.js';

// Exportar utilidades
export {
  normalizePlaceholderKey,
  isValidTemplateStructure,
  isValidUrl,
  isDataUri,
  generateUniqueId,
  safeJsonStringify,
  safeJsonParse,
  safeGet,
  getMissingKeys,
  ELEMENT_TYPES,
  SUPPORTED_ELEMENT_TYPES,
  DEFAULT_PAGE_DIMENSIONS,
  DEFAULT_PAGE_CONFIG,
  DEFAULT_CANVAS_CONFIG,
  ERROR_CODES,
  TIMEOUT_CONFIG,
  IMAGE_CONFIG,
  FONT_STYLES,
  SCHEMA_VERSION,
} from './utils/index.js';

// Versión de la librería
export const VERSION = '1.0.0-alpha.1';

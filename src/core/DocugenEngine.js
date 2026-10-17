/**
 * DocugenEngine - Motor de generación de documentos
 * Clase principal que gestiona plantillas y genera PDFs
 */

import { generatePdfBuffer, generatePdf } from './pdfRenderer.js';
import { validateTemplate, isValidTemplate } from '../validators/templateValidator.js';
import { validateDataAgainstTemplate, extractTemplateParameters, getValidationSummary } from '../validators/dataValidator.js';
import { generateUniqueId } from '../utils/helpers.js';

/**
 * Motor de generación de documentos PDF con plantillas dinámicas
 *
 * @class DocugenEngine
 * @example
 * const docugen = new DocugenEngine();
 *
 * // Registrar una plantilla
 * const template = JSON.parse(fs.readFileSync('template.json'));
 * docugen.registerTemplate(template, 'invoice');
 *
 * // Obtener información de la plantilla
 * const params = docugen.getTemplateParameters('invoice');
 * console.log(params); // Lista de parámetros disponibles
 *
 * // Validar datos
 * const validation = docugen.validateData('invoice', { client: 'ACME' });
 * if (!validation.valid) throw new Error(validation.errors.join(', '));
 *
 * // Generar PDF
 * const pdf = await docugen.generatePDF({
 *   template: 'invoice',
 *   data: { client: 'ACME', total: 1500 }
 * });
 * fs.writeFileSync('invoice.pdf', pdf);
 */
export class DocugenEngine {
  /**
   * Inicializa el motor de generación
   * @param {object} options - Opciones de configuración
   * @param {number} options.timeout - Timeout para cargar recursos remotos (ms)
   */
  constructor(options = {}) {
    this.templates = new Map();
    this.timeout = options.timeout || 30000;
    this.version = '1.0.0-alpha.1';
  }

  /**
   * Registra una plantilla en el motor
   * @param {object} templateData - Datos de plantilla (JSON)
   * @param {string} templateId - ID único para la plantilla (default: auto-generate)
   * @returns {object} - Plantilla registrada
   * @throws {Error} - Si la plantilla no es válida
   *
   * @example
   * const template = JSON.parse(templateJson);
   * docugen.registerTemplate(template, 'invoice_v1');
   */
  registerTemplate(templateData, templateId = null) {
    if (!templateData || typeof templateData !== 'object') {
      throw new Error('Template data must be an object');
    }

    // Validar estructura de la plantilla
    const validation = validateTemplate(templateData);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.join('; ')}`);
    }

    const id = templateId || generateUniqueId();
    this.templates.set(id, {
      ...templateData,
      _docugenId: id,
      _registeredAt: new Date().toISOString(),
    });

    return {
      id,
      name: templateData.name,
      elementCount: (templateData.elements || []).length,
      registeredAt: new Date().toISOString(),
    };
  }

  /**
   * Obtiene una plantilla registrada
   * @param {string} templateId - ID de la plantilla
   * @returns {object} - Datos de la plantilla
   * @throws {Error} - Si la plantilla no existe
   *
   * @example
   * const template = docugen.getTemplate('invoice_v1');
   */
  getTemplate(templateId) {
    if (!this.templates.has(templateId)) {
      throw new Error(`Template not found: ${templateId}`);
    }
    return this.templates.get(templateId);
  }

  /**
   * Lista todas las plantillas registradas
   * @returns {object[]} - Array de metadatos de plantillas
   *
   * @example
   * const templates = docugen.getTemplates();
   * console.log(templates); // [{ id, name, elementCount, registeredAt }, ...]
   */
  getTemplates() {
    return Array.from(this.templates.entries()).map(([id, template]) => ({
      id,
      name: template.name,
      description: template.description || '',
      elementCount: (template.elements || []).length,
      registeredAt: template._registeredAt,
    }));
  }

  /**
   * Elimina una plantilla del registro
   * @param {string} templateId - ID de la plantilla
   * @returns {boolean} - true si fue eliminada
   *
   * @example
   * docugen.unregisterTemplate('invoice_v1');
   */
  unregisterTemplate(templateId) {
    return this.templates.delete(templateId);
  }

  /**
   * Verifica si una plantilla está registrada
   * @param {string} templateId - ID de la plantilla
   * @returns {boolean} - true si existe
   */
  hasTemplate(templateId) {
    return this.templates.has(templateId);
  }

  /**
   * Obtiene los parámetros dinámicos de una plantilla
   * @param {string} templateId - ID de la plantilla
   * @returns {object[]} - Array de parámetros con metadata
   * @throws {Error} - Si la plantilla no existe
   *
   * @example
   * const params = docugen.getTemplateParameters('invoice_v1');
   * // [
   * //   { key: 'client', label: 'Client Name', required: true, type: 'text', ... },
   * //   { key: 'total', label: 'Total Amount', required: true, type: 'text', ... }
   * // ]
   */
  getTemplateParameters(templateId) {
    const template = this.getTemplate(templateId);
    return extractTemplateParameters(template);
  }

  /**
   * Obtiene un resumen detallado de información de una plantilla
   * @param {string} templateId - ID de la plantilla
   * @returns {object} - Información detallada
   * @throws {Error} - Si la plantilla no existe
   *
   * @example
   * const info = docugen.getTemplateInfo('invoice_v1');
   * console.log(info.parameters); // Lista de parámetros
   * console.log(info.elements); // Lista de elementos
   */
  getTemplateInfo(templateId) {
    const template = this.getTemplate(templateId);
    const parameters = extractTemplateParameters(template);

    return {
      id: templateId,
      name: template.name,
      description: template.description || '',
      dimensions: template.dimensions,
      elementCount: (template.elements || []).length,
      parameters,
      registeredAt: template._registeredAt,
    };
  }

  /**
   * Valida que los datos sean válidos para una plantilla
   * @param {string} templateId - ID de la plantilla
   * @param {object} data - Datos a validar
   * @returns {object} - { valid: boolean, errors: string[], missing: string[] }
   * @throws {Error} - Si la plantilla no existe
   *
   * @example
   * const validation = docugen.validateData('invoice_v1', {});
   * if (!validation.valid) {
   *   console.log('Missing:', validation.missing); // ['client', 'total']
   *   console.log('Errors:', validation.errors);
   * }
   */
  validateData(templateId, data = {}) {
    const template = this.getTemplate(templateId);
    return validateDataAgainstTemplate(template, data);
  }

  /**
   * Obtiene un resumen completo de validación
   * Incluye información de la plantilla y estado de validación de datos
   * @param {string} templateId - ID de la plantilla
   * @param {object} data - Datos a validar
   * @returns {object} - Resumen de validación
   * @throws {Error} - Si la plantilla no existe
   *
   * @example
   * const summary = docugen.getValidationSummary('invoice_v1', data);
   * console.log(summary.isReady); // true o false
   * console.log(summary.parameters); // Parámetros de la plantilla
   */
  getValidationSummary(templateId, data = {}) {
    const template = this.getTemplate(templateId);
    return getValidationSummary(template, data);
  }

  /**
   * Genera un PDF a partir de una plantilla y datos
   * Retorna un Buffer que puede guardarse a disco o enviarse como respuesta HTTP
   *
   * @param {object} options - Opciones de generación
   * @param {string} options.template - ID de plantilla registrada O objeto plantilla directamente
   * @param {object} options.data - Datos dinámicos (default: {})
   * @param {boolean} options.validate - Validar datos antes de generar (default: true)
   * @returns {Promise<Buffer>} - Buffer del PDF generado
   * @throws {Error} - Si la plantilla no existe o los datos son inválidos
   *
   * @example
   * // Usando plantilla registrada
   * const pdfBuffer = await docugen.generatePDF({
   *   template: 'invoice_v1',
   *   data: { client: 'ACME Corp', total: 1500 }
   * });
   * fs.writeFileSync('invoice.pdf', pdfBuffer);
   *
   * // Enviando como respuesta HTTP
   * app.get('/generate', async (req, res) => {
   *   const pdf = await docugen.generatePDF({
   *     template: 'invoice_v1',
   *     data: req.query
   *   });
   *   res.setHeader('Content-Type', 'application/pdf');
   *   res.send(pdf);
   * });
   */
  async generatePDF({ template, data = {}, validate = true } = {}) {
    let templateObj;

    // Resolver si es ID o directamente un objeto
    if (typeof template === 'string') {
      templateObj = this.getTemplate(template);
    } else if (typeof template === 'object' && template !== null) {
      // Validar plantilla directa
      if (!isValidTemplate(template)) {
        throw new Error('Invalid template object provided');
      }
      templateObj = template;
    } else {
      throw new Error('Template must be a registered template ID or a template object');
    }

    // Validar datos si está habilitado
    if (validate) {
      const validation = validateDataAgainstTemplate(templateObj, data);
      if (!validation.valid) {
        throw new Error(`Data validation failed: ${validation.errors.join('; ')}`);
      }
    }

    // Generar PDF
    return generatePdfBuffer({
      template: templateObj,
      data,
      timeout: this.timeout,
    });
  }

  /**
   * Genera un PDF con metadatos adicionales
   * Útil cuando necesitas información sobre el documento generado
   *
   * @param {object} options - Opciones de generación (mismo que generatePDF)
   * @returns {Promise<object>} - { buffer: Buffer, metadata: object }
   * @throws {Error} - Si la plantilla no existe o los datos son inválidos
   *
   * @example
   * const result = await docugen.generatePDFWithMetadata({
   *   template: 'invoice_v1',
   *   data: { client: 'ACME', total: 1500 }
   * });
   * console.log(result.metadata.generatedAt); // ISO timestamp
   * console.log(result.metadata.elementCount); // Número de elementos
   * fs.writeFileSync('invoice.pdf', result.buffer);
   */
  async generatePDFWithMetadata({ template, data = {}, validate = true } = {}) {
    let templateObj;

    if (typeof template === 'string') {
      templateObj = this.getTemplate(template);
    } else if (typeof template === 'object' && template !== null) {
      if (!isValidTemplate(template)) {
        throw new Error('Invalid template object provided');
      }
      templateObj = template;
    } else {
      throw new Error('Template must be a registered template ID or a template object');
    }

    if (validate) {
      const validation = validateDataAgainstTemplate(templateObj, data);
      if (!validation.valid) {
        throw new Error(`Data validation failed: ${validation.errors.join('; ')}`);
      }
    }

    return generatePdf({
      template: templateObj,
      data,
      timeout: this.timeout,
    });
  }

  /**
   * Exporta la configuración de una plantilla (para compartir o respaldar)
   * @param {string} templateId - ID de la plantilla
   * @returns {object} - Plantilla en formato JSON
   * @throws {Error} - Si la plantilla no existe
   *
   * @example
   * const template = docugen.exportTemplate('invoice_v1');
   * fs.writeFileSync('invoice_v1.json', JSON.stringify(template, null, 2));
   */
  exportTemplate(templateId) {
    const template = this.getTemplate(templateId);
    const { _docugenId, _registeredAt, ...exportData } = template;
    return exportData;
  }

  /**
   * Obtiene información de la librería
   * @returns {object} - Información de versión y capacidades
   *
   * @example
   * const info = docugen.getInfo();
   * console.log(info.version);
   */
  getInfo() {
    return {
      version: this.version,
      name: 'docugen-lib',
      description: 'JavaScript library for dynamic PDF document generation',
      templates: this.templates.size,
      capabilities: [
        'Template registration and management',
        'Dynamic parameter extraction',
        'Data validation',
        'PDF generation with 17 element types',
        'External resource handling (images, QR codes)',
        'Metadata tracking',
      ],
    };
  }
}

export default DocugenEngine;

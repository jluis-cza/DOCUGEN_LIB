/**
 * DocugenEngine - Motor de generación de documentos
 * Clase principal que gestiona plantillas y genera PDFs
 */

import { generatePdfBuffer, generatePdf } from './pdfRenderer.js';
import { validateTemplate, isValidTemplate } from '../validators/templateValidator.js';
import { validateDataAgainstTemplate, extractTemplateParameters, getValidationSummary } from '../validators/dataValidator.js';
import { generateUniqueId } from '../utils/helpers.js';

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const resolveTemplate = (engine, template) => {
  if (typeof template === 'string') return engine.getTemplate(template);
  if (isRecord(template)) {
    if (!isValidTemplate(template)) throw new Error('Invalid template object provided');
    return template;
  }
  throw new Error('Template must be a registered template ID or a template object');
};

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
   * @param {object} options.metadata - Metadatos PDF opcionales: documentName, author y status
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
  async generatePDF({ template, data = {}, metadata = {}, validate = true } = {}) {
    const templateObj = resolveTemplate(this, template);
    if (!isRecord(metadata)) throw new Error('Metadata must be an object');

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
      metadata,
      timeout: this.timeout,
    });
  }

  /**
   * Genera un PDF con metadatos adicionales
   * Útil cuando necesitas información sobre el documento generado
   *
   * @param {object} options - Opciones de generación (mismo que generatePDF)
   * @param {object} options.metadata - Metadatos PDF opcionales: documentName, author y status
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
  async generatePDFWithMetadata({ template, data = {}, metadata = {}, validate = true } = {}) {
    const templateObj = resolveTemplate(this, template);
    if (!isRecord(metadata)) throw new Error('Metadata must be an object');

    if (validate) {
      const validation = validateDataAgainstTemplate(templateObj, data);
      if (!validation.valid) {
        throw new Error(`Data validation failed: ${validation.errors.join('; ')}`);
      }
    }

    return generatePdf({
      template: templateObj,
      data,
      metadata,
      timeout: this.timeout,
    });
  }

  /**
   * Genera un lote de PDFs y conserva los resultados exitosos aunque falle algún registro.
   * @param {object} options - Opciones de generación por lote
   * @param {string|object} options.template - ID registrado u objeto de plantilla
   * @param {object[]} options.documents - Registros { id?, data, metadata? }, máximo 100
   * @param {object} options.metadata - Metadatos de documento usados como valor predeterminado
   * @param {boolean} options.validate - Validar datos antes de generar cada PDF
   * @returns {Promise<object>} Resultados individuales y conteos del lote
   */
  async generatePDFs({
    template,
    documents,
    metadata = {},
    validate = true,
  } = {}) {
    const templateObj = resolveTemplate(this, template);
    if (!Array.isArray(documents) || documents.length === 0) {
      throw new Error('Documents must be a non-empty array');
    }
    if (documents.length > 100) throw new Error('A batch cannot contain more than 100 documents');
    if (!isRecord(metadata)) throw new Error('Metadata must be an object');

    const results = [];
    for (const [index, document] of documents.entries()) {
      const item = isRecord(document) ? document : {};
      const result = { index, id: item.id ?? null };

      try {
        if (!isRecord(document)) throw new Error('Each document must be an object');
        const documentMetadata = item.metadata ?? metadata;
        if (!isRecord(documentMetadata)) throw new Error('Document metadata must be an object');
        const generated = await this.generatePDFWithMetadata({
          template: templateObj,
          data: item.data ?? {},
          metadata: documentMetadata,
          validate,
        });
        results.push({
          ...result,
          success: true,
          ...generated,
        });
      } catch (error) {
        results.push({
          ...result,
          success: false,
          error: error?.message || String(error),
        });
      }
    }

    const succeeded = results.filter((result) => result.success).length;
    return {
      templateName: templateObj.name || 'Untitled',
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
      results,
      generatedAt: new Date().toISOString(),
    };
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
        'Batch PDF generation with partial results',
        'PDF document metadata',
        'External resource handling (images, QR codes)',
        'Metadata tracking',
      ],
    };
  }
}

export default DocugenEngine;

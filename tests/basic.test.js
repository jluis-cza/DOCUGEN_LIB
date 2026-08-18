/**
 * Tests básicos para DOCUGEN-LIB
 * Ejecutar: npm test
 */

import test from 'node:test';
import assert from 'node:assert';
import { DocugenEngine } from '../src/index.js';
import { validateTemplate, isValidTemplate } from '../src/validators/templateValidator.js';
import { extractTemplateParameters, validateDataAgainstTemplate } from '../src/validators/dataValidator.js';
import { resolveTemplateString, extractPlaceholderKeys } from '../src/resolvers/placeholderResolver.js';

// ============================================
// Pruebas de Resolvedores
// ============================================

test('Placeholder Resolver - Resuelve placeholders simples', () => {
  const result = resolveTemplateString('Hello {{name}}, you have {{count}} messages', {
    name: 'Juan',
    count: 5,
  });

  assert.strictEqual(result, 'Hello Juan, you have 5 messages');
});

test('Placeholder Resolver - Extrae claves de placeholder', () => {
  const keys = extractPlaceholderKeys('Invoice {{invoice_id}} from {{company_name}}');
  assert.deepStrictEqual(keys, ['invoice_id', 'company_name']);
});

test('Placeholder Resolver - Maneja placeholders faltantes', () => {
  const result = resolveTemplateString('Hello {{name}}, {{missing}}', { name: 'Juan' });
  assert.strictEqual(result, 'Hello Juan, ');
});

// ============================================
// Pruebas de Validadores
// ============================================

test('Template Validator - Valida estructura básica', () => {
  const validTemplate = {
    name: 'Test Template',
    dimensions: { width: 794, height: 1123 },
    elements: [
      {
        id: 'title',
        type: 'title',
        x: 0,
        y: 0,
        width: 794,
        height: 40,
        text: 'Hello',
      },
    ],
  };

  const result = validateTemplate(validTemplate);
  assert.strictEqual(result.valid, true);
});

test('Template Validator - Rechaza plantilla sin elementos', () => {
  const invalidTemplate = {
    name: 'Test',
    dimensions: { width: 794, height: 1123 },
    elements: [],
  };

  const result = validateTemplate(invalidTemplate);
  assert.strictEqual(result.valid, false);
  assert(result.errors.some((e) => e.includes('at least one element')));
});

test('Template Validator - Rechaza tipo de elemento no soportado', () => {
  const invalidTemplate = {
    name: 'Test',
    dimensions: { width: 794, height: 1123 },
    elements: [
      {
        id: 'invalid',
        type: 'unsupportedType',
        x: 0,
        y: 0,
      },
    ],
  };

  const result = validateTemplate(invalidTemplate);
  assert.strictEqual(result.valid, false);
  assert(result.errors.some((e) => e.includes('unsupported type')));
});

// ============================================
// Pruebas de Data Validator
// ============================================

test('Data Validator - Extrae parámetros de plantilla', () => {
  const template = {
    name: 'Invoice',
    dimensions: { width: 794, height: 1123 },
    elements: [
      {
        id: 'invoice_num',
        type: 'text',
        x: 0,
        y: 0,
        placeholderKey: 'invoice_number',
        text: 'Invoice #',
      },
      {
        id: 'client',
        type: 'text',
        x: 0,
        y: 40,
        text: 'Client: {{client_name}}',
      },
    ],
    metadata: {
      dynamicParameters: [
        {
          key: 'invoice_number',
          label: 'Invoice Number',
          required: true,
        },
      ],
    },
  };

  const params = extractTemplateParameters(template);
  const keys = params.map((p) => p.key);

  assert(keys.includes('invoice_number'));
  assert(keys.includes('client_name'));
});

test('Data Validator - Valida datos contra plantilla', () => {
  const template = {
    name: 'Invoice',
    dimensions: { width: 794, height: 1123 },
    elements: [
      {
        id: 'title',
        type: 'text',
        x: 0,
        y: 0,
        placeholderKey: 'invoice_number',
        text: 'Invoice #',
      },
    ],
  };

  const validation = validateDataAgainstTemplate(template, {
    invoice_number: 'INV-001',
  });

  assert.strictEqual(validation.valid, true);
});

test('Data Validator - Rechaza datos incompletos', () => {
  const template = {
    name: 'Invoice',
    dimensions: { width: 794, height: 1123 },
    elements: [
      {
        id: 'number',
        type: 'text',
        x: 0,
        y: 0,
        placeholderKey: 'invoice_number',
        text: 'Invoice',
      },
    ],
  };

  const validation = validateDataAgainstTemplate(template, {});

  assert.strictEqual(validation.valid, false);
  assert(validation.missing.includes('invoice_number'));
});

// ============================================
// Pruebas de DocugenEngine
// ============================================

test('DocugenEngine - Registra plantilla correctamente', () => {
  const docugen = new DocugenEngine();

  const template = {
    name: 'Test',
    dimensions: { width: 794, height: 1123 },
    elements: [
      {
        id: 'title',
        type: 'title',
        x: 0,
        y: 0,
        width: 794,
        height: 40,
        text: 'Test',
      },
    ],
  };

  const result = docugen.registerTemplate(template, 'test_template');

  assert.strictEqual(result.id, 'test_template');
  assert.strictEqual(result.name, 'Test');
  assert.strictEqual(result.elementCount, 1);
});

test('DocugenEngine - Obtiene plantilla registrada', () => {
  const docugen = new DocugenEngine();

  const template = {
    name: 'Invoice',
    dimensions: { width: 794, height: 1123 },
    elements: [
      {
        id: 'title',
        type: 'title',
        x: 0,
        y: 0,
        width: 794,
        height: 40,
        text: 'Invoice',
      },
    ],
  };

  docugen.registerTemplate(template, 'invoice');
  const retrieved = docugen.getTemplate('invoice');

  assert.strictEqual(retrieved.name, 'Invoice');
  assert.strictEqual(retrieved.elements.length, 1);
});

test('DocugenEngine - Lanza error si plantilla no existe', () => {
  const docugen = new DocugenEngine();

  assert.throws(
    () => docugen.getTemplate('nonexistent'),
    /Template not found/
  );
});

test('DocugenEngine - Lista plantillas registradas', () => {
  const docugen = new DocugenEngine();

  const template = {
    name: 'Template',
    dimensions: { width: 794, height: 1123 },
    elements: [
      {
        id: 'title',
        type: 'title',
        x: 0,
        y: 0,
        width: 794,
        height: 40,
        text: 'Title',
      },
    ],
  };

  docugen.registerTemplate(template, 'template1');
  docugen.registerTemplate(template, 'template2');

  const templates = docugen.getTemplates();

  assert.strictEqual(templates.length, 2);
});

test('DocugenEngine - Obtiene parámetros de plantilla', () => {
  const docugen = new DocugenEngine();

  const template = {
    name: 'Invoice',
    dimensions: { width: 794, height: 1123 },
    elements: [
      {
        id: 'client',
        type: 'text',
        x: 0,
        y: 0,
        placeholderKey: 'client_name',
        text: 'Client',
      },
      {
        id: 'total',
        type: 'text',
        x: 0,
        y: 40,
        text: 'Total: {{amount}}',
      },
    ],
  };

  docugen.registerTemplate(template, 'invoice');
  const params = docugen.getTemplateParameters('invoice');

  const keys = params.map((p) => p.key);
  assert(keys.includes('client_name'));
  assert(keys.includes('amount'));
});

test('DocugenEngine - Valida datos', () => {
  const docugen = new DocugenEngine();

  const template = {
    name: 'Invoice',
    dimensions: { width: 794, height: 1123 },
    elements: [
      {
        id: 'number',
        type: 'text',
        x: 0,
        y: 0,
        placeholderKey: 'invoice_number',
        text: 'Invoice',
      },
    ],
  };

  docugen.registerTemplate(template, 'invoice');

  const validationValid = docugen.validateData('invoice', { invoice_number: 'INV-001' });
  assert.strictEqual(validationValid.valid, true);

  const validationInvalid = docugen.validateData('invoice', {});
  assert.strictEqual(validationInvalid.valid, false);
  assert(validationInvalid.missing.includes('invoice_number'));
});

test('DocugenEngine - Rechaza plantilla inválida en registro', () => {
  const docugen = new DocugenEngine();

  assert.throws(
    () =>
      docugen.registerTemplate({
        name: 'Invalid',
        dimensions: { width: 794, height: 1123 },
        elements: [],
      }),
    /Invalid template/
  );
});

test('DocugenEngine - Obtiene información de librería', () => {
  const docugen = new DocugenEngine();

  const info = docugen.getInfo();

  assert(info.version);
  assert.strictEqual(info.name, 'docugen-lib');
  assert(Array.isArray(info.capabilities));
});

console.log('✅ Todos los tests completados');

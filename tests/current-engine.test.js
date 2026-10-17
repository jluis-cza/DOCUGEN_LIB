import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import PDFDocument from 'pdfkit';
import { DocugenEngine } from '../src/index.js';
import { readExternalResource } from '../src/resolvers/resourceResolver.js';

const tinyPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';

test('extracts typed inputs and reserves generated page numbers', () => {
  const engine = new DocugenEngine();
  engine.registerTemplate({
    name: 'Typed parameters',
    dimensions: { width: 500, height: 500, unit: 'px' },
    elements: [
      { id: 'age', type: 'text', x: 0, y: 0, placeholderKey: 'age' },
      { id: 'photo', type: 'image', x: 0, y: 0, src: '{{photo}}' },
      { id: 'accepted', type: 'checkbox', x: 0, y: 0, placeholderKey: 'accepted' },
      { id: 'page', type: 'pageNumber', x: 0, y: 0, text: 'Page {{page_number}}' },
    ],
    metadata: {
      dynamicParameters: [
        { key: 'age', type: 'number', required: true },
        { key: 'mail', type: 'email', required: true },
      ],
    },
  }, 'typed');

  assert.deepEqual(
    engine.getTemplateParameters('typed').map(({ key, type }) => ({ key, type })),
    [
      { key: 'accepted', type: 'boolean' },
      { key: 'age', type: 'number' },
      { key: 'mail', type: 'email' },
      { key: 'photo', type: 'image' },
    ]
  );
  assert.equal(engine.validateData('typed', {
    age: 0,
    mail: 'not-an-email',
    photo: 'https://example.com/photo.png',
    accepted: false,
  }).valid, false);
  assert.equal(engine.validateData('typed', {
    age: 0,
    mail: 'person@example.com',
    photo: 'https://example.com/photo.png',
    accepted: false,
  }).valid, true);
});

test('renders pixel-sized multi-page PDFs and injects page numbers', async () => {
  const engine = new DocugenEngine();
  const template = {
    name: 'Paginated',
    dimensions: { width: 300, height: 300, unit: 'px' },
    page: { margin: { top: 20, right: 20, bottom: 20, left: 20 } },
    elements: [
      {
        id: 'body',
        type: 'paragraph',
        x: 10,
        y: 10,
        width: 260,
        height: 260,
        text: Array.from({ length: 800 }, (_, index) => `Line ${index + 1} sample content`).join(' '),
      },
      { id: 'page-number', type: 'pageNumber', x: 10, y: 270, width: 100, height: 16, text: 'Page {{page_number}}' },
    ],
  };
  const originalText = PDFDocument.prototype.text;
  const labels = [];
  PDFDocument.prototype.text = function (text, ...args) {
    if (String(text).startsWith('Page ')) labels.push(String(text));
    return originalText.call(this, text, ...args);
  };

  try {
    const pdf = await engine.generatePDF({ template, validate: false });
    const source = pdf.toString('latin1');
    const pageCount = (source.match(/\/Type\s*\/Page\b/g) || []).length;
    assert.ok(pdf.subarray(0, 5).toString('ascii') === '%PDF-');
    assert.ok(pageCount > 1);
    assert.match(source, /\/MediaBox \[0 0 225 225\]/);
    assert.equal(labels.length, pageCount);
    assert.deepEqual(labels, labels.map((_, index) => `Page ${index + 1}`));
  } finally {
    PDFDocument.prototype.text = originalText;
  }
});

test('renders inline styles, embedded font families, transforms, and static resources', async () => {
  const engine = new DocugenEngine();
  const dataUrl = `data:image/png;base64,${tinyPng}`;
  const template = {
    name: 'Styled certificate',
    dimensions: { width: 500, height: 400, unit: 'px' },
    metadata: {
      resources: [{
        id: 'brand-logo',
        name: 'logo.png',
        mimeType: 'image/png',
        size: Buffer.from(tinyPng, 'base64').length,
        dataUrl,
      }],
    },
    elements: [
      {
        id: 'styled',
        type: 'paragraph',
        x: 20,
        y: 20,
        width: 400,
        height: 60,
        text: 'Welcome <bold>{{name}}</bold>',
        fontFamily: 'Roboto',
        fontWeight: 600,
        italic: true,
        underline: true,
        align: 'justify',
        rotation: 4,
        opacity: 0.5,
      },
      {
        id: 'logo',
        type: 'image',
        x: 20,
        y: 100,
        width: 80,
        height: 80,
        imageMode: 'static',
        resourceId: 'brand-logo',
        src: 'resource:brand-logo',
      },
    ],
  };
  engine.registerTemplate(template, 'styled');

  const pdf = await engine.generatePDF({ template: 'styled', data: { name: 'Ada Lovelace' } });
  const source = pdf.toString('latin1');
  assert.ok(pdf.subarray(0, 5).toString('ascii') === '%PDF-');
  assert.match(source, /\/FontFile2\b/);
  assert.match(source, /Roboto-/);
  assert.match(source, /\/Subtype \/Image/);
  assert.match(source, /\/ca 0\.5/);
});

test('reads local resources in ESM and reports invalid image data', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'docugen-lib-'));
  const imagePath = path.join(directory, 'pixel.png');
  const imageBuffer = Buffer.from(tinyPng, 'base64');
  await fs.writeFile(imagePath, imageBuffer);

  try {
    assert.deepEqual(await readExternalResource(imagePath), imageBuffer);
    await assert.rejects(
      readExternalResource('data:image/gif;base64,AAAA'),
      /Unsupported or invalid image data URI/
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

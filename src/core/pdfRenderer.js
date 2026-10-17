/**
 * Convierte plantillas DOCUGEN en PDFKit buffers.
 */

import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {
  getElementImageSrc,
  getElementQrValue,
  getElementText,
  getTableRows,
  resolveTemplateString,
} from '../resolvers/placeholderResolver.js';
import { readExternalResource } from '../resolvers/resourceResolver.js';
import { DEFAULT_PAGE_CONFIG, DEFAULT_PAGE_DIMENSIONS } from '../utils/constants.js';
import { hasTextMarkup, parseTextMarkup, wrapStyledText } from '../utils/textMarkup.js';

const require = createRequire(import.meta.url);
const PDF_POINTS_PER_PIXEL = 72 / 96;
const FONT_FILES = {
  Roboto: {
    regular: require.resolve('@fontsource/roboto/files/roboto-latin-400-normal.woff'),
    semibold: require.resolve('@fontsource/roboto/files/roboto-latin-600-normal.woff'),
    bold: require.resolve('@fontsource/roboto/files/roboto-latin-700-normal.woff'),
    italic: require.resolve('@fontsource/roboto/files/roboto-latin-400-italic.woff'),
    semiboldItalic: require.resolve('@fontsource/roboto/files/roboto-latin-600-italic.woff'),
    boldItalic: require.resolve('@fontsource/roboto/files/roboto-latin-700-italic.woff'),
  },
  Lato: {
    regular: require.resolve('@fontsource/lato/files/lato-latin-400-normal.woff'),
    semibold: require.resolve('@fontsource/lato/files/lato-latin-700-normal.woff'),
    bold: require.resolve('@fontsource/lato/files/lato-latin-700-normal.woff'),
    italic: require.resolve('@fontsource/lato/files/lato-latin-400-italic.woff'),
    semiboldItalic: require.resolve('@fontsource/lato/files/lato-latin-700-italic.woff'),
    boldItalic: require.resolve('@fontsource/lato/files/lato-latin-700-italic.woff'),
  },
  Montserrat: {
    regular: require.resolve('@fontsource/montserrat/files/montserrat-latin-400-normal.woff'),
    semibold: require.resolve('@fontsource/montserrat/files/montserrat-latin-600-normal.woff'),
    bold: require.resolve('@fontsource/montserrat/files/montserrat-latin-700-normal.woff'),
    italic: require.resolve('@fontsource/montserrat/files/montserrat-latin-400-italic.woff'),
    semiboldItalic: require.resolve('@fontsource/montserrat/files/montserrat-latin-600-italic.woff'),
    boldItalic: require.resolve('@fontsource/montserrat/files/montserrat-latin-700-italic.woff'),
  },
  'Open Sans': {
    regular: require.resolve('@fontsource/open-sans/files/open-sans-latin-400-normal.woff'),
    semibold: require.resolve('@fontsource/open-sans/files/open-sans-latin-600-normal.woff'),
    bold: require.resolve('@fontsource/open-sans/files/open-sans-latin-700-normal.woff'),
    italic: require.resolve('@fontsource/open-sans/files/open-sans-latin-400-italic.woff'),
    semiboldItalic: require.resolve('@fontsource/open-sans/files/open-sans-latin-600-italic.woff'),
    boldItalic: require.resolve('@fontsource/open-sans/files/open-sans-latin-700-italic.woff'),
  },
};
const BUILTIN_FONTS = {
  Arial: {
    regular: 'Helvetica',
    semibold: 'Helvetica-Bold',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
    semiboldItalic: 'Helvetica-BoldOblique',
    boldItalic: 'Helvetica-BoldOblique',
  },
  'Times New Roman': {
    regular: 'Times-Roman',
    semibold: 'Times-Bold',
    bold: 'Times-Bold',
    italic: 'Times-Italic',
    semiboldItalic: 'Times-BoldItalic',
    boldItalic: 'Times-BoldItalic',
  },
  'Courier New': {
    regular: 'Courier',
    semibold: 'Courier-Bold',
    bold: 'Courier-Bold',
    italic: 'Courier-Oblique',
    semiboldItalic: 'Courier-BoldOblique',
    boldItalic: 'Courier-BoldOblique',
  },
  ...FONT_FILES,
};

const getElementFont = (element, defaultBold = false, run = {}) => {
  const configuredWeight =
    element?.fontWeight === 'bold'
      ? 700
      : element?.fontWeight === 'normal'
        ? 400
        : Number(element?.fontWeight);
  const weight = run.bold
    ? 700
    : run.semibold
      ? 600
      : Number.isFinite(configuredWeight)
        ? configuredWeight
        : defaultBold
          ? 700
          : 400;
  const family = BUILTIN_FONTS[element?.fontFamily || 'Arial'];
  if (!family) throw new Error(`Unsupported PDF font family: ${element?.fontFamily}`);
  const italic = Boolean(element?.italic || run.italic);
  if (italic) {
    if (weight >= 700) return family.boldItalic;
    if (weight >= 600) return family.semiboldItalic || family.boldItalic;
    return family.italic;
  }
  if (weight >= 700) return family.bold;
  if (weight >= 600) return family.semibold || family.bold;
  return family.regular;
};

const getTextRenderOptions = (doc, element, text, y, width, fontSize, align) => {
  const font = Number(fontSize || 16);
  const desiredLineSpacing = Math.max(font, Number(element.lineSpacing) || font * 1.35);
  const lineGap = Math.max(0, desiredLineSpacing - doc.currentLineHeight(true));
  const options = { width, align, lineGap, characterSpacing: 0, continued: false };

  if (element.autoHeight === false) {
    options.height = Number(element.height || 30);
  } else if (!hasTextMarkup(text)) {
    const measuredHeight = doc.heightOfString(String(text), { width, lineGap, characterSpacing: 0 });
    const availableHeight = doc.page.height / PDF_POINTS_PER_PIXEL - y;
    const expandedHeight = Math.max(Number(element.height || 30), Math.ceil(measuredHeight + 1));
    if (expandedHeight < availableHeight) options.height = expandedHeight;
  }
  return options;
};

const renderTextContent = (doc, element, text, x, y, options, defaultBold = false) => {
  if (options.lineBreak === false) {
    const parsedRuns = parseTextMarkup(text);
    const runs = hasTextMarkup(text)
      ? parsedRuns.map((run) => ({ ...run, text: run.text.replace(/\s+/g, ' ') }))
      : [{ text: String(text).replace(/\s+/g, ' ') }];
    let currentX = x;
    runs.forEach((run) => {
      if (!run.text) return;
      doc.font(getElementFont(element, defaultBold, run));
      doc.text(run.text, currentX, y, {
        lineBreak: false,
        underline: Boolean(element.underline || run.underlined),
      });
      currentX += doc.widthOfString(run.text);
    });
    doc.font(getElementFont(element, defaultBold));
    return;
  }

  if (!hasTextMarkup(text)) {
    doc
      .font(getElementFont(element, defaultBold))
      .text(String(text), x, y, { ...options, underline: Boolean(element.underline) });
    return;
  }

  const lineHeight = doc.currentLineHeight(true) + (Number(options.lineGap) || 0);
  const layoutWidth = Math.max(1, Number(options.width) || 1);
  const maxY = options.height === undefined ? Infinity : y + Number(options.height);
  const pageHeight = doc.page.height / PDF_POINTS_PER_PIXEL;
  const pageBottom = doc.page.margins.bottom / PDF_POINTS_PER_PIXEL;
  const fontForRun = (run) => getElementFont(element, defaultBold, run);
  const lines = wrapStyledText(doc, fontForRun, text, layoutWidth);
  let currentY = y;

  lines.forEach((line, lineIndex) => {
    if (options.height !== undefined && lineIndex > 0 && currentY + lineHeight > maxY) return;
    if (currentY + lineHeight > pageHeight - pageBottom) {
      if (options.height !== undefined) return;
      doc.addPage();
      currentY = doc.page.margins.top / PDF_POINTS_PER_PIXEL;
    }

    const naturalWidth = line.runs.reduce((total, run) => {
      doc.font(fontForRun(run));
      return total + doc.widthOfString(run.text);
    }, 0);
    const spaces = line.runs.reduce((count, run) => count + (run.text.match(/ /g) || []).length, 0);
    const justify = options.align === 'justify' && !line.lastInParagraph && spaces > 0;
    const extraSpace = justify ? Math.max(0, (layoutWidth - naturalWidth) / spaces) : 0;
    let currentX = x;
    if (options.align === 'center') currentX += (layoutWidth - naturalWidth) / 2;
    if (options.align === 'right') currentX += layoutWidth - naturalWidth;

    line.runs.forEach((run) => {
      doc.font(fontForRun(run));
      (run.text.match(/ +|[^ ]+/g) || []).forEach((segment) => {
        const segmentWidth = doc.widthOfString(segment);
        doc.text(segment, currentX, currentY, {
          lineBreak: false,
          textWidth: segmentWidth,
          wordCount: 1,
          underline: Boolean(element.underline || run.underlined),
        });
        currentX += segmentWidth;
        if (justify && segment === ' ') currentX += extraSpace;
      });
    });
    currentY += lineHeight;
  });

  doc.y = currentY;
  doc.font(getElementFont(element, defaultBold));
};

const renderElementText = (doc, element, text, x, y, width, fontSize, align, defaultBold = false, renderOptions = {}) => {
  doc.font(getElementFont(element, defaultBold));
  renderTextContent(
    doc,
    element,
    text,
    x,
    y,
    { ...getTextRenderOptions(doc, element, text, y, width, fontSize, align), ...renderOptions },
    defaultBold
  );
};

const drawElementContent = async (doc, element, payload = {}, resources = [], resourceOptions = {}) => {
  const x = Number(element.x || 0);
  const y = Number(element.y || 0);
  const width = Number(element.width || 100);
  const height = Number(element.height || 30);

  if (element.type === 'rect') {
    doc.save().rect(x, y, width, height).fill(element.fill || '#eaf2ff')
      .strokeColor(element.stroke || '#9ec5fe').lineWidth(element.strokeWidth || 1).stroke().restore();
    return;
  }
  if (element.type === 'line' || element.type === 'separator') {
    doc.moveTo(x, y).lineTo(x + width, y + Number(element.height || 0))
      .strokeColor(element.stroke || '#d1d5db').lineWidth(element.strokeWidth || 1).stroke();
    return;
  }
  if (element.type === 'checkbox') {
    const supplied = element.placeholderKey ? payload[element.placeholderKey] : undefined;
    const value = supplied === undefined ? element.checked : supplied;
    const checked = typeof value === 'boolean'
      ? value
      : ['true', '1', 'yes'].includes(String(value).toLowerCase());
    doc.rect(x, y, width || 18, height || 18).strokeColor(element.stroke || '#1f9d55')
      .lineWidth(element.strokeWidth || 1).stroke();
    if (checked) {
      doc.moveTo(x + 4, y + (height || 18) / 2)
        .lineTo(x + (width || 18) / 2, y + (height || 18) - 4)
        .lineTo(x + (width || 18) - 4, y + 4)
        .strokeColor('#18a957').lineWidth(2).stroke();
    }
    const label = resolveTemplateString(element.text || 'Aceptado', payload);
    if (label) {
      doc.fontSize(element.fontSize || 12).fillColor(element.color || '#111111');
      renderElementText(
        doc, element, label, x + (width || 18) + 8, y + 2,
        Math.max(1, doc.page.width / PDF_POINTS_PER_PIXEL - x - (width || 18) - 8),
        element.fontSize || 12, element.align || 'left', false, { lineBreak: false }
      );
    }
    return;
  }
  if (element.type === 'signature') {
    const label = resolveTemplateString(element.text || 'Firma autorizada', payload);
    doc.moveTo(x, y).lineTo(x + width, y).strokeColor(element.stroke || '#111827')
      .lineWidth(element.strokeWidth || 1).stroke();
    doc.fontSize(element.fontSize || 12).fillColor(element.color || '#111111');
    renderElementText(doc, element, label, x, y + 12, width, element.fontSize || 12, element.align || 'left');
    return;
  }
  if (element.type === 'footer') {
    const footerText = getElementText(element, payload) || 'Documento generado por Docugen';
    doc.fontSize(element.fontSize || 11).fillColor(element.color || '#4b5563');
    renderElementText(doc, element, footerText, x, y, width, element.fontSize || 11, element.align || 'center');
    return;
  }
  if (element.type === 'image') {
    const resourceId = element.resourceId ||
      (String(element.src || '').startsWith('resource:') ? String(element.src).slice(9) : '');
    let imageSource;
    if (element.imageMode === 'static' || resourceId) {
      const resource = resources.find((item) => item.id === resourceId);
      if (resourceId && !resource) throw new Error(`Image resource "${resourceId}" was not found in the template.`);
      imageSource = resource?.dataUrl || (element.imageMode === 'static' ? element.src : '');
    } else {
      imageSource = getElementImageSrc(element, payload);
    }
    if (!imageSource) return;
    const imageBuffer = await readExternalResource(imageSource, resourceOptions);
    if (imageBuffer) doc.image(imageBuffer, x, y, { fit: [width, height], align: 'center', valign: 'center' });
    return;
  }
  if (element.type === 'qr') {
    const qrTarget = getElementQrValue(element, payload);
    if (!qrTarget) return;
    const qrBuffer = await QRCode.toBuffer(qrTarget, {
      type: 'png',
      margin: 1,
      width: Math.max(80, Number(width || 120)),
      color: { dark: '#111827', light: '#ffffff' },
    });
    doc.image(qrBuffer, x, y, { fit: [width, height] });
    return;
  }
  if (element.type === 'table') {
    const rows = getTableRows(element, payload);
    if (!rows.length) return;
    const lineHeight = height / rows.length;
    const colCount = Math.max(1, ...rows.map((row) => row.length));
    const cellWidth = width / colCount;
    doc.font(getElementFont(element));
    rows.forEach((row, rowIndex) => {
      for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
        const cellX = x + colIndex * cellWidth;
        const cellY = y + rowIndex * lineHeight;
        doc.rect(cellX, cellY, cellWidth, lineHeight).strokeColor(element.stroke || '#cbd5e1')
          .lineWidth(element.strokeWidth || 1).stroke();
        doc.fontSize(element.fontSize || 10).fillColor(element.color || '#111111');
        renderTextContent(doc, element, String(row[colIndex] || '').trim(), cellX + 4, cellY + 4, {
          width: cellWidth - 8,
          height: Math.max(0, lineHeight - 8),
          align: element.align || 'left',
          characterSpacing: 0,
        });
      }
    });
    return;
  }

  const textValue = getElementText(element, payload);
  if (element.type === 'list') {
    const items = String(textValue || '').split('\n').map((item) => item.trim()).filter(Boolean)
      .map((item) => item.replace(/^[•●▪-]\s*/, ''));
    if (!items.length) return;
    if (hasTextMarkup(element.text || '')) {
      const bulletedText = String(textValue).split('\n')
        .map((item) => `• ${item.trim().replace(/^[•●▪-]\s*/, '')}`).join('\n');
      doc.fontSize(element.fontSize || 14).fillColor(element.color || '#111111');
      renderElementText(doc, element, bulletedText, x, y, width, element.fontSize || 14, element.align || 'left');
    } else {
      const options = getTextRenderOptions(doc, element, items.join('\n'), y, width, element.fontSize || 14, element.align || 'left');
      doc.fontSize(element.fontSize || 14).fillColor(element.color || '#111111')
        .list(items, x, y, { ...options, indent: 12, bulletIndent: 12 });
    }
    return;
  }
  if (element.type === 'date') {
    const dateValue = textValue || new Date().toLocaleDateString('es-ES');
    doc.fontSize(element.fontSize || 12).fillColor(element.color || '#111111');
    renderElementText(doc, element, dateValue, x, y, width, element.fontSize || 12, element.align || 'left', true);
    return;
  }
  if (element.type === 'pageNumber') {
    const label = resolveTemplateString(element.text || 'Página {{page_number}}', payload);
    doc.fontSize(element.fontSize || 10).fillColor(element.color || '#374151');
    renderElementText(doc, element, label, x, y, width, element.fontSize || 10, element.align || 'right');
    return;
  }

  const defaultBold = element.type === 'title' || element.type === 'subtitle';
  const fontSize = element.fontSize || (element.type === 'title' ? 24 : element.type === 'subtitle' ? 20 : element.type === 'paragraph' || element.type === 'list' ? 14 : 16);
  doc.fontSize(fontSize).fillColor(element.color || '#111111');
  renderElementText(doc, element, textValue, x, y, width, fontSize, element.align || 'left', defaultBold);
};

const drawElement = async (doc, element, payload, resources, resourceOptions) => {
  const x = Number(element.x || 0);
  const y = Number(element.y || 0);
  const width = Number(element.width || 100);
  const height = Number(element.height || 30);
  doc.save();
  try {
    if (element.rotation) doc.rotate(Number(element.rotation), { origin: [x + width / 2, y + height / 2] });
    if (element.opacity !== undefined) doc.opacity(Math.max(0, Math.min(1, Number(element.opacity))));
    await drawElementContent(doc, element, payload, resources, resourceOptions);
  } finally {
    doc.restore();
  }
};

export const generatePdfBuffer = async ({ template, data = {}, timeout } = {}) => {
  if (!template || typeof template !== 'object' || Array.isArray(template)) {
    throw new Error('Template is required and must be an object');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Data must be an object');
  }

  const pageWidth = Number(template.dimensions?.width || DEFAULT_PAGE_DIMENSIONS.width);
  const pageHeight = Number(template.dimensions?.height || DEFAULT_PAGE_DIMENSIONS.height);
  const pageConfig = { ...DEFAULT_PAGE_CONFIG, ...(template.page || {}) };
  const margin = { ...DEFAULT_PAGE_CONFIG.margin, ...(pageConfig.margin || {}) };
  const document = new PDFDocument({
    size: [pageWidth * PDF_POINTS_PER_PIXEL, pageHeight * PDF_POINTS_PER_PIXEL],
    margins: {
      top: Number(margin.top || 0) * PDF_POINTS_PER_PIXEL,
      left: Number(margin.left || 0) * PDF_POINTS_PER_PIXEL,
      bottom: Number(margin.bottom || 0) * PDF_POINTS_PER_PIXEL,
      right: Number(margin.right || 0) * PDF_POINTS_PER_PIXEL,
    },
    bufferPages: true,
  });
  document.scale(PDF_POINTS_PER_PIXEL);

  const drawPageBackground = () => {
    document.save();
    document.fillColor(pageConfig.backgroundColor || '#ffffff').rect(0, 0, pageWidth, pageHeight).fill();
    document.restore();
  };

  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      document.destroy();
      reject(error);
    };
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    document.on('error', fail);
    document.on('pageAdded', () => {
      document.scale(PDF_POINTS_PER_PIXEL);
      drawPageBackground();
    });

    const render = async () => {
      try {
        const resources = Array.isArray(template.metadata?.resources) ? template.metadata.resources : [];
        const resourceOptions = timeout ? { timeout } : {};
        for (const element of template.elements || []) {
          if (element.type !== 'pageNumber') {
            await drawElement(document, element, data, resources, resourceOptions);
          }
        }
        const pageRange = document.bufferedPageRange();
        const pageNumberElements = (template.elements || []).filter((element) => element.type === 'pageNumber');
        for (let pageIndex = pageRange.start; pageIndex < pageRange.start + pageRange.count; pageIndex += 1) {
          document.switchToPage(pageIndex);
          for (const element of pageNumberElements) {
            await drawElement(
              document,
              element,
              { ...data, page_number: pageIndex - pageRange.start + 1 },
              resources,
              resourceOptions
            );
          }
        }
        document.end();
      } catch (error) {
        fail(error);
      }
    };
    drawPageBackground();
    render();
  });
};

export const generatePdf = async ({ template, data = {}, timeout } = {}) => {
  const buffer = await generatePdfBuffer({ template, data, timeout });
  return {
    buffer,
    metadata: {
      templateName: template?.name || 'Untitled',
      generatedAt: new Date().toISOString(),
      dataKeys: Object.keys(data),
      elementCount: (template?.elements || []).length,
    },
  };
};

/**
 * Ejemplo con imágenes y QR
 * Muestra cómo usar elementos con recursos externos
 *
 * Ejecutar: node examples/with-images.js
 */

import fs from 'node:fs/promises';
import { DocugenEngine } from '../src/index.js';

async function main() {
  console.log('🖼️  DOCUGEN-LIB - Ejemplo con Imágenes y QR\n');

  const docugen = new DocugenEngine();

  // Plantilla con elementos de imagen y QR
  const certificateTemplate = {
    name: 'Certificate Template',
    description: 'Certificate with logo, QR code, and dynamic text',
    dimensions: {
      width: 1058,  // A4 landscape
      height: 794,
      unit: 'px',
    },
    page: {
      backgroundColor: '#f5f5f5',
      margin: { top: 30, right: 30, bottom: 30, left: 30 },
    },
    elements: [
      {
        id: 'header_rect',
        type: 'rect',
        x: 30,
        y: 30,
        width: 998,
        height: 100,
        fill: '#1e3a8a',
        stroke: '#1e3a8a',
      },
      {
        id: 'header_text',
        type: 'title',
        x: 30,
        y: 50,
        width: 998,
        height: 60,
        text: 'Certificate of Completion',
        fontSize: 36,
        color: '#ffffff',
        align: 'center',
      },
      {
        id: 'certificate_line',
        type: 'line',
        x: 100,
        y: 170,
        width: 858,
        height: 0,
        stroke: '#cccccc',
        strokeWidth: 2,
      },
      {
        id: 'this_certifies',
        type: 'paragraph',
        x: 50,
        y: 200,
        width: 958,
        height: 30,
        text: 'This certifies that',
        fontSize: 14,
        color: '#333333',
        align: 'center',
      },
      {
        id: 'recipient_name',
        type: 'title',
        x: 50,
        y: 250,
        width: 958,
        height: 50,
        text: '{{recipient_name}}',
        fontSize: 28,
        color: '#1e3a8a',
        align: 'center',
      },
      {
        id: 'achievement_text',
        type: 'paragraph',
        x: 50,
        y: 320,
        width: 958,
        height: 60,
        text: 'has successfully completed the course\n{{course_name}}\non {{completion_date}}',
        fontSize: 13,
        color: '#333333',
        align: 'center',
      },
      {
        id: 'qr_code',
        type: 'qr',
        x: 100,
        y: 450,
        width: 120,
        height: 120,
        qrValue: 'https://docugen.io/verify/{{certificate_id}}',
      },
      {
        id: 'qr_label',
        type: 'text',
        x: 100,
        y: 580,
        width: 120,
        height: 20,
        text: 'Scan to verify',
        fontSize: 10,
        color: '#666666',
        align: 'center',
      },
      {
        id: 'signature_line',
        type: 'signature',
        x: 500,
        y: 500,
        width: 200,
        height: 40,
        text: 'Director Signature',
        fontSize: 11,
        color: '#333333',
      },
      {
        id: 'date_issued',
        type: 'text',
        x: 500,
        y: 600,
        width: 200,
        height: 20,
        text: 'Issued: {{issue_date}}',
        fontSize: 11,
        color: '#333333',
      },
      {
        id: 'footer_text',
        type: 'footer',
        x: 50,
        y: 720,
        width: 958,
        height: 20,
        text: 'Certificate ID: {{certificate_id}} | Valid Until: {{expiry_date}}',
        fontSize: 9,
        color: '#999999',
        align: 'center',
      },
    ],
    metadata: {
      version: 1,
      dynamicParameters: [
        { key: 'recipient_name', label: 'Recipient Name', required: true, type: 'text' },
        { key: 'course_name', label: 'Course Name', required: true, type: 'text' },
        { key: 'completion_date', label: 'Completion Date', required: true, type: 'text' },
        { key: 'certificate_id', label: 'Certificate ID', required: true, type: 'text' },
        { key: 'issue_date', label: 'Issue Date', required: true, type: 'text' },
        { key: 'expiry_date', label: 'Expiry Date', required: true, type: 'text' },
      ],
    },
  };

  try {
    console.log('📝 Registering certificate template...');
    docugen.registerTemplate(certificateTemplate, 'certificate_v1');
    console.log('✅ Template registered\n');

    // Datos del certificado
    const certificateData = {
      recipient_name: 'María García López',
      course_name: 'Advanced JavaScript Development',
      completion_date: '2026-08-18',
      certificate_id: 'CERT-2026-4521',
      issue_date: '2026-08-18',
      expiry_date: '2027-08-18',
    };

    console.log('🔍 Validating certificate data...');
    const validation = docugen.validateData('certificate_v1', certificateData);
    if (!validation.valid) {
      console.error('❌ Validation failed:', validation.errors);
      return;
    }
    console.log('✅ Data is valid\n');

    console.log('⚙️  Generating certificate PDF...');
    const pdfBuffer = await docugen.generatePDF({
      template: 'certificate_v1',
      data: certificateData,
    });
    console.log(`✅ Certificate generated! Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);

    const outputPath = './certificate_example.pdf';
    await fs.writeFile(outputPath, pdfBuffer);
    console.log(`📄 Certificate saved to: ${outputPath}\n`);

    console.log('✨ Example completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

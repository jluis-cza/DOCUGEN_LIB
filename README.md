# DOCUGEN-LIB 📄

Librería JavaScript para generación de documentos PDF con plantillas dinámicas. Motor de generación documental independiente, reutilizable y agnóstico de frameworks.

**Versión**: 1.0.0-alpha.1  
**Licencia**: MIT  
**Autor**: jluis-cza

---

## 📋 Tabla de Contenidos

- [Características](#características)
- [Instalación](#instalación)
- [Inicio Rápido](#inicio-rápido)
- [Conceptos Principales](#conceptos-principales)
- [API Referencia](#api-referencia)
- [Ejemplos](#ejemplos)
- [Tipos de Elementos](#tipos-de-elementos)
- [Resolución de Placeholders](#resolución-de-placeholders)
- [Validación de Datos](#validación-de-datos)
- [FAQ](#faq)

---

## ✨ Características

✅ **17 tipos de elementos** - Texto, imágenes, QR, tablas, firmas, y más  
✅ **Placeholders dinámicos** - Reemplaza `{{variable}}` con datos en tiempo real  
✅ **Validación tipada** - Revisa parámetros requeridos, formatos y valores permitidos
✅ **Recursos de imagen** - Usa recursos estáticos del template, Data URIs, URLs y rutas locales
✅ **Diseño actualizado** - Fuentes, estilos inline, rotación, opacidad y altura automática
✅ **Paginación** - Distribuye texto largo y genera números de página automáticamente
✅ **Parámetros extraíbles** - Descubre automáticamente qué datos necesita tu plantilla  
✅ **Sin dependencias de BD** - Funciona en cualquier entorno Node.js  
✅ **Agnóstico de framework** - Úsalo con Express, Fastify, Lambda, etc.  
✅ **Generación en memoria** - Retorna Buffer, tú decides qué hacer con él  
✅ **Error handling** - Mensajes claros y validación exhaustiva  
✅ **TypeScript-ready** - API clara y predecible

---

## 📦 Instalación

```bash
npm install docugen-lib
```

O con yarn:

```bash
yarn add docugen-lib
```

---

## 🚀 Inicio Rápido

### 1. Crear una Plantilla JSON

Una plantilla es un archivo JSON que define la estructura y elementos del documento:

```json
{
  "name": "Invoice",
  "dimensions": { "width": 794, "height": 1123 },
  "page": {
    "backgroundColor": "#ffffff",
    "margin": { "top": 40, "right": 40, "bottom": 40, "left": 40 }
  },
  "elements": [
    {
      "id": "title",
      "type": "title",
      "x": 40,
      "y": 40,
      "width": 700,
      "height": 40,
      "text": "Invoice #{{invoice_number}}",
      "fontSize": 24,
      "color": "#000000"
    },
    {
      "id": "client",
      "type": "paragraph",
      "x": 40,
      "y": 100,
      "width": 400,
      "height": 30,
      "text": "Client: {{client_name}}",
      "fontSize": 14,
      "color": "#333333"
    }
  ]
}
```

### 2. Generar un PDF

```javascript
import fs from 'node:fs/promises';
import { DocugenEngine } from 'docugen-lib';

const docugen = new DocugenEngine();

// Cargar plantilla
const template = JSON.parse(
  await fs.readFile('./template.json', 'utf-8')
);

// Registrar plantilla
docugen.registerTemplate(template, 'invoice');

// Generar PDF
const pdfBuffer = await docugen.generatePDF({
  template: 'invoice',
  data: {
    invoice_number: 'INV-001',
    client_name: 'Acme Corp'
  }
});

// Guardar a disco
await fs.writeFile('./invoice.pdf', pdfBuffer);
```

---

## 🎯 Conceptos Principales

### Plantillas

Una plantilla define la estructura visual de un documento. Incluye:

- **Dimensiones**: Ancho y alto en píxeles CSS (`unit: "px"`); se convierten a puntos PDF con escala 72/96
- **Configuración de página**: Color de fondo, márgenes
- **Elementos**: Componentes visuales (texto, imágenes, etc.)
- **Metadatos**: Parámetros dinámicos y recursos de imagen estáticos

Las coordenadas y los márgenes también se expresan en píxeles CSS. El motor admite páginas de tamaño personalizado y crea páginas adicionales cuando el texto fluye fuera de la página.

### Parámetros Dinámicos

Los placeholders `{{variable}}` son reemplazados con valores reales:

```javascript
// En la plantilla
"text": "Hello {{name}}, your total is ${{amount}}"

// En los datos
const data = {
  name: 'Juan',
  amount: '1500.00'
};

// Resultado final
"Hello Juan, your total is $1500.00"
```

### Elementos

Componentes visuales que componen el documento:

| Tipo | Descripción | Ejemplo |
|------|---|---|
| `text` | Texto simple | Descripción, dirección |
| `title` | Título grande | Encabezado de documento |
| `subtitle` | Subtítulo | Secciones |
| `paragraph` | Párrafo | Contenido |
| `list` | Lista con viñetas | Enumeraciones |
| `image` | Imagen embebida | Logos, fotos |
| `qr` | Código QR | Verificación, enlaces |
| `table` | Tabla de datos | Facturas, listados |
| `rect` | Rectángulo | Decoración |
| `line` | Línea | Separadores |
| `checkbox` | Casilla de verificación | Confirmaciones |
| `signature` | Firma | Autorización |
| `footer` | Pie de página | Información final |
| `date` | Fecha actual | Timestamps |
| `pageNumber` | Número de página | Paginación |

#### Propiedades visuales y texto enriquecido

Los elementos admiten `fontFamily` (`Arial`, `Times New Roman`, `Courier New`, `Roboto`, `Lato`, `Montserrat` u `Open Sans`), `fontWeight` (400, 600 o 700), `italic`, `underline`, `lineSpacing`, `align`, `rotation` y `opacity`. Títulos y subtítulos son negrita por defecto. El texto puede incluir estilos inline anidados:

```json
{
  "type": "paragraph",
  "x": 40,
  "y": 120,
  "width": 650,
  "height": 40,
  "autoHeight": true,
  "fontFamily": "Roboto",
  "fontWeight": 400,
  "text": "Hola <bold>{{client_name}}</bold>, <italic>gracias</italic>."
}
```

Las etiquetas admitidas son `<bold>`, `<semibold>`, `<italic>` y `<underlined>`; los valores dentro de ellas también resuelven placeholders. `autoHeight: false` respeta el alto definido y recorta texto que no cabe. Las líneas con `align: "justify"` se justifican salvo la última línea del párrafo.

#### Imágenes estáticas dentro de una plantilla

Los recursos estáticos se guardan en `metadata.resources` y se vinculan desde los elementos `image`. Cada recurso admite PNG/JPEG válido, hasta 2 MB individualmente y 6 MB en total por plantilla:

```json
{
  "metadata": {
    "resources": [{
      "id": "company-logo",
      "name": "logo.png",
      "mimeType": "image/png",
      "size": 68,
      "dataUrl": "data:image/png;base64,..."
    }]
  },
  "elements": [{
    "id": "logo",
    "type": "image",
    "imageMode": "static",
    "resourceId": "company-logo",
    "src": "resource:company-logo",
    "x": 40,
    "y": 20,
    "width": 120,
    "height": 60
  }]
}
```

`size` debe coincidir con el tamaño real decodificado del Data URI y `mimeType` con su formato.

---

## 📚 API Referencia

### DocugenEngine

#### Constructor

```javascript
const docugen = new DocugenEngine(options);
```

**Opciones**:
- `timeout` (number): Timeout para operaciones (default: 30000ms)

#### registerTemplate(templateData, templateId?)

Registra una plantilla en el motor.

```javascript
const result = docugen.registerTemplate(templateJson, 'invoice_v1');
// { id, name, elementCount, registeredAt }
```

#### getTemplate(templateId)

Obtiene una plantilla registrada.

```javascript
const template = docugen.getTemplate('invoice_v1');
```

#### getTemplates()

Lista todas las plantillas registradas.

```javascript
const templates = docugen.getTemplates();
// [{ id, name, description, elementCount, registeredAt }, ...]
```

#### getTemplateParameters(templateId)

Obtiene los parámetros dinámicos de una plantilla.

```javascript
const params = docugen.getTemplateParameters('invoice_v1');
// [
//   { key: 'client_name', label: 'Client Name', required: true, type: 'text', ... },
//   { key: 'total', label: 'Total Amount', required: true, type: 'text', ... }
// ]
```

#### validateData(templateId, data)

Valida que los datos sean válidos para una plantilla.

```javascript
const validation = docugen.validateData('invoice_v1', {
  client_name: 'ACME',
  total: '1500'
});

// { valid: true/false, errors: [...], missing: [...] }
```

#### generatePDF(options)

Genera un PDF y retorna un Buffer.

```javascript
const pdfBuffer = await docugen.generatePDF({
  template: 'invoice_v1',      // ID o plantilla directa
  data: { ... },                // Datos dinámicos
  validate: true                // Validar antes de generar (default: true)
});

// pdfBuffer es un Buffer que puedes guardar, enviar, etc.
```

La plantilla puede pasarse como ID previamente registrado o como objeto directamente. La validación de datos está activada por defecto. `new DocugenEngine({ timeout })` configura el tiempo límite (ms) para cargar recursos remotos durante el renderizado.

#### generatePDFWithMetadata(options)

Genera un PDF y retorna metadatos adicionales.

```javascript
const result = await docugen.generatePDFWithMetadata({
  template: 'invoice_v1',
  data: { ... }
});

// {
//   buffer: Buffer,
//   metadata: {
//     templateName: 'Invoice',
//     generatedAt: '2026-08-18T...',
//     dataKeys: ['client_name', 'total'],
//     elementCount: 15
//   }
// }
```

---

## 💡 Ejemplos

### Ejemplo 1: Factura Dinámica

```javascript
import { DocugenEngine } from 'docugen-lib';
import fs from 'node:fs/promises';

const docugen = new DocugenEngine();
const template = JSON.parse(
  await fs.readFile('./invoice_template.json', 'utf-8')
);

docugen.registerTemplate(template, 'invoice');

const pdfBuffer = await docugen.generatePDF({
  template: 'invoice',
  data: {
    invoice_number: 'INV-2026-0001',
    client_name: 'Acme Corporation',
    items_total: '1500.00',
    issue_date: '2026-08-18'
  }
});

await fs.writeFile('./invoice_0001.pdf', pdfBuffer);
```

### Ejemplo 2: API REST

```javascript
import express from 'express';
import { DocugenEngine } from 'docugen-lib';

const app = express();
const docugen = new DocugenEngine();

// Cargar y registrar plantillas al inicio
const invoiceTemplate = await loadTemplate('invoice.json');
docugen.registerTemplate(invoiceTemplate, 'invoice');

app.post('/generate-invoice', async (req, res) => {
  try {
    // Validar datos
    const validation = docugen.validateData('invoice', req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid data', details: validation.errors });
    }

    // Generar PDF
    const pdfBuffer = await docugen.generatePDF({
      template: 'invoice',
      data: req.body
    });

    // Enviar como respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="invoice.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

### Ejemplo 3: Generación en Lote

```javascript
import { DocugenEngine } from 'docugen-lib';
import fs from 'node:fs/promises';

const docugen = new DocugenEngine();
const template = JSON.parse(await fs.readFile('./certificate.json', 'utf-8'));

docugen.registerTemplate(template, 'certificate');

// Datos de 100 usuarios
const users = await loadUsersFromDatabase();

for (const user of users) {
  const pdfBuffer = await docugen.generatePDF({
    template: 'certificate',
    data: {
      name: user.name,
      course: user.course,
      completion_date: user.completedAt,
      certificate_id: user.certificateId
    }
  });

  await fs.writeFile(`./certificates/${user.id}.pdf`, pdfBuffer);
}

console.log(`Generated ${users.length} certificates`);
```

---

## 🎨 Tipos de Elementos

### Elemento Text

```json
{
  "type": "text",
  "x": 40,
  "y": 100,
  "width": 400,
  "height": 30,
  "text": "Simple text or {{placeholder}}",
  "fontSize": 12,
  "color": "#333333",
  "align": "left"
}
```

### Elemento Title

```json
{
  "type": "title",
  "x": 40,
  "y": 40,
  "width": 700,
  "height": 40,
  "text": "Invoice #{{invoice_id}}",
  "fontSize": 24,
  "color": "#000000",
  "align": "center"
}
```

### Elemento Image

```json
{
  "type": "image",
  "x": 40,
  "y": 100,
  "width": 100,
  "height": 100,
  "src": "https://example.com/logo.png"
}
```

O Data URI:

```json
{
  "type": "image",
  "x": 40,
  "y": 100,
  "width": 100,
  "height": 100,
  "src": "data:image/png;base64,iVBORw0KGgoAAAANS..."
}
```

### Elemento QR

```json
{
  "type": "qr",
  "x": 600,
  "y": 400,
  "width": 120,
  "height": 120,
  "qrValue": "https://verify.example.com/{{certificate_id}}"
}
```

### Elemento Table

```json
{
  "type": "table",
  "x": 40,
  "y": 200,
  "width": 714,
  "height": 200,
  "text": "Product | Qty | Price\nApple | 5 | $2.50\nBanana | 3 | $1.50",
  "fontSize": 11,
  "color": "#333333"
}
```

---

## 🔄 Resolución de Placeholders

Los placeholders se resuelven automáticamente en orden:

1. **Texto, QR e imagen**: los placeholders `{{key}}` en `text`, `qrValue` o `src` se sustituyen desde `data`.
2. **`placeholderKey` en texto**: determina el parámetro que se valida; cuando `text` contiene únicamente `{{placeholderKey}}`, su valor directo también se resuelve. Si el texto tiene otras palabras o claves, se sustituyen sus propios placeholders.
3. **`placeholderKey` en checkbox**: usa el valor dinámico para marcar/desmarcar. `true`, `"true"`, `"1"` y `"yes"` se consideran marcados.

```javascript
{
  "type": "text",
  "placeholderKey": "client_name",
  "text": "Client: {{client_name}}"
}

// data: { client_name: "ACME" } -> "Client: ACME"
```

Las claves de datos son planas; la notación `{{customer.name}}` busca la clave literal `"customer.name"`, no recorre objetos anidados. Los placeholders sin valor se sustituyen por una cadena vacía.

Los elementos `pageNumber` son valores generados: se omiten al extraer parámetros y el motor inyecta `page_number` (comenzando en 1) al renderizar cada página. No es necesario incluir esa clave en `data`.

---

## ✅ Validación de Datos

### Validación Automática

Antes de generar un PDF, valida automáticamente:

```javascript
const validation = docugen.validateData('invoice', {});
// {
//   valid: false,
//   errors: [
//     "Missing required parameter: invoice_number",
//     "Missing required parameter: client_name"
//   ],
//   missing: ["invoice_number", "client_name"]
// }
```

Se infieren tipos a partir de la metadata y del elemento que usa el valor: `text`, `textarea` (máximo 4000 caracteres), `number`, `date`, `boolean`, `email`, `url`, `image` y `qr`. Los parámetros opcionales vacíos se omiten en la validación; los obligatorios vacíos se reportan en `missing`. `allowedValues` limita el valor recibido.

### Desactivar Validación

Si necesitas saltarte la validación:

```javascript
await docugen.generatePDF({
  template: 'invoice',
  data: { ... },
  validate: false  // ⚠️ Úsalo solo si sabes qué haces
});
```

---

## ❓ FAQ

**P: ¿Puedo usar variables anidadas?**  
R: No directamente. Usa datos planos: `{ "user_first_name": "Juan" }` en lugar de `{ "user": { "firstName": "Juan" } }`

**P: ¿Qué formatos de imagen soporta?**  
R: PNG y JPEG/JPG. Data URIs y recursos estáticos se validan contra el formato y contenido; las imágenes remotas se descargan con un límite de tamaño.

**P: ¿Hay límite de tamaño de imagen?**  
R: Sí, 2 MB por imagen y 6 MB combinados para recursos estáticos de una plantilla.

**P: ¿Cómo se numeran las páginas?**

R: Añade un elemento `pageNumber` con `text: "Página {{page_number}}"`. La librería lo renderiza automáticamente en cada página, una vez calculada la paginación.

**P: ¿Funciona en el navegador?**  
R: No en este momento. La librería está optimizada para Node.js

**P: ¿Cómo manejo errores?**  
R: Usa try/catch. Los errores tienen mensajes descriptivos.

```javascript
try {
  await docugen.generatePDF({ template, data });
} catch (error) {
  console.error('PDF generation failed:', error.message);
}
```

**P: ¿Puedo usar fuentes personalizadas?**  
R: Además de las fuentes PDF integradas Arial, Times New Roman y Courier New, se incluyen Roboto, Lato, Montserrat y Open Sans.

---

## 📝 Licencia

MIT

## 👤 Autor

**jluis-cza**  
GitHub: https://github.com/jluis-cza  
Email: luis@example.com

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 🐛 Reportar Bugs

Usa [GitHub Issues](https://github.com/jluis-cza/DOCUGEN_LIB/issues)

---

**¡Gracias por usar DOCUGEN-LIB!** 🎉

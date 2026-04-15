/**
 * parser.js — Browser-based document parsing for project signals.
 * Supports PDF, XLSX, DOCX, and CSV.
 */

// Initialize PDF.js worker
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/**
 * parseFile — Main entry point for file parsing
 * @param {File} file 
 * @returns {Promise<string>} - Extracted text content
 */
export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  
  try {
    if (ext === 'pdf') {
      return await parsePDF(file);
    } else if (['xlsx', 'xls'].includes(ext)) {
      return await parseExcel(file);
    } else if (ext === 'docx') {
      return await parseWord(file);
    } else if (ext === 'csv') {
      return await parseCSV(file);
    } else if (['txt', 'md'].includes(ext)) {
      return await file.text();
    } else {
      throw new Error(`Unsupported file format: .${ext}`);
    }
  } catch (err) {
    console.error(`Error parsing ${file.name}:`, err);
    throw new Error(`Could not parse ${file.name}. Is it encrypted or corrupted?`);
  }
}

async function parsePDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += strings.join(' ') + '\n';
  }
  
  return fullText;
}

async function parseExcel(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
  let fullText = '';
  
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const csv = window.XLSX.utils.sheet_to_csv(worksheet);
    fullText += `--- Sheet: ${sheetName} ---\n${csv}\n\n`;
  });
  
  return fullText;
}

async function parseWord(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function parseCSV(file) {
  return await file.text();
}

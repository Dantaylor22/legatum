// Secure file upload helper
// Validates type, size, and sanitises filenames before upload

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

export function validateFile(file) {
  const errors = []

  if (!ALLOWED_TYPES.has(file.type)) {
    errors.push(`File type not allowed. Permitted: PDF, images, Word, text.`)
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    errors.push(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`)
  }

  if (file.size === 0) {
    errors.push('File is empty.')
  }

  return errors
}

// Sanitise filename: strip path traversal, special chars, limit length
export function sanitiseFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // Only allow safe chars
    .replace(/\.{2,}/g, '.')             // No double dots (path traversal)
    .replace(/^\./, '_')                 // No leading dots
    .substring(0, 100)                   // Max 100 chars
}

// Verify file magic bytes match declared type (prevent polyglot files)
export async function verifyFileMagic(file) {
  const header = await file.slice(0, 8).arrayBuffer()
  const bytes  = new Uint8Array(header)

  const signatures = {
    'application/pdf':  [0x25, 0x50, 0x44, 0x46],        // %PDF
    'image/jpeg':       [0xFF, 0xD8, 0xFF],                // JPEG
    'image/png':        [0x89, 0x50, 0x4E, 0x47],          // PNG
    'image/webp':       [0x52, 0x49, 0x46, 0x46],          // RIFF (WebP)
  }

  const expected = signatures[file.type]
  if (!expected) return true  // No magic check for types without a signature

  return expected.every((byte, i) => bytes[i] === byte)
}

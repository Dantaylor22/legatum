// Shared input validation utilities

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export function validateEmail(email) {
  if (!email || typeof email !== 'string') return 'Email is required'
  if (email.length > 254) return 'Email address is too long'
  if (!EMAIL_RE.test(email)) return 'Please enter a valid email address'
  return null
}

export function validateName(name, field = 'Name') {
  if (!name || typeof name !== 'string') return `${field} is required`
  const trimmed = name.trim()
  if (trimmed.length < 1) return `${field} is required`
  if (trimmed.length > 200) return `${field} is too long (max 200 characters)`
  // Reject obvious injection attempts
  if (/<script|javascript:|data:/i.test(trimmed)) return `${field} contains invalid characters`
  return null
}

export function validateVaultTitle(title) {
  if (!title || !title.trim()) return 'Title is required'
  if (title.trim().length > 200) return 'Title is too long (max 200 characters)'
  if (/<script|javascript:|data:/i.test(title)) return 'Title contains invalid characters'
  return null
}

export function validateUrl(url, allowedPrefixes) {
  if (!url || typeof url !== 'string') return false
  return allowedPrefixes.some(prefix => url.startsWith(prefix))
}

export function sanitiseText(text, maxLength = 500) {
  if (!text) return ''
  return String(text).trim().substring(0, maxLength)
}

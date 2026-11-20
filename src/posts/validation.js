const POST_FIELDS = ['postId', 'name', 'email', 'body']

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/

const countCharacters = (text) => [...text].length

const isText = (value, min, max) =>
  typeof value === 'string' && countCharacters(value) >= min && countCharacters(value) <= max

export const isPositiveInteger = (value) => Number.isSafeInteger(value) && value >= 1

export const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const FIELD_RULES = {
  postId: {
    isValid: isPositiveInteger,
    message: 'postId doit être un entier supérieur ou égal à 1',
  },
  name: {
    isValid: (value) => isText(value, 1, 100),
    message: 'name doit être un texte de 1 à 100 caractères',
  },
  email: {
    isValid: (value) => isText(value, 1, 100) && EMAIL_PATTERN.test(value),
    message: 'email doit être une adresse e-mail valide de 100 caractères au plus',
  },
  body: {
    isValid: (value) => isText(value, 1, 500),
    message: 'body doit être un texte de 1 à 500 caractères',
  },
}

export function parsePositiveInteger(raw) {
  if (typeof raw !== 'string' || !POSITIVE_INTEGER_PATTERN.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) ? value : null
}

export function validatePost(input, { partial = false } = {}) {
  if (!isPlainObject(input)) {
    return { error: 'Le corps de la requête doit être un objet JSON' }
  }

  const errors = []
  const keys = Object.keys(input)

  for (const key of keys) {
    if (key === 'id') {
      errors.push('id est attribué par le serveur et ne peut pas être modifié')
    } else if (!POST_FIELDS.includes(key)) {
      errors.push(`Champ inconnu : ${key}`)
    }
  }

  if (partial && keys.length === 0) {
    errors.push(`Au moins un champ parmi ${POST_FIELDS.join(', ')} est requis`)
  }

  const fields = {}
  for (const field of POST_FIELDS) {
    if (!Object.hasOwn(input, field)) {
      if (!partial) errors.push(`${field} est requis`)
    } else if (FIELD_RULES[field].isValid(input[field])) {
      fields[field] = input[field]
    } else {
      errors.push(FIELD_RULES[field].message)
    }
  }

  return errors.length > 0 ? { error: errors.join(' ; ') } : { fields }
}

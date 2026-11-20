import { readFileSync } from 'node:fs'
import { isPlainObject, isPositiveInteger, validatePost } from './validation.js'

export function loadSeed(path) {
  const posts = JSON.parse(readFileSync(path, 'utf8'))

  if (!Array.isArray(posts)) {
    throw new Error(`${path} must contain a JSON array of posts`)
  }

  const seenIds = new Set()

  for (const [index, entry] of posts.entries()) {
    if (!isPlainObject(entry)) {
      throw new Error(`Seed entry #${index} must be an object`)
    }

    const { id, ...fields } = entry
    if (!isPositiveInteger(id) || seenIds.has(id)) {
      throw new Error(`Seed entry #${index}: id must be a unique integer >= 1`)
    }
    seenIds.add(id)

    const { error } = validatePost(fields)
    if (error) {
      throw new Error(`Seed entry #${index} (id ${id}): ${error}`)
    }
  }

  return posts
}

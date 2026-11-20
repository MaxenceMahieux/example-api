import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, beforeEach, describe, it } from 'node:test'
import { createApp } from '../src/app.js'
import { loadSeed } from '../src/posts/seed.js'
import { createPostStore } from '../src/posts/store.js'

const FIXTURE_POSTS = [
  { postId: 1, id: 1, name: 'First', email: 'alice@example.com', body: 'Hello' },
  { postId: 1, id: 2, name: 'Second', email: 'bob@example.com', body: 'World' },
  { postId: 2, id: 3, name: 'Third', email: 'carol@example.com', body: 'Again' },
]

const VALID_INPUT = { postId: 4, name: 'New post', email: 'dave@example.com', body: 'Some text' }

let store
let handler
let baseUrl
const server = createServer((req, res) => handler(req, res))

before(async () => {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(() => new Promise((resolve) => server.close(() => resolve())))

beforeEach(() => {
  store = createPostStore(FIXTURE_POSTS)
  handler = createApp(store).callback()
})

async function request(method, path, body, headers = {}) {
  const init = { method, headers: { ...headers } }
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
    init.headers['content-type'] ??= 'application/json'
  }
  const res = await fetch(`${baseUrl}${path}`, init)
  const text = await res.text()
  return { status: res.status, headers: res.headers, text, json: text ? JSON.parse(text) : undefined }
}

function assertJsonError(res, status) {
  assert.equal(res.status, status)
  assert.match(res.headers.get('content-type'), /application\/json/)
  assert.deepEqual(Object.keys(res.json), ['error'])
  assert.equal(typeof res.json.error, 'string')
  assert.ok(res.json.error.length > 0)
}

describe('GET /posts', () => {
  it('lists every post', async () => {
    const res = await request('GET', '/posts')
    assert.equal(res.status, 200)
    assert.deepEqual(res.json, FIXTURE_POSTS)
  })

  it('filters by postId', async () => {
    const res = await request('GET', '/posts?postId=1')
    assert.equal(res.status, 200)
    assert.deepEqual(res.json.map((p) => p.id), [1, 2])
  })

  it('returns an empty list when no post matches', async () => {
    const res = await request('GET', '/posts?postId=99')
    assert.equal(res.status, 200)
    assert.deepEqual(res.json, [])
  })

  for (const query of ['postId=0', 'postId=-1', 'postId=abc', 'postId=1.5', 'postId=', 'postId=1&postId=2']) {
    it(`rejects ${query} with 400`, async () => {
      assertJsonError(await request('GET', `/posts?${query}`), 400)
    })
  }
})

describe('GET /posts/:id', () => {
  it('returns the post with its fields in order', async () => {
    const res = await request('GET', '/posts/2')
    assert.equal(res.status, 200)
    assert.deepEqual(res.json, FIXTURE_POSTS[1])
    assert.deepEqual(Object.keys(res.json), ['postId', 'id', 'name', 'email', 'body'])
  })

  for (const id of ['999', 'abc', '0', '1.5', '%00', '%E0%A4%A']) {
    it(`returns 404 for id ${id}`, async () => {
      assertJsonError(await request('GET', `/posts/${id}`), 404)
    })
  }
})

describe('POST /posts', () => {
  it('creates a post with a server-assigned id', async () => {
    const res = await request('POST', '/posts', VALID_INPUT)
    assert.equal(res.status, 201)
    assert.equal(res.headers.get('location'), '/posts/4')
    assert.deepEqual(res.json, { ...VALID_INPUT, id: 4 })
    assert.deepEqual((await request('GET', '/posts/4')).json, res.json)
  })

  it('creates two distinct posts for the same payload', async () => {
    const first = await request('POST', '/posts', VALID_INPUT)
    const second = await request('POST', '/posts', VALID_INPUT)
    assert.notEqual(first.json.id, second.json.id)
  })

  it('accepts boundary lengths', async () => {
    const email = `${'a'.repeat(88)}@example.com`
    assert.equal(email.length, 100)
    const res = await request('POST', '/posts', {
      ...VALID_INPUT,
      name: 'n'.repeat(100),
      email,
      body: 'b'.repeat(500),
    })
    assert.equal(res.status, 201)
  })

  const invalidPayloads = {
    'missing field': { postId: 1, name: 'x', email: 'x@example.com' },
    'unknown field': { ...VALID_INPUT, role: 'admin' },
    'client-provided id': { ...VALID_INPUT, id: 42 },
    'postId = 0': { ...VALID_INPUT, postId: 0 },
    'postId as string': { ...VALID_INPUT, postId: '1' },
    'postId decimal': { ...VALID_INPUT, postId: 1.5 },
    'postId object': { ...VALID_INPUT, postId: { $ne: null } },
    'empty name': { ...VALID_INPUT, name: '' },
    'name too long': { ...VALID_INPUT, name: 'n'.repeat(101) },
    'name not a string': { ...VALID_INPUT, name: 123 },
    'malformed email': { ...VALID_INPUT, email: 'not-an-email' },
    'email too long': { ...VALID_INPUT, email: `${'a'.repeat(89)}@example.com` },
    'empty body': { ...VALID_INPUT, body: '' },
    'body too long': { ...VALID_INPUT, body: 'b'.repeat(501) },
    'null value': { ...VALID_INPUT, body: null },
    'empty object': {},
  }

  for (const [label, payload] of Object.entries(invalidPayloads)) {
    it(`rejects ${label} with 400`, async () => {
      assertJsonError(await request('POST', '/posts', payload), 400)
      assert.equal(store.list().length, FIXTURE_POSTS.length)
    })
  }

  for (const raw of ['{"postId": 1,', 'null', '[]', '"texte"', '42']) {
    it(`rejects the raw body ${raw} with 400`, async () => {
      assertJsonError(await request('POST', '/posts', raw), 400)
    })
  }

  it('rejects a non-JSON body with 400', async () => {
    assertJsonError(await request('POST', '/posts', 'postId=1', { 'content-type': 'text/plain' }), 400)
  })

  it('rejects a body that is too large with 413', async () => {
    assertJsonError(await request('POST', '/posts', { ...VALID_INPUT, body: 'x'.repeat(200000) }), 413)
  })

  it('never reuses an id after a deletion', async () => {
    await request('DELETE', '/posts/3')
    const res = await request('POST', '/posts', VALID_INPUT)
    assert.equal(res.json.id, 4)
  })
})

describe('PUT /posts/:id', () => {
  it('replaces the post', async () => {
    const res = await request('PUT', '/posts/1', VALID_INPUT)
    assert.equal(res.status, 200)
    assert.deepEqual(res.json, { ...VALID_INPUT, id: 1 })
    assert.deepEqual((await request('GET', '/posts/1')).json, { ...VALID_INPUT, id: 1 })
  })

  it('is idempotent', async () => {
    await request('PUT', '/posts/1', VALID_INPUT)
    const firstState = (await request('GET', '/posts/1')).text
    await request('PUT', '/posts/1', VALID_INPUT)
    assert.equal((await request('GET', '/posts/1')).text, firstState)
  })

  it('requires all four fields', async () => {
    assertJsonError(await request('PUT', '/posts/1', { name: 'Only name' }), 400)
    assert.deepEqual((await request('GET', '/posts/1')).json, FIXTURE_POSTS[0])
  })

  it('rejects an unknown field', async () => {
    assertJsonError(await request('PUT', '/posts/1', { ...VALID_INPUT, role: 'admin' }), 400)
  })

  it('rejects an id in the body', async () => {
    assertJsonError(await request('PUT', '/posts/1', { ...VALID_INPUT, id: 1 }), 400)
  })

  it('returns 404 for an unknown or malformed id', async () => {
    assertJsonError(await request('PUT', '/posts/999', VALID_INPUT), 404)
    assertJsonError(await request('PUT', '/posts/abc', VALID_INPUT), 404)
  })
})

describe('PATCH /posts/:id', () => {
  it('updates only the provided fields', async () => {
    const res = await request('PATCH', '/posts/1', { name: 'Renamed' })
    assert.equal(res.status, 200)
    assert.deepEqual(res.json, { ...FIXTURE_POSTS[0], name: 'Renamed' })
  })

  it('accepts several fields at once', async () => {
    const res = await request('PATCH', '/posts/1', { postId: 7, body: 'Updated' })
    assert.equal(res.status, 200)
    assert.deepEqual(res.json, { ...FIXTURE_POSTS[0], postId: 7, body: 'Updated' })
  })

  const invalidPayloads = {
    'empty object': {},
    'id': { id: 5 },
    'id with a valid field': { id: 5, name: 'x' },
    'unknown field': { role: 'admin' },
    'invalid email': { email: 'nope' },
  }

  for (const [label, payload] of Object.entries(invalidPayloads)) {
    it(`rejects ${label} with 400`, async () => {
      assertJsonError(await request('PATCH', '/posts/1', payload), 400)
      assert.deepEqual((await request('GET', '/posts/1')).json, FIXTURE_POSTS[0])
    })
  }

  it('returns 404 for an unknown post', async () => {
    assertJsonError(await request('PATCH', '/posts/999', { name: 'x' }), 404)
  })
})

describe('DELETE /posts/:id', () => {
  it('deletes the post and returns 204 without body', async () => {
    const res = await request('DELETE', '/posts/1')
    assert.equal(res.status, 204)
    assert.equal(res.text, '')
    assertJsonError(await request('GET', '/posts/1'), 404)
  })

  it('returns 404 when replayed', async () => {
    await request('DELETE', '/posts/1')
    assertJsonError(await request('DELETE', '/posts/1'), 404)
  })
})

describe('error format', () => {
  it('answers an unknown route with a JSON 404', async () => {
    assertJsonError(await request('GET', '/nimportequoi'), 404)
  })

  it('answers an unsupported method with a JSON 405 and an Allow header', async () => {
    const res = await request('DELETE', '/posts')
    assertJsonError(res, 405)
    assert.match(res.headers.get('allow'), /GET/)
  })
})

describe('seed file', () => {
  it('loads the ten posts of posts.seed.json', () => {
    const posts = loadSeed(new URL('../posts.seed.json', import.meta.url))
    assert.equal(posts.length, 10)
    assert.equal(new Set(posts.map((p) => p.id)).size, posts.length)
  })
})

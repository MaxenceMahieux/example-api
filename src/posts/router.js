import Router from '@koa/router'
import { parsePositiveInteger, validatePost } from './validation.js'

function readValidFields(ctx, options) {
  const { fields, error } = validatePost(ctx.request.body, options)
  if (error) ctx.throw(400, error)
  return fields
}

export function createPostsRouter(store) {
  const router = new Router()

  router.param('id', (rawId, ctx, next) => {
    const id = parsePositiveInteger(rawId)
    const post = id === null ? null : store.findById(id)
    if (!post) ctx.throw(404, 'Post introuvable')
    ctx.state.post = post
    return next()
  })

  router.get('/posts', (ctx) => {
    if (ctx.query.postId === undefined) {
      ctx.body = store.list()
      return
    }

    const postId = parsePositiveInteger(ctx.query.postId)
    if (postId === null) {
      ctx.throw(400, 'Le paramètre postId doit être un entier supérieur ou égal à 1')
    }

    ctx.body = store.list(postId)
  })

  router.get('/posts/:id', (ctx) => {
    ctx.body = ctx.state.post
  })

  router.post('/posts', (ctx) => {
    const post = store.create(readValidFields(ctx))
    ctx.status = 201
    ctx.set('Location', `/posts/${post.id}`)
    ctx.body = post
  })

  router.put('/posts/:id', (ctx) => {
    ctx.body = store.replace(ctx.state.post.id, readValidFields(ctx))
  })

  router.patch('/posts/:id', (ctx) => {
    ctx.body = store.update(ctx.state.post.id, readValidFields(ctx, { partial: true }))
  })

  router.delete('/posts/:id', (ctx) => {
    store.remove(ctx.state.post.id)
    ctx.status = 204
  })

  return router
}

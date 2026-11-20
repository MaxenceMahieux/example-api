import Koa from 'koa'
import { bodyParser } from '@koa/bodyparser'
import { createPostsRouter } from './posts/router.js'

const EMPTY_RESPONSE_MESSAGES = {
  404: 'Route introuvable',
  405: 'Méthode non autorisée',
  501: 'Méthode non implémentée',
}

const isErrorStatus = (status) => Number.isInteger(status) && status >= 400 && status < 600

async function jsonErrors(ctx, next) {
  try {
    await next()
    if (ctx.status >= 400 && ctx.body == null) {
      ctx.throw(ctx.status, EMPTY_RESPONSE_MESSAGES[ctx.status] ?? 'Requête invalide', { expose: true })
    }
  } catch (error) {
    ctx.status = isErrorStatus(error.status) ? error.status : 500
    ctx.body = { error: error.expose ? error.message : 'Erreur interne du serveur' }
    if (!error.expose) ctx.app.emit('error', error, ctx)
  }
}

const parseJsonBody = bodyParser({
  enableTypes: ['json'],
  jsonLimit: '16kb',
  onError: (error, ctx) => {
    if (error.status === 413) ctx.throw(413, 'Corps de requête trop volumineux')
    ctx.throw(400, 'Corps de requête invalide : un objet JSON est attendu')
  },
})

export function createApp(store) {
  const app = new Koa()
  const router = createPostsRouter(store)

  app.use(jsonErrors)
  app.use(parseJsonBody)
  app.use(router.routes())
  app.use(router.allowedMethods())

  return app
}

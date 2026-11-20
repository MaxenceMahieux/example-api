import Koa from 'koa'
import Router from '@koa/router'

const app = new Koa()
const router = new Router()

const examples = [
  { id: 1, title: 'Lire la doc de Koa', done: true },
  { id: 2, title: 'Écrire une première route', done: false },
  { id: 3, title: 'Tester avec curl et Postman', done: false },
]

app.use(async (ctx, next) => {
  const debut = Date.now()
  await next()
  console.log(`${ctx.method} ${ctx.path} -> ${ctx.status} (${Date.now() - debut}ms)`)
})

router.get('/health', (ctx) => {
  ctx.body = { status: 'ok' }
})

router.get('/examples', (ctx) => {
  ctx.body = examples
})

router.get('/examples/:id', (ctx) => {
  const id = Number(ctx.params.id)
  const example = examples.find((e) => e.id === id)

  if (!example) {
    ctx.status = 404
    ctx.body = { error: 'Exemple introuvable' }
    return
  }

  ctx.body = example
})

app.use(router.routes())
app.use(router.allowedMethods())

app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000')
})
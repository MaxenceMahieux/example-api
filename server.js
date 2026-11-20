import Koa from 'koa'
import Router from '@koa/router'

const app = new Koa()
const router = new Router()

app.use(async (ctx, next) => {
  const debut = Date.now()
  await next()
  console.log(`${ctx.method} ${ctx.path} -> ${ctx.status} (${Date.now() - debut}ms)`)
})

router.get('/health', (ctx) => {
  ctx.body = { status: 'ok' }
})

app.use(router.routes())
app.use(router.allowedMethods())

app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000')
})
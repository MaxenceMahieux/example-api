import { createApp } from './src/app.js'
import { loadSeed } from './src/posts/seed.js'
import { createPostStore } from './src/posts/store.js'

const PORT = Number(process.env.PORT) || 3000
const store = createPostStore(loadSeed(new URL('./posts.seed.json', import.meta.url)))

createApp(store).listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})

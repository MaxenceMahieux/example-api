const toPost = (id, { postId, name, email, body }) => ({ postId, id, name, email, body })

export function createPostStore(initialPosts = []) {
  const posts = initialPosts.map(({ id, ...fields }) => toPost(id, fields))
  let nextId = Math.max(0, ...posts.map((post) => post.id)) + 1

  const indexOf = (id) => posts.findIndex((post) => post.id === id)
  const findById = (id) => posts.find((post) => post.id === id) ?? null

  return {
    findById,

    list(postId) {
      return postId === undefined ? [...posts] : posts.filter((post) => post.postId === postId)
    },

    create(fields) {
      const post = toPost(nextId++, fields)
      posts.push(post)
      return post
    },

    replace(id, fields) {
      const index = indexOf(id)
      if (index === -1) return null
      posts[index] = toPost(id, fields)
      return posts[index]
    },

    update(id, fields) {
      const post = findById(id)
      return post && Object.assign(post, fields)
    },

    remove(id) {
      const index = indexOf(id)
      if (index === -1) return false
      posts.splice(index, 1)
      return true
    },
  }
}

import { Hono } from 'hono';
import { Env, User, Post } from '../types';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../lib/jwt';

const posts = new Hono<{ Bindings: Env; Variables: { user: User } }>();

posts.use('*', authMiddleware);

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// GET /api/posts
posts.get('/', async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(
    'SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC'
  )
    .bind(user.id)
    .all<Post>();

  return c.json({ posts: result.results });
});

// POST /api/posts
posts.post('/', async (c) => {
  const user = c.get('user');
  const { title, slug, body, publish } = await c.req.json<{
    title: string;
    slug?: string;
    body?: string;
    publish?: boolean;
  }>();

  if (!title) {
    return c.json({ error: 'Title is required' }, 400);
  }

  // Only pro users can publish
  if (publish && !user.is_pro) {
    return c.json({ error: 'Publishing is a Pro feature' }, 403);
  }

  const id = generateId();
  const postSlug = slug || generateSlug(title);
  const publishedAt = publish ? new Date().toISOString() : null;

  await c.env.DB.prepare(
    'INSERT INTO posts (id, user_id, title, slug, body, published_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(id, user.id, title, postSlug, body || '', publishedAt)
    .run();

  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?')
    .bind(id)
    .first<Post>();

  return c.json({ post }, 201);
});

// PUT /api/posts/:id
posts.put('/:id', async (c) => {
  const user = c.get('user');
  const postId = c.req.param('id');
  const { title, slug, body, publish } = await c.req.json<{
    title?: string;
    slug?: string;
    body?: string;
    publish?: boolean;
  }>();

  const existing = await c.env.DB.prepare(
    'SELECT * FROM posts WHERE id = ? AND user_id = ?'
  )
    .bind(postId, user.id)
    .first<Post>();

  if (!existing) {
    return c.json({ error: 'Post not found' }, 404);
  }

  if (publish && !user.is_pro) {
    return c.json({ error: 'Publishing is a Pro feature' }, 403);
  }

  const publishedAt = publish ? new Date().toISOString() : existing.published_at;

  await c.env.DB.prepare(
    'UPDATE posts SET title = ?, slug = ?, body = ?, published_at = ? WHERE id = ? AND user_id = ?'
  )
    .bind(
      title ?? existing.title,
      slug ?? existing.slug,
      body ?? existing.body,
      publishedAt,
      postId,
      user.id
    )
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?')
    .bind(postId)
    .first<Post>();

  return c.json({ post: updated });
});

// DELETE /api/posts/:id
posts.delete('/:id', async (c) => {
  const user = c.get('user');
  const postId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT * FROM posts WHERE id = ? AND user_id = ?'
  )
    .bind(postId, user.id)
    .first();

  if (!existing) {
    return c.json({ error: 'Post not found' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM posts WHERE id = ? AND user_id = ?')
    .bind(postId, user.id)
    .run();

  return c.json({ message: 'Post deleted' });
});

export default posts;

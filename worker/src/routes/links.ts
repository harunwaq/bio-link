import { Hono } from 'hono';
import { Env, User, Link } from '../types';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../lib/jwt';

const links = new Hono<{ Bindings: Env; Variables: { user: User } }>();

links.use('*', authMiddleware);

// GET /api/links
links.get('/', async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(
    'SELECT * FROM links WHERE user_id = ? ORDER BY order_index ASC'
  )
    .bind(user.id)
    .all<Link>();

  return c.json({ links: result.results });
});

// POST /api/links
links.post('/', async (c) => {
  const user = c.get('user');
  const { title, url, type } = await c.req.json<{
    title: string;
    url?: string;
    type?: 'link' | 'header' | 'embed';
  }>();

  // Get max order_index
  const maxOrder = await c.env.DB.prepare(
    'SELECT MAX(order_index) as max_order FROM links WHERE user_id = ?'
  )
    .bind(user.id)
    .first<{ max_order: number | null }>();

  const orderIndex = (maxOrder?.max_order ?? -1) + 1;
  const id = generateId();

  await c.env.DB.prepare(
    'INSERT INTO links (id, user_id, title, url, order_index, type) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(id, user.id, title || '', url || '', orderIndex, type || 'link')
    .run();

  const link = await c.env.DB.prepare('SELECT * FROM links WHERE id = ?')
    .bind(id)
    .first<Link>();

  return c.json({ link }, 201);
});

// PUT /api/links/:id
links.put('/:id', async (c) => {
  const user = c.get('user');
  const linkId = c.req.param('id');
  const { title, url, is_visible } = await c.req.json<{
    title?: string;
    url?: string;
    is_visible?: number;
  }>();

  // Verify ownership
  const existing = await c.env.DB.prepare(
    'SELECT * FROM links WHERE id = ? AND user_id = ?'
  )
    .bind(linkId, user.id)
    .first<Link>();

  if (!existing) {
    return c.json({ error: 'Link not found' }, 404);
  }

  await c.env.DB.prepare(
    'UPDATE links SET title = ?, url = ?, is_visible = ? WHERE id = ? AND user_id = ?'
  )
    .bind(
      title ?? existing.title,
      url ?? existing.url,
      is_visible ?? existing.is_visible,
      linkId,
      user.id
    )
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM links WHERE id = ?')
    .bind(linkId)
    .first<Link>();

  return c.json({ link: updated });
});

// DELETE /api/links/:id
links.delete('/:id', async (c) => {
  const user = c.get('user');
  const linkId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT * FROM links WHERE id = ? AND user_id = ?'
  )
    .bind(linkId, user.id)
    .first();

  if (!existing) {
    return c.json({ error: 'Link not found' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM links WHERE id = ? AND user_id = ?')
    .bind(linkId, user.id)
    .run();

  return c.json({ message: 'Link deleted' });
});

// PUT /api/links/reorder
links.put('/reorder', async (c) => {
  const user = c.get('user');
  const { orderedIds } = await c.req.json<{ orderedIds: string[] }>();

  if (!orderedIds || !Array.isArray(orderedIds)) {
    return c.json({ error: 'orderedIds array is required' }, 400);
  }

  const statements = orderedIds.map((id, index) =>
    c.env.DB.prepare('UPDATE links SET order_index = ? WHERE id = ? AND user_id = ?').bind(
      index,
      id,
      user.id
    )
  );

  await c.env.DB.batch(statements);

  return c.json({ message: 'Links reordered' });
});

export default links;

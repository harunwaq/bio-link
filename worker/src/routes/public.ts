import { Hono } from 'hono';
import { Env, User, Link, Social } from '../types';
import { generateId } from '../lib/jwt';

const publicRoutes = new Hono<{ Bindings: Env }>();

// GET /api/public/:username - Public bio page data
publicRoutes.get('/:username', async (c) => {
  const username = c.req.param('username').toLowerCase();

  const user = await c.env.DB.prepare(
    'SELECT id, username, name, bio, avatar_url, theme, show_verified, nsfw_warning FROM users WHERE username = ? AND is_verified = 1'
  )
    .bind(username)
    .first<Partial<User>>();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const links = await c.env.DB.prepare(
    'SELECT id, title, url, type, clicks FROM links WHERE user_id = ? AND is_visible = 1 ORDER BY order_index ASC'
  )
    .bind(user.id!)
    .all<Partial<Link>>();

  const socials = await c.env.DB.prepare(
    'SELECT platform, url FROM socials WHERE user_id = ?'
  )
    .bind(user.id!)
    .all<Partial<Social>>();

  return c.json({
    user: {
      username: user.username,
      name: user.name,
      bio: user.bio,
      avatar_url: user.avatar_url,
      theme: user.theme,
      show_verified: user.show_verified,
      nsfw_warning: user.nsfw_warning,
    },
    links: links.results,
    socials: socials.results,
  });
});

// POST /api/public/:username/view - Track page view
publicRoutes.post('/:username/view', async (c) => {
  const username = c.req.param('username').toLowerCase();

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first<{ id: string }>();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const { country, device } = await c.req.json<{ country?: string; device?: string }>();

  await c.env.DB.prepare(
    'INSERT INTO page_views (id, user_id, country, device) VALUES (?, ?, ?, ?)'
  )
    .bind(generateId(), user.id, country || '', device || '')
    .run();

  return c.json({ message: 'View tracked' });
});

// POST /api/public/:username/click/:linkId - Track link click
publicRoutes.post('/:username/click/:linkId', async (c) => {
  const username = c.req.param('username').toLowerCase();
  const linkId = c.req.param('linkId');

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first<{ id: string }>();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const { country } = await c.req.json<{ country?: string }>();

  // Record click
  await c.env.DB.prepare(
    'INSERT INTO link_clicks (id, link_id, user_id, country) VALUES (?, ?, ?, ?)'
  )
    .bind(generateId(), linkId, user.id, country || '')
    .run();

  // Increment link click count
  await c.env.DB.prepare(
    'UPDATE links SET clicks = clicks + 1 WHERE id = ? AND user_id = ?'
  )
    .bind(linkId, user.id)
    .run();

  return c.json({ message: 'Click tracked' });
});

// POST /api/public/:username/subscribe - Subscribe to user
publicRoutes.post('/:username/subscribe', async (c) => {
  const username = c.req.param('username').toLowerCase();
  const { email } = await c.req.json<{ email: string }>();

  if (!email) {
    return c.json({ error: 'Email is required' }, 400);
  }

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first<{ id: string }>();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Check if already subscribed
  const existing = await c.env.DB.prepare(
    'SELECT id FROM subscribers WHERE user_id = ? AND email = ?'
  )
    .bind(user.id, email)
    .first();

  if (existing) {
    return c.json({ message: 'Already subscribed' });
  }

  await c.env.DB.prepare(
    'INSERT INTO subscribers (id, user_id, email) VALUES (?, ?, ?)'
  )
    .bind(generateId(), user.id, email)
    .run();

  return c.json({ message: 'Subscribed successfully' });
});

export default publicRoutes;

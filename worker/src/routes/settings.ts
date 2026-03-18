import { Hono } from 'hono';
import { Env, User } from '../types';
import { authMiddleware } from '../middleware/auth';

const settings = new Hono<{ Bindings: Env; Variables: { user: User } }>();

settings.use('*', authMiddleware);

// GET /api/settings
settings.get('/', async (c) => {
  const user = c.get('user');

  return c.json({
    username: user.username,
    email: user.email,
    preferred_link_style: user.preferred_link_style,
    nsfw_warning: user.nsfw_warning,
    show_verified: user.show_verified,
    seo_title: user.seo_title,
    seo_description: user.seo_description,
    google_analytics_id: user.google_analytics_id,
    is_pro: user.is_pro,
  });
});

// PUT /api/settings
settings.put('/', async (c) => {
  const user = c.get('user');
  const {
    username,
    preferred_link_style,
    nsfw_warning,
    show_verified,
    seo_title,
    seo_description,
    google_analytics_id,
  } = await c.req.json<{
    username?: string;
    preferred_link_style?: string;
    nsfw_warning?: number;
    show_verified?: number;
    seo_title?: string;
    seo_description?: string;
    google_analytics_id?: string;
  }>();

  // If username is being changed, check availability
  if (username && username !== user.username) {
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE username = ? AND id != ?'
    )
      .bind(username.toLowerCase(), user.id)
      .first();

    if (existing) {
      return c.json({ error: 'Username already taken' }, 409);
    }
  }

  await c.env.DB.prepare(
    `UPDATE users SET 
      username = ?,
      preferred_link_style = ?,
      nsfw_warning = ?,
      show_verified = ?,
      seo_title = ?,
      seo_description = ?,
      google_analytics_id = ?
    WHERE id = ?`
  )
    .bind(
      username?.toLowerCase() ?? user.username,
      preferred_link_style ?? user.preferred_link_style,
      nsfw_warning ?? user.nsfw_warning,
      show_verified ?? user.show_verified,
      seo_title ?? user.seo_title,
      seo_description ?? user.seo_description,
      google_analytics_id ?? user.google_analytics_id,
      user.id
    )
    .run();

  return c.json({ message: 'Settings updated' });
});

export default settings;

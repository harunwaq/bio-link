import { Hono } from 'hono';
import { Env, User } from '../types';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../lib/jwt';

const design = new Hono<{ Bindings: Env; Variables: { user: User } }>();

design.use('*', authMiddleware);

// GET /api/design
design.get('/', async (c) => {
  const user = c.get('user');

  const socials = await c.env.DB.prepare(
    'SELECT * FROM socials WHERE user_id = ? ORDER BY platform ASC'
  )
    .bind(user.id)
    .all();

  return c.json({
    name: user.name,
    bio: user.bio,
    avatar_url: user.avatar_url,
    theme: user.theme,
    socials: socials.results,
  });
});

// PUT /api/design
design.put('/', async (c) => {
  const user = c.get('user');
  const { name, bio, theme, socials } = await c.req.json<{
    name?: string;
    bio?: string;
    theme?: string;
    socials?: { platform: string; url: string }[];
  }>();

  // Update user profile fields
  await c.env.DB.prepare(
    'UPDATE users SET name = ?, bio = ?, theme = ? WHERE id = ?'
  )
    .bind(name ?? user.name, bio ?? user.bio, theme ?? user.theme, user.id)
    .run();

  // Update socials if provided
  if (socials && Array.isArray(socials)) {
    // Delete existing socials
    await c.env.DB.prepare('DELETE FROM socials WHERE user_id = ?').bind(user.id).run();

    // Insert new socials
    for (const social of socials) {
      if (social.url && social.url.trim()) {
        await c.env.DB.prepare(
          'INSERT INTO socials (id, user_id, platform, url) VALUES (?, ?, ?, ?)'
        )
          .bind(generateId(), user.id, social.platform, social.url)
          .run();
      }
    }
  }

  const updatedUser = await c.env.DB.prepare(
    'SELECT name, bio, avatar_url, theme FROM users WHERE id = ?'
  )
    .bind(user.id)
    .first();

  const updatedSocials = await c.env.DB.prepare(
    'SELECT * FROM socials WHERE user_id = ?'
  )
    .bind(user.id)
    .all();

  return c.json({
    ...updatedUser,
    socials: updatedSocials.results,
  });
});

export default design;

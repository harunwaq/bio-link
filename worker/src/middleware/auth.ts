import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyJWT } from '../lib/jwt';
import { Env, User } from '../types';

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: { user: User } }>,
  next: Next
) {
  const token = getCookie(c, 'session');

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Verify the JWT
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }

  // Check if session exists in KV
  const sessionData = await c.env.SESSIONS.get(`session:${payload.sub}`);
  if (!sessionData) {
    return c.json({ error: 'Session expired' }, 401);
  }

  // Load user from database
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(payload.sub)
    .first<User>();

  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }

  c.set('user', user);
  await next();
}

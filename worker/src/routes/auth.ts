import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { Env, User } from '../types';
import {
  createJWT,
  verifyJWT,
  generateId,
  hashPassword,
  verifyPassword,
  generateVerificationCode,
} from '../lib/jwt';
import { sendVerificationEmail } from '../lib/email';

const auth = new Hono<{ Bindings: Env; Variables: { user: User } }>();

// POST /api/auth/signup
auth.post('/signup', async (c) => {
  const { email, username, password } = await c.req.json<{
    email: string;
    username: string;
    password: string;
  }>();

  if (!email || !username || !password) {
    return c.json({ error: 'Email, username, and password are required' }, 400);
  }

  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return c.json({ error: 'Username can only contain letters, numbers, and underscores' }, 400);
  }

  // Check existing user
  const existingEmail = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();
  if (existingEmail) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const existingUsername = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username.toLowerCase())
    .first();
  if (existingUsername) {
    return c.json({ error: 'Username already taken' }, 409);
  }

  const userId = generateId();
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)'
  )
    .bind(userId, email, username.toLowerCase(), passwordHash)
    .run();

  // Generate and store verification code
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
  await c.env.DB.prepare(
    'INSERT INTO verification_codes (id, user_id, code, expires_at) VALUES (?, ?, ?, ?)'
  )
    .bind(generateId(), userId, code, expiresAt)
    .run();

  await sendVerificationEmail(email, code);

  return c.json({ message: 'Signup successful. Check your email for verification code.', userId });
});

// POST /api/auth/verify-email
auth.post('/verify-email', async (c) => {
  const { email, code } = await c.req.json<{ email: string; code: string }>();

  if (!email || !code) {
    return c.json({ error: 'Email and code are required' }, 400);
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<User>();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const verification = await c.env.DB.prepare(
    'SELECT * FROM verification_codes WHERE user_id = ? AND code = ? ORDER BY created_at DESC LIMIT 1'
  )
    .bind(user.id, code)
    .first<{ id: string; expires_at: string }>();

  if (!verification) {
    return c.json({ error: 'Invalid verification code' }, 400);
  }

  if (new Date(verification.expires_at) < new Date()) {
    return c.json({ error: 'Verification code expired' }, 400);
  }

  // Mark user as verified
  await c.env.DB.prepare('UPDATE users SET is_verified = 1 WHERE id = ?')
    .bind(user.id)
    .run();

  // Clean up verification codes
  await c.env.DB.prepare('DELETE FROM verification_codes WHERE user_id = ?')
    .bind(user.id)
    .run();

  // Create JWT and store session
  const token = await createJWT(
    { sub: user.id, email: user.email, username: user.username },
    c.env.JWT_SECRET
  );

  await c.env.SESSIONS.put(`session:${user.id}`, JSON.stringify({ token }), {
    expirationTtl: 7 * 24 * 60 * 60,
  });

  setCookie(c, 'session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return c.json({
    message: 'Email verified successfully',
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      onboarding_completed: user.onboarding_completed,
    },
  });
});

// POST /api/auth/login
auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<User>();

  if (!user) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  if (!user.is_verified) {
    // Re-send verification code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await c.env.DB.prepare(
      'INSERT INTO verification_codes (id, user_id, code, expires_at) VALUES (?, ?, ?, ?)'
    )
      .bind(generateId(), user.id, code, expiresAt)
      .run();
    await sendVerificationEmail(email, code);
    return c.json({ error: 'Email not verified. New code sent.', needsVerification: true }, 403);
  }

  const token = await createJWT(
    { sub: user.id, email: user.email, username: user.username },
    c.env.JWT_SECRET
  );

  await c.env.SESSIONS.put(`session:${user.id}`, JSON.stringify({ token }), {
    expirationTtl: 7 * 24 * 60 * 60,
  });

  setCookie(c, 'session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      bio: user.bio,
      avatar_url: user.avatar_url,
      theme: user.theme,
      is_pro: user.is_pro,
      onboarding_completed: user.onboarding_completed,
    },
  });
});

// POST /api/auth/logout
auth.post('/logout', async (c) => {
  const token = getCookie(c, 'session');
  if (token) {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (payload) {
      await c.env.SESSIONS.delete(`session:${payload.sub}`);
    }
  }

  deleteCookie(c, 'session', { path: '/' });
  return c.json({ message: 'Logged out' });
});

// GET /api/auth/me
auth.get('/me', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) {
    return c.json({ user: null }, 401);
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ user: null }, 401);
  }

  const sessionData = await c.env.SESSIONS.get(`session:${payload.sub}`);
  if (!sessionData) {
    return c.json({ user: null }, 401);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, username, name, bio, avatar_url, theme, is_pro, is_verified, onboarding_completed, preferred_link_style, nsfw_warning, show_verified, seo_title, seo_description, google_analytics_id, created_at FROM users WHERE id = ?'
  )
    .bind(payload.sub)
    .first();

  if (!user) {
    return c.json({ user: null }, 401);
  }

  return c.json({ user });
});

// GET /api/auth/check-username/:username
auth.get('/check-username/:username', async (c) => {
  const username = c.req.param('username').toLowerCase();

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return c.json({ available: false, error: 'Invalid characters' });
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first();

  return c.json({ available: !existing });
});

export default auth;

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, User } from './types';
import authRoutes from './routes/auth';
import linksRoutes from './routes/links';
import postsRoutes from './routes/posts';
import designRoutes from './routes/design';
import uploadRoutes from './routes/upload';
import subscribersRoutes from './routes/subscribers';
import statsRoutes from './routes/stats';
import settingsRoutes from './routes/settings';
import publicRoutes from './routes/public';

const app = new Hono<{ Bindings: Env; Variables: { user: User } }>();

// CORS middleware
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      // Allow the frontend URL and localhost for development
      const allowedOrigins = [c.env.FRONTEND_URL, 'http://localhost:5173'];
      return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount route modules
app.route('/api/auth', authRoutes);
app.route('/api/links', linksRoutes);
app.route('/api/posts', postsRoutes);
app.route('/api/design', designRoutes);
app.route('/api/upload', uploadRoutes);
app.route('/api/subscribers', subscribersRoutes);
app.route('/api/stats', statsRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/public', publicRoutes);

// Serve R2 avatars
app.get('/api/avatar/*', async (c) => {
  const key = c.req.path.replace('/api/avatar/', '');
  const object = await c.env.AVATARS.get(key);

  if (!object) {
    return c.json({ error: 'Not found' }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000');

  return new Response(object.body, { headers });
});

// Onboarding endpoint - save onboarding data
app.post('/api/onboarding', async (c) => {
  // Import auth middleware inline for this endpoint
  const { getCookie } = await import('hono/cookie');
  const { verifyJWT } = await import('./lib/jwt');
  const { generateId } = await import('./lib/jwt');

  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: 'Invalid session' }, 401);

  const { name, bio, links, socials } = await c.req.json<{
    name: string;
    bio: string;
    links?: { title: string; url: string }[];
    socials?: { platform: string; url: string }[];
  }>();

  // Update user profile
  await c.env.DB.prepare(
    'UPDATE users SET name = ?, bio = ?, onboarding_completed = 1 WHERE id = ?'
  )
    .bind(name || '', bio || '', payload.sub)
    .run();

  // Save links
  if (links && links.length > 0) {
    for (let i = 0; i < links.length; i++) {
      if (links[i].title || links[i].url) {
        await c.env.DB.prepare(
          'INSERT INTO links (id, user_id, title, url, order_index, type) VALUES (?, ?, ?, ?, ?, ?)'
        )
          .bind(generateId(), payload.sub, links[i].title, links[i].url, i, 'link')
          .run();
      }
    }
  }

  // Save socials
  if (socials && socials.length > 0) {
    for (const social of socials) {
      if (social.url && social.url.trim()) {
        await c.env.DB.prepare(
          'INSERT INTO socials (id, user_id, platform, url) VALUES (?, ?, ?, ?)'
        )
          .bind(generateId(), payload.sub, social.platform, social.url)
          .run();
      }
    }
  }

  return c.json({ message: 'Onboarding completed' });
});

export default app;

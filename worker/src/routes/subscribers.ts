import { Hono } from 'hono';
import { Env, User, Subscriber } from '../types';
import { authMiddleware } from '../middleware/auth';
import { sendSubscriberEmail } from '../lib/email';

const subscribers = new Hono<{ Bindings: Env; Variables: { user: User } }>();

subscribers.use('*', authMiddleware);

// GET /api/subscribers
subscribers.get('/', async (c) => {
  const user = c.get('user');

  const result = await c.env.DB.prepare(
    'SELECT * FROM subscribers WHERE user_id = ? ORDER BY subscribed_at DESC'
  )
    .bind(user.id)
    .all<Subscriber>();

  return c.json({
    subscribers: result.results,
    count: result.results.length,
  });
});

// POST /api/subscribers/send-email
subscribers.post('/send-email', async (c) => {
  const user = c.get('user');
  const { subject, body } = await c.req.json<{ subject: string; body: string }>();

  if (!subject || !body) {
    return c.json({ error: 'Subject and body are required' }, 400);
  }

  const result = await c.env.DB.prepare(
    'SELECT email FROM subscribers WHERE user_id = ?'
  )
    .bind(user.id)
    .all<{ email: string }>();

  const emails = result.results.map((s) => s.email);

  if (emails.length === 0) {
    return c.json({ error: 'No subscribers to email' }, 400);
  }

  await sendSubscriberEmail(emails, subject, body, c.env.RESEND_API_KEY);

  return c.json({ message: `Email sent to ${emails.length} subscribers` });
});

export default subscribers;

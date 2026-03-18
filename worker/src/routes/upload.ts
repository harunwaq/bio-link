import { Hono } from 'hono';
import { Env, User } from '../types';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../lib/jwt';

const upload = new Hono<{ Bindings: Env; Variables: { user: User } }>();

upload.use('*', authMiddleware);

// POST /api/upload/avatar
upload.post('/avatar', async (c) => {
  const user = c.get('user');

  try {
    const formData = await c.req.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Use JPEG, PNG, WebP, or GIF.' }, 400);
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: 'File too large. Max 5MB.' }, 400);
    }

    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
    const key = `avatars/${user.id}/${Date.now()}.${ext}`;

    await c.env.AVATARS.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // The URL will depend on your R2 public access configuration
    const avatarUrl = `/api/avatar/${key}`;

    // Update user's avatar_url
    await c.env.DB.prepare('UPDATE users SET avatar_url = ? WHERE id = ?')
      .bind(avatarUrl, user.id)
      .run();

    return c.json({ avatar_url: avatarUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Upload failed' }, 500);
  }
});

export default upload;

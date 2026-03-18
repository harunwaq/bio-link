import { Hono } from 'hono';
import { Env, User } from '../types';
import { authMiddleware } from '../middleware/auth';

const stats = new Hono<{ Bindings: Env; Variables: { user: User } }>();

stats.use('*', authMiddleware);

// GET /api/stats?period=30days|alltime
stats.get('/', async (c) => {
  const user = c.get('user');
  const period = c.req.query('period') || '30days';

  let dateFilter = '';
  if (period === '30days') {
    dateFilter = "AND visited_at >= datetime('now', '-30 days')";
  }

  // Page views
  const pageViews = await c.env.DB.prepare(
    `SELECT DATE(visited_at) as date, COUNT(*) as count 
     FROM page_views 
     WHERE user_id = ? ${dateFilter}
     GROUP BY DATE(visited_at) 
     ORDER BY date ASC`
  )
    .bind(user.id)
    .all<{ date: string; count: number }>();

  // Total page views
  const totalViews = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM page_views WHERE user_id = ? ${dateFilter}`
  )
    .bind(user.id)
    .first<{ total: number }>();

  // Top links by clicks
  let clickDateFilter = '';
  if (period === '30days') {
    clickDateFilter = "AND lc.clicked_at >= datetime('now', '-30 days')";
  }

  const topLinks = await c.env.DB.prepare(
    `SELECT l.title, l.url, COUNT(lc.id) as clicks 
     FROM links l 
     LEFT JOIN link_clicks lc ON l.id = lc.link_id ${clickDateFilter}
     WHERE l.user_id = ? 
     GROUP BY l.id 
     ORDER BY clicks DESC 
     LIMIT 10`
  )
    .bind(user.id)
    .all<{ title: string; url: string; clicks: number }>();

  // Top socials
  const topSocials = await c.env.DB.prepare(
    `SELECT platform, url FROM socials WHERE user_id = ?`
  )
    .bind(user.id)
    .all<{ platform: string; url: string }>();

  // Location data
  const locations = await c.env.DB.prepare(
    `SELECT country, COUNT(*) as count 
     FROM page_views 
     WHERE user_id = ? AND country != '' ${dateFilter}
     GROUP BY country 
     ORDER BY count DESC`
  )
    .bind(user.id)
    .all<{ country: string; count: number }>();

  // Device data
  const devices = await c.env.DB.prepare(
    `SELECT device, COUNT(*) as count 
     FROM page_views 
     WHERE user_id = ? AND device != '' ${dateFilter}
     GROUP BY device 
     ORDER BY count DESC`
  )
    .bind(user.id)
    .all<{ device: string; count: number }>();

  return c.json({
    pageViews: pageViews.results,
    totalViews: totalViews?.total || 0,
    topLinks: topLinks.results,
    topSocials: topSocials.results,
    locations: locations.results,
    devices: devices.results,
  });
});

export default stats;

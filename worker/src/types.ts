import { Context } from 'hono';

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  AVATARS: R2Bucket;
  JWT_SECRET: string;
  FRONTEND_URL: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  name: string;
  bio: string;
  avatar_url: string;
  theme: string;
  is_pro: number;
  is_verified: number;
  onboarding_completed: number;
  preferred_link_style: string;
  nsfw_warning: number;
  show_verified: number;
  seo_title: string;
  seo_description: string;
  google_analytics_id: string;
  created_at: string;
}

export interface Link {
  id: string;
  user_id: string;
  title: string;
  url: string;
  order_index: number;
  is_visible: number;
  clicks: number;
  type: 'link' | 'header' | 'embed';
  created_at: string;
}

export interface Social {
  id: string;
  user_id: string;
  platform: string;
  url: string;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  body: string;
  published_at: string | null;
  created_at: string;
}

export interface Subscriber {
  id: string;
  user_id: string;
  email: string;
  subscribed_at: string;
}

export interface PageView {
  id: string;
  user_id: string;
  visited_at: string;
  country: string;
  device: string;
}

export interface LinkClick {
  id: string;
  link_id: string;
  user_id: string;
  clicked_at: string;
  country: string;
}

export type AppContext = Context<{ Bindings: Env; Variables: { user: User } }>;

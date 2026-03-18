import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const API_BASE = import.meta.env.PROD
  ? 'https://biolink-worker.alhaytami2019.workers.dev/api'
  : '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  signup: (data: { email: string; username: string; password: string }) =>
    request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  verifyEmail: (data: { email: string; code: string }) =>
    request('/auth/verify-email', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<{ user: any }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: any }>('/auth/me'),
  checkUsername: (username: string) =>
    request<{ available: boolean }>(`/auth/check-username/${username}`),

  // Onboarding
  completeOnboarding: (data: {
    name: string;
    bio: string;
    links?: { title: string; url: string }[];
    socials?: { platform: string; url: string }[];
  }) => request('/onboarding', { method: 'POST', body: JSON.stringify(data) }),

  // Links
  getLinks: () => request<{ links: any[] }>('/links'),
  createLink: (data: { title: string; url?: string; type?: string }) =>
    request<{ link: any }>('/links', { method: 'POST', body: JSON.stringify(data) }),
  updateLink: (id: string, data: any) =>
    request<{ link: any }>(`/links/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLink: (id: string) =>
    request(`/links/${id}`, { method: 'DELETE' }),
  reorderLinks: (orderedIds: string[]) =>
    request('/links/reorder', { method: 'PUT', body: JSON.stringify({ orderedIds }) }),

  // Posts
  getPosts: () => request<{ posts: any[] }>('/posts'),
  createPost: (data: any) =>
    request<{ post: any }>('/posts', { method: 'POST', body: JSON.stringify(data) }),
  updatePost: (id: string, data: any) =>
    request<{ post: any }>(`/posts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePost: (id: string) =>
    request(`/posts/${id}`, { method: 'DELETE' }),

  // Design
  getDesign: () => request<any>('/design'),
  updateDesign: (data: any) =>
    request('/design', { method: 'PUT', body: JSON.stringify(data) }),

  // Upload
  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await fetch(`${API_BASE}/upload/avatar`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json() as Promise<{ avatar_url: string }>;
  },

  // Subscribers
  getSubscribers: () => request<{ subscribers: any[]; count: number }>('/subscribers'),
  sendEmail: (data: { subject: string; body: string }) =>
    request('/subscribers/send-email', { method: 'POST', body: JSON.stringify(data) }),

  // Stats
  getStats: (period: string = '30days') =>
    request<any>(`/stats?period=${period}`),

  // Settings
  getSettings: () => request<any>('/settings'),
  updateSettings: (data: any) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Public
  getPublicProfile: (username: string) =>
    request<any>(`/public/${username}`),
  trackView: (username: string, data?: any) =>
    request(`/public/${username}/view`, { method: 'POST', body: JSON.stringify(data || {}) }),
  trackClick: (username: string, linkId: string, data?: any) =>
    request(`/public/${username}/click/${linkId}`, { method: 'POST', body: JSON.stringify(data || {}) }),
  subscribe: (username: string, email: string) =>
    request(`/public/${username}/subscribe`, { method: 'POST', body: JSON.stringify({ email }) }),
};

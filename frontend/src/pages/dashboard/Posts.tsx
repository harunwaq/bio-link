import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

export default function PostsTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: api.getPosts,
  });

  const deleteMutation = useMutation({
    mutationFn: api.deletePost,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['posts'] }); toast.success('Post deleted'); },
  });

  const posts = data?.posts || [];

  if (isLoading) return <p style={{ color: '#9ca3af', padding: 40 }}>Loading posts...</p>;

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Pro banner for free users */}
      {!user?.is_pro && (
        <div style={{
          background: 'linear-gradient(135deg, #f9357b, #f97316)',
          color: 'white',
          padding: '16px 24px',
          borderRadius: 12,
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Upgrade to Pro</h3>
            <p style={{ fontSize: 13, opacity: 0.9 }}>Publishing blog posts is a Pro feature</p>
          </div>
          <button style={{
            background: 'white',
            color: '#f9357b',
            border: 'none',
            padding: '8px 20px',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Upgrade
          </button>
        </div>
      )}

      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }} className="fade-in">
          <div style={{ fontSize: 48, marginBottom: 16 }}>✍️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Write your first post</h2>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>Share your thoughts with your audience</p>
          <button
            className="btn-gradient"
            onClick={() => navigate('/dashboard/posts/new')}
          >
            Write a post
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Your Posts</h2>
            <button
              className="btn-gradient"
              onClick={() => navigate('/dashboard/posts/new')}
            >
              + New Post
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {posts.map((post: any) => (
              <div
                key={post.id}
                className="card"
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => navigate(`/dashboard/posts/${post.id}`)}
              >
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{post.title || 'Untitled'}</h3>
                  <p style={{ fontSize: 12, color: '#9ca3af' }}>
                    {post.published_at ? `Published ${new Date(post.published_at).toLocaleDateString()}` : 'Draft'}
                    {' · '}slug: {post.slug || '—'}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(post.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14 }}
                >
                  🗑 Delete
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

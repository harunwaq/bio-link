import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

export default function PostEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isNew = !id || id === 'new';

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  const { data } = useQuery({
    queryKey: ['post', id],
    queryFn: () => api.getPosts().then(d => d.posts.find((p: any) => p.id === id)),
    enabled: !isNew,
  });

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setSlug(data.slug);
      setBody(data.body);
    }
  }, [data]);

  useEffect(() => {
    if (isNew && title) {
      setSlug(
        title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
      );
    }
  }, [title, isNew]);

  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      const payload = { title, slug, body, publish };
      if (isNew) {
        return api.createPost(payload);
      } else {
        return api.updatePost(id!, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post saved!');
      navigate('/dashboard/posts');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyFormat = (tag: string) => {
    const textarea = document.getElementById('post-body') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.substring(start, end);
    
    let formatted = '';
    switch (tag) {
      case 'bold': formatted = `**${selected}**`; break;
      case 'italic': formatted = `*${selected}*`; break;
      case 'underline': formatted = `__${selected}__`; break;
      case 'link': formatted = `[${selected}](url)`; break;
      case 'bullet': formatted = `\n- ${selected}`; break;
      case 'quote': formatted = `\n> ${selected}`; break;
      default: formatted = selected;
    }
    
    setBody(body.substring(0, start) + formatted + body.substring(end));
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button
          onClick={() => navigate('/dashboard/posts')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
        >
          ← Back to posts
        </button>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn-outline"
            onClick={() => saveMutation.mutate(false)}
            disabled={loading}
          >
            Save Draft
          </button>
          <button
            className="btn-gradient"
            onClick={() => saveMutation.mutate(true)}
            disabled={loading || !user?.is_pro}
            title={!user?.is_pro ? 'Publishing requires Pro' : ''}
          >
            {loading ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      <input
        type="text"
        className="input-field"
        placeholder="Post title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>Slug:</span>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          style={{ border: 'none', outline: 'none', fontSize: 13, color: '#6b7280', background: '#f3f4f6', padding: '4px 8px', borderRadius: 4 }}
        />
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '8px 12px',
        background: '#f9fafb',
        borderRadius: '8px 8px 0 0',
        border: '1px solid #e5e7eb',
        borderBottom: 'none',
      }}>
        {[
          { label: 'B', tag: 'bold', style: { fontWeight: 700 } },
          { label: 'I', tag: 'italic', style: { fontStyle: 'italic' } },
          { label: 'U', tag: 'underline', style: { textDecoration: 'underline' } },
          { label: '🔗', tag: 'link', style: {} },
          { label: '•', tag: 'bullet', style: {} },
          { label: '❝', tag: 'quote', style: {} },
        ].map((btn) => (
          <button
            key={btn.tag}
            onClick={() => applyFormat(btn.tag)}
            style={{
              ...btn.style,
              background: 'none',
              border: '1px solid transparent',
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <textarea
        id="post-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your post content here... (supports Markdown)"
        style={{
          width: '100%',
          minHeight: 400,
          padding: 16,
          fontSize: 15,
          lineHeight: 1.7,
          border: '1px solid #e5e7eb',
          borderRadius: '0 0 8px 8px',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'var(--font-sans)',
        }}
      />
    </div>
  );
}

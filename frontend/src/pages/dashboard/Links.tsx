import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import PhoneMockup from '../../components/PhoneMockup';
import toast from 'react-hot-toast';

export default function LinksTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['links'],
    queryFn: api.getLinks,
  });
  const { data: designData } = useQuery({
    queryKey: ['design'],
    queryFn: api.getDesign,
  });

  const [localLinks, setLocalLinks] = useState<any[]>([]);

  useEffect(() => {
    if (data?.links) setLocalLinks(data.links);
  }, [data]);

  const createMutation = useMutation({
    mutationFn: api.createLink,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['links'] }); toast.success('Link added!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.updateLink(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['links'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteLink,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['links'] }); toast.success('Link deleted'); },
  });

  const reorderMutation = useMutation({
    mutationFn: api.reorderLinks,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['links'] }),
  });

  const moveLink = (index: number, direction: 'up' | 'down') => {
    const newLinks = [...localLinks];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newLinks.length) return;
    [newLinks[index], newLinks[swapIndex]] = [newLinks[swapIndex], newLinks[index]];
    setLocalLinks(newLinks);
    reorderMutation.mutate(newLinks.map(l => l.id));
  };

  const toggleVisibility = (link: any) => {
    updateMutation.mutate({ id: link.id, is_visible: link.is_visible ? 0 : 1 });
  };

  return (
    <div style={{ display: 'flex', gap: 40 }}>
      {/* Left: Phone mockup */}
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
        <PhoneMockup
          name={designData?.name || user?.name}
          bio={designData?.bio || user?.bio}
          avatarUrl={designData?.avatar_url || user?.avatar_url}
          theme={designData?.theme || user?.theme}
          links={localLinks.filter(l => l.is_visible)}
          socials={designData?.socials || []}
        />
      </div>

      {/* Right: Links panel */}
      <div style={{ flex: 1, maxWidth: 600 }}>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <button
            className="btn-gradient"
            onClick={() => createMutation.mutate({ title: '', url: '', type: 'link' })}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            + ADD LINK
          </button>
          <button
            className="btn-blue"
            onClick={() => createMutation.mutate({ title: '', url: '', type: 'embed' })}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            + ADD EMBED
          </button>
        </div>

        <button
          onClick={() => createMutation.mutate({ title: 'Header', type: 'header' })}
          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14, marginBottom: 16 }}
        >
          + Add header
        </button>

        {isLoading && <p style={{ color: '#9ca3af' }}>Loading links...</p>}

        {/* Link list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {localLinks.map((link, index) => (
            <div key={link.id} className="link-item">
              {/* Drag handle / reorder buttons */}
              <div className="drag-handle" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button
                  onClick={() => moveLink(index, 'up')}
                  disabled={index === 0}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#9ca3af', padding: 2 }}
                >
                  ▲
                </button>
                <span style={{ fontSize: 14 }}>⋮⋮</span>
                <button
                  onClick={() => moveLink(index, 'down')}
                  disabled={index === localLinks.length - 1}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#9ca3af', padding: 2 }}
                >
                  ▼
                </button>
              </div>

              {/* Link content */}
              <div style={{ flex: 1 }}>
                {link.type === 'header' ? (
                  <input
                    type="text"
                    value={link.title}
                    onChange={(e) => {
                      const updated = localLinks.map(l => l.id === link.id ? { ...l, title: e.target.value } : l);
                      setLocalLinks(updated);
                    }}
                    onBlur={() => updateMutation.mutate({ id: link.id, title: link.title })}
                    placeholder="Header text"
                    style={{ border: 'none', outline: 'none', fontSize: 14, fontWeight: 700, width: '100%', background: 'transparent' }}
                  />
                ) : (
                  <>
                    <input
                      type="text"
                      value={link.title}
                      onChange={(e) => {
                        const updated = localLinks.map(l => l.id === link.id ? { ...l, title: e.target.value } : l);
                        setLocalLinks(updated);
                      }}
                      onBlur={() => updateMutation.mutate({ id: link.id, title: link.title })}
                      placeholder="Link title"
                      style={{ border: 'none', outline: 'none', fontSize: 14, fontWeight: 600, width: '100%', background: 'transparent', marginBottom: 4 }}
                    />
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => {
                        const updated = localLinks.map(l => l.id === link.id ? { ...l, url: e.target.value } : l);
                        setLocalLinks(updated);
                      }}
                      onBlur={() => updateMutation.mutate({ id: link.id, url: link.url })}
                      placeholder="https://..."
                      style={{ border: 'none', outline: 'none', fontSize: 12, color: '#6b7280', width: '100%', background: 'transparent' }}
                    />
                  </>
                )}
              </div>

              {/* Click count + visibility toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>
                  👁 {link.clicks || 0}
                </span>
                <button
                  onClick={() => toggleVisibility(link)}
                  className={`toggle ${link.is_visible ? 'active' : ''}`}
                  title={link.is_visible ? 'Visible' : 'Hidden'}
                />
                <button
                  onClick={() => deleteMutation.mutate(link.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#ef4444' }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>

        {localLinks.length === 0 && !isLoading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>No links yet</p>
            <p style={{ fontSize: 14 }}>Add your first link to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}

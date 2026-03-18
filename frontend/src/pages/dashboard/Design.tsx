import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import PhoneMockup from '../../components/PhoneMockup';
import { themes } from '../../themes';
import toast from 'react-hot-toast';

export default function DesignTab() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['design'],
    queryFn: api.getDesign,
  });

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [selectedTheme, setSelectedTheme] = useState(user?.theme || 'basics');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');

  // Sync with server data
  useState(() => {
    if (data) {
      setName(data.name || '');
      setBio(data.bio || '');
      setSelectedTheme(data.theme || 'basics');
      setAvatarUrl(data.avatar_url || '');
    }
  });

  const updateMutation = useMutation({
    mutationFn: api.updateDesign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design'] });
      refreshUser();
      toast.success('Design updated!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.uploadAvatar(file);
      setAvatarUrl(result.avatar_url);
      toast.success('Avatar uploaded!');
      refreshUser();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSave = () => {
    updateMutation.mutate({ name, bio, theme: selectedTheme });
  };

  const themeCategories = ['Link in bio', 'Blog', 'Shop'] as const;

  return (
    <div style={{ display: 'flex', gap: 40 }}>
      {/* Phone mockup */}
      <div style={{ flexShrink: 0, paddingTop: 20 }}>
        <PhoneMockup
          name={name}
          bio={bio}
          avatarUrl={avatarUrl}
          theme={selectedTheme}
          links={[]}
          socials={data?.socials || []}
        />
      </div>

      {/* Design panel */}
      <div style={{ flex: 1, maxWidth: 600 }}>
        {/* Profile section */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Profile</h3>

          {/* Avatar upload */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: avatarUrl ? `url(${avatarUrl}) center/cover` : '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {!avatarUrl && <span style={{ fontSize: 24, color: '#9ca3af' }}>📷</span>}
            </div>
            <label style={{
              padding: '8px 16px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}>
              Upload avatar
              <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
            </label>
          </div>

          <input
            type="text"
            className="input-field"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <textarea
            className="textarea-field"
            placeholder="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        {/* Themes */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Themes</h3>

          {themeCategories.map((category) => {
            const categoryThemes = themes.filter((t) => t.category === category);
            if (categoryThemes.length === 0) return null;
            return (
              <div key={category} style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {category}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {categoryThemes.map((theme) => (
                    <div
                      key={theme.id}
                      className={`theme-card ${selectedTheme === theme.id ? 'selected' : ''}`}
                      onClick={() => setSelectedTheme(theme.id)}
                      style={{
                        background: theme.background.includes('gradient') ? theme.background : theme.background,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: 16,
                      }}
                    >
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: theme.cardBg,
                        border: `2px solid ${theme.textColor}30`,
                      }} />
                      <div style={{
                        width: '60%',
                        height: 6,
                        background: theme.buttonBg,
                        borderRadius: 3,
                      }} />
                      <div style={{
                        width: '60%',
                        height: 6,
                        background: theme.buttonBg,
                        borderRadius: 3,
                      }} />
                      <span style={{ color: theme.textColor, fontSize: 10, fontWeight: 600, marginTop: 4 }}>
                        {theme.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button
          className="btn-gradient"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          style={{ width: '100%', marginTop: 24 }}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

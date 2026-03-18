import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

export default function SettingsTab() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const [username, setUsername] = useState('');
  const [preferredLink, setPreferredLink] = useState('bio.link/username');
  const [nsfwWarning, setNsfwWarning] = useState(false);
  const [showVerified, setShowVerified] = useState(false);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState('');

  useEffect(() => {
    if (data) {
      setUsername(data.username || '');
      setPreferredLink(data.preferred_link_style || 'bio.link/username');
      setNsfwWarning(!!data.nsfw_warning);
      setShowVerified(!!data.show_verified);
      setSeoTitle(data.seo_title || '');
      setSeoDescription(data.seo_description || '');
      setGoogleAnalyticsId(data.google_analytics_id || '');
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      refreshUser();
      toast.success('Settings saved!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = () => {
    updateMutation.mutate({
      username,
      preferred_link_style: preferredLink,
      nsfw_warning: nsfwWarning ? 1 : 0,
      show_verified: showVerified ? 1 : 0,
      seo_title: seoTitle,
      seo_description: seoDescription,
      google_analytics_id: googleAnalyticsId,
    });
  };

  if (isLoading) return <p style={{ color: '#9ca3af', padding: 40 }}>Loading settings...</p>;

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Preferred Link */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Preferred Link</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 14 }}>
          <input
            type="radio"
            checked={preferredLink === 'bio.link/username'}
            onChange={() => setPreferredLink('bio.link/username')}
          />
          bio.link/{username}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
          <input
            type="radio"
            checked={preferredLink === 'username.bio.link'}
            onChange={() => setPreferredLink('username.bio.link')}
          />
          {username}.bio.link
        </label>
      </div>

      {/* Toggles */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>NSFW Warning</span>
            <p style={{ fontSize: 12, color: '#9ca3af' }}>Show a content warning before your page</p>
          </div>
          <button
            className={`toggle ${nsfwWarning ? 'active' : ''}`}
            onClick={() => setNsfwWarning(!nsfwWarning)}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Show Verified Checkmark</span>
            <p style={{ fontSize: 12, color: '#9ca3af' }}>Display a verified badge on your profile</p>
          </div>
          <button
            className={`toggle ${showVerified ? 'active' : ''}`}
            onClick={() => setShowVerified(!showVerified)}
          />
        </div>
      </div>

      {/* SEO */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 12 }}>SEO</h3>
        <input
          type="text"
          className="input-field"
          placeholder="SEO Title"
          value={seoTitle}
          onChange={(e) => setSeoTitle(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <textarea
          className="textarea-field"
          placeholder="SEO Description"
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          rows={3}
        />
      </div>

      {/* Google Analytics */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Google Analytics</h3>
        <input
          type="text"
          className="input-field"
          placeholder="GA Tracking ID (e.g., G-XXXXXXXXXX)"
          value={googleAnalyticsId}
          onChange={(e) => setGoogleAnalyticsId(e.target.value)}
        />
      </div>

      {/* Username */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 12 }}>My Username</h3>
        <input
          type="text"
          className="input-field"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
        />
      </div>

      {/* Pro Links */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 12 }}>
          Pro Links
          {!user?.is_pro && (
            <span style={{
              background: 'linear-gradient(135deg, #f9357b, #f97316)',
              color: 'white',
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 700,
              marginLeft: 8,
            }}>PRO</span>
          )}
        </h3>
        <div style={{ opacity: user?.is_pro ? 1 : 0.5 }}>
          <div style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14 }}>
            🌐 Custom Domain Setup
          </div>
          <div style={{ padding: '12px 0', fontSize: 14 }}>
            😀 Emoji Link Creator
          </div>
        </div>
      </div>

      <button
        className="btn-gradient"
        onClick={handleSave}
        disabled={updateMutation.isPending}
        style={{ width: '100%' }}
      >
        {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}

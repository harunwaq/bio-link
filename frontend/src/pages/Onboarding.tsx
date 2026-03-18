import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import PhoneMockup from '../components/PhoneMockup';
import toast from 'react-hot-toast';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');

  // Step 2
  const [links, setLinks] = useState([{ title: '', url: '' }]);
  const [socials, setSocials] = useState({
    instagram: '',
    tiktok: '',
    youtube: '',
  });

  const addLink = () => setLinks([...links, { title: '', url: '' }]);
  const updateLink = (i: number, field: 'title' | 'url', value: string) => {
    const updated = [...links];
    updated[i][field] = value;
    setLinks(updated);
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const socialList = Object.entries(socials)
        .filter(([, url]) => url.trim())
        .map(([platform, url]) => ({ platform, url }));

      const validLinks = links.filter(l => l.title || l.url);

      await api.completeOnboarding({
        name,
        bio,
        links: validLinks,
        socials: socialList,
      });

      await refreshUser();
      toast.success('Welcome to Bio Link!');
      navigate('/dashboard/links');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #f3f4f6' }}>
        <div className="bio-logo">BIO.<br/>LINK</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>{user?.email}</span>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>▼</span>
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 20px' }} className="slide-up">
        {/* Back arrow + Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}
            >
              ←
            </button>
          )}
          <div className="progress-bar" style={{ flex: 1 }}>
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* Step 1: Profile details */}
        {step === 1 && (
          <div className="fade-in">
            <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 32 }}>
              Add your profile details
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                className="input-field"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div style={{ position: 'relative' }}>
                <textarea
                  className="textarea-field"
                  placeholder="Bio"
                  value={bio}
                  onChange={(e) => {
                    if (e.target.value.length <= 255) setBio(e.target.value);
                  }}
                  rows={4}
                />
                <span style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 11, color: '#9ca3af' }}>
                  {bio.length}/255
                </span>
              </div>
            </div>
            <button
              className="btn-gradient"
              style={{ width: '100%', marginTop: 24 }}
              onClick={() => setStep(2)}
              disabled={!name.trim()}
            >
              CONTINUE
            </button>
          </div>
        )}

        {/* Step 2: Add links + socials */}
        {step === 2 && (
          <div className="fade-in">
            <h2 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
              Start with a link
            </h2>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 14, marginBottom: 32 }}>
              Add anything you want your followers to see.
            </p>

            {/* Links */}
            {links.map((link, i) => (
              <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Link name"
                  value={link.title}
                  onChange={(e) => updateLink(i, 'title', e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <input
                  type="url"
                  className="input-field"
                  placeholder="URL"
                  value={link.url}
                  onChange={(e) => updateLink(i, 'url', e.target.value)}
                />
              </div>
            ))}

            <button
              onClick={addLink}
              style={{ display: 'block', margin: '0 auto', background: 'none', border: 'none', color: '#3b82f6', fontWeight: 500, cursor: 'pointer', fontSize: 14 }}
            >
              +Add another
            </button>

            {/* Socials */}
            <div style={{ marginTop: 32 }}>
              <h3 style={{ fontWeight: 700, textAlign: 'center', marginBottom: 16 }}>Socials</h3>
              {[
                { platform: 'instagram', icon: '📷', color: '#E4405F' },
                { platform: 'tiktok', icon: '🎵', color: '#000000' },
                { platform: 'youtube', icon: '▶️', color: '#FF0000' },
              ].map((s) => (
                <div
                  key={s.platform}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '10px 14px',
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: s.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                    }}
                  >
                    {s.icon}
                  </span>
                  <input
                    type="url"
                    placeholder="URL"
                    value={socials[s.platform as keyof typeof socials]}
                    onChange={(e) => setSocials({ ...socials, [s.platform]: e.target.value })}
                    style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14 }}
                  />
                </div>
              ))}
            </div>

            <button
              className="btn-gradient"
              style={{ width: '100%', marginTop: 24 }}
              onClick={() => setStep(3)}
            >
              CONTINUE
            </button>
          </div>
        )}

        {/* Step 3: Looking Good! Preview */}
        {step === 3 && (
          <div className="fade-in" style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>Looking Good!</h2>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
              <PhoneMockup
                name={name}
                bio={bio}
                links={links.filter(l => l.title || l.url)}
                socials={Object.entries(socials)
                  .filter(([, url]) => url)
                  .map(([platform, url]) => ({ platform, url }))}
              />
            </div>

            <button
              className="btn-gradient"
              style={{ width: '100%', maxWidth: 300 }}
              onClick={handleComplete}
              disabled={loading}
            >
              {loading ? 'SETTING UP...' : 'COMPLETE SETUP'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

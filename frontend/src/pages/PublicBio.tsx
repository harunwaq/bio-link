import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { getTheme } from '../themes';

export default function PublicBio() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [subEmail, setSubEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!username) return;
    api.getPublicProfile(username)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });

    // Track page view
    api.trackView(username, {
      device: /Mobi/.test(navigator.userAgent) ? 'mobile' : 'desktop',
    }).catch(() => {});
  }, [username]);

  const handleLinkClick = async (linkId: string, url: string) => {
    if (username) {
      api.trackClick(username, linkId).catch(() => {});
    }
    window.open(url, '_blank');
  };

  const handleSubscribe = async () => {
    if (!subEmail || !username) return;
    try {
      await api.subscribe(username, subEmail);
      setSubscribed(true);
    } catch {}
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#1a1a1a' }}>
        <div style={{ color: 'white', fontSize: 18 }}>Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#1a1a1a', flexDirection: 'column' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
        <h1 style={{ color: 'white', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Page not found</h1>
        <p style={{ color: '#9ca3af', fontSize: 14 }}>This bio page doesn't exist yet.</p>
        <a href="/signup" style={{ color: '#f9357b', marginTop: 16, textDecoration: 'none', fontWeight: 600 }}>
          Create your own →
        </a>
      </div>
    );
  }

  const { user: profile, links, socials } = data;
  const theme = getTheme(profile.theme || 'basics');

  const bgStyle = theme.background.includes('gradient')
    ? { background: theme.background }
    : { backgroundColor: theme.background };

  return (
    <div style={{ ...bgStyle, minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ maxWidth: 440, width: '100%' }}>
        {/* NSFW warning */}
        {profile.nsfw_warning && (
          <div style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', padding: '12px 16px', borderRadius: 8, textAlign: 'center', fontSize: 13, marginBottom: 16 }}>
            ⚠️ This page may contain NSFW content
          </div>
        )}

        {/* Avatar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: profile.avatar_url ? `url(${profile.avatar_url}) center/cover` : '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `3px solid ${theme.textColor}30`,
            }}
          >
            {!profile.avatar_url && (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={theme.textColor} strokeWidth="1.5" opacity={0.5}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>
        </div>

        {/* Name + verified */}
        <h1 style={{ color: theme.textColor, textAlign: 'center', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          {profile.name || profile.username}
          {profile.show_verified ? ' ✓' : ''}
        </h1>

        {/* Bio */}
        {profile.bio && (
          <p style={{ color: theme.textColor, textAlign: 'center', fontSize: 14, opacity: 0.8, marginBottom: 24, lineHeight: 1.5 }}>
            {profile.bio}
          </p>
        )}

        {/* Social icons */}
        {socials.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
            {socials.map((social: any, i: number) => (
              <a
                key={i}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: `${theme.textColor}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.textColor,
                  textDecoration: 'none',
                  fontSize: 18,
                  transition: 'transform 0.2s',
                }}
              >
                {social.platform === 'instagram' && '📷'}
                {social.platform === 'tiktok' && '🎵'}
                {social.platform === 'youtube' && '▶️'}
                {social.platform === 'twitter' && '𝕏'}
                {social.platform === 'facebook' && 'f'}
              </a>
            ))}
          </div>
        )}

        {/* Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {links.map((link: any) => {
            if (link.type === 'header') {
              return (
                <div
                  key={link.id}
                  style={{
                    color: theme.textColor,
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    padding: '12px 0',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {link.title}
                </div>
              );
            }
            return (
              <button
                key={link.id}
                onClick={() => handleLinkClick(link.id, link.url)}
                style={{
                  backgroundColor: theme.buttonBg,
                  color: theme.buttonText,
                  padding: '16px 24px',
                  borderRadius: 12,
                  border: 'none',
                  textAlign: 'center',
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'transform 0.15s, opacity 0.15s',
                  width: '100%',
                }}
                onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {link.title || link.url}
              </button>
            );
          })}
        </div>

        {/* Subscribe */}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          {!showSubscribe ? (
            <button
              onClick={() => setShowSubscribe(true)}
              style={{
                background: `${theme.textColor}15`,
                color: theme.textColor,
                border: 'none',
                padding: '12px 24px',
                borderRadius: 24,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✉️ Subscribe
            </button>
          ) : subscribed ? (
            <p style={{ color: theme.textColor, fontSize: 14 }}>✅ You're subscribed!</p>
          ) : (
            <div style={{ display: 'flex', gap: 8, maxWidth: 320, margin: '0 auto' }}>
              <input
                type="email"
                placeholder="Your email"
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleSubscribe}
                style={{
                  background: '#f9357b',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Join
              </button>
            </div>
          )}
        </div>

        {/* Share + Bio.link badge */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 32 }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
            }}
            style={{ background: 'none', border: 'none', color: theme.textColor, cursor: 'pointer', opacity: 0.5, fontSize: 18 }}
            title="Share"
          >
            ↗
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              border: `2px solid ${theme.textColor}`,
              fontSize: 6,
              fontWeight: 800,
              textAlign: 'center',
              color: theme.textColor,
              textDecoration: 'none',
              opacity: 0.4,
              lineHeight: 1,
            }}
          >
            BIO.<br />LINK
          </a>
        </div>
      </div>
    </div>
  );
}

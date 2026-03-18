import { getTheme } from '../themes';

interface PhoneMockupProps {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  theme?: string;
  links?: { id?: string; title: string; url: string; type?: string }[];
  socials?: { platform: string; url: string }[];
}

export default function PhoneMockup({
  name = '',
  bio = '',
  avatarUrl = '',
  theme: themeId = 'basics',
  links = [],
  socials = [],
}: PhoneMockupProps) {
  const theme = getTheme(themeId);

  const bgStyle = theme.background.includes('gradient')
    ? { background: theme.background }
    : { backgroundColor: theme.background };

  return (
    <div className="phone-mockup">
      <div className="phone-mockup-content" style={bgStyle}>
        {/* Avatar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, marginTop: 8 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: avatarUrl ? `url(${avatarUrl}) center/cover` : '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              color: '#9ca3af',
              border: `3px solid ${theme.textColor}20`,
            }}
          >
            {!avatarUrl && (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>
        </div>

        {/* Name */}
        {name && (
          <h3 style={{ color: theme.textColor, textAlign: 'center', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
            {name}
          </h3>
        )}

        {/* Bio */}
        {bio && (
          <p style={{ color: theme.textColor, textAlign: 'center', fontSize: 12, opacity: 0.8, marginBottom: 16, padding: '0 12px' }}>
            {bio}
          </p>
        )}

        {/* Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 8px' }}>
          {links
            .filter(l => l.type !== 'header')
            .map((link, i) => (
              <div
                key={link.id || i}
                style={{
                  backgroundColor: theme.buttonBg,
                  color: theme.buttonText,
                  padding: '12px 16px',
                  borderRadius: 8,
                  textAlign: 'center',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
              >
                {link.title || link.url || 'Untitled'}
              </div>
            ))}
          {links
            .filter(l => l.type === 'header')
            .map((header, i) => (
              <div
                key={`header-${i}`}
                style={{
                  color: theme.textColor,
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '8px 0',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {header.title}
              </div>
            ))}
        </div>

        {/* Social Icons */}
        {socials.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
            {socials.map((social, i) => (
              <div
                key={i}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: `${theme.textColor}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  color: theme.textColor,
                }}
              >
                {social.platform === 'instagram' && '📷'}
                {social.platform === 'tiktok' && '🎵'}
                {social.platform === 'youtube' && '▶️'}
                {social.platform === 'twitter' && '𝕏'}
                {social.platform === 'facebook' && 'f'}
              </div>
            ))}
          </div>
        )}

        {/* Bio.link badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <div className="bio-logo" style={{ borderColor: theme.textColor, color: theme.textColor, fontSize: 6, opacity: 0.5 }}>
            BIO.<br />LINK
          </div>
        </div>
      </div>
    </div>
  );
}

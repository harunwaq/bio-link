import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: 'white', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 32px',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          border: '2px solid white',
          fontSize: 9,
          fontWeight: 800,
          textAlign: 'center',
          lineHeight: 1,
        }}>
          BIO.<br />LINK
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: '10px 24px',
              borderRadius: 8,
              fontWeight: 500,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Log in
          </button>
          <button
            onClick={() => navigate('/signup')}
            style={{
              background: 'linear-gradient(135deg, #f9357b, #f97316)',
              border: 'none',
              color: 'white',
              padding: '10px 24px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Sign up free
          </button>
        </div>
      </header>

      {/* Hero */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        paddingTop: 100,
        padding: '100px 20px 60px',
      }}>
        <h1 style={{
          fontSize: 'clamp(40px, 7vw, 72px)',
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: 24,
          maxWidth: 700,
          background: 'linear-gradient(135deg, #ffffff, #f9357b, #f97316)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Everything you are.<br />In one simple link.
        </h1>
        <p style={{
          fontSize: 18,
          color: 'rgba(255,255,255,0.6)',
          marginBottom: 40,
          maxWidth: 500,
          lineHeight: 1.6,
        }}>
          Join millions of creators using Bio Link to share everything they create, curate, and sell online. All from one link.
        </p>

        {/* CTA */}
        <div style={{
          display: 'flex',
          gap: 12,
          maxWidth: 440,
          width: '100%',
        }}>
          <div style={{
            flex: 1,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginRight: 4 }}>bio.link/</span>
            <input
              type="text"
              placeholder="yourname"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'none',
                color: 'white',
                fontSize: 14,
              }}
            />
          </div>
          <button
            onClick={() => navigate('/signup')}
            style={{
              background: 'linear-gradient(135deg, #f9357b, #f97316)',
              border: 'none',
              color: 'white',
              padding: '14px 28px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Claim it
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 16 }}>
          It's free and takes less than a minute
        </p>
      </div>

      {/* Features */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 24,
        maxWidth: 900,
        margin: '60px auto',
        padding: '0 24px',
      }}>
        {[
          { icon: '🔗', title: 'One Link', desc: 'Share all your content, socials, and links from one simple page' },
          { icon: '🎨', title: 'Custom Themes', desc: 'Choose from beautiful themes or customize to match your brand' },
          { icon: '📊', title: 'Analytics', desc: 'Track page views, link clicks, and visitor locations in real time' },
          { icon: '✍️', title: 'Blog Posts', desc: 'Write and publish blog posts directly on your bio page' },
          { icon: '📧', title: 'Subscribers', desc: 'Build your email list and communicate with your audience' },
          { icon: '⚡', title: 'Lightning Fast', desc: 'Powered by Cloudflare edge network for instant load times' },
        ].map((f, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 16,
              padding: 28,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '40px 20px',
        color: 'rgba(255,255,255,0.3)',
        fontSize: 13,
      }}>
        © 2024 Bio Link. Built with Cloudflare.
      </footer>
    </div>
  );
}

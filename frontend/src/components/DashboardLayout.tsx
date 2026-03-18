import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);

  const tabs = [
    { path: '/dashboard/links', label: 'Links' },
    { path: '/dashboard/posts', label: 'Posts' },
    { path: '/dashboard/design', label: 'Design' },
    { path: '/dashboard/subscribers', label: 'Subscribers' },
    { path: '/dashboard/stats', label: 'Stats' },
    { path: '/dashboard/settings', label: 'Settings' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.success('Logged out');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`bio.link/${user?.username}`);
    toast.success('Link copied!');
    setShowShareDropdown(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Top bar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        <div className="bio-logo">BIO.<br/>LINK</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            style={{
              background: 'linear-gradient(135deg, #f9357b, #f97316)',
              color: 'white',
              border: 'none',
              padding: '8px 20px',
              borderRadius: 24,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Upgrade
          </button>

          <a
            href={`/${user?.username}`}
            target="_blank"
            rel="noopener"
            style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}
          >
            bio.link/{user?.username}
          </a>

          {/* Share button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowShareDropdown(!showShareDropdown)}
              style={{
                background: 'none',
                border: '1px solid #e5e7eb',
                padding: '8px 16px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Share ↗
            </button>
            {showShareDropdown && (
              <div className="dropdown" style={{ minWidth: 220 }}>
                <button className="dropdown-item" onClick={copyLink}>📋 Copy link</button>
                <button className="dropdown-item" onClick={() => { setShowShareDropdown(false); toast('QR Code feature coming soon!'); }}>
                  📱 Get my QR code
                </button>
                <button className="dropdown-item" onClick={() => setShowShareDropdown(false)}>📲 Add to my socials</button>
              </div>
            )}
          </div>

          {/* Avatar dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: user?.avatar_url ? `url(${user.avatar_url}) center/cover` : '#e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {!user?.avatar_url && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                )}
              </div>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>▼</span>
            </button>
            {showDropdown && (
              <div className="dropdown" style={{ minWidth: 200 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600 }}>
                  {user?.name || user?.username}
                </div>
                <button className="dropdown-item" onClick={() => { setShowDropdown(false); }}>+ Add a new page</button>
                <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/dashboard/settings'); }}>⚙️ Account settings</button>
                <button className="dropdown-item" onClick={handleLogout} style={{ color: '#ef4444' }}>🚪 Logout</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <nav style={{
        display: 'flex',
        gap: 0,
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        paddingLeft: 24,
        overflowX: 'auto',
      }}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {/* Content */}
      <div style={{ padding: 24 }}>
        <Outlet />
      </div>

      {/* Click outside to close dropdowns */}
      {(showDropdown || showShareDropdown) && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 30 }}
          onClick={() => { setShowDropdown(false); setShowShareDropdown(false); }}
        />
      )}
    </div>
  );
}

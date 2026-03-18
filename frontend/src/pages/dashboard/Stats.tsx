import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function StatsTab() {
  const [period, setPeriod] = useState<'30days' | 'alltime'>('30days');

  const { data, isLoading } = useQuery({
    queryKey: ['stats', period],
    queryFn: () => api.getStats(period),
  });

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Period toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setPeriod('30days')}
          style={{
            padding: '8px 20px',
            borderRadius: 24,
            border: 'none',
            background: period === '30days' ? '#1a1a1a' : '#f3f4f6',
            color: period === '30days' ? 'white' : '#6b7280',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          30 Days
        </button>
        <button
          onClick={() => setPeriod('alltime')}
          style={{
            padding: '8px 20px',
            borderRadius: 24,
            border: 'none',
            background: period === 'alltime' ? '#1a1a1a' : '#f3f4f6',
            color: period === 'alltime' ? 'white' : '#6b7280',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          All time
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: '#9ca3af', padding: 40 }}>Loading stats...</p>
      ) : (
        <>
          {/* Total views */}
          <div className="card" style={{ marginBottom: 24, textAlign: 'center' }}>
            <h2 style={{ fontSize: 48, fontWeight: 800 }}>{data?.totalViews || 0}</h2>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Page Views</p>
          </div>

          {/* Page views chart */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Page Views</h3>
            {data?.pageViews?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.pageViews}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#f9357b"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#f9357b' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>No data yet</p>
            )}
          </div>

          {/* Top Links / Top Socials */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Top Links</h3>
              {data?.topLinks?.length > 0 ? (
                data.topLinks.map((link: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      {link.title || link.url || 'Untitled'}
                    </span>
                    <span style={{ fontWeight: 600 }}>{link.clicks}</span>
                  </div>
                ))
              ) : (
                <p style={{ color: '#9ca3af', fontSize: 13 }}>No clicks yet</p>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Top Socials</h3>
              {data?.topSocials?.length > 0 ? (
                data.topSocials.map((social: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                    <span style={{ textTransform: 'capitalize' }}>{social.platform}</span>
                    <span style={{ color: '#9ca3af', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }}>
                      {social.url}
                    </span>
                  </div>
                ))
              ) : (
                <p style={{ color: '#9ca3af', fontSize: 13 }}>No socials configured</p>
              )}
            </div>
          </div>

          {/* Locations */}
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 12 }}>🌍 Visitor Locations</h3>
            {data?.locations?.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {data.locations.map((loc: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: 8, fontSize: 13 }}>
                    <span>{loc.country}</span>
                    <span style={{ fontWeight: 600 }}>{loc.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 20 }}>
                No visitor data yet. Share your bio page to start tracking!
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

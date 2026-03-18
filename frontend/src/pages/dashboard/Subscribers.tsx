import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

export default function SubscribersTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['subscribers'],
    queryFn: api.getSubscribers,
  });

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'Why should I build a subscriber list?',
      a: 'Building a subscriber list lets you directly reach your audience without relying on social media algorithms. You own the relationship with your subscribers, making it a powerful tool for driving engagement and conversions.',
    },
    {
      q: 'Do I need to offer something in return?',
      a: 'While offering an incentive (like exclusive content, early access, or a free resource) can boost subscriptions, it\'s not required. Many creators build lists simply by providing consistent value through their content.',
    },
    {
      q: 'What does it cost?',
      a: 'Collecting subscribers through Bio Link is free! When you\'re ready to send emails, you can upgrade to our Pro plan for built-in email sending, or export your list to use with any email marketing service.',
    },
  ];

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Subscriber count */}
      <div className="card" style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 48, fontWeight: 800 }}>{data?.count || 0}</h2>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Total subscribers</p>
      </div>

      <button className="btn-gradient" style={{ width: '100%', marginBottom: 32 }}>
        Send an email
      </button>

      {/* Subscriber list */}
      {data?.subscribers && data.subscribers.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Recent subscribers</h3>
          {data.subscribers.slice(0, 10).map((sub: any) => (
            <div
              key={sub.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #f3f4f6',
                fontSize: 14,
              }}
            >
              <span>{sub.email}</span>
              <span style={{ color: '#9ca3af', fontSize: 12 }}>
                {new Date(sub.subscribed_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* FAQ */}
      <div className="card">
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Frequently Asked Questions</h3>
        {faqs.map((faq, i) => (
          <div key={i}>
            <div
              className="accordion-header"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <span>{faq.q}</span>
              <span style={{ fontSize: 18, transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(180deg)' : 'none' }}>
                ▼
              </span>
            </div>
            {openFaq === i && (
              <div className="accordion-content fade-in">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

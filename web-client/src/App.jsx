import React, { useState, useEffect } from 'react';
import UploadForm from './components/UploadForm';

export default function App() {
  const [auth, setAuth] = useState({ username: '', password: '' });
  const [summary, setSummary] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  // fetchLatest optionally accepts creds; falls back to current auth state
  const fetchLatest = async (creds = null) => {
    const useCreds = creds ?? auth;
    if (!useCreds.username || !useCreds.password) {
      setStatusMsg('Enter username/password and click "Fetch Summary" or upload.');
      setSummary(null);
      console.warn('Credentials missing for fetchLatest');
      return;
    }

    setStatusMsg('Fetching latest summary…');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/summary/', {
        headers: { 'Authorization': 'Basic ' + btoa(`${useCreds.username}:${useCreds.password}`) }
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { data = text; }
      console.log('SUMMARY fetch', res.status, data);
      if (!res.ok) {
        setSummary(null);
        setStatusMsg(`Failed to fetch summary (status ${res.status})`);
        return;
      }
      setSummary(data);
      setStatusMsg('Latest summary loaded.');
    } catch (e) {
      console.error('Failed to fetch summary', e);
      setSummary(null);
      setStatusMsg('Network or CORS error while fetching summary.');
    }
  };

  useEffect(() => {
    // Try once on load if creds present in state
    if (auth.username && auth.password) fetchLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: 'Inter, system-ui, Arial', maxWidth: 900 }}>
      <h2 style={{ marginBottom: 8 }}>Chemical Equipment Parameter Visualizer</h2>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div>
          <input
            placeholder="username"
            value={auth.username}
            onChange={(e) => setAuth({ ...auth, username: e.target.value })}
            style={{ padding: 8, marginRight: 6 }}
          />
          <input
            placeholder="password"
            type="password"
            value={auth.password}
            onChange={(e) => setAuth({ ...auth, password: e.target.value })}
            style={{ padding: 8 }}
          />
        </div>
        <div>
          <button onClick={() => fetchLatest()} style={{ padding: '8px 12px' }}>
            Fetch Summary
          </button>
        </div>
        <div style={{ color: '#666', marginLeft: 8 }}>{statusMsg}</div>
      </div>

      {/* Pass current auth to UploadForm. onUploaded receives upload response */}
      <UploadForm
        onUploaded={(uploadRes) => {
          console.log('onUploaded called', uploadRes);
          // After upload, fetch latest summary using current UI credentials
          fetchLatest();
        }}
        auth={auth}
      />

      <div style={{ marginTop: 24 }}>
        <h3>Latest summary</h3>
        {summary ? (
          <div style={{ background: '#fafafa', padding: 12, borderRadius: 6 }}>
            <div><strong>Name:</strong> {summary.name}</div>
            <div><strong>Uploaded at:</strong> {new Date(summary.uploaded_at).toLocaleString()}</div>
            <div style={{ marginTop: 8 }}>
              <strong>Total count:</strong> {summary.summary?.total_count ?? '—'}
            </div>
            <div style={{ marginTop: 8 }}>
              <strong>Averages:</strong>
              <pre style={{ background: '#fff', padding: 8, borderRadius: 4 }}>
{JSON.stringify(summary.summary?.averages ?? {}, null, 2)}
              </pre>
            </div>
            <div style={{ marginTop: 8 }}>
              <strong>Type distribution:</strong>
              <pre style={{ background: '#fff', padding: 8, borderRadius: 4 }}>
{JSON.stringify(summary.summary?.type_distribution ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div style={{ color: '#666' }}>No dataset loaded yet. Upload one or fetch summary.</div>
        )}
      </div>
    </div>
  );
}
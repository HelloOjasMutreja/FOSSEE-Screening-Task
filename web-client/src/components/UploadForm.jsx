// src/components/UploadForm.jsx
import React, { useState } from 'react';

export default function UploadForm({ onUploaded, auth }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!file) return alert('Choose a CSV first.');
    if (!auth?.username || !auth?.password) return alert('Enter username and password in the top inputs before uploading.');

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const username = auth.username;
      const password = auth.password;

      const res = await fetch('http://127.0.0.1:8000/api/upload/', {
        method: 'POST',
        body: fd,
        headers: { 'Authorization': 'Basic ' + btoa(`${username}:${password}`) }
      });

      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch (e) { body = text; }
      console.log('UPLOAD response', res.status, body);

      if (!res.ok) {
        // surface server message if present
        const msg = (typeof body === 'object') ? JSON.stringify(body) : body;
        throw new Error(`Upload failed (${res.status}): ${msg}`);
      }

      alert('Upload succeeded');
      onUploaded && onUploaded(body);
    } catch (e) {
      console.error('Upload error detail:', e);
      alert('Upload error: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, maxWidth: 560 }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Upload CSV</div>
      <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
      <div style={{ marginTop: 10 }}>
        <button onClick={upload} disabled={busy} style={{ padding: '8px 12px' }}>
          {busy ? 'Uploading…' : 'Upload to Backend'}
        </button>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
        Make sure you enter your username/password in the top inputs (BasicAuth).
      </div>
    </div>
  );
}
// src/components/UploadForm.jsx
import React, { useState } from 'react';

export default function UploadForm({ onUploaded, auth }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvName, setCsvName] = useState('');
  const [csvError, setCsvError] = useState('');

  const parseCsvForPreview = (fileObj) => {
    if (!fileObj) {
      setCsvPreview([]);
      setCsvName('');
      return;
    }

    setCsvError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result || '';
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

      if (!lines.length) {
        setCsvPreview([]);
        setCsvError('File appears to be empty.');
        return;
      }

      const rows = lines.map((line) => line.split(','));
      setCsvPreview(rows.slice(0, 25)); // preview first 25 lines
      setCsvName(fileObj.name);
    };
    reader.onerror = () => {
      setCsvError('Could not read file.');
    };
    reader.readAsText(fileObj);
  };

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    parseCsvForPreview(f || null);
  };

  const upload = async () => {
    if (!file) {
      alert('Choose a CSV first.');
      return;
    }
    if (!auth?.username || !auth?.password) {
      alert('Enter username and password first.');
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const username = auth.username;
      const password = auth.password;

      const res = await fetch('http://127.0.0.1:8000/api/upload/', {
        method: 'POST',
        body: fd,
        headers: {
          Authorization: 'Basic ' + btoa(`${username}:${password}`),
        },
      });

      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch (e) {
        body = text;
      }

      console.log('UPLOAD response', res.status, body);

      if (!res.ok) {
        const msg = typeof body === 'object' ? JSON.stringify(body) : body;
        throw new Error(`Upload failed (${res.status}): ${msg}`);
      }

      onUploaded && onUploaded(body);
    } catch (e) {
      console.error('Upload error detail:', e);
      alert('Upload error: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card upload-card">
      <div className="card-header">
        <div className="card-title">1 · Upload CSV</div>
        <p className="card-subtitle">
          Choose a CSV to analyze. A quick preview will appear below.
        </p>
      </div>

      <div className="upload-controls">
        <label className="file-input-label">
          <span className="file-input-button">Select CSV</span>
          <input
            type="file"
            accept=".csv"
            onChange={onFileChange}
            className="file-input-hidden"
          />
        </label>

        <button
          className="btn btn-primary"
          onClick={upload}
          disabled={busy || !file}
        >
          {busy ? 'Uploading…' : 'Upload to Backend'}
        </button>
      </div>

      <div className="upload-meta">
        <div className="upload-file-name">
          {csvName ? (
            <>
              <span className="dot dot-success" /> {csvName}
            </>
          ) : (
            <>
              <span className="dot" /> No file selected
            </>
          )}
        </div>
        <div className="upload-hint">
          Uses BasicAuth with the username/password you logged in with.
        </div>
      </div>

      {csvError && <div className="alert alert-error">{csvError}</div>}

      {csvPreview.length > 0 && (
        <div className="csv-preview">
          <div className="csv-preview-header">
            CSV preview <span>(showing first {csvPreview.length} rows)</span>
          </div>
          <div className="csv-preview-table-wrapper">
            <table className="csv-preview-table">
              <thead>
                <tr>
                  {csvPreview[0].map((cell, idx) => (
                    <th key={idx}>{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvPreview.slice(1).map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
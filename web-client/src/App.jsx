import React, { useState, useEffect, useRef } from 'react';
import UploadForm from './components/UploadForm';
import './App.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function App() {
  const [auth, setAuth] = useState({ username: '', password: '' });
  const [summary, setSummary] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(true);
  const [authError, setAuthError] = useState('');
  const summaryRef = useRef(null);

  // Fetch latest summary
  const fetchLatest = async (creds = null) => {
    const useCreds = creds ?? auth;
    if (!useCreds.username || !useCreds.password) {
      setStatusMsg('Enter username/password and press “Summarize & Visualize”.');
      setSummary(null);
      return;
    }

    setStatusMsg('Fetching latest summary…');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/summary/', {
        headers: {
          Authorization: 'Basic ' + btoa(`${useCreds.username}:${useCreds.password}`),
        },
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

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
    if (auth.username && auth.password) {
      fetchLatest(auth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAuthSubmit = () => {
    if (!auth.username || !auth.password) {
      setAuthError('Please enter both username and password.');
      return;
    }
    setAuthError('');
    setShowAuthModal(false);
    fetchLatest(auth);
  };

  // --- Data prep for charts & insights --------------------------------------
  const averages = summary?.summary?.averages || {};
  const typeDist = summary?.summary?.type_distribution || {};

  const avgEntries = Object.entries(averages);
  const numericAvgEntries = avgEntries.map(([k, v]) => [k, Number(v) || 0]);
  const maxAvg = numericAvgEntries.length
    ? Math.max(...numericAvgEntries.map(([, v]) => v))
    : 0;

  const typeEntries = Object.entries(typeDist);
  const totalTypes = typeEntries.reduce(
    (sum, [, v]) => sum + (Number(v) || 0),
    0
  );

  // Pie segments
  const pieSegments = (() => {
    if (!totalTypes || !typeEntries.length) return [];
    const cx = 50;
    const cy = 50;
    const r = 40;
    let startAngle = 0;

    return typeEntries.map(([key, value], idx) => {
      const numeric = Number(value) || 0;
      const sliceAngle = (numeric / totalTypes) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      const x1 = cx + r * Math.cos(startAngle - Math.PI / 2);
      const y1 = cy + r * Math.sin(startAngle - Math.PI / 2);
      const x2 = cx + r * Math.cos(endAngle - Math.PI / 2);
      const y2 = cy + r * Math.sin(endAngle - Math.PI / 2);

      const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
      const pathData = [
        `M ${cx} ${cy}`,
        `L ${x1} ${y1}`,
        `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z',
      ].join(' ');

      startAngle = endAngle;
      return { key, idx, pathData };
    });
  })();

  // Quick insights
  const sortedAvgDesc = [...numericAvgEntries].sort((a, b) => b[1] - a[1]);
  const topAvg = sortedAvgDesc[0];
  const bottomAvg = sortedAvgDesc[sortedAvgDesc.length - 1];

  const sortedTypesDesc = [...typeEntries].sort(
    (a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0)
  );
  const dominantType = sortedTypesDesc[0];

  // --- PDF export ------------------------------------------------------------
  const handleDownloadPdf = async () => {
    if (!summary) {
      alert('No summary available to export.');
      return;
    }
    if (!summaryRef.current) {
      alert('Nothing to export yet. Try summarizing first.');
      return;
    }

    try {
      const element = summaryRef.current;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#F3F4F6',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const ratio = Math.min(
        pageWidth / canvas.width,
        pageHeight / canvas.height
      );

      const imgWidth = canvas.width * ratio;
      const imgHeight = canvas.height * ratio;

      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      pdf.save(`${summary.name || 'chemical-summary'}.pdf`);
    } catch (err) {
      console.error('PDF export error', err);
      alert('Failed to generate PDF. Check the console for details.');
    }
  };

  return (
    <div className="app-root">
      {/* Auth modal overlay */}
      {showAuthModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>Sign in to continue</h2>
              <p>
                Use your BasicAuth credentials for the API. You can change them later
                from the top bar.
              </p>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label className="field-label">Username</label>
                <input
                  className="text-input"
                  placeholder="enter username"
                  value={auth.username}
                  onChange={(e) => setAuth({ ...auth, username: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Password</label>
                <input
                  className="text-input"
                  type="password"
                  placeholder="enter password"
                  value={auth.password}
                  onChange={(e) => setAuth({ ...auth, password: e.target.value })}
                />
              </div>
              {authError && <div className="alert alert-error">{authError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleAuthSubmit}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="app-shell">
        <header className="app-header">
          <div className="app-title-block">
            <h1 className="app-title">Chemical Equipment Parameter Visualizer</h1>
            <p className="app-subtitle">
              Upload CSV → Summarize → View metrics & distributions at a glance.
            </p>
          </div>

          <div className="app-user-block">
            {auth.username ? (
              <div className="user-pill">
                <span className="user-dot" />
                <span className="user-name">Logged in as&nbsp;</span>
                <strong>{auth.username}</strong>
                <button
                  className="pill-button"
                  onClick={() => setShowAuthModal(true)}
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                className="btn btn-outline"
                onClick={() => setShowAuthModal(true)}
              >
                Sign in
              </button>
            )}
          </div>
        </header>

        <main className="app-main">
          <div className="layout-grid">
            <section className="panel">
              <UploadForm
                auth={auth}
                onUploaded={(uploadRes) => {
                  console.log('onUploaded called', uploadRes);
                  fetchLatest(auth);
                }}
              />

              {summary && (
                <details className="raw-json raw-json-left">
                  <summary>Raw summary JSON</summary>
                  <pre>{JSON.stringify(summary, null, 2)}</pre>
                </details>
              )}
            </section>
            <section className="panel">
              <div className="card summary-card">
                <div className="card-header summary-header">
                  <div>
                    <div className="card-title">2 · Summarize & Visualize</div>
                    <p className="card-subtitle">
                      Fetch the latest processed summary from the backend and
                      visualize it.
                    </p>
                  </div>
                  <div className="summary-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => fetchLatest()}
                    >
                      Summarize & Visualize
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={handleDownloadPdf}
                      disabled={!summary}
                    >
                      Download PDF
                    </button>
                  </div>
                </div>

                <div className="status-text">{statusMsg}</div>

                {summary ? (
                  <>
                    {/* Everything inside this wrapper goes into the PDF */}
                    <div className="summary-content" ref={summaryRef}>
                      <div className="summary-meta">
                        <div>
                          <span className="meta-label">Dataset name</span>
                          <div className="meta-value">
                            {summary.name || '—'}
                          </div>
                        </div>
                        <div>
                          <span className="meta-label">Uploaded at</span>
                          <div className="meta-value">
                            {summary.uploaded_at
                              ? new Date(
                                  summary.uploaded_at
                                ).toLocaleString()
                              : '—'}
                          </div>
                        </div>
                        <div>
                          <span className="meta-label">Total count</span>
                          <div className="meta-value">
                            {summary.summary?.total_count ?? '—'}
                          </div>
                        </div>
                      </div>

                      {/* Quick insights card */}
                      <div className="insights-card">
                        <div className="insights-title">Quick insights</div>
                        <div className="insights-grid">
                          <div className="insight-item">
                            <div className="insight-label">Dominant type</div>
                            <div className="insight-value">
                              {dominantType ? (
                                <>
                                  {dominantType[0]}{' '}
                                  <span className="insight-sub">
                                    (
                                    {totalTypes
                                      ? (
                                          ((Number(dominantType[1]) || 0) /
                                            totalTypes) *
                                          100
                                        ).toFixed(1)
                                      : '0'}
                                    % of entries)
                                  </span>
                                </>
                              ) : (
                                '—'
                              )}
                            </div>
                          </div>

                          <div className="insight-item">
                            <div className="insight-label">Highest average</div>
                            <div className="insight-value">
                              {topAvg ? (
                                <>
                                  {topAvg[0]}{' '}
                                  <span className="insight-sub">
                                    ({topAvg[1].toFixed(2)})
                                  </span>
                                </>
                              ) : (
                                '—'
                              )}
                            </div>
                          </div>

                          <div className="insight-item">
                            <div className="insight-label">Lowest average</div>
                            <div className="insight-value">
                              {bottomAvg ? (
                                <>
                                  {bottomAvg[0]}{' '}
                                  <span className="insight-sub">
                                    ({bottomAvg[1].toFixed(2)})
                                  </span>
                                </>
                              ) : (
                                '—'
                              )}
                            </div>
                          </div>

                          <div className="insight-item">
                            <div className="insight-label">Type richness</div>
                            <div className="insight-value">
                              {typeEntries.length || '—'}{' '}
                              <span className="insight-sub">
                                distinct equipment types
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Charts (now full-width, each chart its own row) */}
                      <div className="charts-grid">
                        {/* Averages bar chart */}
                        <div className="chart-card">
                          <div className="chart-title">Parameter Averages</div>
                          {numericAvgEntries.length === 0 ? (
                            <div className="chart-empty">
                              No averages available.
                            </div>
                          ) : (
                            <div className="bar-chart">
                              {numericAvgEntries.map(([key, numeric]) => {
                                const percent = maxAvg
                                  ? (numeric / maxAvg) * 100
                                  : 0;
                                return (
                                  <div className="bar-row" key={key}>
                                    <div className="bar-label">{key}</div>
                                    <div className="bar-track">
                                      <div
                                        className="bar-fill"
                                        style={{ width: `${percent}%` }}
                                      />
                                    </div>
                                    <div className="bar-value">
                                      {numeric.toFixed(2)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Pie chart alone */}
                        <div className="chart-card">
                          <div className="chart-title">Type Distribution – Pie</div>
                          {typeEntries.length === 0 ? (
                            <div className="chart-empty">
                              No type distribution available.
                            </div>
                          ) : (
                            <div className="pie-chart-container">
                              <svg viewBox="0 0 100 100" className="pie-chart">
                                {pieSegments.map((seg) => (
                                  <path
                                    key={seg.key}
                                    d={seg.pathData}
                                    className={`pie-segment seg-${seg.idx % 6}`}
                                  />
                                ))}
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="24"
                                  fill="#F9FAFB"
                                />
                              </svg>
                              <div className="pie-center-label">
                                <div className="pie-total">{totalTypes}</div>
                                <div className="pie-caption">total</div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Legend as its own block */}
                        <div className="chart-card legend-card">
                          <div className="chart-title">
                            Type Distribution – Legend
                          </div>
                          {typeEntries.length === 0 ? (
                            <div className="chart-empty">
                              No type distribution available.
                            </div>
                          ) : (
                            <div className="stacked-legend">
                              {typeEntries.map(([key, value], idx) => {
                                const numeric = Number(value) || 0;
                                const percent = totalTypes
                                  ? (numeric / totalTypes) * 100
                                  : 0;
                                return (
                                  <div className="legend-item" key={key}>
                                    <span
                                      className={`legend-swatch seg-${idx % 6}`}
                                    />
                                    <span className="legend-label">{key}</span>
                                    <span className="legend-value">
                                      {numeric} ({percent.toFixed(1)}%)
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    No dataset loaded yet. Upload a CSV, then click
                    “Summarize & Visualize”.
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
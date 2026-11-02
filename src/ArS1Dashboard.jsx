import { useEffect, useRef, useState } from 'react';

function normalizeApiOrigin(value) {
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('Server address HTTPS se shuru hona chahiye.');
  }
  return url.origin;
}

export default function ArS1Dashboard({ isAdmin = false }) {
  const [endpoint, setEndpoint] = useState(import.meta.env.VITE_DASHBOARD_API_URL || '');
  const [token, setToken] = useState('');
  const [statusDraft, setStatusDraft] = useState('Online');
  const [messageDraft, setMessageDraft] = useState('');
  const [state, setState] = useState(null);
  const [status, setStatus] = useState('Disconnected');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const socketRef = useRef(null);

  useEffect(() => () => socketRef.current?.close(1000, 'Screen closed'), []);

  async function connect(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    socketRef.current?.close(1000, 'Reconnect');
    setState(null);
    try {
      const origin = normalizeApiOrigin(endpoint);
      const response = await fetch(origin + '/api/status', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Status request fail hua (' + response.status + ').');
      setState(await response.json());

      const wsUrl = new URL('/ws', origin);
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      if (isAdmin && token.trim()) wsUrl.searchParams.set('token', token.trim());
      const socket = new WebSocket(wsUrl.toString());
      socketRef.current = socket;
      setStatus('Connecting…');
      socket.onopen = () => setStatus('Connected');
      socket.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data);
          if (payload?.data && (payload.type === 'INIT_STATE' || payload.type === 'STATE_UPDATE')) {
            setState(payload.data);
            setStatus('Connected · live updates');
          }
        } catch {
          setError('Server ka response JSON format mein nahi hai.');
        }
      };
      socket.onerror = () => setError('Live connection mein error aaya. Server URL aur access settings check karein.');
      socket.onclose = () => setStatus('Disconnected');
    } catch (e) {
      setStatus('Disconnected');
      setError(e?.message || 'Server se connect nahi ho saka.');
    }
  }

  async function publishStatus(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const origin = normalizeApiOrigin(endpoint);
      if (!token.trim()) throw new Error('Admin access token enter karein.');
      const response = await fetch(origin + '/api/status', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token.trim(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ status: statusDraft.trim(), message: messageDraft.trim() }),
      });
      if (!response.ok) throw new Error('Update fail hua (' + response.status + '). Token aur server check karein.');
      const result = await response.json();
      setState(result.data);
      setNotice('Status server par update ho gaya.');
    } catch (e) {
      setError(e?.message || 'Status update nahi ho saka.');
    }
  }

  function disconnect() {
    socketRef.current?.close(1000, 'User disconnected');
    socketRef.current = null;
    setStatus('Disconnected');
  }

  return <section className="panel">
    <div className="split">
      <div><p className="eyebrow">AR S1 · LIVE SERVER</p><h3>Server Connection</h3>
      <p className="muted">{isAdmin ? 'Admin server status publish aur connection check kar sakta hai.' : 'Server ka live connection status dekhein.'}</p></div>
      <span className="pill">{status}</span>
    </div>
    <form className="form" onSubmit={connect}>
      <label>HTTPS Server URL
        <input type="url" required value={endpoint} onChange={e => setEndpoint(e.target.value)}
          placeholder="https://your-server.example" autoComplete="url" />
      </label>
      {isAdmin && <label>Admin access token
        <input type="password" required value={token} onChange={e => setToken(e.target.value)}
          placeholder="Server admin token" autoComplete="off" />
      </label>}
      <div className="tool-actions">
        <button className="primary" type="submit">Connect</button>
        <button className="secondary" type="button" onClick={disconnect}>Disconnect</button>
      </div>
    </form>
    {isAdmin && <form className="form" onSubmit={publishStatus}>
      <h3>Publish live status</h3>
      <label>Status<input required maxLength="80" value={statusDraft} onChange={e => setStatusDraft(e.target.value)} /></label>
      <label>Message<textarea rows="3" maxLength="500" value={messageDraft} onChange={e => setMessageDraft(e.target.value)} /></label>
      <button className="primary" type="submit">Publish to Member app</button>
    </form>}
    {error && <div className="alert error">{error}</div>}
    {notice && <div className="alert">{notice}</div>}
    {state && <div className="tool-result">
      <h3>Latest server state</h3>
      <p><b>Status:</b> {state.status || 'Ready'}</p>
      {state.message && <p><b>Message:</b> {state.message}</p>}
      <p><b>Last updated:</b> {state.updated_at || state.last_updated || 'Not provided'}</p>
      {Number.isFinite(Number(state.countdown_seconds)) &&
        <p><b>Countdown:</b> {Number(state.countdown_seconds)} seconds</p>}
      <p className="muted">Member app receives updates while the live connection is open.</p>
    </div>}
    <p className="dataset-note">Use the deployed HTTPS address. Admin token is entered at runtime and is not embedded in the APK.</p>
  </section>;
}

import { useEffect, useRef, useState } from 'react';

function normalizeApiOrigin(value) {
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('Server address HTTPS se shuru hona chahiye.');
  }
  return url.origin;
}

export default function ArS1Dashboard() {
  const [endpoint, setEndpoint] = useState(import.meta.env.VITE_DASHBOARD_API_URL || '');
  const [token, setToken] = useState('');
  const [state, setState] = useState(null);
  const [status, setStatus] = useState('Disconnected');
  const [error, setError] = useState('');
  const socketRef = useRef(null);

  useEffect(() => () => socketRef.current?.close(1000, 'Screen closed'), []);

  async function connect(event) {
    event.preventDefault();
    setError('');
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
      if (token.trim()) wsUrl.searchParams.set('token', token.trim());
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
      socket.onerror = () => setError('Live connection mein error aaya. Server URL aur access token check karein.');
      socket.onclose = () => setStatus('Disconnected');
    } catch (e) {
      setStatus('Disconnected');
      setError(e?.message || 'Server se connect nahi ho saka.');
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
      <p className="muted">Admin server ka current connection status yahan dekhein.</p></div>
      <span className="pill">{status}</span>
    </div>
    <form className="form" onSubmit={connect}>
      <label>HTTPS Server URL
        <input type="url" required value={endpoint} onChange={e => setEndpoint(e.target.value)}
          placeholder="https://your-server.example" autoComplete="url" />
      </label>
      <label>WebSocket access token
        <input type="password" value={token} onChange={e => setToken(e.target.value)}
          placeholder="If your server requires a token" autoComplete="off" />
      </label>
      <div className="tool-actions">
        <button className="primary" type="submit">Connect</button>
        <button className="secondary" type="button" onClick={disconnect}>Disconnect</button>
      </div>
    </form>
    {error && <div className="alert error">{error}</div>}
    {state && <div className="tool-result">
      <h3>Latest server state</h3>
      <p><b>Last updated:</b> {state.last_updated || state.updated_at || 'Not provided'}</p>
      {Number.isFinite(Number(state.countdown_seconds)) &&
        <p><b>Countdown:</b> {Number(state.countdown_seconds)} seconds</p>}
      <p className="muted">Initial status loaded. Live state refreshes while the connection is open.</p>
    </div>}
    <p className="dataset-note">Connection address must be configured for the deployed service. Do not share private access tokens.</p>
  </section>;
}

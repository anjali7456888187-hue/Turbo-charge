import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const MODELS = ['ARS1', 'AR 2.0', 'AR Hybrid', 'AR Opus', 'AR Management'];

export default function ArS1Dashboard() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    supabase.from('tc_app_settings').select('value,updated_at').eq('key','server_api_config').eq('is_public',true).maybeSingle()
      .then(({data,error}) => {
        if (!active) return;
        if (error) setError('Server configuration could not be loaded.');
        else setConfig(data?.value || null);
        setLoading(false);
      }).catch(() => { if (active) { setError('Could not reach configuration service.'); setLoading(false); } });
    return () => { active = false; };
  }, []);

  const base = config?.base_url || '';
  const mappings = config?.models || {};
  return (
    <section className="panel" aria-label="Server connection">
      <div className="split"><div><p className="eyebrow">TURBO CHARGE</p><h3>Server / API</h3><p className="muted">Configured endpoints for app services.</p></div></div>
      {loading ? <p className="muted">Loading server settings…</p> : error ? <div className="alert error">{error}</div> : !base ? <div className="alert">Server URL has not been configured by Admin yet.</div> : <div className="row"><small>Main server URL</small><strong className="endpoint-value">{base}</strong><span className="pill">Configured · connection not verified</span></div>}
      <div className="admin-stats">{MODELS.map(name => <article key={name}><small>{name}</small><strong>{mappings[name] || (base ? 'Uses main server' : 'Not configured')}</strong></article>)}</div>
      <p className="muted">Endpoint configuration alone does not prove the server is online. Connection status will only be confirmed after a real health-check succeeds.</p>
    </section>
  );
}

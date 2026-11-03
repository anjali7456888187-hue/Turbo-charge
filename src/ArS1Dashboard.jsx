const MODELS = ['ARS1', 'AR 2.0', 'AR Hybrid', 'AR Opus', 'AR Management'];

export default function ArS1Dashboard() {
  return (
    <section className="panel" aria-label="Model catalog">
      <div className="split">
        <div>
          <p className="eyebrow">TURBO CHARGE</p>
          <h3>Model Catalog</h3>
          <p className="muted">Available model names</p>
        </div>
      </div>
      <div className="admin-stats">
        {MODELS.map((name) => (
          <article key={name}>
            <small>Model</small>
            <strong>{name}</strong>
          </article>
        ))}
      </div>
      <p className="muted">Model endpoints and server configuration are managed separately by the administrator.</p>
    </section>
  );
}

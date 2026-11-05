import { tokenomics } from "../lib/copy";

export default function Tokenomics() {
  return (
    <section id="tokenomics" className="tokenomics-section" aria-labelledby="tokenomics-title">
      <div className="pets-grid" aria-hidden="true" />
      <div className="pets-content">
        <h2 id="tokenomics-title" className="tokenomics-title">
          {tokenomics.header}
        </h2>
        <dl className="stat-list">
          {tokenomics.stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <dt>{stat.label}</dt>
              <dd>
                {stat.value.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <p className="tokenomics-closing">
          {tokenomics.closing.lead}
          <strong>{tokenomics.closing.accent}</strong>
        </p>
      </div>
    </section>
  );
}

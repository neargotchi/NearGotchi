import type { CSSProperties } from "react";

import { tokenomics } from "../lib/copy";

// Decorative sparkles around "burns.": fixed positions, varied timing so the twinkle looks random.
const sparkles: { id: string; tone: "white" | "ink" | "green" | "deep"; style: CSSProperties }[] = [
  { id: "a", tone: "white", style: { left: "10%", top: "8%", animationDuration: "2.2s", animationDelay: "0s" } },
  { id: "b", tone: "ink", style: { left: "93%", top: "58%", animationDuration: "1.8s", animationDelay: "0.7s" } },
  { id: "c", tone: "white", style: { left: "82%", top: "14%", animationDuration: "2.6s", animationDelay: "1.3s" } },
  { id: "d", tone: "green", style: { left: "-6%", top: "-34%", animationDuration: "3s", animationDelay: "0.4s" } },
  { id: "e", tone: "deep", style: { left: "101%", top: "-26%", animationDuration: "2s", animationDelay: "1s" } },
  { id: "f", tone: "green", style: { left: "38%", top: "-48%", animationDuration: "2.4s", animationDelay: "1.9s" } },
  { id: "g", tone: "deep", style: { left: "70%", top: "112%", animationDuration: "1.6s", animationDelay: "0.2s" } },
  { id: "h", tone: "green", style: { left: "-8%", top: "86%", animationDuration: "2.8s", animationDelay: "1.5s" } },
];

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
          <strong className="burns">
            {tokenomics.closing.accent}
            {sparkles.map((sparkle) => (
              <span
                key={sparkle.id}
                className={`sparkle sparkle-${sparkle.tone}`}
                aria-hidden="true"
                style={sparkle.style}
              />
            ))}
          </strong>
        </p>
      </div>
    </section>
  );
}

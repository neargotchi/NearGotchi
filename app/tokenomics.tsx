import Sparkles from "../components/Sparkles";
import Mascot from "../components/Mascot";
import { tokenomics, mascots } from "../lib/copy";

export default function Tokenomics() {
  return (
    <section id="tokenomics" className="tokenomics-section" aria-labelledby="tokenomics-title">
      <div className="pets-grid" aria-hidden="true" />
      <div className="pets-content">
        <div className="section-head">
          <h2 id="tokenomics-title" className="tokenomics-title">
            {tokenomics.header}
          </h2>
          <Mascot {...mascots.tokenomics} className="mascot-heading" />
        </div>
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
            <Sparkles
              count={3}
              colors={["#ffffff", "var(--ink)"]}
              area={[
                { x: [4, 14], y: [4, 20] },
                { x: [88, 94], y: [50, 64] },
                { x: [78, 86], y: [6, 18] },
              ]}
              seed="burns-on"
              duration={[1.6, 2.6]}
            />
            <Sparkles
              count={5}
              colors={["var(--green)", "var(--green-deep)"]}
              area={[
                { x: [-10, -2], y: [-40, -20] },
                { x: [96, 104], y: [-34, -18] },
                { x: [30, 50], y: [-52, -40] },
                { x: [60, 76], y: [108, 118] },
                { x: [-10, -4], y: [80, 94] },
              ]}
              seed="burns-around"
              duration={[2, 3]}
            />
          </strong>
        </p>
      </div>
    </section>
  );
}

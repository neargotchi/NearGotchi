import { fill, petPage } from "../../lib/copy";
import { PET_RULES, levelOf } from "../../lib/mocks";

function Meter({ label, value, warn }: { label: string; value: number; warn: boolean }) {
  const filled = Math.round(value / 10);
  return (
    <div
      className={warn ? "pet-meter is-warn" : "pet-meter"}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={fill(petPage.meters.valueText, { n: String(value) })}
    >
      <span className="pet-meter-label">{label}</span>
      <span className="pet-meter-bar">
        {Array.from({ length: 10 }, (_, index) => (
          <span key={index} className={index < filled ? "is-on" : undefined} />
        ))}
      </span>
      <span className="pet-meter-value">{value}</span>
    </div>
  );
}

/** Hunger + energy as 10-segment pixel meters, and the demo balance (null on testnet: payments are real testnet NEAR). */
export default function StatBars({ hunger, energy, balance }: { hunger: number; energy: number; balance: number | null }) {
  const h = levelOf(hunger);
  const e = levelOf(energy);
  return (
    <div className="pet-stats">
      <Meter label={petPage.meters.hunger} value={h} warn={h >= PET_RULES.hungryAt} />
      <Meter label={petPage.meters.energy} value={e} warn={false} />
      {balance === null ? null : <p className="pet-balance">{fill(petPage.balance, { n: String(balance) })}</p>}
    </div>
  );
}

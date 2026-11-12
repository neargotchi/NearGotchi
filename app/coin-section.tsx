import TitleSparkles from "../components/TitleSparkles";
import { coin } from "../lib/copy";

/**
 * $NEARGotchi: a small section under the numbers (task 076; nav link since task 088). One framed
 * card: the blurb (the "not financial advice" line lives in the footer), the shared pixel button
 * to nearly.trade (new tab)
 * and the token address as plain selectable text (no copy button component exists yet).
 */
export default function CoinSection() {
  return (
    <section id="coin" className="coin-section" aria-labelledby="coin-title">
      <div className="pets-grid" aria-hidden="true" />
      <div className="pets-content">
        <div className="section-head">
          <h2 id="coin-title" className="coin-title section-title-host">
            {coin.header}
            <TitleSparkles seed="title-coin" below />
          </h2>
        </div>
        <div className="coin-card">
          <p className="coin-text">{coin.body}</p>
          <a className="button button-primary" href={coin.cta.url} target="_blank" rel="noopener noreferrer">
            {coin.cta.label}
            <span className="visually-hidden"> {coin.newTab}</span>
            <span className="launch-arrow" aria-hidden="true" />
          </a>
          <p className="coin-address">
            <span className="visually-hidden">{coin.addressLabel}: </span>
            <span className="coin-address-id">{coin.address}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

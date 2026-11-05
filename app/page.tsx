import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="hero-shell">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-grid" aria-hidden="true" />

        <div className="hero-content">
          <div className="hero-copy">
            <h1 id="hero-title">
              your pet
              <br />
              lives
              <br />
              on near.
            </h1>
            <p className="hero-lede">
              mint it. feed it. dress it. talk to it. it thinks with near ai,
              and it eats tokens to do it.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/mint">
                mint your pet
              </Link>
              <a className="button button-secondary" href="#how-it-works">
                how it works <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>

          <div className="device-wrap">
            <Image
              className="device-logo"
              src="/logo-transparent.png"
              alt="NEARGOTCHI pixel pet device"
              width={1024}
              height={1024}
              priority
            />
          </div>
        </div>
      </section>
    </main>
  );
}

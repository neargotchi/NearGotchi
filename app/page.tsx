import Image from "next/image";
import Sparkles from "../components/Sparkles";
import PetCta from "./pet-cta";
import Faq from "./faq";
import HowItWorks from "./how-it-works";
import PetGallery from "./pet-gallery";
import Tokenomics from "./tokenomics";
import Wardrobe from "./wardrobe";

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
              on{" "}
              <span className="hero-near">
                near.
                <Sparkles
                  count={7}
                  colors={["var(--green)", "var(--sparkle-alt)"]}
                  area={[
                    { x: [-4, 8], y: [-30, -14] },
                    { x: [34, 46], y: [-36, -20] },
                    { x: [74, 86], y: [-28, -12] },
                    { x: [102, 110], y: [0, 20] },
                    { x: [104, 112], y: [56, 76] },
                    { x: [14, 26], y: [98, 110] },
                    { x: [60, 72], y: [100, 112] },
                  ]}
                  seed="hero-near"
                  size={25}
                />
              </span>
            </h1>
            <p className="hero-lede">
              mint it. feed it. dress it. talk to it. it thinks with near ai,
              and it eats tokens to do it.
            </p>
            <div className="hero-actions">
              <PetCta variant="hero">
                <Sparkles
                  count={5}
                  colors={["var(--green)", "var(--sparkle-alt)"]}
                  area={[
                    { x: [-8, 20], y: [-40, -10] },
                    { x: [80, 104], y: [-40, -10] },
                    { x: [100, 112], y: [20, 90] },
                  ]}
                  seed="hero-mint"
                  size={12}
                  mode="burst"
                />
              </PetCta>
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
            <span className="n-sweep" aria-hidden="true">
              <span className="n-sweep-box">
                <span />
              </span>
            </span>
            <Sparkles
              count={5}
              colors={["var(--green)", "var(--sparkle-alt)"]}
              area={[
                { x: [0, 10], y: [10, 40] },
                { x: [88, 98], y: [20, 60] },
                { x: [6, 14], y: [70, 90] },
                { x: [84, 94], y: [72, 92] },
                { x: [70, 80], y: [0, 6] },
              ]}
              seed="hero-egg"
              size={25}
              duration={[2.2, 3.4]}
            />
          </div>
        </div>
      </section>

      <PetGallery />
      <HowItWorks />
      <Wardrobe />
      <Tokenomics />
      <Faq />
    </main>
  );
}

import Image from "next/image";
import DropProgress from "../components/DropProgress";
import Sparkles from "../components/Sparkles";
import PetCta from "./pet-cta";
import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, pageMeta } from "../lib/site";
import { hero } from "../lib/copy";
import Faq from "./faq";
import HowItWorks from "./how-it-works";
import PetGallery from "./pet-gallery";
import Tokenomics from "./tokenomics";
import DropSection from "./drop-section";
import MeetYourGotchi from "./meet-your-gotchi";
import Wordmark from "./wordmark";

export const metadata: Metadata = pageMeta({
  path: "/",
  title: "NEARGOTCHI — your ai pet on near",
  description: SITE_DESCRIPTION,
});

export default function Home() {
  return (
    <main className="hero-shell">
      {/* Pixel scene (public/hero/*.png) behind a centred column: app/hero-header.css. */}
      <section id="home" className="hero" aria-labelledby="hero-title">
        {/* Twinkling pixel stars in the sky on both sides of the title and the egg. */}
        <Sparkles
          count={8}
          colors={["var(--green)", "var(--sparkle-alt)"]}
          area={[
            { x: [6, 13], y: [36, 44] },
            { x: [20, 27], y: [14, 22] },
            { x: [29, 35], y: [50, 58] },
            { x: [13, 19], y: [60, 66] },
            { x: [86, 93], y: [34, 44] },
            { x: [72, 79], y: [12, 20] },
            { x: [65, 71], y: [50, 58] },
            { x: [81, 87], y: [60, 66] },
          ]}
          seed="hero-sky"
          size={15}
          duration={[2.2, 3.6]}
          className="hero-sky"
        />
        {/* Phones: the sky set above would sit on the full-width copy; smaller stars in the side strips. */}
        <Sparkles
          count={6}
          colors={["var(--green)", "var(--sparkle-alt)"]}
          area={[
            { x: [3, 10], y: [30, 36] },
            { x: [90, 97], y: [30, 36] },
            { x: [4, 12], y: [44, 52] },
            { x: [88, 96], y: [44, 52] },
            { x: [40, 60], y: [12, 16] },
            { x: [3, 9], y: [62, 68] },
          ]}
          seed="hero-sky-mobile"
          size={10}
          duration={[2.2, 3.6]}
          className="hero-sky-mobile"
        />
        <div className="hero-content">
          <h1 id="hero-title">
            {/* Title sparkles: the 7 of main's "near." title, around the wordmark (none below it: subtitle). */}
            <span className="hero-title-host">
              <Wordmark text={SITE_NAME} />
              <Sparkles
                count={7}
                colors={["var(--green)", "var(--sparkle-alt)"]}
                area={[
                  { x: [-7, -3], y: [-20, 20] },
                  { x: [6, 16], y: [-75, -45] },
                  { x: [30, 40], y: [-90, -60] },
                  { x: [56, 66], y: [-85, -55] },
                  { x: [82, 92], y: [-75, -45] },
                  { x: [102, 106], y: [-20, 20] },
                  { x: [96, 101], y: [-70, -45] },
                ]}
                seed="hero-near"
                size={25}
              />
            </span>
          </h1>
          <p className="hero-subtitle">{hero.subtitle}</p>

          <div className="device-wrap">
            <Image
              className="device-logo"
              src="/logo-transparent.png"
              alt="NEARGOTCHI pixel pet device"
              width={1024}
              height={1024}
              sizes="(max-width: 768px) 48vw, 465px"
              priority
            />
            {/* Light sweep over the N strokes (globals.css .n-sweep; off with reduced motion). */}
            <span className="n-sweep" aria-hidden="true">
              <span className="n-sweep-box">
                <span />
              </span>
            </span>
            <Sparkles
              count={5}
              colors={["var(--green)", "var(--sparkle-alt)"]}
              area={[
                { x: [8, 16], y: [0, 10] },
                { x: [80, 88], y: [2, 12] },
                { x: [0, 8], y: [64, 78] },
                { x: [90, 98], y: [66, 80] },
                { x: [70, 80], y: [0, 6] },
              ]}
              seed="hero-egg"
              size={25}
              duration={[2.2, 3.4]}
            />
          </div>

          <p className="hero-lede">{hero.lede}</p>
          <div className="hero-actions">
            <PetCta variant="hero" />
            <a className="button button-secondary" href="#how-it-works">
              {hero.learnMore}
            </a>
          </div>
          {/* "x / 300 hatched": live from the contract on testnet, this browser's count in the demo. */}
          <DropProgress className="hero-progress" />

          <a className="hero-scroll" href="#pets" aria-label={hero.scroll}>
            <span aria-hidden="true" />
          </a>
        </div>
      </section>

      <PetGallery />
      <HowItWorks />
      <MeetYourGotchi />
      <DropSection />
      <Tokenomics />
      <Faq />
    </main>
  );
}

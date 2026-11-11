import Image from "next/image";
import Link from "next/link";

import { header } from "../lib/copy";
import Sparkles from "../components/Sparkles";
import MobileMenu from "./mobile-menu";
import PetCta from "./pet-cta";
import SectionNav from "./section-nav";
import SocialX from "./social-x";
import ThemeToggle from "./theme-toggle";
import WalletMenu from "./wallet-menu";
import Wordmark from "./wordmark";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-brand" href="/">
          <Image src="/logo-transparent.png" alt="" width={40} height={40} />
          <span className="site-brand-name">
            <Wordmark text={header.brand} />
          </span>
        </Link>
        <SectionNav className="site-nav" />
        <div className="site-actions">
          <ThemeToggle />
          <SocialX />
          <WalletMenu />
          <PetCta variant="header">
            <Sparkles
              count={4}
              colors={["var(--green)", "var(--sparkle-alt)"]}
              area={[
                { x: [-8, 20], y: [-45, -15] },
                { x: [80, 100], y: [100, 125] },
              ]}
              seed="header-mint"
              size={9}
              mode="burst"
            />
          </PetCta>
        </div>
        <ThemeToggle className="header-theme-toggle" />
        <SocialX className="header-social-x" />
        <MobileMenu />
      </div>
    </header>
  );
}

import Image from "next/image";
import Link from "next/link";

import { header, navHref } from "../lib/copy";
import Sparkles from "../components/Sparkles";
import MobileMenu from "./mobile-menu";
import PetCta from "./pet-cta";
import ThemeToggle from "./theme-toggle";
import WalletButton from "./wallet-button";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-brand" href="/">
          <Image src="/logo-transparent.png" alt="" width={40} height={40} />
          <span className="site-brand-name">{header.brand}</span>
        </Link>
        <nav className="site-nav" aria-label="sections">
          <ul>
            {header.nav.map((link) => (
              <li key={link.href}>
                <a href={navHref(link.href)}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-actions">
          <WalletButton />
          <ThemeToggle />
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
        <MobileMenu />
      </div>
    </header>
  );
}

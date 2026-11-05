import Image from "next/image";
import Link from "next/link";

import { header } from "../lib/copy";
import Sparkles from "../components/Sparkles";
import WalletButton from "./wallet-button";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-brand" href="/">
          <Image src="/logo-transparent.png" alt="" width={40} height={40} />
          {header.brand}
        </Link>
        <nav className="site-nav" aria-label="sections">
          <ul>
            {header.nav.map((link) => (
              <li key={link.href}>
                <a href={`/${link.href}`}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-actions">
          <WalletButton />
          <Link className="button button-primary" href={header.cta.href}>
            {header.cta.label}
            <Sparkles
              count={4}
              colors={["var(--green)", "var(--green-deep)"]}
              area={[
                { x: [-8, 20], y: [-45, -15] },
                { x: [80, 100], y: [100, 125] },
              ]}
              seed="header-mint"
              size={9}
              mode="burst"
            />
          </Link>
        </div>
      </div>
    </header>
  );
}

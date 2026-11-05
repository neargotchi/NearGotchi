import Image from "next/image";
import Link from "next/link";

import { header } from "../lib/copy";
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
          </Link>
        </div>
      </div>
    </header>
  );
}

import Image from "next/image";
import Link from "next/link";

import { header } from "../lib/copy";
import MobileMenu from "./mobile-menu";
import PetCta from "./pet-cta";
import SectionNav from "./section-nav";
import SocialX from "./social-x";
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
          <SocialX />
          <WalletMenu />
          <PetCta variant="header" />
        </div>
        <SocialX className="header-social-x" />
        <MobileMenu />
      </div>
    </header>
  );
}

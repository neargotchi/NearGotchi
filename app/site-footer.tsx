import { footer } from "../lib/copy";

export default function SiteFooter() {
  const socials = footer.socials.filter((link) => link.url !== null);

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-legal">
          <p>{footer.disclaimer}</p>
          <p>{footer.privacy}</p>
          {footer.addresses.map((item) => (
            <p key={item.account} className="site-footer-address">
              {item.label}:{" "}
              <a href={`https://nearblocks.io/address/${item.account}`} rel="noopener noreferrer" target="_blank" translate="no">
                {item.account}
              </a>
            </p>
          ))}
        </div>
        <div className="site-footer-meta">
          <p>{footer.copyright}</p>
          <p>{footer.builtOn}</p>
          {footer.links.map((link) => (
            <p key={link.label}>
              <a href={link.url} rel="noopener noreferrer" target="_blank">
                {link.label}
              </a>
            </p>
          ))}
          {socials.map((link) => (
            <p key={link.label}>
              <a href={link.url!} rel="noopener noreferrer" target="_blank">
                {link.label}
              </a>
            </p>
          ))}
        </div>
      </div>
    </footer>
  );
}

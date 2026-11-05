import { footer } from "../lib/copy";

export default function SiteFooter() {
  const socials = footer.socials.filter((link) => link.url !== null);

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>{footer.disclaimer}</p>
        <div className="site-footer-meta">
          <p>{footer.copyright}</p>
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

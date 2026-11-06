import Sparkles from "../components/Sparkles";
import { footer } from "../lib/copy";

export default function SiteFooter() {
  const socials = footer.socials.filter((link) => link.url !== null);

  return (
    <footer className="site-footer">
      <Sparkles
        count={4}
        colors={["var(--green)", "var(--sparkle-alt)"]}
        area={[
          { x: [50, 60], y: [20, 75] },
          { x: [64, 74], y: [20, 75] },
          { x: [4, 9], y: [20, 75] },
          { x: [93, 97], y: [20, 75] },
        ]}
        seed="footer"
        size={12}
        duration={[3, 4.5]}
      />
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

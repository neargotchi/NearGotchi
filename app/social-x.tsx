import { header } from "../lib/copy";

const X_PATH =
  "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932 6.064-6.933zM17.61 20.644h2.039L6.486 3.24H4.298L17.61 20.644z";

/** X profile as a square pixel-frame button (header actions on desktop, header bar on mobile). */
export default function SocialX({ className }: { className?: string }) {
  return (
    <a
      className={className ? `social-x ${className}` : "social-x"}
      href={header.x.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={header.x.label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={X_PATH} fill="currentColor" />
      </svg>
    </a>
  );
}

/**
 * Pixel-font titles (header brand, hero title, section titles). Press Start 2P draws T and I one
 * pixel narrower and offset right, which opens gaps in the word; .glyph-narrow
 * (app/hero-header.css) pulls them back by that pixel.
 */
export default function Wordmark({ text }: { text: string }) {
  return text
    .split(/([ti])/i)
    .map((part, index) => (index % 2 ? <span key={index} className="glyph-narrow">{part}</span> : part));
}

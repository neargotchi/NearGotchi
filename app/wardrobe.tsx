import Image from "next/image";
import Link from "next/link";

import { wardrobe } from "../lib/copy";
import { items, slots } from "../lib/mocks";

export default function Wardrobe() {
  return (
    <section id="wardrobe" className="wardrobe-section" aria-labelledby="wardrobe-title">
      <div className="pets-grid" aria-hidden="true" />
      <div className="pets-content">
        <header className="wardrobe-heading">
          <h2 id="wardrobe-title">{wardrobe.header}</h2>
          <p>{wardrobe.sub}</p>
          <Link className="button button-primary" href={wardrobe.cta.href}>
            {wardrobe.cta.label}
          </Link>
        </header>
        <div className="wardrobe-groups">
          {slots.map((slot) => {
            const slotItems = items.filter((item) => item.slot === slot);
            return (
              <section key={slot} className="wardrobe-group" aria-labelledby={`slot-${slot}`}>
                <h3 id={`slot-${slot}`}>{slot}</h3>
                <ul>
                  {slotItems.map((item) => (
                    <li key={item.id} className="item-card">
                      <div className="item-sprite-wrap">
                        <Image
                          className="item-sprite"
                          src={item.src}
                          alt={item.id}
                          width={item.width}
                          height={item.height}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}

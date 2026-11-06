import Image from "next/image";
import Link from "next/link";

import Sparkles from "../components/Sparkles";
import { notFound } from "../lib/copy";

export default function NotFound() {
  return (
    <main className="notfound-shell">
      <section className="notfound" aria-labelledby="notfound-title">
        <div className="pets-grid" aria-hidden="true" />
        <div className="notfound-content">
          <div className="notfound-scene">
            {/* merk sitting by its empty bowl (the bowl is part of the hungry sprite) */}
            <Image
              className="notfound-sprite"
              src="/pets/pet3/hungry.png"
              alt="merk, sad, next to an empty bowl"
              width={489}
              height={431}
              priority
            />
            <Sparkles
              count={5}
              colors={["var(--green)", "var(--sparkle-alt)"]}
              area={[
                { x: [0, 10], y: [4, 24] },
                { x: [84, 96], y: [0, 18] },
                { x: [90, 100], y: [46, 64] },
                { x: [-6, 4], y: [56, 74] },
                { x: [70, 80], y: [86, 98] },
              ]}
              seed="notfound"
              size={25}
            />
          </div>
          <h1 id="notfound-title" className="notfound-code">
            {notFound.code}
          </h1>
          <p className="notfound-line">{notFound.line}</p>
          <Link className="button button-primary" href={notFound.cta.href}>
            {notFound.cta.label}
          </Link>
        </div>
      </section>
    </main>
  );
}

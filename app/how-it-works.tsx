import Image from "next/image";

import Mascot from "../components/Mascot";
import TitleSparkles from "../components/TitleSparkles";
import { howItWorks, mascots } from "../lib/copy";

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="steps-section" aria-labelledby="steps-title">
      <div className="pets-grid" aria-hidden="true" />
      <div className="pets-content">
        <div className="section-head">
          <h2 id="steps-title" className="steps-title section-title-host">
            {howItWorks.header}
            <TitleSparkles seed="title-steps" below />
          </h2>
          <Mascot {...mascots.howItWorks} />
        </div>
        <ol className="steps-list">
          {howItWorks.steps.map((step) => (
            <li
              key={step.number}
              className="step-card"
            >
              <div className="step-sprite-wrap" aria-hidden="true">
                <Image
                  className="step-sprite"
                  src={step.sprite.src}
                  alt={step.sprite.alt}
                  width={step.sprite.width}
                  height={step.sprite.height}
                  sizes="(max-width: 1023px) 60vw, 320px"
                />
              </div>
              <h3 className="step-heading">
                <span className="step-number">{step.number}</span>
                {step.title}
              </h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

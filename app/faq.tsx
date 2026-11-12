import Mascot from "../components/Mascot";
import TitleSparkles from "../components/TitleSparkles";
import FaqMotion from "./faq-motion";
import { faq, mascots } from "../lib/copy";

export default function Faq() {
  return (
    <section id="faq" className="faq-section" aria-labelledby="faq-title">
      <div className="pets-grid" aria-hidden="true" />
      <div className="pets-content">
        <div className="section-head">
          <h2 id="faq-title" className="faq-title section-title-host">
            {faq.header}
            <TitleSparkles seed="title-faq" below />
          </h2>
          <Mascot {...mascots.faq} />
        </div>
        <div className="faq-list">
          {faq.items.map((item, index) => (
            // name="faq": one answer open at a time (native exclusive accordion; app/faq-motion.tsx
            // closes the others in browsers without it). Clicking the open one closes it.
            <details key={item.question} id={item.id} className="faq-item" name="faq" open={index === 0}>
              <summary>{item.question}</summary>
              <p>
                {item.answer}
                {item.link ? (
                  <>
                    {" "}
                    <a href={item.link.href} rel="noopener noreferrer" target="_blank">
                      {item.link.label}
                    </a>
                  </>
                ) : null}
              </p>
            </details>
          ))}
        </div>
        <FaqMotion />
      </div>
    </section>
  );
}

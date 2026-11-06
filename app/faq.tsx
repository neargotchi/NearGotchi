import Mascot from "../components/Mascot";
import TitleSparkles from "../components/TitleSparkles";
import FaqMotion from "./faq-motion";
import { faq, mascots } from "../lib/copy";

export default function Faq() {
  return (
    <section id="faq" className="faq-section" aria-labelledby="faq-title">
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
            <details key={item.question} className="faq-item" open={index === 0}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
        <FaqMotion />
      </div>
    </section>
  );
}

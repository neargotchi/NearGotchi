import { faq } from "../lib/copy";

export default function Faq() {
  return (
    <section id="faq" className="faq-section" aria-labelledby="faq-title">
      <div className="pets-grid" aria-hidden="true" />
      <div className="pets-content">
        <h2 id="faq-title" className="faq-title">
          {faq.header}
        </h2>
        <div className="faq-list">
          {faq.items.map((item, index) => (
            <details key={item.question} className="faq-item" open={index === 0}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

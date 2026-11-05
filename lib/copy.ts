// Public copy for landing sections, from docs/neargotchi-copy-v1.md. Keep text verbatim.

export type HowItWorksStep = {
  number: number;
  title: string;
  body: string;
  sprite: { src: string; width: number; height: number; alt: string };
  soon?: boolean;
};

export const howItWorks = {
  header: "how gotchi works",
  steps: [
    {
      number: 1,
      title: "mint",
      body: "pick a pet. it hatches as an nft with its own balance.",
      sprite: { src: "/logo-transparent.png", width: 1024, height: 1024, alt: "" },
    },
    {
      number: 2,
      title: "feed",
      body: "snacks cost $NEARGotchi. hungry pets don't talk.",
      sprite: { src: "/pets/pet1/hungry.png", width: 489, height: 431, alt: "" },
    },
    {
      number: 3,
      title: "talk",
      body: "every message uses energy. your pet thinks with near ai.",
      sprite: { src: "/pets/pet3/happy.png", width: 489, height: 431, alt: "" },
    },
  ] satisfies HowItWorksStep[],
};

export const wardrobe = {
  header: "dress to impress",
  sub: "crowns, caps, capes, gold chains. buy the fit, flex the fit.",
  cta: { label: "open wardrobe", href: "/pet" },
};

export const tokenomics = {
  header: "the numbers",
  stats: [
    { label: "ticker", value: ["$NEARGotchi"] },
    { label: "chain", value: ["near"] },
    // Placeholder until the owner decides: always "tba".
    { label: "supply", value: ["tba"] },
    { label: "platform fees", value: ["50% burned /", "50% to the community"] },
  ],
  closing: { lead: "every snack ", accent: "burns." },
};

export const faq = {
  header: "faq",
  items: [
    {
      question: "what is neargotchi?",
      answer: "an ai pet on near. every pet is an nft that eats tokens to think.",
    },
    {
      question: "why does my pet need tokens?",
      answer: "talking runs on near ai. tokens = energy. no energy, no words.",
    },
    {
      question: "what if i don't feed it?",
      answer: "it gets sad and slowly loses energy. it won't die. it will just sulk. dramatically.",
    },
    {
      question: "where do the fees go?",
      answer: "half is burned. half goes back to the community.",
    },
  ],
};

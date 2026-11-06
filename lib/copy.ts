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

export const notFound = {
  code: "404",
  line: "your gotchi wandered off.",
  cta: { label: "bring it home", href: "/" },
};

export const header = {
  brand: "neargotchi",
  nav: [
    { label: "pets", href: "#pets" },
    { label: "how it works", href: "#how-it-works" },
    { label: "wardrobe", href: "#wardrobe" },
    { label: "tokenomics", href: "#tokenomics" },
    { label: "faq", href: "#faq" },
  ],
  wallet: { label: "connect wallet", tag: "demo", note: "demo only, no wallet connected" },
  cta: { label: "mint your pet", href: "/mint" },
  // Header + burger CTA once a demo pet exists (PLAN-MINT review §1). Hero CTA keeps "mint your pet".
  petCta: { label: "my pet", href: "/pet" },
};

/** Section anchors ("#pets") live on the home page; route hrefs ("/pet") are used as-is. */
export const navHref = (href: string) => (href.startsWith("/") ? href : `/${href}`);

export type SocialLink = { label: string; url: string | null };

export const footer = {
  disclaimer: "not financial advice. $NEARGotchi is a memecoin with no promise of value.",
  copyright: "© 2026 neargotchi",
  // URLs not approved yet (copy v1 §7 has [URL]); null links are not rendered.
  socials: [
    { label: "X", url: null },
    { label: "telegram", url: null },
  ] as SocialLink[],
};

/** Section mascots: pet sprite folder (lib/mocks.ts) + speech bubble line, keyed by section. */
export const mascots = {
  pets: { name: "batman", spriteFolder: "pet1", line: "pick me. i'm the real one." },
  howItWorks: { name: "merk", spriteFolder: "pet3", line: "it's easy. i watched." },
  wardrobe: { name: "nightshade", spriteFolder: "pet2", line: "i look good in a crown." },
  tokenomics: { name: "batman", spriteFolder: "pet1", line: "every snack burns. feed me." },
  faq: { name: "merk", spriteFolder: "pet3", line: "ask away. i never sleep." },
};

/** Replaces {name}-style placeholders. */
export const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/** "mint {name}" link under the mood buttons of the 3 real pet cards → /mint?pet=… */
export const petGallery = { mintLink: "mint {name}" };

/** /mint (docs/PLAN-MINT.md §5). Demo only: no real mint, no wallet. */
export const mintPage = {
  metaTitle: "mint — NEARGOTCHI",
  metaDescription: "pick a gotchi, name it, watch it hatch. demo, no real mint.",
  title: "hatch your gotchi",
  sub: "pick a pet. give it a name. watch it hatch.",
  demo: "demo · no real mint, no wallet",
  mascot: { name: "nightshade", spriteFolder: "pet2", line: "i hatched once. it was a lot." },
  pickLegend: "1. pick your pet",
  picked: "picked",
  nameLabel: "2. name it",
  nameHint: "2–12 characters. letters, numbers, spaces, - and _.",
  errors: {
    too_short: "too short. 2 characters at least.",
    too_long: "too long. 12 characters max.",
    bad_chars: "letters, numbers, spaces, - and _ only.",
    no_pet: "pick a pet first.",
  },
  mintButton: "mint",
  mintTag: "demo",
  hatching: "hatching…",
  hatched: "{name} hatched.",
  redirecting: "taking you to {name}…",
  goTo: "go to {name}",
  existing: {
    title: "you already have a gotchi.",
    body: "{name} the {species} is waiting.",
    go: "go to your pet",
    startOver: "start over",
  },
  confirm: {
    text: "start over? {name} will be gone. it's a demo, so nothing real is lost.",
    yes: "yes, start over",
    keep: "keep {name}",
  },
  storageNote: "this browser won't save your pet. it stays until you close the tab.",
  noscript: "turn on javascript to hatch a pet.",
};

/** /pet stub until the full /pet task. */
export const petPage = {
  metaTitle: "my pet — NEARGOTCHI",
  empty: "no pet yet.",
  emptyLink: "hatch one",
};

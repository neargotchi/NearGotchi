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
      body: "hatch a random pet. 300 in drop 1. each one is an nft with its own balance.",
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
  cta: { label: "open wardrobe", href: "/pet#wardrobe" },
};

export const tokenomics = {
  header: "the numbers",
  stats: [
    { label: "ticker", value: ["$NEARGotchi"] },
    { label: "chain", value: ["near"] },
    // Placeholder until the owner decides: always "tba".
    { label: "supply", value: ["tba"] },
    { label: "split", value: ["33% team /", "33% stakers /", "34% buyback & burn"] },
  ],
  // Under the tiles (body font).
  note: "applies to hatches, platform fees and the 5% royalty.",
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
      question: "how many pets are there?",
      answer: "drop 1 is 300 pets: 100 of each. every hatch is random: pet, background, starter accessory and rarity. 2 near per hatch.",
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
      answer: "split three ways: 33% team, 33% to stakers, 34% buys back $NEARGotchi and burns it.",
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
  /** Demo wallet (app/wallet-menu.tsx, lib/wallet.ts): one fake account per browser, nothing is signed. */
  wallet: {
    label: "connect wallet",
    tag: "demo",
    /** Chip label once connected; the button opens a small panel. */
    chipLabel: "wallet {account}, demo. open menu",
    note: "demo wallet · nothing is signed",
    connected: "connected as {account}. demo wallet, nothing is signed.",
    disconnected: "disconnected. your gotchis wait in this browser.",
    myPets: "my gotchis",
    disconnect: "disconnect",
  },
  // One primary CTA for hero, header and burger panel (app/pet-cta.tsx): no pet → /mint …
  cta: { label: "hatch a gotchi", href: "/mint" },
  // … demo pet exists → /pet.
  petCta: { label: "my gotchi", href: "/pet" },
};

/** Section anchors ("#pets") live on the home page; route hrefs ("/pet") are used as-is. */
export const navHref = (href: string) => (href.startsWith("/") ? href : `/${href}`);

export type SocialLink = { label: string; url: string | null };

export const footer = {
  disclaimer: "not financial advice. $NEARGotchi is a memecoin with no promise of value.",
  // No cookies, no analytics: only functional localStorage (theme, demo pet, chat).
  privacy: "no tracking. your demo wallet and pets live only in your browser.",
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
  howItWorks: { name: "near kat", spriteFolder: "pet3", line: "it's easy. i watched." },
  wardrobe: { name: "near dragon", spriteFolder: "pet2", line: "i look good in a crown." },
  tokenomics: { name: "batman", spriteFolder: "pet1", line: "every snack burns. feed me." },
  faq: { name: "near kat", spriteFolder: "pet3", line: "ask away. i never sleep." },
};

/** Replaces {name}-style placeholders. */
export const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/** "mint {name}" link under the mood buttons of the 3 real pet cards → plain /mint (the pet comes from the drop-1 draw). */
export const petGallery = { mintLink: "mint {name}" };

/**
 * /mint (docs/PLAN-MINT.md §5, random hatch since task 036: docs/DEVLOG.md §2).
 * Demo only: no real mint, no wallet. Rarity only, never value (checked by scripts/check-drop1.mjs).
 */
export const mintPage = {
  metaTitle: "mint — NEARGOTCHI",
  metaDescription: "hatch an egg, meet one of 300 gotchis, name it. demo, no real mint.",
  title: "hatch your gotchi",
  sub: "one egg. one of 300 gotchis inside. name it when it's out.",
  demo: "demo · no real mint, demo wallet only",
  mascot: { name: "near dragon", spriteFolder: "pet2", line: "i hatched once. it was a lot." },
  hatchButton: "hatch",
  hatchTag: "demo",
  readyHint: "you don't pick the pet. the egg does. common, rare, epic or legendary.",
  hatchError: "the egg didn't crack. try again.",
  hatching: "hatching…",
  waiting: "almost… the egg is still wobbling.",
  /** role=status line once the pet is out. */
  hatched: "it's out: {tier} {species}.",
  reveal: {
    /** h2 of the reveal, focused when it appears. */
    title: "{token} hatched.",
    nameLabel: "name it",
    /** Submit: saves the name, then /pet?id={tokenId}&tab=games. */
    play: "play with {name}",
    share: "share on x",
    shareNewTab: "(opens x in a new tab)",
    /** x.com/intent/tweet text (PLANNER REVIEW 037): no @handle until the X account is confirmed. */
    shareText: "i hatched {token}, a {tier} {species}. one of {count} {tier} {pet}s in neargotchi drop 1 (demo).",
  },
  nameHint: "2–12 characters. letters, numbers, spaces, - and _. empty keeps {pet}.",
  errors: {
    too_short: "too short. 2 characters at least.",
    too_long: "too long. 12 characters max.",
    bad_chars: "letters, numbers, spaces, - and _ only.",
    no_pet: "that gotchi is gone. hatch again.",
    no_wallet: "connect the demo wallet first.",
  },
  soldOut: {
    title: "all {total} hatched.",
    body: "every egg in this demo drop is out. in this browser, anyway.",
    reset: "reset demo drop",
    note: "demo only: puts all {total} eggs back in this browser.",
  },
  storageNote: "this browser won't save your pet. it stays until you close the tab.",
  noscript: "turn on javascript to hatch a pet.",
};

/**
 * Drop progress bar (components/DropProgress.tsx) on the landing hero, /mint and /pet. The count is this
 * browser's demo hatches only, so "demo" is always part of it. "…" until the browser count is read.
 */
export const dropProgress = {
  label: "{minted} / {total} hatched · {left} left · demo",
  pending: "…",
};

/** Shown on /pet and /mint without a connected demo wallet (app/wallet-gate.tsx). */
export const walletGate = {
  title: "connect a demo wallet",
  pet: "your gotchis belong to an account. connect the demo wallet to see them.",
  mint: "hatching needs an account. connect the demo wallet first.",
  button: "connect demo wallet",
  note: "a fake account, you.demo. nothing is signed, nothing leaves this browser.",
};

/** /pet (docs/DEVLOG.md §5). Demo only: balance is always "demo", chat is local. */
export const petPage = {
  metaTitle: "my gotchi — NEARGOTCHI",
  empty: "no pet yet.",
  emptyLink: "hatch your gotchi",
  /** Next to the pet switcher and the drop progress bar. */
  hatchAnother: "hatch another",
  /** Row of the account's pets (app/pet/pet-switcher.tsx). */
  switcher: { label: "your gotchis", item: "{name}, {token}" },
  /** WAI-ARIA tabs under the device (app/pet/pet-tabs.tsx); ?tab= in the URL. */
  tabs: { label: "{name} menu", stats: "stats", games: "games", feed: "feed", chat: "chat" },
  stats: {
    character: "character",
    age: "age",
    ageToday: "hatched today",
    ageDay: "1 day old",
    ageDays: "{n} days old",
    counters: "so far",
    games: "games played",
    snacks: "snacks eaten",
    messages: "messages sent",
    best: "best scores",
    simon: "simon",
    snack: "catch the snack",
    noScore: "—",
    renameLabel: "rename",
    renameSave: "save name",
    renamed: "renamed to {name}.",
  },
  release: {
    button: "release {name}",
    text: "release {name}? it leaves your demo account. its token stays hatched.",
    yes: "yes, release",
    keep: "keep {name}",
  },
  /** Games tab (app/pet/tab-games.tsx, lib/games.ts). */
  games: {
    title: "games",
    soon: "soon",
    cost: "every finished game: +15 hunger, happy for 1 min. stop early and it's free.",
    best: "best",
    noScore: "—",
    play: "play",
    again: "play again",
    stop: "stop",
    blocked: {
      hungry: "{name} is too hungry to play.",
      asleep: "{name} is recharging. back at 40 energy.",
    },
    feedFirst: "feed it first",
    finished: "+15 hunger · {name} is happy. score {score}.",
    newBest: "new best!",
    stopped: "stopped. no cost.",
    simon: {
      title: "simon",
      rules: "the three buttons light up in a row. press them back in the same order. one more each round. keys 1, 2, 3 work too.",
      pads: "simon buttons",
      pad: "button {n}",
      ready: "press play",
      round: "round {n}",
      watch: "watch…",
      yourTurn: "your turn",
      /** between rounds */
      good: "nice!",
      /** aria-live after the sequence is shown */
      sequence: "round {n}. your turn: {seq}.",
      wrong: "oops. it was {n}.",
      over: "game over",
    },
    snack: {
      title: "catch the snack",
      rules: "snacks fall from the top. move {name} with ← → or a / d, or tap the left or right half of the screen. 20 seconds a round, p pauses.",
      ready: "press play",
      time: "time {t}",
      score: "caught {n}",
      paused: "paused",
      over: "time's up",
      left: "move left",
      right: "move right",
      pause: "pause",
      resume: "resume",
      live: {
        start: "go! 20 seconds. arrow keys or a and d move {name}.",
        paused: "paused.",
        resumed: "go!",
        ten: "10 seconds left. caught {n}.",
        over: "time's up. caught {n}.",
      },
    },
  },
  sub: "the {species} · hatched {date}",
  tapLabel: "pet {name}",
  status: {
    sleep: "zzz… {name} is recharging.",
    happy: "{name} is happy.",
    hungry: "{name} is hungry.",
    normal: "{name} is chilling.",
  },
  meters: { hunger: "hunger", energy: "energy", valueText: "{n} of 100" },
  balance: "{n} demo $NEARGotchi",
  /** Feed tab = snack shop (app/pet/tab-feed.tsx, lib/shop.ts). Demo $NEARGotchi only. */
  shop: {
    title: "snack shop",
    note: "demo $NEARGotchi · nothing real is spent",
    refill: "refill demo balance",
    refillDone: "refilled to 100 demo $NEARGotchi. still not real.",
    refillFull: "balance is already 100.",
    cost: "{n} demo",
    hunger: "−{n} hunger",
    energy: "+{n} energy",
    happy: "happy for 1 min",
    stock: "{n} of {max} left",
    unlimited: "always in stock",
    restock: "+1 in {time}",
    buy: "buy & feed",
    reason: {
      out_of_stock: "sold out · back in {time}",
      broke: "not enough demo $NEARGotchi",
      full: "{name} is full and rested",
    },
    result: {
      fed: "nom. {snack} for {n} demo $NEARGotchi.",
      asleep: "{name} woke up for the {snack}.",
      asleepStill: "{name} ate the {snack} in its sleep. still sleepy.",
      full: "{name} is full and rested. kept your {snack}.",
      broke: "not enough demo $NEARGotchi for the {snack}.",
      out_of_stock: "{snack} is sold out. back in {time}.",
    },
  },
  /** Drop-1 token card (app/pet/token-card.tsx). Rarity only, never value. */
  token: {
    title: "{token}",
    demo: "demo token · not on chain",
    number: "#{id} of {total}",
    rarity: "one of {count} {tier} {pet}s",
    pet: "pet",
    background: "background",
    item: "item",
    alt: "{token}: a {tier} {species} on a {background} background, wearing {item}.",
  },
  chat: {
    title: "talk",
    note: "demo · near ai soon",
    label: "message",
    placeholder: "say something to {name}",
    hint: "each message uses 4 energy and 3 food.",
    send: "send",
    typing: "{name} is typing…",
    empty: "no messages yet. say hi.",
    tooLong: "140 characters max.",
    blank: "type something first.",
    asleep: "zzz… {name} is recharging. a snack with energy wakes it up.",
    you: "you",
  },
};

/** Public token page /nft/[id] (app/nft/[id]/page.tsx). Rarity only, never value. */
export const nftPage = {
  metaTitle: "{token} — NEARGOTCHI",
  imageAlt: "{token}: a {tier} {species} from neargotchi drop 1, on its tier colour.",
  sub: "one of {total} gotchis in drop 1. a demo token: it lives in this site, not on chain yet.",
  cta: "hatch your own",
  pets: "meet the pets",
};

/** Shop snacks (lib/shop.ts ids). */
export const snackLabels = { cookie: "bone cookie", berries: "berries", noodles: "noodles", candy: "star candy" } as const;

/** Character on the stats tab: 3 traits per pet (docs/DEVLOG.md §2, approved by the owner 2026-11-08). */
export const petTraits: Record<string, [string, string, string]> = {
  pet1: ["chunky", "always hungry", "loyal"],
  pet2: ["tiny", "dramatic", "hoards shiny things"],
  pet3: ["alert", "curious", "never sleeps"],
};

/** Drop-1 tier badge labels (components/TierBadge.tsx). */
export const tierLabels = { common: "common", rare: "rare", epic: "epic", legendary: "legendary" } as const;

/** Dressed items as shown on the token card (same words as scripts/build_metadata.py WEARING, without articles). */
export const itemLabels: Record<string, string> = {
  beanie: "beanie", cap: "cap", chain: "chain", crown: "crown", halo: "halo", headphones: "headphones",
  keffiyeh: "keffiyeh", mask: "mask", nerd: "nerd glasses", pixel: "pixel shades", sunglasses: "sunglasses",
  tophat: "top hat", tshirt: "t-shirt",
};

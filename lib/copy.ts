// Public copy for landing sections (approved by the owner). Keep text verbatim.
// NEXT_PUBLIC_CHAIN=testnet swaps the few "demo" strings that would be untrue with a real wallet and a real mint.

import { DROP1_CONTRACT, EXPLORER_URL, NET, isMainnet, isOnChain } from "./chain";

export type HowItWorksStep = {
  number: number;
  title: string;
  body: string;
  sprite: { src: string; width: number; height: number; alt: string };
  soon?: boolean;
};

/** Hero (app/page.tsx). Demo now, near next: no live near ai promise, no dressing up. */
export const hero = {
  subtitle: "your ai companion on near",
  lede: "hatch one of 300 gotchis. feed it, play with it, talk to it. " + (isOnChain ? `live on near ${NET}.` : "demo now, near next."),
  learnMore: "learn more",
  /** Chevron under the buttons → #pets (label for screen readers only). */
  scroll: "explore the pets",
};

export const howItWorks = {
  header: "how gotchi works",
  steps: [
    {
      number: 1,
      title: "hatch",
      body: "crack an egg, meet a random gotchi. 300 in drop 1, each one an nft with its own rarity.",
      sprite: { src: "/logo-transparent.png", width: 1024, height: 1024, alt: "" },
    },
    {
      number: 2,
      title: "feed",
      body: "snacks fill the hunger bar. a starving pet won't play.",
      sprite: { src: "/pets/pet1/hungry.png", width: 489, height: 431, alt: "" },
    },
    {
      number: 3,
      title: "play",
      body: "catch the snack, fetch, hide & seek. a game makes it happy, and a bit hungry.",
      sprite: { src: "/pets/pet2/happy.png", width: 489, height: 431, alt: "" },
    },
    {
      number: 4,
      title: "talk",
      body: isOnChain
        ? "every message uses energy. an energy pack refills it. replies come from near ai."
        : "every message uses energy. an energy pack refills it. near ai comes next; the demo answers on its own.",
      sprite: { src: "/pets/pet3/happy.png", width: 489, height: 431, alt: "" },
    },
  ] as HowItWorksStep[],
};

/** "meet your gotchi" (app/meet-your-gotchi.tsx): the 4 tabs of /pet, each with a live mini preview. */
export const yourGotchi = {
  header: "meet your gotchi",
  sub: "every gotchi comes with a little menu. this is it.",
  tiles: {
    stats: { title: "stats", body: "its nft card, character, age and how it's doing." },
    games: { title: "games", body: "three tiny lcd games: catch the snack, fetch and hide & seek. games make it happy." },
    feed: { title: "feed", body: "snacks fill hunger. an energy pack refills the talk bar. snacks restock on their own time." },
    chat: { title: "chat", body: "talk to it. every pet has its own voice. each message costs a bit of energy." },
  },
  /** Fixed sample data for the previews (not a real pet). */
  sample: {
    name: "near kat",
    you: "gm",
    reply: "gm. i saw you coming three blocks ago.",
    catchTime: "time 0:12",
    catchScore: "caught 7",
  },
  cta: "try it: hatch your gotchi",
};

/** "drop 1" (app/drop-section.tsx), in place of the old wardrobe. Rarity only, never value. */
export const dropSection = {
  header: "drop 1",
  sub: "300 gotchis. every egg is random: pet, background, item and rarity.",
  tiersTitle: "4 tiers",
  tierCount: "{n} per pet",
  tierTotal: "{n} in the drop",
  itemsTitle: "13 items, one per gotchi",
  backgroundsTitle: "12 backgrounds",
  cta: "hatch your gotchi",
};

export const tokenomics = {
  header: "the numbers",
  stats: [
    { label: "hatch", value: ["2 near"] },
    { label: "supply", value: ["300"] },
    { label: "team", value: ["50%"] },
    { label: "holder rewards", value: ["50%"] },
  ],
  // Under the tiles (body font). Exactly what the contract does (contracts/drop1/src/lib.rs).
  note: "every hatch pays 2 near, minus a small storage reserve. half goes to the team, half is split equally between the gotchis hatched before it, and their owners claim it from their wallet. the very first hatch has no earlier gotchi, so its half goes to the team. it is a share of hatch sales and nothing more is promised.",
  closing: { lead: "every hatch ", accent: "pays holders." },
};

/** $NEARGotchi coin (app/coin-section.tsx), under the numbers; no nav entry. No prices, no numbers, no promises. */
export const coin = {
  header: "$NEARGotchi",
  body: "the community coin of the neargotchi crew. born on NEAR, made by the fans, for the fans. every gotchi has a friend in it. join the herd.",
  cta: { label: "open on nearly.trade", url: "https://nearly.trade/neargotchi.nearlytrade.near" },
  /** Screen readers only, after the external link label. */
  newTab: "(opens in a new tab)",
  address: "neargotchi.nearlytrade.near",
  addressLabel: "token address",
};

/** One FAQ entry. `id` = anchor on the home page; `link` is appended to the answer. */
export type FaqItem = { question: string; answer: string; id?: string; link?: { label: string; href: string } };

/** Anchor of "is the hatch fair?" (linked from /mint, task 087). */
export const FAIR_HATCH_ID = "fair-hatch";

export const faq: { header: string; items: FaqItem[] } = {
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
      id: FAIR_HATCH_ID,
      question: "is the hatch fair?",
      answer: "you can check it yourself. you pay, the contract stores a ticket, and a later block draws your gotchi from the pool that is left, using the chain's random seed. you can't pick it and neither can we. every hatch is a public transaction on nearblocks. the pictures and metadata are pinned by content hash (ipfs cid) and each token's media hash is on chain. two honest limits: the contract has not been audited, and near's random seed comes from block producers, so no on-chain randomness is perfect.",
      // mainnet only, address from env (NEXT_PUBLIC_DROP1_CONTRACT)
      link: isMainnet && DROP1_CONTRACT ? { label: "verify on nearblocks", href: `${EXPLORER_URL}/address/${DROP1_CONTRACT}` } : undefined,
    },
    {
      question: "why does my pet need tokens?",
      answer: "talking runs on near ai cloud. energy is the fuel: only chatting spends it, and an energy pack refills it. no energy, no words.",
    },
    {
      question: "what if i don't feed it?",
      answer: "it gets hungry, then sad. it won't die. it will just sulk. dramatically. snacks fix hunger, games make it a bit hungrier.",
    },
    {
      question: "where do the fees go?",
      answer: "the contract splits hatch proceeds (2 near minus a small storage reserve): 50% to the team, 50% to the holders of the gotchis hatched earlier, split equally. holders claim from their wallet. the first hatch has no earlier gotchi, so its half goes to the team. nothing else is promised.",
    },
    {
      question: "i hatch more than one. does part of it come back to me?",
      answer: "partly. the holder half of each hatch is split between all gotchis hatched before it, your own earlier ones included, so a share of your second hatch is credited to your first gotchi and you claim it like any other reward. same split for everyone, not a refund. nothing more is promised.",
    },
    {
      question: "is this live?",
      answer: isMainnet
        ? "yes, on near mainnet, with real near. the contract is unaudited: only spend what you can afford to lose. snacks are paid in real near; games and chat state live in your browser."
        : "it's a testnet demo. the mint is real on near testnet; snacks, games and chat are still mocks in your browser.",
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
    { label: "home", href: "#home" },
    { label: "pets", href: "#pets" },
    { label: "how it works", href: "#how-it-works" },
    { label: "your gotchi", href: "#your-gotchi" },
    { label: "drop 1", href: "#drop-1" },
    { label: "tokenomics", href: "#tokenomics" },
    // Task 088: the coin section gets its own link, underlined with a soft glow (hero-header.css .nav-glow).
    { label: "$NEARGotchi", href: "#coin", highlight: true },
    { label: "faq", href: "#faq" },
  ],
  /** Demo wallet (app/wallet-menu.tsx, lib/wallet.ts): one fake account per browser, nothing is signed. */
  wallet: {
    label: "connect wallet",
    tag: isOnChain ? NET : "demo",
    /** Chip label once connected; the button opens a small panel. */
    chipLabel: isOnChain ? `wallet {account}, ${NET}. open menu` : "wallet {account}, demo. open menu",
    note: isOnChain ? `near ${NET} wallet` : "demo wallet · nothing is signed",
    connected: isOnChain ? "connected as {account}." : "connected as {account}. demo wallet, nothing is signed.",
    disconnected: isOnChain ? "wallet disconnected." : "wallet disconnected. your gotchis wait in this browser.",
    myPets: "my gotchis",
    disconnect: "disconnect",
  },
  // One primary CTA for hero, header and burger panel (app/pet-cta.tsx): no pet → /mint …
  cta: { label: "hatch a gotchi", href: "/mint" },
  // … demo pet exists → /pet.
  petCta: { label: "my gotchi", href: "/pet" },
  /** Square X button next to the theme toggle (app/social-x.tsx). */
  x: { label: "NEARGOTCHI on X", url: "https://x.com/neargotchiAI" },
};

/** Section anchors ("#pets") live on the home page; route hrefs ("/pet") are used as-is. */
export const navHref = (href: string) => (href.startsWith("/") ? href : `/${href}`);

export type SocialLink = { label: string; url: string | null };

export const footer = {
  disclaimer: "not financial advice. $NEARGotchi is a memecoin with no promise of value.",
  // No cookies, no analytics: only functional localStorage (theme, demo pet, chat).
  privacy: isOnChain
    ? `no tracking. game state (hunger, energy, chat) lives only in this browser; ownership is on near ${NET}.`
    : "no tracking. your demo wallet and pets live only in this browser.",
  copyright: "© 2026 neargotchi",
  builtOn: "built on near: nft contract + near ai cloud",
  /** listed addresses (task 080): text only, no claims. Links go to the mainnet explorer. */
  addresses: [
    { label: "drop 1 contract (near mainnet)", account: "drop1.neargochi-dev.near" },
    { label: "$NEARGotchi token", account: "neargotchi.nearlytrade.near" },
  ],
  // URLs not approved yet; null links are not rendered.
  socials: [
    { label: "X", url: null },
    { label: "telegram", url: null },
  ] as SocialLink[],
};

/** Section mascots: pet sprite folder (lib/mocks.ts) + speech bubble line, keyed by section. */
export const mascots = {
  pets: { name: "batman", spriteFolder: "pet1", line: "i'm the real one. the others are cute too." },
  howItWorks: { name: "near kat", spriteFolder: "pet3", line: "it's easy. i watched." },
  drop: { name: "near dragon", spriteFolder: "pet2", line: "i got a crown. legendary? i'll never tell." },
  yourGotchi: { name: "batman", spriteFolder: "pet1", line: "four tabs. one is snacks. guess my favourite." },
  tokenomics: { name: "batman", spriteFolder: "pet1", line: "snacks. i only care about snacks." },
  faq: { name: "near kat", spriteFolder: "pet3", line: "ask away. i never sleep." },
};

/** Replaces {name}-style placeholders. */
export const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/** "meet the pets" (app/pet-gallery.tsx): you don't pick, the egg does, so one CTA under the cards. */
export const petGallery = {
  header: "meet the pets",
  sub: "3 pets in drop 1, 4 moods each. one of them is a real dog.",
  tiersLabel: "{name} in drop 1, one per tier",
  tierLink: "{token}, {tier}. enlarge",
  /** Enlarged tier thumbnail (app/nft-lightbox.tsx). */
  lightbox: { open: "open nft page", close: "close" },
  cta: "hatch your gotchi",
};

/**
 * /mint (docs/PLAN-MINT.md §5, random hatch since task 036: docs/DEVLOG.md §2).
 * Demo only: no real mint, no wallet. Rarity only, never value (checked by scripts/check-drop1.mjs).
 */
export const mintPage = {
  metaTitle: "mint — NEARGOTCHI",
  metaDescription: isOnChain ? `hatch an egg on near ${NET}, meet one of 300 gotchis, name it.` : "hatch an egg, meet one of 300 gotchis, name it. demo, no real mint.",
  title: "hatch your gotchi",
  sub: "one egg. one of 300 gotchis inside. name it when it's out.",
  demo: isOnChain ? (isMainnet ? "near mainnet · 2 real near per hatch" : "near testnet · 2 test near per hatch") : "demo · no real mint, demo wallet only",
  mascot: { name: "near dragon", spriteFolder: "pet2", line: "i hatched once. it was a lot." },
  hatchButton: "hatch",
  hatchTag: "demo",
  readyHint: "you don't pick the pet. the egg does. common, rare, epic or legendary.",
  hatchError: "the egg didn't crack. try again.",
  /** testnet (NEXT_PUBLIC_CHAIN=testnet): real 2 NEAR mint */
  chain: {
    hatchTag: isMainnet ? "2 near · real" : "2 near · testnet",
    readyHint: isMainnet
      ? "2 real near. the contract picks the pet, not you. common, rare, epic or legendary."
      : "2 near on testnet. the contract picks the pet, not you. common, rare, epic or legendary.",
    waitingWallet: "confirm in your wallet…",
    /** mainnet only (task 088): one calm line under the hatch button (replaces the warning box + checkbox). */
    finalNote: "real near, final. no refunds. the contract is unaudited.",
    /** under the hatch button (task 087); `link` goes to the faq answer */
    draw: { text: "how the draw works: the contract draws after payment, nobody picks.", link: "details in the faq" },
    errors: {
      paused: "hatching is paused right now. try again soon.",
      no_funds: isMainnet ? "not enough near. you need 2 near plus a little gas." : "not enough testnet near. you need 2 near plus a little gas.",
      rejected: "cancelled in the wallet. nothing was spent.",
      failed: "the egg didn't crack. check your wallet and try again.",
    },
  },
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
    shareText: "i hatched {token}, a {tier} {species}. one of {count} {tier} {pet}s in neargotchi drop 1 ("+(isOnChain ? NET : "demo")+").",
  },
  nameHint: "2–12 characters. letters, numbers, spaces, - and _. empty keeps {pet}.",
  errors: {
    too_short: "too short. 2 characters at least.",
    too_long: "too long. 12 characters max.",
    bad_chars: "letters, numbers, spaces, - and _ only.",
    no_pet: "that gotchi is gone. hatch again.",
    no_wallet: isOnChain ? "connect your wallet first." : "connect the demo wallet first.",
  },
  soldOut: {
    title: "all {total} hatched.",
    body: isOnChain ? "every egg in drop 1 is out." : "every egg in this demo drop is out. in this browser, anyway.",
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
  label: isOnChain ? `{minted} / {total} hatched · {left} left · ${NET}` : "{minted} / {total} hatched · {left} left · demo",
  pending: "…",
  /** the contract could not be read */
  unavailable: "—",
};

/** Shown on /pet and /mint without a connected demo wallet (app/wallet-gate.tsx). */
export const walletGate = {
  title: isOnChain ? "connect a wallet" : "connect a demo wallet",
  pet: isOnChain ? `your gotchis belong to an account. connect your near ${NET} wallet to see them.` : "your gotchis belong to an account. connect the demo wallet to see them.",
  mint: isOnChain ? `hatching needs an account. connect your near ${NET} wallet first.` : "hatching needs an account. connect the demo wallet first.",
  button: isOnChain ? "connect wallet" : "connect demo wallet",
  note: isOnChain ? (isMainnet ? "near mainnet. hatching costs 2 real near." : "near testnet only. hatching costs 2 test near.") : "a fake account, you.demo. nothing is signed, nothing leaves this browser.",
};

/** /pet (docs/DEVLOG.md §5). Demo only: balance is always "demo", chat is local. */
export const petPage = {
  /** Mainnet sign-in (task 081, app/pet/energy-sign-in.tsx): energy = near ai credits, kept by the server. */
  signIn: {
    title: "sign to prove it's you",
    body: "energy is near ai credits and lives on our server, so we need to know the pets are yours. one signature in your wallet: no transaction, no cost.",
    button: "sign in with wallet",
    busy: "waiting for your wallet…",
    cancelled: "signing was cancelled. nothing happened.",
    failed: "the signature couldn't be checked. try again.",
    unavailable: "the energy service is down right now. chat and energy packs wait; everything else works.",
    /** task 088: the popup's close button (screen readers) and the action in "sign in first" notes */
    close: "close",
    action: "sign in",
  },
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
    snack: "catch the snack",
    fetch: "fetch",
    hideseek: "hide & seek",
    noScore: "—",
    renameLabel: "rename",
    renameSave: "save name",
    renamed: "renamed to {name}.",
  },
  release: {
    button: "release {name}",
    text: isOnChain ? "release {name}? it leaves this browser. you still own the token." : "release {name}? it leaves your demo account. its token stays hatched.",
    yes: "yes, release",
    keep: "keep {name}",
  },
  /** Games tab (app/pet/tab-games.tsx, lib/games.ts). */
  games: {
    title: "games",
    soon: "soon",
    cost: "every finished game: +10 hunger, happy for 1 min. stop early and it's free.",
    best: "best",
    noScore: "—",
    play: "play",
    again: "play again",
    stop: "stop",
    blocked: {
      hungry: "{name} is too hungry to play.",
    },
    close: "close",
    feedFirst: "feed it first",
    /** Cards under catch the snack (games in tasks 050–051). */
    /** Hide & seek (app/pet/games/hide-seek.tsx, lib/hideseek-game.ts). */
    hideseek: {
      title: "hide & seek",
      rules:
        "{name} ducks behind one spot, then the spots shuffle. keep your eye on it and pick: click or tap, or press 1–5 (arrows + enter work too). one more spot every 2 rounds, a bit faster each round. a wrong pick ends the game. p pauses between rounds.",
      ready: "press play",
      round: "round {n}",
      score: "found {n}",
      pick: "your pick",
      spot: "{n}, {kind}",
      kinds: { bush: "bush", box: "box", tree: "tree", rock: "rock", barrel: "barrel" },
      yay: "found!",
      empty: "empty!",
      over: "game over",
      pauseNext: "pause after this round",
      live: {
        round: "round {n}: {name} hides behind one of {k} spots. watch the shuffle.",
        pick: "your pick: 1 to {k}.",
        found: "found {name} behind the {kind}! found {n}.",
        miss: "the {kind} is empty. {name} was behind the {other} and sticks its tongue out. found {n}.",
        pauseNext: "pausing after this round.",
        paused: "paused.",
        resumed: "go!",
        over: "game over. found {n}.",
      },
    },
    /** Fetch (app/pet/games/fetch-game.tsx, lib/fetch-game.ts). */
    fetch: {
      title: "fetch",
      rules:
        "hold space, the screen or the throw button: the power bar swings up and down. let go to throw. on the flag = 3, close = 1. three hits in a row count double. 8 throws or 45 seconds, p pauses.",
      ready: "press play",
      hold: "hold to throw",
      throwNo: "ball {n}/8",
      time: "{t}",
      score: "score {n}",
      streak: "×2",
      pad: "throw",
      hit: "+{n}!",
      near: "close +1",
      miss: "miss",
      over: "all done",
      live: {
        start: "go! 8 throws, 45 seconds. hold space to wind up, let go to throw.",
        hit: "on the flag! +{n}. score {score}.",
        double: "three in a row: double. +{n}. score {score}.",
        near: "close. +1. score {score}.",
        miss: "missed the flag. {name} brings it back anyway, a bit sad. score {score}.",
        tired: "{name} is getting tired.",
        paused: "paused.",
        resumed: "go!",
        over: "all done. score {n}.",
      },
    },
    finished: "+10 hunger · {name} is happy. score {score}.",
    newBest: "new best!",
    stopped: "stopped. no cost.",
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
    sleep: "{name} is chilling.",
    happy: "{name} is happy.",
    hungry: "{name} is hungry.",
    normal: "{name} is chilling.",
  },
  loading: "loading your gotchi",
  meters: { hunger: "hunger", energy: "energy", valueText: "{n} of 100" },
  balance: "{n} demo $NEARGotchi",
  /** Feed tab = shop (app/pet/tab-feed.tsx, lib/shop.ts): snacks fill hunger, the energy pack fills energy. */
  /** On-chain only (app/pet/holder-rewards.tsx): the 50% holder share of later hatches, claimed from the contract. */
  rewards: {
    title: "holder rewards",
    /** {n} = formatted amount, e.g. "0.995 NEAR". */
    pending: "this gotchi has {n} to claim.",
    note: "half of every later hatch is split between the gotchis hatched before it. rewards follow the token: claim before you transfer it.",
    empty: "no rewards yet — rewards from future hatches.",
    loading: "loading rewards…",
    error: "couldn't load rewards right now.",
    retry: "try again",
    claim: "claim",
    claiming: "confirm in your wallet…",
    claimed: "claimed {n}.",
    failed: "the claim didn't go through. nothing was paid; try again.",
  },

  shop: {
    title: "snack shop",
    note: "snacks fill hunger. energy is for talking.",
    noteDemo: "demo $NEARGotchi · nothing real is spent",
    noteChain: isMainnet ? "paid in real near. unaudited, real funds." : "paid in testnet near",
    /** mainnet energy pack while the server waits for the chain (task 081) */
    confirming: "confirming payment…",
    refill: "refill demo balance",
    refillDone: "refilled to 100 demo $NEARGotchi. still not real.",
    refillFull: "balance is already 100.",
    cost: "{n} demo",
    costNear: isMainnet ? "{n} near (real)" : "{n} testnet near",
    hunger: "−{n} hunger",
    energy: "+{n} energy",
    pack: {
      title: "energy pack",
      body: "fuel for talking. each message uses 4 energy.",
      /** on-chain builds (task 087): what energy is */
      ai: "energy = near ai credits. the chat runs on near ai cloud.",
      /** mainnet only: the pack is paid in real near */
      aiFunds: "energy packs help pay for the near ai credits behind the chat.",
      buy: "buy energy",
      alt: "energy pack",
    },
    happy: "happy for 1 min",
    stock: "{n} of {max} left",
    unlimited: "always in stock",
    restock: "+1 in {time}",
    buy: "buy & feed",
    reason: {
      out_of_stock: "sold out · back in {time}",
      broke: "not enough demo $NEARGotchi",
      full: "{name} is full",
      fullEnergy: "{name} has full energy",
    },
    result: {
      fed: "nom. {snack} for {n}.",
      charged: "+{e} energy for {n}. {name} has plenty to say.",
      full: "{name} is full. kept your {snack}.",
      fullEnergy: "{name} already has full energy. kept your pack.",
      broke: "not enough demo $NEARGotchi for the {snack}.",
      out_of_stock: "{snack} is sold out. back in {time}.",
      cancelled: "cancelled in the wallet. nothing was spent.",
      failed: "couldn't confirm the payment. check your wallet before you try again: if it went through, it is applied the next time you open this page.",
      /** mainnet energy pack (task 081): no session yet — nothing was paid */
      signin: "sign in first so the energy can go to {name}. nothing was paid.",
      /** mainnet energy pack: paid, the server is still confirming it on chain */
      confirming: "payment sent. the energy arrives once it's confirmed on chain; this page keeps checking.",
    },
  },
  /** Drop-1 token card (app/pet/token-card.tsx). Rarity only, never value. */
  token: {
    title: "{token}",
    demo: isOnChain ? `token on near ${NET}` : "demo token · not on chain",
    number: "#{id} of {total}",
    rarity: "one of {count} {tier} {pet}s",
    pet: "pet",
    background: "background",
    item: "item",
    alt: "{token}: a {tier} {species} on a {background} background, wearing {item}.",
  },
  chat: {
    title: "talk",
    note: isOnChain ? "powered by near ai" : "demo · near ai soon",
    noteAi: "powered by near ai",
    noteMock: "demo mode (mock answers)",
    /** on-chain builds (task 087), above the chat log */
    credits: "energy = near ai credits. the chat runs on near ai cloud.",
    thinking: "{name} is thinking…",
    aiError: "the signal dropped. nothing was spent, try again.",
    /** mainnet (task 081): the site's daily near ai budget is used up; nothing was spent */
    resting: "ai is resting, try tomorrow. nothing was spent.",
    /** mainnet (task 081): no / expired sign-in */
    signedOut: "sign in first: it proves the pet is yours. no transaction, no cost.",
    label: "message",
    placeholder: "say something to {name}",
    hint: "each message uses 4 energy. food is not touched.",
    send: "send",
    typing: "{name} is typing…",
    empty: "no messages yet. say hi.",
    tooLong: "140 characters max.",
    blank: "type something first.",
    noEnergy: "{name} has no energy left to talk.",
    noEnergyLink: "buy an energy pack",
    you: "you",
  },
};

/** Public token page /nft/[id] (app/nft/[id]/page.tsx). Rarity only, never value. */
export const nftPage = {
  metaTitle: "{token} — NEARGOTCHI",
  imageAlt: "{token}: a {tier} {species} from neargotchi drop 1, on its tier colour.",
  sub: isOnChain ? `one of {total} gotchis in drop 1, an nft on near ${NET}.` : "one of {total} gotchis in drop 1. a demo token: it lives in this site, not on chain yet.",
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

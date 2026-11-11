import Image from "next/image";
import Link from "next/link";

import Mascot from "../components/Mascot";
import TierBadge from "../components/TierBadge";
import TitleSparkles from "../components/TitleSparkles";
import { fill, mascots, petPage, petTraits, snackLabels, yourGotchi } from "../lib/copy";
import { findToken } from "../lib/drop1";
import { findPet, petSpriteSrc } from "../lib/mocks";
import { findSnack, type SnackId } from "../lib/shop";
import SnackSprite from "./pet/snack-sprites";
import StatBars from "./pet/stat-bars";
import { TokenArt } from "./pet/token-card";

/** Sample pet for every preview: near kat #005 (epic). Fixed data, not anyone's pet. */
const SAMPLE_TOKEN = 5;

function StatsPreview() {
  const token = findToken(SAMPLE_TOKEN)!;
  return (
    <div className="gotchi-stats">
      <TokenArt token={token} />
      <div className="gotchi-stats-info">
        <TierBadge tier={token.tier} />
        <p className="gotchi-stats-name">{token.name}</p>
        <ul className="pet-traits">
          {(petTraits[token.petId] ?? []).map((trait) => (
            <li key={trait}>{trait}</li>
          ))}
        </ul>
      </div>
      <StatBars hunger={30} energy={80} balance={100} />
    </div>
  );
}

/** catch the snack mid-round: the same console, HUD and pads, with a snack falling towards the pet. */
function GamesPreview() {
  const { catchTime, catchScore } = yourGotchi.sample;
  const profile = findPet(findToken(SAMPLE_TOKEN)!.petId)!;
  return (
    <div className="simon-device gotchi-simon">
      <div className="catch-screen gotchi-catch">
        <div className="catch-hud">
          <span>{catchTime}</span>
          <span>{catchScore}</span>
        </div>
        <SnackSprite id="berries" className="gotchi-catch-snack" />
        <Image
          className="gotchi-catch-pet"
          src={petSpriteSrc(profile, "normal")}
          alt=""
          width={profile.spriteWidth}
          height={profile.spriteHeight}
          sizes="64px"
        />
      </div>
      <div className="simon-pads catch-pads">
        {[-1, 1].map((dir) => (
          <span key={dir} className={dir > 0 ? "simon-pad catch-pad is-lit" : "simon-pad catch-pad"}>
            <span>
              <i className={dir < 0 ? "catch-arrow is-left" : "catch-arrow"} />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SnackCard({ id, stock }: { id: SnackId; stock: string }) {
  const snack = findSnack(id)!;
  return (
    <div className="snack-card">
      <div className="snack-top">
        <span className="snack-art">
          <SnackSprite id={id} className="snack-svg" />
        </span>
        <div className="snack-title">
          <p className="snack-name">{snackLabels[id]}</p>
          <p className="snack-cost">{fill(petPage.shop.cost, { n: String(snack.price) })}</p>
        </div>
      </div>
      <ul className="snack-effects">
        <li>{fill(petPage.shop.hunger, { n: String(snack.hunger) })}</li>
      </ul>
      <p className="snack-stock">{stock}</p>
      <span className="button button-primary snack-buy">{petPage.shop.buy}</span>
    </div>
  );
}

function FeedPreview() {
  return (
    <div className="gotchi-feed">
      <SnackCard id="berries" stock={fill(petPage.shop.stock, { n: "2", max: "3" })} />
      <SnackCard id="noodles" stock={fill(petPage.shop.stock, { n: "2", max: "2" })} />
    </div>
  );
}

function ChatPreview() {
  const { name, you, reply } = yourGotchi.sample;
  return (
    <div className="pet-chat gotchi-chat">
      <div className="pet-chat-head">
        <p className="mint-subtitle">{petPage.chat.title}</p>
        <p className="pet-chat-note">{petPage.chat.note}</p>
      </div>
      <div className="pet-chat-log">
        <p className="pet-msg is-you">{you}</p>
        <p className="pet-msg is-pet">{reply}</p>
      </div>
      <div className="pet-chat-form">
        <span className="mint-input gotchi-input">{fill(petPage.chat.placeholder, { name })}</span>
        <span className="button button-primary">{petPage.chat.send}</span>
      </div>
    </div>
  );
}

const TILES = [
  { key: "stats", Preview: StatsPreview },
  { key: "games", Preview: GamesPreview },
  { key: "feed", Preview: FeedPreview },
  { key: "chat", Preview: ChatPreview },
] as const;

/**
 * "meet your gotchi" (docs/DEVLOG.md §3): the 4 tabs of /pet as tiles, each with a mini preview built
 * from the real components and styles (token art, tier badge, stat bars, catch console, snack cards, chat)
 * with fixed sample data, plus one sentence. Previews are inert and hidden from assistive tech; the
 * sentence carries the meaning.
 */
export default function MeetYourGotchi() {
  return (
    <section id="your-gotchi" className="steps-section gotchi-section" aria-labelledby="your-gotchi-title">
      <div className="pets-grid" aria-hidden="true" />
      <div className="pets-content">
        <div className="section-head">
          <h2 id="your-gotchi-title" className="steps-title section-title-host">
            {yourGotchi.header}
            <TitleSparkles seed="title-your-gotchi" below />
          </h2>
          <Mascot {...mascots.yourGotchi} />
        </div>
        <p className="section-sub">{yourGotchi.sub}</p>
        <ul className="gotchi-tiles">
          {TILES.map(({ key, Preview }) => (
            <li key={key} className="gotchi-tile">
              <h3 className="gotchi-tile-tab">{yourGotchi.tiles[key].title}</h3>
              <div className="gotchi-preview" aria-hidden="true" inert>
                <Preview />
              </div>
              <p className="gotchi-tile-body">{yourGotchi.tiles[key].body}</p>
            </li>
          ))}
        </ul>
        <div className="section-cta cta-marks">
          <Link className="button button-primary" href="/mint">
            {yourGotchi.cta}
            <span className="launch-arrow" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

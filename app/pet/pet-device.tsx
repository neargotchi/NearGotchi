"use client";

import Image from "next/image";
import type { CSSProperties } from "react";

import Sparkles from "../../components/Sparkles";
import { fill, petPage } from "../../lib/copy";
import { moods, petSpriteSrc, type Mood, type PetProfile } from "../../lib/mocks";
import type { SnackId } from "../../lib/shop";
import SnackSprite from "./snack-sprites";

/** One feed animation run; a new `run` remounts the layer so a click mid-animation restarts it. */
export type FeedAnim = { run: number; kind: "fed" | "full"; snack: SnackId };

type PetDeviceProps = {
  profile: PetProfile;
  name: string;
  mood: Mood;
  hop: number;
  burst: number;
  feed: FeedAnim | null;
  onTap: () => void;
};

/**
 * The egg's look as a big handheld: cream body, NEAR green frame, LCD screen, three buttons.
 * All four mood sprites are loaded up front and swapped with `hidden`, so a mood change never
 * flashes an empty screen.
 */
export default function PetDevice({ profile, name, mood, hop, burst, feed, onTap }: PetDeviceProps) {
  return (
    <div className="pet-device">
      <div className="pet-device-body">
        <div className="pet-device-frame">
          <div
            className="pet-device-screen"
            style={{ "--mouth-x": profile.mouth[0], "--mouth-y": profile.mouth[1] } as CSSProperties}
          >
            <button type="button" className="pet-device-tap" aria-label={fill(petPage.tapLabel, { name })} onClick={onTap}>
              {/* chew/turn-away wrapper (restarted per feed run), then the hop wrapper (per tap) */}
              <span key={feed ? `feed-${feed.run}` : "idle"} className={feed ? `pet-device-chew is-${feed.kind}` : "pet-device-chew"}>
              <span key={hop} className={hop ? "pet-device-figure is-hop" : "pet-device-figure"}>
                {moods.map((item) => (
                  <Image
                    key={item}
                    className="pet-device-sprite"
                    src={petSpriteSrc(profile, item)}
                    alt=""
                    width={profile.spriteWidth}
                    height={profile.spriteHeight}
                    hidden={item !== mood}
                    priority
                  />
                ))}
              </span>
              </span>
            </button>
            {feed ? (
              /* keys are prefixed: the feed layer and the burst are siblings, so equal counters must not collide */
              <span key={`feed-${feed.run}`} className={`pet-feed is-${feed.kind}`} aria-hidden="true">
                <span className="pet-mouth">
                <span className={`pet-snack is-${feed.snack}`}>
                  <SnackSprite id={feed.snack} className="pet-snack-svg" />
                </span>
                {feed.kind === "fed" ? (
                  <>
                    <span className="pet-crumbs">
                      <span />
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className="pet-nom">+nom</span>
                  </>
                ) : null}
                </span>
              </span>
            ) : null}
            {burst ? (
              <Sparkles
                key={`burst-${burst}`}
                count={8}
                colors={["var(--green)", "var(--sparkle-alt)"]}
                area={[
                  { x: [8, 26], y: [8, 32] },
                  { x: [74, 92], y: [8, 32] },
                  { x: [6, 22], y: [56, 84] },
                  { x: [78, 94], y: [56, 84] },
                ]}
                seed={`pet-${profile.id}-${burst % 3}`}
                size={20}
                mode="burst"
              />
            ) : null}
          </div>
        </div>
        <span className="pet-device-buttons" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}

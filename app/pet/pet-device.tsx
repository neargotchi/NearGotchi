"use client";

import Image from "next/image";

import Sparkles from "../../components/Sparkles";
import { fill, petPage } from "../../lib/copy";
import { moods, petSpriteSrc, type Mood, type PetProfile } from "../../lib/mocks";

type PetDeviceProps = {
  profile: PetProfile;
  name: string;
  mood: Mood;
  hop: number;
  burst: number;
  onTap: () => void;
};

/**
 * The egg's look as a big handheld: cream body, NEAR green frame, LCD screen, three buttons.
 * All four mood sprites are loaded up front and swapped with `hidden`, so a mood change never
 * flashes an empty screen.
 */
export default function PetDevice({ profile, name, mood, hop, burst, onTap }: PetDeviceProps) {
  return (
    <div className="pet-device">
      <div className="pet-device-body">
        <div className="pet-device-frame">
          <div className="pet-device-screen">
            <button type="button" className="pet-device-tap" aria-label={fill(petPage.tapLabel, { name })} onClick={onTap}>
              {/* key restarts the hop on every tap */}
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
            </button>
            {burst ? (
              <Sparkles
                key={burst}
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

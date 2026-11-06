"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { fill, mintPage } from "../../lib/copy";
import {
  MintError,
  PET_NAME_MAX,
  findPet,
  getPet,
  isPersistent,
  mintPet,
  normalizePetName,
  petSpriteSrc,
  pets,
  resetPet,
  subscribePet,
  validatePetName,
  type DemoPet,
  type NameError,
  type PetProfile,
} from "../../lib/mocks";
import HatchStage from "./hatch-stage";
import PetPicker from "./pet-picker";

type View = "loading" | "form" | "existing" | "hatching";
type Focus = "first-radio" | "existing" | "confirm" | null;

/** Name errors only (no_pet is shown on the picker). */
type FieldError = Exclude<NameError, "no_pet">;

/**
 * /mint state machine: loading → existing | form → hatching → /pet.
 * The pet is saved before the hatch plays, so leaving mid-hatch keeps it.
 */
export default function MintFlow() {
  const router = useRouter();
  const [view, setView] = useState<View>("loading");
  const viewRef = useRef<View>("loading");
  const [pet, setPet] = useState<DemoPet | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<FieldError | null>(null);
  const [pickError, setPickError] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [hatch, setHatch] = useState<{ profile: PetProfile; name: string } | null>(null);
  const [focus, setFocus] = useState<Focus>(null);

  const firstRadioRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const existingRef = useRef<HTMLHeadingElement>(null);
  const confirmRef = useRef<HTMLParagraphElement>(null);

  const go = (next: View) => {
    viewRef.current = next;
    setView(next);
  };

  useEffect(() => {
    let live = true;
    setPersistent(isPersistent());
    // Deep link /mint?pet=pet1|pet2|pet3 preselects; anything else selects nothing.
    const fromUrl = new URLSearchParams(window.location.search).get("pet");
    if (findPet(fromUrl)) setSelected(fromUrl);

    getPet().then((saved) => {
      if (!live || viewRef.current !== "loading") return;
      setPet(saved);
      go(saved ? "existing" : "form");
    });

    // Other tabs (and this tab's own reset) keep the view in sync; a running hatch is left alone.
    const unsubscribe = subscribePet((saved) => {
      if (!live || viewRef.current === "hatching") return;
      setPet(saved);
      setConfirming(false);
      go(saved ? "existing" : "form");
    });

    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  // Focus moves only after a user action, never on first load.
  useEffect(() => {
    if (!focus) return;
    if (focus === "first-radio" && view === "form") firstRadioRef.current?.focus();
    if (focus === "existing" && view === "existing") existingRef.current?.focus();
    if (focus === "confirm" && confirming) confirmRef.current?.focus();
    setFocus(null);
  }, [focus, view, confirming]);

  const nameCheck = (value: string) => {
    if (!normalizePetName(value)) return null;
    const result = validatePetName(value, selected ?? pets[0].id);
    return result.ok || result.error === "no_pet" ? null : result.error;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (viewRef.current !== "form") return;
    const profile = findPet(selected);
    if (!profile) {
      setPickError(true);
      firstRadioRef.current?.focus();
      return;
    }
    const checked = validatePetName(name, profile.id);
    if (!checked.ok) {
      setNameError(checked.error === "no_pet" ? null : checked.error);
      inputRef.current?.focus();
      return;
    }
    // Hatching before the save notifies subscribers, so this tab's listener ignores it.
    go("hatching");
    setHatch({ profile, name: checked.name });
    try {
      setPet(await mintPet({ petId: profile.id, name: checked.name }));
    } catch (error) {
      go("form");
      setHatch(null);
      if (error instanceof MintError && error.code !== "no_pet") setNameError(error.code);
    }
  };

  const startOver = async () => {
    await resetPet();
    setConfirming(false);
    setName("");
    setNameError(null);
    setPickError(false);
    go("form");
    setFocus("first-radio");
  };

  if (view === "hatching" && hatch) {
    return <HatchStage profile={hatch.profile} name={hatch.name} onDone={() => router.push("/pet")} />;
  }

  if (view === "existing" && pet) {
    const profile = findPet(pet.petId)!;
    return (
      <div className="mint-existing">
        <h2 ref={existingRef} className="mint-subtitle" tabIndex={-1}>
          {mintPage.existing.title}
        </h2>
        <div className="mint-existing-body">
          <div className="pet-card mint-existing-card">
            <div className="pet-sprite-wrap">
              <Image
                className="pet-sprite"
                src={petSpriteSrc(profile, "happy")}
                alt=""
                width={profile.spriteWidth}
                height={profile.spriteHeight}
              />
            </div>
            <p className="mint-card-name">
              <span className="mint-card-title">{pet.name}</span>
            </p>
            <p className="mint-card-text">{fill(mintPage.existing.body, { name: pet.name, species: pet.species })}</p>
          </div>
          {confirming ? (
            <div className="mint-confirm" role="group" aria-labelledby="mint-confirm-text">
              <p id="mint-confirm-text" ref={confirmRef} tabIndex={-1}>
                {fill(mintPage.confirm.text, { name: pet.name })}
              </p>
              <div className="mint-actions">
                <button type="button" className="button button-secondary" onClick={startOver}>
                  {mintPage.confirm.yes}
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    setConfirming(false);
                    setFocus("existing");
                  }}
                >
                  {fill(mintPage.confirm.keep, { name: pet.name })}
                </button>
              </div>
            </div>
          ) : (
            <div className="mint-actions">
              <Link className="button button-primary" href="/pet">
                {mintPage.existing.go}
              </Link>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setConfirming(true);
                  setFocus("confirm");
                }}
              >
                {mintPage.existing.startOver}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const placeholder = findPet(selected)?.name ?? "";

  return (
    <>
      <noscript>
        <p className="mint-note">{mintPage.noscript}</p>
        <style>{".mint-form.is-loading { visibility: visible; }"}</style>
      </noscript>
      <form
        className={view === "loading" ? "mint-form is-loading" : "mint-form"}
        aria-busy={view === "loading" || undefined}
        noValidate
        onSubmit={submit}
      >
        <PetPicker
          selected={selected}
          error={pickError}
          firstRadioRef={firstRadioRef}
          onSelect={(petId) => {
            setSelected(petId);
            setPickError(false);
          }}
        />
        <div className="mint-step mint-name">
          <label className="mint-legend" htmlFor="mint-name">
            {mintPage.nameLabel}
          </label>
          <div className="mint-name-row">
            <input
              ref={inputRef}
              id="mint-name"
              className="mint-input"
              type="text"
              name="name"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={PET_NAME_MAX * 2}
              placeholder={placeholder}
              value={name}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "mint-name-hint mint-name-error" : "mint-name-hint"}
              onChange={(event) => {
                setName(event.target.value);
                // Clear a shown error as soon as the value is fixed; new errors wait for blur/submit.
                if (nameError && !nameCheck(event.target.value)) setNameError(null);
              }}
              onBlur={() => {
                const normalized = normalizePetName(name);
                setName(normalized);
                setNameError(nameCheck(normalized));
              }}
            />
            <button type="submit" className="button button-primary">
              {mintPage.mintButton}
              <span className="mint-tag">{mintPage.mintTag}</span>
            </button>
          </div>
          <p id="mint-name-hint" className="mint-hint">
            {mintPage.nameHint}
          </p>
          {nameError ? (
            <p id="mint-name-error" className="mint-error" role="alert">
              {mintPage.errors[nameError]}
            </p>
          ) : null}
        </div>
        {persistent ? null : <p className="mint-note">{mintPage.storageNote}</p>}
      </form>
    </>
  );
}

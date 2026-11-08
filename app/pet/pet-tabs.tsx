"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { petPage } from "../../lib/copy";

export const petTabs = ["stats", "games", "feed", "chat"] as const;
export type PetTab = (typeof petTabs)[number];

export const isPetTab = (value: unknown): value is PetTab => petTabs.includes(value as PetTab);

type PetTabsProps = {
  tab: PetTab;
  onTab: (tab: PetTab) => void;
  /** Accessible name of the tab list ("{name} menu"). */
  label: string;
  panels: Record<PetTab, ReactNode>;
};

/**
 * WAI-ARIA tabs (automatic activation): ←/→ move and select, Home/End jump; only the selected tab is in
 * the tab order. All panels stay mounted (hidden), so a half-typed chat message survives a tab switch.
 */
export default function PetTabs({ tab, onTab, label, panels }: PetTabsProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = petTabs.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onTab(petTabs[next]);
    buttons.current[next]?.focus();
  };

  return (
    <div className="pet-tabs">
      <div className="pet-tablist" role="tablist" aria-label={label}>
        {petTabs.map((name, index) => (
          <button
            key={name}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`pet-tab-${name}`}
            className="pet-tab"
            aria-selected={name === tab}
            aria-controls={`pet-panel-${name}`}
            tabIndex={name === tab ? 0 : -1}
            onClick={() => onTab(name)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {petPage.tabs[name]}
          </button>
        ))}
      </div>
      {petTabs.map((name) => (
        <div
          key={name}
          role="tabpanel"
          id={`pet-panel-${name}`}
          className="pet-panel"
          aria-labelledby={`pet-tab-${name}`}
          hidden={name !== tab}
          tabIndex={0}
        >
          {panels[name]}
        </div>
      ))}
    </div>
  );
}

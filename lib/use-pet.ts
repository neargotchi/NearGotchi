"use client";

import { useEffect, useState } from "react";

import { getPet, subscribePet, type DemoPet } from "./mocks";

/** Saved demo pet on the client. `ready` is false on the server and the first paint. */
export function usePet() {
  const [state, setState] = useState<{ ready: boolean; pet: DemoPet | null }>({ ready: false, pet: null });

  useEffect(() => {
    let live = true;
    getPet().then((pet) => live && setState({ ready: true, pet }));
    const unsubscribe = subscribePet((pet) => live && setState({ ready: true, pet }));
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  return state;
}

"use client";

import { useEffect, useState } from "react";

import { getAccount, subscribeAccount, type DemoAccount } from "./wallet";

/** Connected demo account on the client. `ready` is false on the server and the first paint. */
export function useWallet() {
  const [state, setState] = useState<{ ready: boolean; account: DemoAccount | null }>({ ready: false, account: null });

  useEffect(() => {
    let live = true;
    getAccount().then((account) => live && setState({ ready: true, account }));
    const unsubscribe = subscribeAccount((account) => live && setState({ ready: true, account }));
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  return state;
}

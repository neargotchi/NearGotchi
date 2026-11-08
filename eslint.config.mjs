// Standard Next.js 16 flat config (create-next-app default). Added in task 035: `npm run lint` had no config.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Warn, not error, until reviewed: the existing code reads browser-only state (localStorage, theme)
    // in mount effects after hydration and keeps latest callbacks in refs, on purpose (/mint, /pet, theme toggle).
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"]),
]);

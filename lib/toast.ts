// Tiny toast bus (task 064): any client code calls toast("text"), app/toaster.tsx shows it bottom right.

export type ToastKind = "info" | "error";
export type ToastItem = { id: number; text: string; kind: ToastKind };

type Listener = (item: ToastItem) => void;
const listeners = new Set<Listener>();
let nextId = 1;

/** Shows a toast (auto-hides after ~4 s). No-op on the server or when no toaster is mounted. */
export function toast(text: string, kind: ToastKind = "info") {
  const item = { id: nextId++, text, kind };
  listeners.forEach((listener) => listener(item));
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

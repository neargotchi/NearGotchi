"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { askNearAi, nearAiEnabled } from "../../lib/chat-client";
import { isOnChain } from "../../lib/chain";
import { fill, petPage } from "../../lib/copy";
import {
  PET_RULES,
  chatWithPet,
  getChat,
  subscribeChat,
  type ChatMessage,
  type DemoPet,
} from "../../lib/mocks";

type PetChatProps = {
  name: string;
  /** "buy an energy pack": opens the shop tab. */
  onShop: () => void;
  /** The pet after a message (energy spent). */
  onPet: (pet: DemoPet) => void;
  /** A real reply was revealed → happy for 3s. */
  onReply: () => void;
  /** Mainnet (task 081): the server said the session is gone — show the sign-in again. */
  onSignedOut?: () => void;
  /** task 088: "sign in" in the signed-out note reopens the sign-in popup. */
  onSignIn?: () => void;
};

const typingDelay = (reply: ChatMessage) => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 400;
  return Math.min(1400, 600 + 20 * reply.text.length);
};

/**
 * Local chat: your message shows at once; the reply (already stored) is revealed after a short
 * pixel "typing…" delay. One reply at a time, one message queued behind it.
 */
export default function PetChat({ name, onShop, onPet, onReply, onSignedOut, onSignIn }: PetChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  /** The pet is waiting for NEAR AI (the energy is spent only once the answer is in). */
  const [thinking, setThinking] = useState(false);
  /** null = unknown yet; true = real NEAR AI; false = mock answers. */
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const queued = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = useRef({ onPet, onReply, onSignedOut });
  callbacks.current = { onPet, onReply, onSignedOut };

  useEffect(() => {
    let live = true;
    const load = () => getChat().then((log) => live && !busy.current && setMessages(log));
    load();
    const unsubscribe = subscribeChat(load);
    nearAiEnabled().then((on) => live && setAiOn(on));
    return () => {
      live = false;
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Keep the newest message in view inside the log (the page itself doesn't scroll).
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, typing]);

  const run = async (text: string) => {
    busy.current = true;
    let result: Awaited<ReturnType<typeof chatWithPet>>;
    setMessages((current) => [...current, { id: "pending", from: "you", text, at: new Date().toISOString() }]);
    setThinking(true);
    try {
      result = await chatWithPet(text, undefined, askNearAi);
    } catch {
      setThinking(false);
      busy.current = false;
      return;
    }
    setThinking(false);
    callbacks.current.onPet(result.pet);
    if (result.kind === "signed_out") callbacks.current.onSignedOut?.();
    const note = result.kind === "no_energy" || result.kind === "ai_error" || result.kind === "resting" || result.kind === "signed_out";
    if (!note) setAiOn(result.source === "ai");
    if (result.source === "ai" || note) {
      // the wait already happened: show the answer at once
      setMessages(result.messages);
      if (result.kind === "reply" || result.kind === "hungry") callbacks.current.onReply();
      busy.current = false;
      const next = queued.current;
      queued.current = null;
      if (next) run(next);
      return;
    }
    setMessages(result.messages.slice(0, -1));
    setTyping(true);
    timer.current = setTimeout(() => {
      setMessages(result.messages);
      setTyping(false);
      if (result.kind === "reply") callbacks.current.onReply();
      busy.current = false;
      const next = queued.current;
      queued.current = null;
      if (next) run(next);
    }, typingDelay(result.reply));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      setError(petPage.chat.blank);
      return;
    }
    if (text.length > PET_RULES.messageMax) {
      setError(petPage.chat.tooLong);
      return;
    }
    setError(null);
    setDraft("");
    if (busy.current) queued.current = text;
    else run(text);
  };

  return (
    <section className="pet-chat" aria-labelledby="pet-chat-title">
      <div className="pet-chat-head">
        <h2 id="pet-chat-title" className="mint-subtitle">
          {petPage.chat.title}
        </h2>
        <p className="pet-chat-note">{aiOn === null ? petPage.chat.note : aiOn ? petPage.chat.noteAi : petPage.chat.noteMock}</p>
      </div>
      {isOnChain ? <p className="pet-ai-line">{petPage.chat.credits}</p> : null}
      <div ref={logRef} className="pet-chat-log" role="log" aria-live="polite" aria-labelledby="pet-chat-title" tabIndex={0}>
        {messages.length === 0 && !typing ? <p className="pet-chat-empty">{petPage.chat.empty}</p> : null}
        {messages.map((message) =>
          message.from === "note" ? (
            <p key={message.id} className="pet-msg is-note">
              {message.text === "ai_error" ? (
                petPage.chat.aiError
              ) : message.text === "resting" ? (
                petPage.chat.resting
              ) : message.text === "signed_out" ? (
                <>
                  {petPage.chat.signedOut}{" "}
                  {onSignIn ? (
                    <button type="button" className="chat-shop-link" onClick={onSignIn}>
                      {petPage.signIn.action}
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  {fill(petPage.chat.noEnergy, { name })}{" "}
                  <button type="button" className="chat-shop-link" onClick={onShop}>
                    {petPage.chat.noEnergyLink}
                  </button>
                </>
              )}
            </p>
          ) : (
            <p key={message.id} className={message.from === "you" ? "pet-msg is-you" : "pet-msg is-pet"}>
              <span className="visually-hidden">{message.from === "you" ? petPage.chat.you : name}: </span>
              {message.text}
            </p>
          ),
        )}
        {typing || thinking ? (
          <p className="pet-typing" aria-hidden="true">
            {fill(thinking ? petPage.chat.thinking : petPage.chat.typing, { name })}
          </p>
        ) : null}
      </div>
      <form className="pet-chat-form" noValidate onSubmit={submit}>
        <label className="visually-hidden" htmlFor="pet-message">
          {petPage.chat.label}
        </label>
        <input
          id="pet-message"
          className="mint-input"
          type="text"
          autoComplete="off"
          maxLength={PET_RULES.messageMax * 2}
          placeholder={fill(petPage.chat.placeholder, { name })}
          value={draft}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "pet-message-hint pet-message-error" : "pet-message-hint"}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
        />
        <button type="submit" className="button button-primary">
          {petPage.chat.send}
        </button>
      </form>
      <p id="pet-message-hint" className="mint-hint">
        {petPage.chat.hint}
      </p>
      {error ? (
        <p id="pet-message-error" className="mint-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

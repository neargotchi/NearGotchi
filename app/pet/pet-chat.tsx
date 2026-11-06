"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { fill, petPage } from "../../lib/copy";
import {
  PET_RULES,
  chatWithPet,
  getChat,
  subscribeChat,
  type ChatKind,
  type ChatMessage,
  type DemoPet,
} from "../../lib/mocks";

type PetChatProps = {
  name: string;
  /** The pet after a message (energy spent). */
  onPet: (pet: DemoPet) => void;
  /** A real reply was revealed → happy for 3s. */
  onReply: () => void;
};

const typingDelay = (reply: ChatMessage) => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 400;
  return Math.min(1400, 600 + 20 * reply.text.length);
};

/**
 * Local chat: your message shows at once; the reply (already stored) is revealed after a short
 * pixel "typing…" delay. One reply at a time, one message queued behind it.
 */
export default function PetChat({ name, onPet, onReply }: PetChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const queued = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = useRef({ onPet, onReply });
  callbacks.current = { onPet, onReply };

  useEffect(() => {
    let live = true;
    const load = () => getChat().then((log) => live && !busy.current && setMessages(log));
    load();
    const unsubscribe = subscribeChat(load);
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
    let result: { pet: DemoPet; messages: ChatMessage[]; reply: ChatMessage; kind: ChatKind };
    try {
      result = await chatWithPet(text);
    } catch {
      busy.current = false;
      return;
    }
    callbacks.current.onPet(result.pet);
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
        <p className="pet-chat-note">{petPage.chat.note}</p>
      </div>
      <div ref={logRef} className="pet-chat-log" role="log" aria-live="polite" aria-labelledby="pet-chat-title" tabIndex={0}>
        {messages.length === 0 && !typing ? <p className="pet-chat-empty">{petPage.chat.empty}</p> : null}
        {messages.map((message) =>
          message.from === "note" ? (
            <p key={message.id} className="pet-msg is-note">
              {fill(petPage.chat.asleep, { name })}
            </p>
          ) : (
            <p key={message.id} className={message.from === "you" ? "pet-msg is-you" : "pet-msg is-pet"}>
              <span className="visually-hidden">{message.from === "you" ? petPage.chat.you : name}: </span>
              {message.text}
            </p>
          ),
        )}
        {typing ? (
          <p className="pet-typing" aria-hidden="true">
            {fill(petPage.chat.typing, { name })}
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

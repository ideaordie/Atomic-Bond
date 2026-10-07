"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { EMOTIONS, type Emotion } from "../../types/emotional-pulse";
import {
  EMOTION_DEFINITIONS,
  PULSE_CATEGORIES,
  type PulseCategory,
} from "../../living-atom/pulse/emotions";
import { PulsePreview } from "./PulsePreview";
import "./emotional-pulse.css";

export function PulseComposer({
  onSend,
  onClose,
  synthetic = true,
}: {
  synthetic?: boolean;
  onSend: (emotion: Emotion) => void | Promise<void>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const [emotion, setEmotion] = useState<Emotion | null>(null);
  const [category, setCategory] = useState<PulseCategory>("FEELING");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const element = dialog.current!;
    const opener = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (opener instanceof HTMLElement) opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="pulse-composer"
      aria-labelledby="emotion-heading"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!emotion || pending) return;
          setPending(true);
          setError("");
          try {
            await onSend(emotion);
          } catch {
            setError("Pulse could not be sent. Please retry.");
          } finally {
            setPending(false);
          }
        }}
      >
        <p className="emotion-eyebrow">YOUR PULSE</p>
        <h2 id="emotion-heading">How are you right now?</h2>
        <p>
          Share one current state with your connected network for 24 hours. A
          new Pulse replaces your previous state.
        </p>
        <div
          className="pulse-categories"
          role="tablist"
          aria-label="Pulse categories"
        >
          {PULSE_CATEGORIES.map((item, index) => (
            <button
              key={item}
              type="button"
              role="tab"
              id={`pulse-tab-${item}`}
              aria-controls="pulse-options"
              aria-selected={category === item}
              tabIndex={category === item ? 0 : -1}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              disabled={pending}
              onClick={() => setCategory(item)}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % 3
                    : event.key === "ArrowLeft"
                      ? (index + 2) % 3
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? 2
                          : null;
                if (next === null) return;
                event.preventDefault();
                setCategory(PULSE_CATEGORIES[next]!);
                tabs.current[next]?.focus();
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <div
          id="pulse-options"
          role="tabpanel"
          aria-labelledby={`pulse-tab-${category}`}
        >
          <fieldset disabled={pending}>
            <legend>Choose one state · {category.toLowerCase()}</legend>
            <div className="emotion-options">
              {EMOTIONS.filter(
                (key) => EMOTION_DEFINITIONS[key].category === category,
              ).map((key) => {
                const definition = EMOTION_DEFINITIONS[key];
                return (
                  <label
                    key={key}
                    style={
                      { "--emotion-color": definition.color } as CSSProperties
                    }
                  >
                    <input
                      type="radio"
                      name="emotion"
                      value={key}
                      checked={emotion === key}
                      onChange={() => setEmotion(key)}
                    />
                    <span className="emotion-dot" aria-hidden="true" />
                    <span>{definition.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
        <PulsePreview emotion={emotion} />
        <div className="emotion-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={!emotion || pending}>
            {pending ? "Sending Pulse…" : "Send Pulse"}
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        {synthetic && (
          <small>Local simulation · no notifications · resets on refresh</small>
        )}
      </form>
    </dialog>
  );
}

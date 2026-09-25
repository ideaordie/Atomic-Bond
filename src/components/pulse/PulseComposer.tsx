"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { EMOTIONS, type Emotion } from "../../types/emotional-pulse";
import { EMOTION_DEFINITIONS } from "../../living-atom/pulse/emotions";
import "./emotional-pulse.css";

export function PulseComposer({
  onSend,
  onClose,
}: {
  onSend: (emotion: Emotion) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [emotion, setEmotion] = useState<Emotion | null>(null);
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
        onSubmit={(event) => {
          event.preventDefault();
          if (emotion) onSend(emotion);
        }}
      >
        <p className="emotion-eyebrow">YOUR EMOTIONAL PULSE</p>
        <h2 id="emotion-heading">How are you feeling?</h2>
        <p>
          A voluntary signal, visible to your connected network for 24 hours. A
          new Pulse replaces it.
        </p>
        <fieldset>
          <legend>Choose one emotional state</legend>
          <div className="emotion-options">
            {EMOTIONS.map((key) => {
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
        <div className="emotion-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={!emotion}>
            Send Pulse
          </button>
        </div>
        <small>Local simulation · no notifications · resets on refresh</small>
      </form>
    </dialog>
  );
}

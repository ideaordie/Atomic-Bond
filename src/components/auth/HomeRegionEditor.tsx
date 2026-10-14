"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HomeRegion } from "./HomeRegion";
import { updateHomeRegion } from "../../services/auth/actions";

export function HomeRegionEditor({
  current,
  save = updateHomeRegion,
}: {
  current: string;
  save?: typeof updateHomeRegion;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <section aria-label="Home Region">
      <h2>HOME REGION</h2>
      <p>{current}</p>
      {!editing ? (
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setEditing(true);
            setMessage("");
          }}
        >
          EDIT HOME REGION
        </button>
      ) : (
        <form
          aria-busy={pending}
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending) return;
            const data = new FormData(event.currentTarget);
            setPending(true);
            try {
              const result = await save(data);
              setMessage(result.error ?? "Home Region updated.");
              if (!result.error) {
                setEditing(false);
                router.refresh();
              }
            } catch {
              setMessage("Unable to update Home Region. Please try again.");
            } finally {
              setPending(false);
            }
          }}
        >
          <HomeRegion />
          <button disabled={pending}>
            {pending ? "Saving…" : "SAVE HOME REGION"}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={pending}
            onClick={() => setEditing(false)}
          >
            CANCEL
          </button>
        </form>
      )}
      <p role="status">{message}</p>
    </section>
  );
}

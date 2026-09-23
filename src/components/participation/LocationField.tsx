"use client";

import { useId, useState } from "react";
import type {
  Location,
  LocationService,
} from "../../services/participation/contracts";

export function LocationField({
  service,
  onSelect,
}: {
  service: LocationService;
  onSelect: (id: string) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Location | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const results = service.search(query);
  const choose = (location: Location) => {
    setSelected(location);
    setQuery(location.displayName);
    setOpen(false);
    setActive(-1);
    onSelect(location.id);
  };
  return (
    <div className="location-field">
      <label htmlFor={id}>Home region</label>
      <input
        id={id}
        role="combobox"
        autoComplete="off"
        placeholder="Start typing your city…"
        value={query}
        aria-autocomplete="list"
        aria-expanded={open && results.length > 0}
        aria-controls={`${id}-results`}
        aria-activedescendant={
          open && active >= 0 ? `${id}-${active}` : undefined
        }
        aria-describedby={`${id}-help`}
        onFocus={() => {
          if (!selected) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelected(null);
          onSelect("");
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((value) =>
              results.length
                ? value < 0
                  ? event.key === "ArrowDown"
                    ? 0
                    : results.length - 1
                  : (value +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      results.length) %
                    results.length
                : -1,
            );
          } else if (
            event.key === "Enter" &&
            open &&
            active >= 0 &&
            results[active]
          ) {
            event.preventDefault();
            choose(results[active]);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {open && results.length > 0 && (
        <ul
          className="location-results"
          role="listbox"
          id={`${id}-results`}
          aria-label="Home region results"
        >
          {results.map((location, index) => (
            <li
              key={location.id}
              id={`${id}-${index}`}
              role="option"
              aria-selected={active === index}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(location)}
            >
              <strong>{location.city}</strong>
              <span>
                {location.region} · {location.country}
              </span>
            </li>
          ))}
        </ul>
      )}
      {open && query.length >= 2 && results.length === 0 && (
        <p className="location-results location-empty" role="status">
          No matching city in this development catalog. Try Boynton Beach or
          Lisbon.
        </p>
      )}
      {selected && (
        <p className="location-selected" role="status">
          <strong>✓ {selected.city}</strong>
          <span>
            {selected.region} · {selected.country}
          </span>
        </p>
      )}
      <p id={`${id}-help`} className="field-help">
        Your home region helps show how far your network reaches. Atomic Bond
        does not require your exact address.
      </p>
    </div>
  );
}

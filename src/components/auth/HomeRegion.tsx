"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  COUNTRIES,
  canonicalRegion,
  searchRegions,
  type RegionChoice,
} from "../../services/locations/canonical-regions";

function SearchSelect({
  label,
  choices,
  onSelect,
}: {
  label: string;
  choices: readonly RegionChoice[];
  onSelect: (code: string) => void;
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const results = searchRegions(choices, query);
  const choose = (choice: RegionChoice) => {
    setQuery(choice.name);
    onSelect(choice.code);
    input.current?.setCustomValidity("");
    input.current?.focus();
    setOpen(false);
  };
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, id, open]);
  return (
    <div
      className="region-select"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>{label} (required)</label>
      <input
        ref={input}
        id={id}
        role="combobox"
        required
        autoComplete="off"
        spellCheck={false}
        placeholder={`Select ${label === "Country" ? "country" : "region"}…`}
        value={query}
        aria-expanded={open}
        aria-controls={`${id}-results`}
        aria-autocomplete="list"
        aria-activedescendant={
          open && results[active] ? `${id}-option-${active}` : undefined
        }
        aria-describedby={`${id}-help`}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
          onSelect("");
          e.currentTarget.setCustomValidity(
            "Select a canonical result from the list.",
          );
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((n) =>
              results.length
                ? (n + (e.key === "ArrowDown" ? 1 : -1) + results.length) %
                  results.length
                : 0,
            );
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            if (results[active]) choose(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
            e.stopPropagation();
          }
        }}
      />
      <small id={`${id}-help`}>Type to search, then select a result.</small>
      {open && (
        <ul
          id={`${id}-results`}
          role="listbox"
          aria-label={`${label} results`}
          className="region-options"
        >
          {results.map((choice, index) => (
            <li key={choice.code} role="presentation">
              <button
                type="button"
                role="option"
                id={`${id}-option-${index}`}
                aria-selected={index === active}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(choice)}
              >
                {choice.name} <small>{choice.code}</small>
              </button>
            </li>
          ))}
          {!results.length && (
            <li role="presentation">
              No matching results. Try another name or code.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
export function HomeRegion() {
  const [countryCode, setCountry] = useState(""),
    [subdivisionCode, setSubdivision] = useState("");
  const country = COUNTRIES.find((c) => c.code === countryCode);
  const selected = canonicalRegion(countryCode, subdivisionCode);
  return (
    <fieldset className="home-region">
      <legend>HOME REGION</legend>
      <p>Choose your country and region. No city, address or GPS is needed.</p>
      <SearchSelect
        label="Country"
        choices={COUNTRIES}
        onSelect={(code) => {
          setCountry(code);
          setSubdivision("");
        }}
      />
      {country && country.subdivisions.length > 0 && (
        <SearchSelect
          key={country.code}
          label="State / Province / Region"
          choices={country.subdivisions}
          onSelect={setSubdivision}
        />
      )}
      {country && !country.subdivisions.length && (
        <p>Country-level selection is sufficient for this location.</p>
      )}
      <input type="hidden" name="locationId" value={selected?.id ?? ""} />
      <p id="selected-region" className="selected-region" hidden={!selected}>
        Selected: {selected?.displayName}
      </p>
    </fieldset>
  );
}

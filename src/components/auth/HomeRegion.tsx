"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  searchRegions,
  type RegionChoice,
} from "../../services/locations/region-search";

type Geography = typeof import("../../services/locations/region-lookup");
let cachedGeography: Geography | undefined;
let geographyRequest: Promise<Geography> | undefined;
function loadGeography() {
  return (geographyRequest ??= import("../../services/locations/region-lookup")
    .then((data) => {
      cachedGeography = data;
      return data;
    })
    .catch((error: unknown) => {
      geographyRequest = undefined;
      throw error;
    }));
}

function SearchSelect({
  label,
  choices,
  onSelect,
  onOpen,
  loading = false,
  loadError = false,
}: {
  label: string;
  choices: readonly RegionChoice[];
  onSelect: (code: string) => void;
  onOpen?: () => void;
  loading?: boolean;
  loadError?: boolean;
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
        onFocus={() => {
          setOpen(true);
          onOpen?.();
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
          onOpen?.();
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
          aria-busy={loading}
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
          {loading && (
            <li role="presentation">
              <span role="status">Loading countries and regions…</span>
            </li>
          )}
          {loadError && (
            <li role="presentation">
              <span role="alert">Unable to load countries and regions.</span>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  // Keep focus in the selector when the retry control disappears.
                  input.current?.focus();
                  setOpen(true);
                  onOpen?.();
                }}
              >
                TRY AGAIN
              </button>
            </li>
          )}
          {!loading && !loadError && !results.length && (
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
  const [geography, setGeography] = useState(cachedGeography);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const ensureGeography = async () => {
    if (geography || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setLoadError(false);
    try {
      const data = await loadGeography();
      if (mounted.current) setGeography(data);
    } catch {
      if (mounted.current) setLoadError(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  };
  const [countryCode, setCountry] = useState(""),
    [subdivisionCode, setSubdivision] = useState("");
  const country = geography?.COUNTRIES.find((c) => c.code === countryCode);
  const selected = geography?.canonicalRegion(countryCode, subdivisionCode);
  return (
    <fieldset className="home-region">
      <legend>HOME REGION</legend>
      <p>Choose your country and region. No city, address or GPS is needed.</p>
      <SearchSelect
        label="Country"
        choices={geography?.COUNTRIES ?? []}
        onOpen={ensureGeography}
        loading={loading}
        loadError={loadError}
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

// Offline, reproducible seed generation. Never edits an applied migration.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const catalog = JSON.parse(
  readFileSync("src/data/locations/catalog.json", "utf8"),
);
const quote = (v) => (v == null ? "null" : `'${v.replaceAll("'", "''")}'`);
const id = (code) =>
  `ab830000-0000-4000-8000-${Buffer.from(code).toString("hex").padEnd(12, "0")}`;
const rows = catalog.flatMap((c) =>
  (c.subdivisions.length ? c.subdivisions : [null]).map(
    (s) =>
      `(${[id(s?.code ?? c.code), `iso3166:${s?.code ?? c.code}`, "", s?.name ?? "", c.name, c.code, [s?.name, c.name].filter(Boolean).join(", "), s?.code ?? null].map(quote).join(",")})`,
  ),
);
const base = readFileSync(
  "supabase/migrations/202609260001_atomic_bond.sql",
  "utf8",
);
const start = base.indexOf("create function public.public_graph(");
const end = base.indexOf("end $$;", start) + 7;
if (start < 0 || end < start) throw Error("Graph function not found");
const graph = base
  .slice(start, end)
  .replace("create function", "create or replace function")
  .replace(
    "'countryCode',l.country_code)",
    "'countryCode',l.country_code,'countryName',l.country,'subdivisionCode',l.subdivision_code)",
  )
  .replace(
    "concat_ws(', ',l.region,l.country)",
    "concat_ws(', ',nullif(l.region,''),l.country)",
  );
const sql = `-- Task #8.3: bundled coarse geography. Existing location rows/Atom associations remain intact.
begin;
alter table public.locations add column subdivision_code text;
alter table public.locations add constraint location_subdivision_country check (subdivision_code is null or (subdivision_code ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$' and left(subdivision_code,2)=country_code));
insert into public.locations(id,canonical_key,city,region,country,country_code,display_name,subdivision_code) values
${rows.join(",\n")}
on conflict(canonical_key) do nothing;
create or replace function public.canonical_location(p_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
select jsonb_build_object('id',id,'city',city,'region',region,'country',country,'country_code',country_code,'display_name',display_name,'subdivision_code',subdivision_code) from public.locations where id=p_id;
$$;
${graph}
commit;
`;
const target = "supabase/migrations/202609280001_coarse_regions.sql";
if (existsSync(target) && readFileSync(target, "utf8") !== sql)
  throw Error(
    "Migration differs; create a new reviewed migration for dataset updates.",
  );
writeFileSync(target, sql);
console.log(
  JSON.stringify({
    countries: catalog.length,
    selectableLocations: rows.length,
  }),
);

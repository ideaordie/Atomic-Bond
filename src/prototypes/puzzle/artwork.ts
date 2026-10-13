// One synthetic vector image; logical crops, never 25 separate files.
// This development asset is inspectable. It is NOT production image secrecy.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
<rect width="500" height="500" fill="#e9e6dc"/><circle cx="350" cy="100" r="60" fill="#dfb866"/>
<path d="M0 240L110 100L220 240L300 160L500 320V500H0Z" fill="#788c86"/>
<path d="M0 320Q120 200 260 330T500 300V500H0Z" fill="#4f6961"/>
<path d="M240 290Q400 330 250 390T370 500H140Q80 450 180 405T240 290" fill="#d9e5e2"/>
<path d="M45 370V180M15 230L45 180L80 230M5 270L45 210L90 270M410 400V240M375 290L410 240L450 290M365 335L410 270L465 335" fill="none" stroke="#263e37" stroke-width="12" stroke-linejoin="round"/>
<path d="M150 65l15 -8l15 8M215 110l15 -8l15 8" fill="none" stroke="#263e37" stroke-width="4"/>
<g fill="#dfb866"><circle cx="80" cy="430" r="8"/><circle cx="115" cy="460" r="6"/><circle cx="420" cy="450" r="9"/><circle cx="455" cy="415" r="6"/></g></svg>`;
export const ARTWORK = `data:image/svg+xml,${encodeURIComponent(svg)}`;
export const tileStyle = (piece: number) => ({
  backgroundImage: `url("${ARTWORK}")`,
  backgroundSize: "500% 500%",
  backgroundPosition: `${(piece % 5) * 25}% ${Math.floor(piece / 5) * 25}%`,
});

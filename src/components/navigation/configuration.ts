export const navigationGroups = {
  core: [{ label: "MY ATOM", href: "/explore", owner: true }],
  applications: [
    { label: "GLOBAL DOODLE", href: "/global-doodle", owner: true },
    { label: "PARTICIPUZZLE", href: "/partici-puzzle", owner: true },
  ],
  information: [
    { label: "ABOUT", href: "/about", owner: false },
    { label: "SETTINGS", href: "/owner", owner: true },
  ],
} as const;

/* Runs before body paint, including offline. Only a two-value local UI preference. */
(() => {
  let appearance = "light";
  try {
    if (localStorage.getItem("atomic-bond-appearance") === "dark")
      appearance = "dark";
  } catch {
    // Storage is optional. No identity, cookie or network fallback.
  }
  document.documentElement.dataset.appearance = appearance;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta)
    meta.setAttribute("content", appearance === "dark" ? "#101010" : "#ffffff");
})();

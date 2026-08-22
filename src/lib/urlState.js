// ---- URL state lives in the hash query (e.g. #/?cats=Agentic+Coding&sort=python&dir=desc) ----
export const readHash = () => {
  const h = window.location.hash || "";
  const qi = h.indexOf("?");
  return new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : "");
};
export const writeHash = (params) => {
  const h = window.location.hash || "#/";
  const base = h.indexOf("?") >= 0 ? h.slice(0, h.indexOf("?")) : h || "#/";
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `${base}?${qs}` : base);
};

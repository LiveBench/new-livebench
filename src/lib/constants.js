// Release dates that have a published table_<date>.csv (+ categories, + optional cost).
// Add new releases here (e.g. "2026-06-25") and drop the matching files in public/.
export const RELEASES = [
  "2024-06-24", "2024-07-26", "2024-08-31", "2024-11-25",
  "2025-04-02", "2025-04-25", "2025-05-30",
  "2025-11-25", "2025-12-23", "2026-01-08", "2026-06-25",
];

// Provider → dot/chip colour (muted but distinct on white). Fallback for anything unlisted.
const ORG_COLORS = {
  OpenAI: "#10A37F", Google: "#EA4335", Anthropic: "#CC785C", DeepSeek: "#7C3AED",
  Alibaba: "#F59E0B", Qwen: "#F59E0B", "Moonshot AI": "#EC4899", Moonshot: "#EC4899",
  xAI: "#111827", Meta: "#4267B2", Mistral: "#FF7000", "Mistral AI": "#FF7000",
  Cohere: "#39C5BB", AbacusAI: "#2F54EB", Arcee: "#9333EA", "Z.AI": "#0EA5E9",
  Minimax: "#DB2777", NVIDIA: "#76B900", Xiaomi: "#FF6900", Microsoft: "#0078D4",
};
export const orgColor = (org) => ORG_COLORS[org] || "#7A8AA8";

// Long category name → short column header.
const CAT_SHORT = {
  Reasoning: "Rsn", Coding: "Cod", "Agentic Coding": "Agt", Mathematics: "Mth",
  "Data Analysis": "Dat", Language: "Lng", IF: "IF", "Instruction Following": "IF",
};
export const catShort = (c) => CAT_SHORT[c] || c.slice(0, 3);

import { overallOf, perMillionOut, valueFrontier, collapseVariants } from "./compute";

// Mock model metadata so collapseVariants has a deterministic family key.
jest.mock("../Table/modelLinks", () => ({
  getModelInfo: (m) => ({ baseName: m.startsWith("fam-") ? "fam" : m }),
  getVariantGroup: () => null,
}));

test("overallOf = mean of per-category averages", () => {
  const categories = { Reasoning: ["a", "b"], Coding: ["c"] };
  const row = { model: "m1", a: 80, b: 60, c: 90 }; // Reasoning 70, Coding 90 -> 80
  expect(overallOf(row, categories)).toBe(80);
});

test("overallOf returns null when no scores", () => {
  expect(overallOf({ model: "x" }, { Reasoning: ["a"] })).toBeNull();
});

test("perMillionOut converts $/question + output tokens to $/1M", () => {
  expect(Math.round(perMillionOut({ cost_per_question: 0.2384, avg_output_tokens: 7826 }))).toBe(30);
  expect(perMillionOut(null)).toBeNull();
});

test("valueFrontier = cheapest model at each new score ceiling, estimates excluded", () => {
  const models = [
    { model: "A", overall: 70, cost: { cost_per_question: 0.01 } },
    { model: "B", overall: 75, cost: { cost_per_question: 0.02 } },
    { model: "C", overall: 72, cost: { cost_per_question: 0.03 } }, // dominated by B
    { model: "D", overall: 99, cost: { cost_per_question: 0.005, est: true } }, // estimate -> ignored
  ];
  const f = valueFrontier(models);
  expect([...f].sort()).toEqual(["A", "B"]);
});

test("collapseVariants keeps the highest-overall variant per family", () => {
  const models = [
    { model: "fam-low", overall: 70 },
    { model: "fam-high", overall: 82 },
    { model: "solo", overall: 60 },
  ];
  const out = collapseVariants(models).map((m) => m.model).sort();
  expect(out).toEqual(["fam-high", "solo"]);
});

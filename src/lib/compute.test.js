import {
  overallOf, catCost, overallCost, costForScope,
  costPerQuality, pointsPerDollar, perMillionOut, valueFrontier, collapseVariants,
} from "./compute";

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

// $/Q is question-weighted: (Σ total cost) / (Σ nq) over the scope's subtasks.
test("costForScope = total cost / question count, weighted by questions", () => {
  const categories = { Reasoning: ["a", "b"], Coding: ["c"] };
  // totals + counts: a=$2/10q=$0.2, b=$8/10q=$0.8, c=$5/5q=$1.0
  const costRow = { model: "m1", a: 2.0, b: 8.0, c: 5.0, nq_a: 10, nq_b: 10, nq_c: 5 };
  expect(costForScope(costRow, categories, "a")).toBeCloseTo(0.2);     // subtask
  expect(catCost(costRow, categories, "Reasoning")).toBeCloseTo(0.5);  // (2+8)/(10+10)
  expect(catCost(costRow, categories, "Coding")).toBeCloseTo(1.0);
  // overall = 15/25 = 0.6 — NOT mean(0.5, 1.0) = 0.75 (that would be category-weighted)
  expect(overallCost(costRow, categories)).toBeCloseTo(0.6);
  expect(costForScope(costRow, categories, "overall")).toBeCloseTo(0.6);
  expect(costForScope(costRow, categories, "missing")).toBeNull();
  expect(costForScope(null, categories, "overall")).toBeNull();
});

test("scope cost skips subtasks with no questions", () => {
  const categories = { Reasoning: ["a"], Coding: ["c"] };
  const costRow = { model: "m1", a: 4.0, nq_a: 10, c: "", nq_c: 0 }; // Coding has no questions
  expect(overallCost(costRow, categories)).toBeCloseTo(0.4); // only a: 4/10
  expect(catCost(costRow, categories, "Coding")).toBeNull();
});

test("costPerQuality / pointsPerDollar operate on scoped values", () => {
  expect(costPerQuality(0.5, 50)).toBeCloseTo(0.01); // $0.5 / 50 pts
  expect(costPerQuality(null, 50)).toBeNull();
  expect(costPerQuality(0.5, 0)).toBeNull();
  expect(pointsPerDollar(50, 0.5)).toBeCloseTo(100);
  expect(pointsPerDollar(50, 0)).toBeNull();
});

test("perMillionOut = official output list price (no derivation)", () => {
  expect(perMillionOut({ output_price_per_million: 30 })).toBe(30);
  expect(perMillionOut({ output_price_per_million: "10" })).toBe(10);
  expect(perMillionOut({})).toBeNull();
  expect(perMillionOut(null)).toBeNull();
});

test("valueFrontier = cheapest model at each new score ceiling (uses costOverall)", () => {
  const models = [
    { model: "A", overall: 70, costOverall: 0.01 },
    { model: "B", overall: 75, costOverall: 0.02 },
    { model: "C", overall: 72, costOverall: 0.03 }, // dominated by B
    { model: "D", overall: 99, costOverall: null },  // no cost -> excluded
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

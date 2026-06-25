import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import App from "./App";

// Two models that exist in modelLinks.js so they survive the metadata filter.
const TABLE = "model,a,b,c\nchatgpt-4o-latest,80,60,90\ndeepseek-v3,70,50,80\n";
const CATS = { Reasoning: ["a", "b"], Coding: ["c"] };
// Cost CSV: per-subtask total cost (a,b,c) + question counts (nq_*) + model-level trailing cols.
const COST = "model,a,b,c,nq_a,nq_b,nq_c,avg_input_tokens,avg_output_tokens,input_price_per_million,output_price_per_million\nchatgpt-4o-latest,0.2,0.6,0.5,10,10,5,700,1000,2.5,10\n";

let container;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  global.fetch = jest.fn((url) => {
    if (url.includes("table_")) return Promise.resolve({ ok: true, text: () => Promise.resolve(TABLE) });
    if (url.includes("categories_")) return Promise.resolve({ ok: true, json: () => Promise.resolve(CATS) });
    if (url.includes("cost_")) return Promise.resolve({ ok: true, text: () => Promise.resolve(COST) });
    return Promise.resolve({ ok: false, status: 404 });
  });
});
afterEach(() => { container.remove(); jest.restoreAllMocks(); });

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

test("renders the leaderboard with real model names and cost columns", async () => {
  await act(async () => { createRoot(container).render(<App />); });
  await flush();
  await flush();
  expect(container.textContent).toContain("ChatGPT-4o");
  expect(container.textContent).toContain("DeepSeek V3");
  expect(container.textContent).toContain("$/task"); // cost column present because cost loaded
  expect(container.textContent).toContain("Leaderboard");
});

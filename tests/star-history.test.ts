import { describe, expect, it } from "vitest";
import {
  buildDailyHistory,
  buildStepPath,
  readStargazers,
  renderSvg,
} from "../scripts/update-star-history.mjs";

function star(date: string) {
  return { starred_at: `${date}T12:00:00Z` };
}

describe("star history chart", () => {
  it("shows all same-day stars on that day and stays flat afterward", () => {
    const history = buildDailyHistory(
      [star("2026-07-06"), star("2026-07-06"), star("2026-07-06"), star("2026-07-06"), star("2026-07-06")],
      "2026-07-20",
    );
    expect(history.points).toEqual([{ date: "2026-07-06", count: 5 }]);
    expect(buildStepPath(history)).toBe("M 88 258 H 88.00 V 128.00 H 632");
  });

  it("builds cumulative steps for stars added on multiple days", () => {
    const history = buildDailyHistory(
      [star("2026-07-01"), star("2026-07-03"), star("2026-07-03")],
      "2026-07-05",
    );
    expect(history.points).toEqual([
      { date: "2026-07-01", count: 1 },
      { date: "2026-07-03", count: 3 },
    ]);
    expect(buildStepPath(history)).toContain("H 360.00 V 128.00 H 632");
  });

  it("renders a zero-star chart without inventing growth", () => {
    const history = buildDailyHistory([], "2026-07-20");
    expect(buildStepPath(history)).toBe("M 88 258 H 632");
    expect(renderSvg(history, "light")).toContain("Current stars: 0");
  });

  it("renders distinct light and dark themes", () => {
    const history = buildDailyHistory([star("2026-07-06")], "2026-07-20");
    expect(renderSvg(history, "light")).toContain("#ffffff");
    expect(renderSvg(history, "dark")).toContain("#0d1117");
  });

  it("preserves the previous chart when detailed dates are unavailable", async () => {
    const fetchImpl = async () => new Response(
      JSON.stringify([{ login: "example-user" }]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
    await expect(readStargazers(fetchImpl)).resolves.toBeNull();
  });
});

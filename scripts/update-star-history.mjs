import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const owner = "truman-t3";
const repo = "keyshot-mcp";
const outputs = {
  light: "assets/star-history-light.svg",
  dark: "assets/star-history-dark.svg",
};
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const baseHeaders = {
  Accept: "application/vnd.github.star+json",
  "User-Agent": "keyshot-mcp-star-history",
};

const authHeaders = token
  ? { ...baseHeaders, Authorization: `Bearer ${token}` }
  : baseHeaders;

export async function readStargazers(fetchImpl = fetch) {
  const stargazers = [];

  for (let page = 1; ; page += 1) {
    const url = `https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=100&page=${page}`;
    let response = await fetchImpl(url, { headers: authHeaders });

    if (!response.ok && token && (response.status === 401 || response.status === 403)) {
      response = await fetchImpl(url, { headers: baseHeaders });
    }

    if (response.status === 401 || response.status === 403) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`GitHub API failed: ${response.status} ${await response.text()}`);
    }

    const pageData = await response.json();
    if (!Array.isArray(pageData)) {
      throw new Error("GitHub stargazers response was not an array.");
    }

    stargazers.push(...pageData);
    if (pageData.length < 100) {
      if (
        stargazers.length > 0 &&
        stargazers.some((entry) => typeof entry?.starred_at !== "string")
      ) {
        return null;
      }
      return stargazers;
    }
  }
}

export function buildDailyHistory(stargazers, endDate) {
  const counts = new Map();
  for (const entry of stargazers) {
    const date = entry?.starred_at?.slice(0, 10);
    if (date) counts.set(date, (counts.get(date) || 0) + 1);
  }

  const dates = [...counts.keys()].sort();
  let total = 0;
  const points = dates.map((date) => {
    total += counts.get(date);
    return { date, count: total };
  });

  return {
    points,
    total,
    firstDate: dates[0] || endDate,
    endDate,
  };
}

function dateNumber(value) {
  return Date.parse(`${value}T00:00:00Z`) / 86_400_000;
}

function xForDate(date, firstDate, endDate) {
  const left = 88;
  const right = 632;
  const span = Math.max(1, dateNumber(endDate) - dateNumber(firstDate));
  const offset = Math.max(0, dateNumber(date) - dateNumber(firstDate));
  return left + Math.min(1, offset / span) * (right - left);
}

function yForCount(count, total) {
  const top = 128;
  const bottom = 258;
  return bottom - (count / Math.max(total, 1)) * (bottom - top);
}

export function buildStepPath(history) {
  if (history.points.length === 0) return "M 88 258 H 632";

  let pathData = "M 88 258";
  for (const point of history.points) {
    const x = xForDate(point.date, history.firstDate, history.endDate);
    pathData += ` H ${x.toFixed(2)} V ${yForCount(point.count, history.total).toFixed(2)}`;
  }
  pathData += ` H 632`;
  return pathData;
}

export function renderSvg(history, theme) {
  const dark = theme === "dark";
  const colors = dark
    ? {
        background: "#0d1117",
        panel: "#161b22",
        border: "#30363d",
        text: "#c9d1d9",
        title: "#f0f6fc",
        muted: "#8b949e",
        line: "#58a6ff",
        badge: "#21262d",
      }
    : {
        background: "#ffffff",
        panel: "#f6f8fa",
        border: "#d0d7de",
        text: "#24292f",
        title: "#1f2328",
        muted: "#57606a",
        line: "#0969da",
        badge: "#ffffff",
      };
  const pathData = buildStepPath(history);
  const finalY = history.total > 0 ? yForCount(history.total, history.total) : 258;
  const firstEventX = history.points.length > 0
    ? xForDate(history.points[0].date, history.firstDate, history.endDate)
    : 88;
  const firstEventY = history.points.length > 0
    ? yForCount(history.points[0].count, history.total)
    : 258;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="360" viewBox="0 0 720 360" role="img" aria-labelledby="title desc">
  <title id="title">Star History for ${owner}/${repo}</title>
  <desc id="desc">${history.total} GitHub stars through ${history.endDate}, plotted by the date each star was added.</desc>
  <style>
    .text { fill: ${colors.text}; font: 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .title { fill: ${colors.title}; font: 700 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .muted { fill: ${colors.muted}; font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  </style>
  <rect fill="${colors.background}" width="720" height="360" rx="16"/>
  <rect fill="${colors.panel}" stroke="${colors.border}" x="32" y="32" width="656" height="296" rx="12"/>
  <text class="title" x="64" y="78">Star History</text>
  <text class="muted" x="64" y="104">${owner}/${repo}</text>
  <rect fill="${colors.badge}" stroke="${colors.border}" x="548" y="55" width="92" height="36" rx="18"/>
  <text class="text" x="571" y="79">&#9733; ${history.total}</text>
  <line stroke="${colors.border}" x1="88" y1="258" x2="632" y2="258"/>
  <line stroke="${colors.border}" x1="88" y1="128" x2="88" y2="258"/>
  <text class="muted" x="66" y="263">0</text>
  <text class="muted" x="66" y="136">${Math.max(history.total, 1)}</text>
  <text class="muted" x="88" y="288">${history.firstDate}</text>
  <text class="muted" x="555" y="288">${history.endDate}</text>
  <path fill="none" stroke="${colors.line}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="${pathData}"/>
  ${history.points.length > 0 ? `<circle fill="${colors.line}" stroke="${colors.background}" stroke-width="3" cx="${firstEventX.toFixed(2)}" cy="${firstEventY.toFixed(2)}" r="6"/>` : ""}
  <circle fill="${colors.line}" stroke="${colors.background}" stroke-width="3" cx="632" cy="${finalY.toFixed(2)}" r="7"/>
  <text class="text" x="486" y="122">Current stars: ${history.total}</text>
</svg>
`;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const stargazers = await readStargazers();
  if (stargazers === null) {
    console.warn("Stargazer dates were unavailable; keeping the existing charts unchanged.");
    return;
  }

  const history = buildDailyHistory(stargazers, today);
  await Promise.all(
    Object.entries(outputs).map(async ([theme, output]) => {
      await fs.mkdir(path.dirname(output), { recursive: true });
      await fs.writeFile(output, renderSvg(history, theme), "utf8");
    }),
  );
  console.log(`Updated star history charts with ${history.total} stars.`);
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  await main();
}

import fs from "node:fs/promises";

const owner = "truman-t3";
const repo = "keyshot-mcp";
const output = "assets/star-history.svg";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const headers = {
  Accept: "application/vnd.github.star+json",
  "User-Agent": "keyshot-mcp-star-history",
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=100`, { headers });

if (!response.ok) {
  throw new Error(`GitHub API failed: ${response.status} ${await response.text()}`);
}

const stargazers = await response.json();
const starCount = Array.isArray(stargazers) ? stargazers.length : 0;
const firstStarDate = stargazers[0]?.starred_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0, 10);
const y = starCount > 0 ? 128 : 258;
const line = starCount > 0 ? `M 88 258 L 632 ${y}` : "M 88 258 L 632 258";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="360" viewBox="0 0 720 360" role="img" aria-labelledby="title desc">
  <title id="title">Star History for ${owner}/${repo}</title>
  <desc id="desc">A star history chart for the ${repo} GitHub repository.</desc>
  <style>
    .bg { fill: #0d1117; }
    .panel { fill: #161b22; stroke: #30363d; stroke-width: 1; }
    .text { fill: #c9d1d9; font: 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .title { fill: #f0f6fc; font: 700 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .muted { fill: #8b949e; font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .axis { stroke: #30363d; stroke-width: 1; }
    .line { fill: none; stroke: #58a6ff; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
    .dot { fill: #58a6ff; stroke: #0d1117; stroke-width: 3; }
    .badge { fill: #21262d; stroke: #30363d; stroke-width: 1; }
  </style>
  <rect class="bg" width="720" height="360" rx="16"/>
  <rect class="panel" x="32" y="32" width="656" height="296" rx="12"/>
  <text class="title" x="64" y="78">Star History</text>
  <text class="muted" x="64" y="104">${owner}/${repo}</text>
  <rect class="badge" x="548" y="55" width="92" height="36" rx="18"/>
  <text class="text" x="571" y="79">★ ${starCount}</text>
  <line class="axis" x1="88" y1="258" x2="632" y2="258"/>
  <line class="axis" x1="88" y1="128" x2="88" y2="258"/>
  <text class="muted" x="66" y="263">0</text>
  <text class="muted" x="66" y="136">${Math.max(starCount, 1)}</text>
  <text class="muted" x="88" y="288">${firstStarDate}</text>
  <text class="muted" x="555" y="288">${today}</text>
  <path class="line" d="${line}"/>
  <circle class="dot" cx="632" cy="${y}" r="7"/>
  <text class="text" x="486" y="122">Current stars: ${starCount}</text>
</svg>
`;

await fs.writeFile(output, svg, "utf8");
console.log(`Updated ${output} with ${starCount} stars.`);

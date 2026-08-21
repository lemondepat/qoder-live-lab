import { execFileSync } from "node:child_process";

const repository = process.env.GITHUB_REPOSITORY || "lemondepat/qoder-live-lab";
const [owner, repo] = repository.split("/");
if (!owner || !repo) throw new Error("GITHUB_REPOSITORY must be owner/repository");

const token = execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
const commits = git(["rev-list", "--reverse", "main"]).trim().split("\n").filter(Boolean);
const mapped = new Map();
const uploadedBlobs = new Set();

for (const localCommit of commits) {
  const treeEntries = parseTree(git(["ls-tree", "-r", "-z", localCommit]));
  for (const entry of treeEntries) {
    if (uploadedBlobs.has(entry.sha)) continue;
    const content = execFileSync("git", ["cat-file", "blob", entry.sha]).toString("base64");
    const blob = await github(`/repos/${repository}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content, encoding: "base64" }),
    });
    if (blob.sha !== entry.sha) throw new Error(`Blob verification failed for ${entry.path}`);
    uploadedBlobs.add(entry.sha);
  }

  const localTree = git(["show", "-s", "--format=%T", localCommit]).trim();
  const tree = await github(`/repos/${repository}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ tree: treeEntries.map(({ path, mode, sha }) => ({ path, mode, type: "blob", sha })) }),
  });
  if (tree.sha !== localTree) throw new Error(`Tree verification failed for ${localCommit}`);

  const fields = git(["show", "-s", "--format=%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%B", localCommit]).split("\0");
  const parents = git(["show", "-s", "--format=%P", localCommit]).trim().split(" ").filter(Boolean).map((sha) => mapped.get(sha) || sha);
  const created = await github(`/repos/${repository}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: fields[6].replace(/\n$/, ""),
      tree: tree.sha,
      parents,
      author: { name: fields[0], email: fields[1], date: fields[2] },
      committer: { name: fields[3], email: fields[4], date: fields[5] },
    }),
  });
  mapped.set(localCommit, created.sha);
  process.stdout.write(`Uploaded commit ${localCommit.slice(0, 7)} → ${created.sha.slice(0, 7)}\n`);
}

const head = mapped.get(commits.at(-1));
await github(`/repos/${repository}/git/refs`, {
  method: "POST",
  body: JSON.stringify({ ref: "refs/heads/main", sha: head }),
});
process.stdout.write(`Published https://github.com/${repository} at ${head}\n`);

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

function parseTree(value) {
  return value.split("\0").filter(Boolean).map((line) => {
    const match = line.match(/^(\d+) blob ([0-9a-f]+)\t([\s\S]+)$/);
    if (!match) throw new Error(`Unsupported tree entry: ${line}`);
    return { mode: match[1], sha: match[2], path: match[3] };
  });
}

async function github(path, init) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.json();
}

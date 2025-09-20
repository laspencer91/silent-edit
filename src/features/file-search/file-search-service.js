const fs = require("fs").promises;
const path = require("path");

const DEFAULT_IGNORE_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".cache",
  ".turbo",
  "coverage",
  "vendor",
];

class FileSearchService {
  constructor(root, options = {}) {
    this.root = root;
    this.maxFiles = options.maxFiles || 10000;
    this.defaultIgnores = new Set([
      ...DEFAULT_IGNORE_DIRS,
      ...(options.ignoreDirectories || []),
    ]);
    this.cache = new Map();
    this.scanPromises = new Map();
    this.gitIgnoreEntries = [];
    this.gitIgnoreLoaded = false;
  }

  setRoot(root) {
    if (!root || root === this.root) return;
    this.root = root;
    this.cache.clear();
    this.scanPromises.clear();
    this.gitIgnoreEntries = [];
    this.gitIgnoreLoaded = false;
  }

  async search(query, { includeIgnored = false, limit = 80 } = {}) {
    const files = await this.getFiles(includeIgnored);
    const trimmed = (query || "").trim();

    if (!trimmed) {
      return files.slice(0, Math.min(files.length, limit * 2));
    }

    const needle = trimmed.toLowerCase();
    const scored = [];

    for (const file of files) {
      const score = fuzzyScore(file.relativePathLower, needle);
      if (score !== null) {
        scored.push({ file, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.file.relativePath.localeCompare(b.file.relativePath);
    });

    return scored.slice(0, limit).map((entry) => ({
      ...entry.file,
      score: entry.score,
    }));
  }

  async getFiles(includeIgnored = false) {
    if (this.cache.has(includeIgnored)) {
      return this.cache.get(includeIgnored);
    }

    if (this.scanPromises.has(includeIgnored)) {
      return this.scanPromises.get(includeIgnored);
    }

    const promise = this.scanWorkspace(includeIgnored)
      .then((files) => {
        this.cache.set(includeIgnored, files);
        this.scanPromises.delete(includeIgnored);
        return files;
      })
      .catch((err) => {
        this.scanPromises.delete(includeIgnored);
        throw err;
      });

    this.scanPromises.set(includeIgnored, promise);
    return promise;
  }

  async scanWorkspace(includeIgnored) {
    const results = [];
    await this.ensureGitIgnoreLoaded();
    await this.walkDirectory(this.root, [], includeIgnored, results);
    return results;
  }

  async ensureGitIgnoreLoaded() {
    if (this.gitIgnoreLoaded) return;
    this.gitIgnoreLoaded = true;

    const gitIgnorePath = path.join(this.root, ".gitignore");
    try {
      const content = await fs.readFile(gitIgnorePath, "utf8");
      this.gitIgnoreEntries = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"))
        .map((line) => line.replace(/\/$/, ""))
        .map((line) =>
          line.startsWith("/") ? line.slice(1) : line
        )
        .filter((line) => line && !line.includes("*"));
    } catch (err) {
      this.gitIgnoreEntries = [];
    }
  }

  async walkDirectory(currentPath, segments, includeIgnored, results) {
    if (results.length >= this.maxFiles) {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch (err) {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const nextSegments = segments.concat(entry.name);

      if (entry.isDirectory()) {
        if (!includeIgnored && this.shouldIgnoreDirectory(nextSegments)) {
          continue;
        }
        await this.walkDirectory(
          path.join(currentPath, entry.name),
          nextSegments,
          includeIgnored,
          results
        );
        if (results.length >= this.maxFiles) {
          return;
        }
      } else if (entry.isFile()) {
        if (!includeIgnored && this.shouldIgnoreFile(nextSegments)) {
          continue;
        }

        const relativePath = nextSegments.join(path.sep);
        const relativePathPosix = nextSegments.join("/");
        results.push({
          absolutePath: path.join(currentPath, entry.name),
          relativePath,
          relativePathLower: relativePathPosix.toLowerCase(),
          relativePathPosix,
          name: entry.name,
          extension: path.extname(entry.name).slice(1),
        });

        if (results.length >= this.maxFiles) {
          return;
        }
      }
    }
  }

  shouldIgnoreDirectory(segments) {
    if (segments.some((part) => this.defaultIgnores.has(part))) {
      return true;
    }
    return this.isGitIgnored(segments);
  }

  shouldIgnoreFile(segments) {
    if (segments.some((part) => this.defaultIgnores.has(part))) {
      return true;
    }
    return this.isGitIgnored(segments);
  }

  isGitIgnored(segments) {
    if (!this.gitIgnoreEntries.length) return false;
    const relative = segments.join("/");
    return this.gitIgnoreEntries.some((ignorePath) =>
      relative === ignorePath || relative.startsWith(`${ignorePath}/`)
    );
  }
}

function fuzzyScore(target, query) {
  let score = 0;
  let lastIndex = -1;
  let consecutive = 0;

  for (const char of query) {
    const index = target.indexOf(char, lastIndex + 1);
    if (index === -1) {
      return null;
    }

    if (index === lastIndex + 1) {
      consecutive += 1;
      score += 6 * consecutive;
    } else {
      consecutive = 0;
      score += 1;
    }

    // Bias matches towards filename portion
    if (char === target[index]) {
      score += 1;
    }

    lastIndex = index;
  }

  // Encourage matches that land near the end/filename
  const lastSlash = target.lastIndexOf("/");
  if (lastSlash !== -1) {
    const filename = target.slice(lastSlash + 1);
    if (filename.startsWith(query)) {
      score += 20;
    }
  } else if (target.startsWith(query)) {
    score += 20;
  }

  // Prefer shorter matches overall
  score += Math.max(0, 10 - (target.length - query.length));

  return score;
}

module.exports = { FileSearchService };

const blessed = require("blessed");
const path = require("path");
const os = require("os");
const { FileSearchService } = require("./file-search-service");

const COLORS = {
  modalBg: "black",
  modalBorder: "cyan",
  inputBg: "gray",
  inputFg: "white",
  listFg: "white",
  listBg: "black",
  selectionBg: "cyan",
  selectionFg: "black",
  muted: "gray",
  warning: "yellow",
};

const FOOTER_COPY = "Enter open · Shift+Enter split · Tab toggle ignored · Esc close";

class FileSearchOverlay {
  constructor(screen, options = {}) {
    this.screen = screen;
    this.options = options;
    this.root = options.root || process.cwd();
    this.includeIgnored = false;
    this.recentFiles = [];
    this.maxRecent = options.maxRecent || 20;

    this.service = new FileSearchService(this.root, options);

    this.state = {
      query: "",
      results: [],
      highlightedIndex: 0,
      busy: false,
      message: "",
    };

    this.container = null;
    this.input = null;
    this.resultsList = null;
    this.footer = null;
    this.header = null;
    this.queryDebounce = null;
    this.lastQueryToken = 0;
  }

  attach(parent) {
    if (this.container) return;

    this.container = blessed.box({
      parent,
      top: "center",
      left: "center",
      width: "70%",
      height: 18,
      padding: { top: 1, right: 2, bottom: 1, left: 2 },
      border: { type: "line", fg: COLORS.modalBorder },
      style: { fg: COLORS.listFg, bg: COLORS.modalBg },
      label: " Go to File ",
    });

    this.header = blessed.box({
      parent: this.container,
      top: 0,
      left: 1,
      height: 1,
      width: "100%",
      tags: true,
      style: { fg: COLORS.muted, bg: COLORS.modalBg },
      content: this.formatHeader(),
    });

    this.input = blessed.textbox({
      parent: this.container,
      top: 2,
      left: 1,
      right: 1,
      height: 1,
      inputOnFocus: true,
      keys: true,
      mouse: true,
      style: {
        fg: COLORS.inputFg,
        bg: COLORS.inputBg,
        focus: { fg: COLORS.inputFg, bg: COLORS.inputBg },
      },
    });

    this.resultsList = blessed.list({
      parent: this.container,
      top: 4,
      left: 1,
      right: 1,
      bottom: 2,
      keys: true,
      mouse: true,
      tags: true,
      style: {
        fg: COLORS.listFg,
        bg: COLORS.listBg,
        selected: {
          fg: COLORS.selectionFg,
          bg: COLORS.selectionBg,
        },
      },
    });

    this.footer = blessed.box({
      parent: this.container,
      bottom: 0,
      left: 1,
      right: 1,
      height: 1,
      tags: true,
      style: { fg: COLORS.muted, bg: COLORS.modalBg },
      content: `{gray-fg}${FOOTER_COPY}{/}`,
    });

    this.registerEvents();
    this.resetToRecents();
    this.render();
  }

  detach() {
    if (!this.container) return;
    this.container.destroy();
    this.container = null;
    this.input = null;
    this.resultsList = null;
    this.footer = null;
    this.header = null;
  }

  onShow() {
    if (!this.state.query) {
      this.resetToRecents();
      this.render();
    }
  }

  onHide() {
    if (this.queryDebounce) {
      clearTimeout(this.queryDebounce);
      this.queryDebounce = null;
    }
    this.state.query = "";
    this.state.results = [];
    this.state.highlightedIndex = 0;
    if (this.input) {
      if (typeof this.input.clearValue === "function") {
        this.input.clearValue();
      } else {
        this.input.setValue("");
      }
    }
  }

  focus() {
    if (this.input) {
      this.input.focus();
    }
  }

  setRoot(root) {
    if (!root || root === this.root) return;
    this.root = root;
    this.service.setRoot(root);
    if (this.header) {
      this.header.setContent(this.formatHeader());
    }
    if (this.input) {
      if (typeof this.input.clearValue === "function") {
        this.input.clearValue();
      } else {
        this.input.setValue("");
      }
    }
    this.resetToRecents();
    this.render();
  }

  formatHeader() {
    const rootDisplay = shortenPath(this.root, 50);
    const ignoredLabel = this.includeIgnored ? "(including ignored)" : "";
    return `{gray-fg}${rootDisplay} ${ignoredLabel}{/}`.trim();
  }

  registerEvents() {
    if (!this.input || !this.resultsList) return;

    const updateQuery = () => {
      if (!this.input) return;
      const value = this.input.getValue() || "";
      this.state.query = value;
      if (!value) {
        this.resetToRecents();
        this.render();
        return;
      }
      this.scheduleRefresh();
    };

    this.input.key(["escape"], () => {
      this.options.onCancel?.();
    });

    this.input.key(["tab"], () => {
      this.toggleIgnored();
      return false;
    });

    this.input.key(["down"], () => {
      this.highlightOffset(1);
      return false;
    });

    this.input.key(["up"], () => {
      this.highlightOffset(-1);
      return false;
    });

    this.input.key(["enter"], (_, key) => {
      this.confirmSelection({ split: Boolean(key.shift) });
      return false;
    });

    this.input.key([
      "backspace",
      "delete",
      "S-backspace",
      "S-delete",
    ], () => {
      // Delay to allow the textbox to update its internal value first.
      setTimeout(updateQuery, 0);
    });

    this.input.on("keypress", (ch, key) => {
      if (
        key.name === "up" ||
        key.name === "down" ||
        key.name === "tab" ||
        key.name === "escape" ||
        key.name === "backspace" ||
        key.name === "delete"
      ) {
        return;
      }

      setTimeout(updateQuery, 0);
    });

    this.resultsList.on("select", (_, index) => {
      this.state.highlightedIndex = index;
      this.confirmSelection({ split: false });
    });

    this.resultsList.key(["escape"], () => {
      this.options.onCancel?.();
    });

    this.resultsList.key(["tab"], () => {
      this.toggleIgnored();
      return false;
    });

    this.resultsList.key(["enter"], (_, key) => {
      this.confirmSelection({ split: Boolean(key.shift) });
      return false;
    });
  }

  scheduleRefresh() {
    if (this.queryDebounce) {
      clearTimeout(this.queryDebounce);
    }

    const token = ++this.lastQueryToken;
    this.queryDebounce = setTimeout(() => {
      this.queryDebounce = null;
      this.refreshResults(token).catch(() => {});
    }, 80);
  }

  async refreshResults(token) {
    if (token && token !== this.lastQueryToken) {
      return;
    }

    if (!this.state.query) {
      this.resetToRecents();
      this.render();
      return;
    }

    this.state.busy = true;
    this.render();

    try {
      const results = await this.service.search(this.state.query, {
        includeIgnored: this.includeIgnored,
        limit: 60,
      });
      this.state.results = this.composeResultItems(results);
      this.state.message = "";
    } catch (err) {
      this.state.results = [formatMessageLine("Unable to read directory")];
      this.state.message = "Unable to read directory";
    }

    this.state.highlightedIndex = 0;
    this.state.busy = false;
    this.render();
  }

  composeResultItems(results) {
    if (!results || results.length === 0) {
      return [formatMessageLine("No files match your search")];
    }
    return results.map((result) => ({
      content: formatResultLine(result),
      meta: result,
    }));
  }

  confirmSelection({ split }) {
    const item = this.state.results[this.state.highlightedIndex];
    if (!item || !item.meta) {
      return;
    }

    const meta = item.meta;
    this.pushRecent(meta);

    if (split && this.options.onOpenSplit) {
      this.options.onOpenSplit(meta);
    } else {
      this.options.onOpen?.(meta);
    }
  }

  highlightOffset(offset) {
    if (!this.state.results.length) return;
    const next = this.state.highlightedIndex + offset;
    this.state.highlightedIndex = Math.max(
      0,
      Math.min(next, this.state.results.length - 1)
    );
    this.resultsList.select(this.state.highlightedIndex);
    this.screen.render();
  }

  toggleIgnored() {
    this.includeIgnored = !this.includeIgnored;
    this.state.message = "";
    if (this.header) {
      this.header.setContent(this.formatHeader());
    }
    if (this.state.query) {
      this.refreshResults();
    } else {
      this.resetToRecents();
      this.render();
    }
  }

  resetToRecents() {
    this.state.busy = false;
    this.state.message = "";

    if (this.recentFiles.length === 0) {
      this.state.results = [formatMessageLine("Start typing to search")];
    } else {
      this.state.results = this.recentFiles.map((meta) => ({
        content: formatRecentLine(meta),
        meta,
      }));
    }
    this.state.highlightedIndex = 0;
  }

  pushRecent(meta) {
    if (!meta) return;
    const key = meta.absolutePath || meta.relativePathPosix || meta.relativePath;
    if (!key) return;

    const snapshot = {
      absolutePath: meta.absolutePath,
      relativePathPosix: meta.relativePathPosix,
      relativePath: meta.relativePath,
      name: meta.name,
      extension: meta.extension,
    };

    this.recentFiles = [
      snapshot,
      ...this.recentFiles.filter((item) => {
        const itemKey =
          item.absolutePath || item.relativePathPosix || item.relativePath;
        return itemKey !== key;
      }),
    ].slice(0, this.maxRecent);
  }

  render() {
    if (!this.container || !this.resultsList) return;

    const items = this.state.results.map((entry) => entry.content);
    this.resultsList.setItems(items.length ? items : [" "]);
    this.resultsList.select(
      Math.max(0, Math.min(this.state.highlightedIndex, items.length - 1))
    );

    if (this.state.busy) {
      this.footer.setContent("{gray-fg}Searching...{/}");
    } else if (this.state.message) {
      this.footer.setContent(`{yellow-fg}${this.state.message}{/}`);
    } else {
      this.footer.setContent(`{gray-fg}${FOOTER_COPY}{/}`);
    }

    this.screen.render();
  }
}

function formatResultLine(result) {
  const filename = result.name;
  const dir = path.dirname(result.relativePathPosix || result.relativePath || "");
  const displayDir = dir && dir !== "." ? dir : "";
  const icon = iconForExtension(result.extension);
  const suffix = displayDir
    ? ` {gray-fg}${truncate(displayDir, 60)}{/}`
    : "";
  return `{cyan-fg}${icon}{/} {bold}${filename}{/}${suffix}`;
}

function formatRecentLine(meta) {
  const relativePath = meta.relativePathPosix || meta.relativePath || meta.name;
  const filename = meta.name || path.basename(relativePath);
  const dir = path.dirname(relativePath);
  const suffix = dir && dir !== "." ? ` {gray-fg}${truncate(dir, 60)}{/}` : "";
  return `{green-fg}[recent]{/} {bold}${filename}{/}${suffix}`;
}

function formatMessageLine(message) {
  return { content: `{gray-fg}${message}{/}`, meta: null };
}

function iconForExtension(extension) {
  const lower = (extension || "").toLowerCase();
  switch (lower) {
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "[js]";
    case "ts":
    case "tsx":
      return "[ts]";
    case "json":
      return "[json]";
    case "css":
    case "scss":
      return "[css]";
    case "html":
    case "htm":
      return "[html]";
    case "md":
    case "markdown":
      return "[md]";
    default:
      return "[file]";
  }
}

function shortenPath(targetPath, maxLength) {
  const home = os.homedir();
  let display = targetPath;
  if (display.startsWith(home)) {
    display = `~${display.slice(home.length)}`;
  }
  if (display.length <= maxLength) {
    return display;
  }
  const parts = display.split(path.sep);
  while (parts.length > 2 && parts.join(path.sep).length > maxLength) {
    parts.splice(1, 1, "...");
  }
  return parts.join(path.sep);
}

function truncate(value, max) {
  if (!value || value.length <= max) return value;
  return `...${value.slice(-(max - 3))}`;
}

module.exports = { FileSearchOverlay };

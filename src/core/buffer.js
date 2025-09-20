const fs = require("fs").promises;

// ===== Buffer Management =====
class Buffer {
  constructor() {
    this.lines = [""];
    this.filename = null;
    this.modified = false;
    this.history = [];
    this.historyIndex = -1;
  }

  // Core text operations
  insertChar(row, col, char) {
    if (row >= this.lines.length) {
      while (this.lines.length <= row) {
        this.lines.push("");
      }
    }

    const line = this.lines[row];
    this.lines[row] = line.slice(0, col) + char + line.slice(col);
    this.modified = true;
    this.saveToHistory();
  }

  deleteChar(row, col) {
    if (row >= this.lines.length) return false;

    const line = this.lines[row];
    if (col > 0) {
      this.lines[row] = line.slice(0, col - 1) + line.slice(col);
      this.modified = true;
      this.saveToHistory();
      return true;
    } else if (row > 0) {
      // Join with previous line
      const prevLine = this.lines[row - 1];
      this.lines[row - 1] = prevLine + line;
      this.lines.splice(row, 1);
      this.modified = true;
      this.saveToHistory();
      return true;
    }
    return false;
  }

  insertLine(row, col = 0) {
    const currentLine = this.lines[row] || "";

    const beforeCursor = currentLine.slice(0, col);
    const afterCursor = currentLine.slice(col);

    this.lines[row] = beforeCursor;
    this.lines.splice(row + 1, 0, afterCursor);
    this.modified = true;
    this.saveToHistory();
  }

  // File operations
  async loadFile(filepath) {
    try {
      const content = await fs.readFile(filepath, "utf8");
      this.lines = content.split("\n");
      if (this.lines.length === 0) this.lines = [""];
      this.filename = filepath;
      this.modified = false;
      this.history = [];
      this.historyIndex = -1;
      return true;
    } catch (err) {
      return false;
    }
  }

  async saveFile(filepath = this.filename) {
    if (!filepath) return false;

    try {
      const content = this.lines.join("\n");
      await fs.writeFile(filepath, content, "utf8");
      this.filename = filepath;
      this.modified = false;
      return true;
    } catch (err) {
      return false;
    }
  }

  // History management for undo/redo
  saveToHistory() {
    // Limit history size
    const maxHistory = 100;

    // Remove any redo history when new change is made
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push({
      lines: [...this.lines],
      timestamp: Date.now(),
    });

    if (this.history.length > maxHistory) {
      this.history.shift();
    }

    this.historyIndex = this.history.length - 1;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const state = this.history[this.historyIndex];
      this.lines = [...state.lines];
      this.modified = true;
      return true;
    }
    return false;
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const state = this.history[this.historyIndex];
      this.lines = [...state.lines];
      this.modified = true;
      return true;
    }
    return false;
  }

  // Utility methods
  getLine(row) {
    return this.lines[row] || "";
  }

  getLineCount() {
    return this.lines.length;
  }

  getText() {
    return this.lines.join("\n");
  }
}

module.exports = { Buffer };

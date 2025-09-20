const blessed = require("blessed");

// ===== UI Management =====
class UI {
  constructor(screen, buffer, cursor, selection) {
    this.screen = screen;
    this.buffer = buffer;
    this.cursor = cursor;
    this.selection = selection;
    this.viewport = { top: 0, left: 0 };
    this.searchTerm = "";

    this.setupWidgets();
  }

  setupWidgets() {
    // Main text area
    this.textArea = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      right: 0,
      bottom: 2,
      tags: true,
      scrollable: false,
      keys: true,
      input: true,
      style: {
        fg: "white",
        bg: "black",
      },
    });

    // Status bar
    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 1,
      left: 0,
      right: 0,
      height: 1,
      tags: true,
      style: {
        fg: "black",
        bg: "cyan",
      },
    });

    // Command line
    this.commandLine = blessed.textbox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      tags: true,
      inputOnFocus: false,
      style: {
        fg: "white",
        bg: "black",
      },
    });
  }

  render() {
    this.updateViewport();
    this.renderText();
    this.renderStatusBar();
    this.renderCursor();

    // Ensure text area is focused for input
    this.textArea.focus();
    this.screen.render();
  }

  updateViewport() {
    const textHeight = this.textArea.height;
    const textWidth = this.textArea.width;

    // Vertical scrolling
    if (this.cursor.row < this.viewport.top) {
      this.viewport.top = this.cursor.row;
    } else if (this.cursor.row >= this.viewport.top + textHeight) {
      this.viewport.top = this.cursor.row - textHeight + 1;
    }

    // Horizontal scrolling
    if (this.cursor.col < this.viewport.left) {
      this.viewport.left = this.cursor.col;
    } else if (this.cursor.col >= this.viewport.left + textWidth) {
      this.viewport.left = this.cursor.col - textWidth + 1;
    }
  }

  renderText() {
    const textHeight = this.textArea.height;
    const textWidth = this.textArea.width;
    const lines = [];

    for (let i = 0; i < textHeight; i++) {
      const row = this.viewport.top + i;
      if (row < this.buffer.getLineCount()) {
        let line = this.buffer.getLine(row);
        let displayLine = "";

        // Build the display line character by character for selection highlighting
        for (let col = 0; col < line.length; col++) {
          const char = line[col];
          const actualCol = col + this.viewport.left;
          const isSelected =
            this.selection && this.selection.contains(row, actualCol);

          // Apply viewport filtering
          if (
            col >= this.viewport.left &&
            col < this.viewport.left + textWidth
          ) {
            if (isSelected) {
              // Highlight selected text
              displayLine += `{blue-bg}{white-fg}${char}{/}`;
            } else if (this.searchTerm && this.isInSearchMatch(line, col)) {
              // Highlight search results
              displayLine += `{yellow-bg}{black-fg}${char}{/}`;
            } else {
              displayLine += char;
            }
          }
        }

        // If no viewport adjustment needed and no selection, use simpler approach
        if (
          this.viewport.left === 0 &&
          (!this.selection || !this.selection.active)
        ) {
          displayLine = line;

          // Truncate to width
          if (displayLine.length > textWidth) {
            displayLine = displayLine.slice(0, textWidth);
          }

          // Highlight search results if active
          if (this.searchTerm) {
            displayLine = this.highlightSearch(displayLine);
          }
        }

        // Add line numbers
        const lineNum = String(row + 1).padStart(4, " ");
        const lineNumColor =
          this.selection &&
          this.selection.active &&
          this.selection.getBounds() &&
          this.isLineInSelection(row)
            ? "{blue-bg}{white-fg}"
            : "{cyan-fg}";
        lines.push(`${lineNumColor}${lineNum}{/} ${displayLine}`);
      } else {
        lines.push("{blue-fg}~{/}");
      }
    }

    this.textArea.setContent(lines.join("\n"));
  }

  // Helper method to check if line is in selection
  isLineInSelection(row) {
    if (!this.selection || !this.selection.active) return false;
    const bounds = this.selection.getBounds();
    return bounds && row >= bounds.startRow && row <= bounds.endRow;
  }

  // Helper method for search highlighting
  isInSearchMatch(line, col) {
    if (!this.searchTerm) return false;
    const searchIndex = line
      .toLowerCase()
      .indexOf(this.searchTerm.toLowerCase());
    return (
      searchIndex !== -1 &&
      col >= searchIndex &&
      col < searchIndex + this.searchTerm.length
    );
  }

  renderStatusBar() {
    const filename = this.buffer.filename || "[No Name]";
    const modified = this.buffer.modified ? "[+]" : "";
    const position = `${this.cursor.row + 1}:${this.cursor.col + 1}`;
    const lineCount = this.buffer.getLineCount();

    const left = ` ${filename} ${modified}`;
    const right = ` ${position} | ${lineCount} lines `;
    const padding = " ".repeat(
      Math.max(0, this.statusBar.width - left.length - right.length)
    );

    this.statusBar.setContent(left + padding + right);
  }

  renderCursor() {
    // Calculate screen position of cursor
    const screenRow = this.cursor.row - this.viewport.top;
    const screenCol = this.cursor.col - this.viewport.left + 5; // +5 for line numbers

    // Show cursor using blessed's cursor positioning
    this.screen.program.cup(screenRow, screenCol);
    this.screen.program.showCursor();
  }

  highlightSearch(line) {
    if (!this.searchTerm) return line;

    const regex = new RegExp(this.searchTerm, "gi");
    return line.replace(regex, (match) => `{yellow-bg}{black-fg}${match}{/}`);
  }

  showMessage(message, type = "info") {
    const colors = {
      info: "{cyan-fg}",
      error: "{red-fg}",
      success: "{green-fg}",
      warning: "{yellow-fg}",
    };

    const color = colors[type] || colors.info;
    this.commandLine.setContent(`${color}${message}{/}`);
    this.screen.render();

    // Clear message after 3 seconds
    setTimeout(() => {
      this.commandLine.setContent("");
      this.screen.render();
    }, 3000);
  }

  async promptInput(prompt) {
    return new Promise((resolve) => {
      this.commandLine.setContent(prompt);
      this.commandLine.readInput((err, value) => {
        this.commandLine.setContent("");
        resolve(value || "");
      });
    });
  }
}

module.exports = { UI };


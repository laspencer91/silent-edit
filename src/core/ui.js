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

    // Get the primary cursor position (which drives viewport)
    let targetRow = this.cursor.row;
    let targetCol = this.cursor.col;

    // In multi-cursor mode, follow the primary range's head position
    if (
      this.selection &&
      this.selection.active &&
      this.selection.primaryRange
    ) {
      const primaryRange = this.selection.primaryRange;
      targetRow = primaryRange.head.row;
      targetCol = primaryRange.head.col;
    }

    // Vertical scrolling
    if (targetRow < this.viewport.top) {
      this.viewport.top = targetRow;
    } else if (targetRow >= this.viewport.top + textHeight) {
      this.viewport.top = targetRow - textHeight + 1;
    }

    // Horizontal scrolling
    if (targetCol < this.viewport.left) {
      this.viewport.left = targetCol;
    } else if (targetCol >= this.viewport.left + textWidth) {
      this.viewport.left = targetCol - textWidth + 1;
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
          const cursorInfo = this.getCursorInfoAt(row, actualCol);

          // Apply viewport filtering
          if (
            col >= this.viewport.left &&
            col < this.viewport.left + textWidth
          ) {
            if (cursorInfo.isCursor) {
              // Highlight cursor positions
              const cursorStyle = cursorInfo.isPrimary
                ? "{inverse}{white-fg}"
                : "{inverse}{cyan-fg}";
              displayLine += `${cursorStyle}${char || " "}{/}`;
            } else if (isSelected) {
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

        // Handle cursors at end of line (beyond text length)
        const endOfLineCol = line.length;
        const cursorAtEnd = this.getCursorInfoAt(row, endOfLineCol);
        if (
          cursorAtEnd.isCursor &&
          endOfLineCol >= this.viewport.left &&
          endOfLineCol < this.viewport.left + textWidth
        ) {
          const cursorStyle = cursorAtEnd.isPrimary
            ? "{inverse}{white-fg}"
            : "{inverse}{cyan-fg}";
          displayLine += `${cursorStyle} {/}`;
        }

        // If no viewport adjustment needed and no selection, use simpler approach
        if (
          this.viewport.left === 0 &&
          (!this.selection || !this.selection.active)
        ) {
          displayLine = line;

          // Add cursor highlighting for simple case
          displayLine = this.addCursorHighlighting(displayLine, row);

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
          this.selection && this.selection.active && this.isLineInSelection(row)
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
    return this.selection.isRowSelected(row);
  }

  // Helper method to get cursor information at a specific position
  getCursorInfoAt(row, col) {
    // Check primary cursor
    if (this.cursor.row === row && this.cursor.col === col) {
      return { isCursor: true, isPrimary: true };
    }

    // Check secondary cursors from selection ranges
    if (this.selection && this.selection.active) {
      for (let i = 0; i < this.selection.ranges.length; i++) {
        const range = this.selection.ranges[i];
        const isPrimary = i === this.selection.primaryIndex;

        // For empty ranges (cursors), check the head position
        if (
          range.isEmpty() &&
          range.head.row === row &&
          range.head.col === col
        ) {
          return { isCursor: true, isPrimary };
        }
      }
    }

    return { isCursor: false, isPrimary: false };
  }

  // Helper method to add cursor highlighting for simple rendering case
  addCursorHighlighting(line, row) {
    if (!this.selection || !this.selection.active) {
      // Only primary cursor
      if (this.cursor.row === row) {
        const col = this.cursor.col;
        if (col <= line.length) {
          const before = line.slice(0, col);
          const char = col < line.length ? line[col] : " ";
          const after = line.slice(col + 1);
          return before + `{inverse}{white-fg}${char}{/}` + after;
        }
      }
      return line;
    }

    // Multiple cursors - need to process all cursor positions
    const cursors = [];

    // Add primary cursor
    if (this.cursor.row === row) {
      cursors.push({ col: this.cursor.col, isPrimary: true });
    }

    // Add secondary cursors
    for (let i = 0; i < this.selection.ranges.length; i++) {
      const range = this.selection.ranges[i];
      const isPrimary = i === this.selection.primaryIndex;

      if (range.isEmpty() && range.head.row === row) {
        cursors.push({ col: range.head.col, isPrimary });
      }
    }

    if (cursors.length === 0) return line;

    // Sort cursors by column position (reverse order for safe insertion)
    cursors.sort((a, b) => b.col - a.col);

    let result = line;
    for (const cursor of cursors) {
      const col = cursor.col;
      if (col <= result.length) {
        const before = result.slice(0, col);
        const char = col < result.length ? result[col] : " ";
        const after = result.slice(col + 1);
        const style = cursor.isPrimary
          ? "{inverse}{white-fg}"
          : "{inverse}{cyan-fg}";
        result = before + `${style}${char}{/}` + after;
      }
    }

    return result;
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

    // Show primary cursor position
    let targetRow = this.cursor.row;
    let targetCol = this.cursor.col;
    if (
      this.selection &&
      this.selection.active &&
      this.selection.primaryRange
    ) {
      const primaryRange = this.selection.primaryRange;
      targetRow = primaryRange.head.row;
      targetCol = primaryRange.head.col;
    }

    const position = `${targetRow + 1}:${targetCol + 1}`;
    const lineCount = this.buffer.getLineCount();

    // Add multi-cursor indicator
    let cursorInfo = "";
    if (
      this.selection &&
      this.selection.active &&
      this.selection.ranges.length > 0
    ) {
      const emptyCursors = this.selection.ranges.filter((r) =>
        r.isEmpty()
      ).length;
      const selections = this.selection.ranges.filter(
        (r) => !r.isEmpty()
      ).length;

      if (emptyCursors > 1) {
        cursorInfo = ` | ${emptyCursors} cursors`;
      } else if (selections > 0) {
        cursorInfo = ` | ${selections} selections`;
      }
    }

    const left = ` ${filename} ${modified}`;
    const right = ` ${position}${cursorInfo} | ${lineCount} lines `;
    const padding = " ".repeat(
      Math.max(0, this.statusBar.width - left.length - right.length)
    );

    this.statusBar.setContent(left + padding + right);
  }

  renderCursor() {
    // Calculate screen position of primary cursor
    // In multi-cursor mode, the terminal cursor follows the primary cursor
    let cursorRow = this.cursor.row;
    let cursorCol = this.cursor.col;

    // If we have multiple cursors, use the primary range's head position
    if (
      this.selection &&
      this.selection.active &&
      this.selection.primaryRange
    ) {
      const primaryRange = this.selection.primaryRange;
      cursorRow = primaryRange.head.row;
      cursorCol = primaryRange.head.col;
    }

    const screenRow = cursorRow - this.viewport.top;
    const screenCol = cursorCol - this.viewport.left + 5; // +5 for line numbers

    // Only show cursor if it's within the visible area
    if (
      screenRow >= 0 &&
      screenRow < this.textArea.height &&
      screenCol >= 5 &&
      screenCol < this.textArea.width + 5
    ) {
      this.screen.program.cup(screenRow, screenCol);
      this.screen.program.showCursor();
    } else {
      this.screen.program.hideCursor();
    }
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

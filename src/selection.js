const { debugLog } = require("./core/debug-logger");

// ===== Selection Management =====
class Selection {
  constructor(buffer, cursor) {
    this.buffer = buffer;
    this.cursor = cursor;
    this.active = false;
    this.anchor = { row: 0, col: 0 }; // Starting point of selection
    this.head = { row: 0, col: 0 }; // Current end point (follows cursor)
  }

  // Start a new selection from current cursor position
  start() {
    this.active = true;
    this.anchor.row = this.cursor.row;
    this.anchor.col = this.cursor.col;
    this.head.row = this.cursor.row;
    this.head.col = this.cursor.col;
  }

  // Update selection as cursor moves
  update() {
    if (!this.active) return;
    this.head.row = this.cursor.row;
    this.head.col = this.cursor.col;
  }

  // Clear the selection
  clear() {
    this.active = false;
    this.anchor = { row: 0, col: 0 };
    this.head = { row: 0, col: 0 };
  }

  // Toggle selection mode
  toggle() {
    if (this.active) {
      this.clear();
    } else {
      this.start();
    }
  }

  // Get normalized selection bounds (handles backward selection)
  getBounds() {
    if (!this.active) return null;

    let startRow, startCol, endRow, endCol;

    if (
      this.anchor.row < this.head.row ||
      (this.anchor.row === this.head.row && this.anchor.col <= this.head.col)
    ) {
      // Forward selection
      startRow = this.anchor.row;
      startCol = this.anchor.col;
      endRow = this.head.row;
      endCol = this.head.col;
    } else {
      // Backward selection
      startRow = this.head.row;
      startCol = this.head.col;
      endRow = this.anchor.row;
      endCol = this.anchor.col;
    }

    return { startRow, startCol, endRow, endCol };
  }

  // Check if a position is within the selection
  contains(row, col) {
    if (!this.active) return false;

    const bounds = this.getBounds();
    if (!bounds) return false;

    const { startRow, startCol, endRow, endCol } = bounds;

    // Check if position is within selection range
    if (row < startRow || row > endRow) return false;
    if (row === startRow && col < startCol) return false;
    if (row === endRow && col >= endCol) return false;

    return true;
  }

  // Get selected text
  getText() {
    if (!this.active) return "";

    const bounds = this.getBounds();
    if (!bounds) return "";

    const { startRow, startCol, endRow, endCol } = bounds;
    let selectedText = "";

    if (startRow === endRow) {
      // Single line selection
      const line = this.buffer.getLine(startRow);
      selectedText = line.substring(startCol, endCol);
    } else {
      // Multi-line selection
      const lines = [];

      // First line (from startCol to end)
      const firstLine = this.buffer.getLine(startRow);
      lines.push(firstLine.substring(startCol));

      // Middle lines (complete lines)
      for (let row = startRow + 1; row < endRow; row++) {
        lines.push(this.buffer.getLine(row));
      }

      // Last line (from start to endCol)
      const lastLine = this.buffer.getLine(endRow);
      lines.push(lastLine.substring(0, endCol));

      selectedText = lines.join("\n");
    }

    return selectedText;
  }

  // Delete selected text
  delete() {
    if (!this.active) return false;

    const bounds = this.getBounds();
    if (!bounds) return false;

    const { startRow, startCol, endRow, endCol } = bounds;

    // Save current state for undo
    this.buffer.saveToHistory();

    if (startRow === endRow) {
      // Single line deletion
      const line = this.buffer.getLine(startRow);
      this.buffer.lines[startRow] =
        line.substring(0, startCol) + line.substring(endCol);
    } else {
      // Multi-line deletion
      const firstLine = this.buffer.getLine(startRow);
      const lastLine = this.buffer.getLine(endRow);

      // Combine first and last line parts
      this.buffer.lines[startRow] =
        firstLine.substring(0, startCol) + lastLine.substring(endCol);

      // Remove intermediate lines
      this.buffer.lines.splice(startRow + 1, endRow - startRow);
    }

    // Move cursor to selection start
    this.cursor.row = startRow;
    this.cursor.col = startCol;
    this.cursor.clamp();

    // Clear selection and mark buffer as modified
    this.clear();
    this.buffer.modified = true;

    return true;
  }

  // Select entire line(s)
  selectLine(row = this.cursor.row) {
    this.active = true;
    this.anchor.row = row;
    this.anchor.col = 0;
    this.head.row = row;
    this.head.col = this.buffer.getLine(row).length;
  }

  // Select word at cursor
  selectWord() {
    const line = this.buffer.getLine(this.cursor.row);
    const col = this.cursor.col;

    // Find word boundaries
    let start = col;
    let end = col;

    // If we're on a word character, expand to word boundaries
    if (col < line.length && /\w/.test(line[col])) {
      // Find start of word
      while (start > 0 && /\w/.test(line[start - 1])) {
        start--;
      }
      // Find end of word
      while (end < line.length && /\w/.test(line[end])) {
        end++;
      }
    } else {
      // If not on a word, try to find nearest word
      // Look backward
      while (start > 0 && !/\w/.test(line[start - 1])) {
        start--;
      }
      while (start > 0 && /\w/.test(line[start - 1])) {
        start--;
      }
      // Look forward
      while (end < line.length && !/\w/.test(line[end])) {
        end++;
      }
      while (end < line.length && /\w/.test(line[end])) {
        end++;
      }
    }

    if (start < end) {
      this.active = true;
      this.anchor.row = this.cursor.row;
      this.anchor.col = start;
      this.head.row = this.cursor.row;
      this.head.col = end;

      // Move cursor to end of selection
      this.cursor.col = end;
    }
  }

  // Select all text in buffer
  selectAll() {
    this.active = true;
    this.anchor.row = 0;
    this.anchor.col = 0;

    const lastRow = Math.max(0, this.buffer.getLineCount() - 1);
    this.head.row = lastRow;
    this.head.col = this.buffer.getLine(lastRow).length;

    // Move cursor to end
    this.cursor.row = this.head.row;
    this.cursor.col = this.head.col;
  }

  // Extend selection to include movement
  extendTo(row, col) {
    if (!this.active) {
      this.start();
    }
    this.head.row = row;
    this.head.col = col;
  }
}

// ===== Integration with UI =====
// Add this method to your UI class to render selections
class UISelectionExtension {
  // Add this method to your existing UI class
  renderTextWithSelection(selection) {
    const textHeight = this.textArea.height;
    const textWidth = this.textArea.width;
    const lines = [];

    for (let i = 0; i < textHeight; i++) {
      const row = this.viewport.top + i;
      if (row < this.buffer.getLineCount()) {
        let line = this.buffer.getLine(row);
        let displayLine = "";

        // Build the display line with selection highlighting
        for (let col = 0; col < line.length; col++) {
          const char = line[col];
          const isSelected = selection.contains(row, col);

          if (isSelected) {
            // Highlight selected text
            displayLine += `{blue-bg}{white-fg}${char}{/}`;
          } else {
            displayLine += char;
          }
        }

        // Apply horizontal viewport
        if (this.viewport.left > 0) {
          // This gets more complex with tags, you might need to adjust
          displayLine = displayLine.slice(this.viewport.left);
        }

        // Add line numbers
        const lineNum = String(row + 1).padStart(4, " ");
        const lineNumColor = selection.contains(row, 0)
          ? "{blue-bg}{white-fg}"
          : "{cyan-fg}";
        lines.push(`${lineNumColor}${lineNum}{/} ${displayLine}`);
      } else {
        lines.push("{blue-fg}~{/}");
      }
    }

    this.textArea.setContent(lines.join("\n"));
  }
}

// ===== Clipboard Operations =====
class Clipboard {
  constructor() {
    this.content = "";
    this.isLinewise = false; // Track if content is full lines
  }

  copy(text, isLinewise = false) {
    this.content = text;
    this.isLinewise = isLinewise;
    debugLog.log("Copied to clipboard:", {
      length: text.length,
      isLinewise,
    });
    return true;
  }

  cut(selection, buffer, cursor) {
    const text = selection.getText();
    if (text) {
      this.copy(text);
      selection.delete();
      return true;
    }
    return false;
  }

  paste(buffer, cursor) {
    if (!this.content) return false;

    buffer.saveToHistory();

    if (this.isLinewise) {
      // Paste as new line(s)
      const lines = this.content.split("\n");

      // Insert after current line
      for (let i = 0; i < lines.length; i++) {
        buffer.lines.splice(cursor.row + i + 1, 0, lines[i]);
      }

      // Move cursor to start of first pasted line
      cursor.row++;
      cursor.col = 0;
    } else {
      // Paste at cursor position
      const line = buffer.getLine(cursor.row);
      const before = line.substring(0, cursor.col);
      const after = line.substring(cursor.col);

      if (this.content.includes("\n")) {
        // Multi-line paste
        const pasteLines = this.content.split("\n");

        // First line
        buffer.lines[cursor.row] = before + pasteLines[0];

        // Middle lines
        for (let i = 1; i < pasteLines.length - 1; i++) {
          buffer.lines.splice(cursor.row + i, 0, pasteLines[i]);
        }

        // Last line
        const lastIndex = pasteLines.length - 1;
        buffer.lines.splice(
          cursor.row + lastIndex,
          0,
          pasteLines[lastIndex] + after
        );

        // Move cursor to end of pasted content
        cursor.row += lastIndex;
        cursor.col = pasteLines[lastIndex].length;
      } else {
        // Single line paste
        buffer.lines[cursor.row] = before + this.content + after;
        cursor.col += this.content.length;
      }
    }

    buffer.modified = true;
    return true;
  }

  clear() {
    this.content = "";
    this.isLinewise = false;
  }
}

// Note: Command handler integration is now handled in src/features/command-handler.js

module.exports = { Selection, Clipboard };

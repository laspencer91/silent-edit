const { debugLog } = require("../core/debug-logger");

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

  // Smart copy that handles both single and multi-cursor scenarios
  copyFromEditor(selection, buffer) {
    if (!selection || !selection.active) {
      return { success: false, message: "Nothing to copy" };
    }

    if (selection.hasContentSelection()) {
      // Copy selected text (standard behavior)
      const text = selection.getText();
      this.copy(text);
      return { success: true, message: "Copied selection to clipboard" };
    }

    // Multi-cursor copy (copy lines at cursor positions)
    const emptyCursors = selection.ranges.filter((r) => r.isEmpty());
    if (emptyCursors.length > 1) {
      const success = this._copyMultiCursor(selection, buffer);
      const message = success
        ? `Copied ${emptyCursors.length} lines to clipboard`
        : "Failed to copy";
      return { success, message };
    }

    return { success: false, message: "Nothing to copy" };
  }

  // Internal method for multi-cursor copy
  _copyMultiCursor(selection, buffer) {
    const ranges = selection.getOrderedRanges("asc");
    const textParts = [];

    for (const range of ranges) {
      if (range.isEmpty()) {
        // For empty ranges (cursors), copy the entire line
        const bounds = range.getBounds();
        const line = buffer.getLine(bounds.startRow);
        textParts.push(line);
      } else {
        // For non-empty ranges, copy the selected text
        const bounds = range.getBounds();
        const text = this._getTextForBounds(bounds, buffer);
        textParts.push(text);
      }
    }

    if (textParts.length === 0) return false;

    // Join multiple parts with newlines
    const combinedText = textParts.join("\n");
    const hasMultipleParts = textParts.length > 1;

    this.copy(combinedText, hasMultipleParts);
    return true;
  }

  _getTextForBounds(bounds, buffer) {
    if (!bounds) return "";

    const { startRow, startCol, endRow, endCol } = bounds;
    let selectedText = "";

    if (startRow === endRow) {
      const line = buffer.getLine(startRow);
      selectedText = line.substring(startCol, endCol);
    } else {
      const lines = [];
      const firstLine = buffer.getLine(startRow);
      lines.push(firstLine.substring(startCol));

      for (let row = startRow + 1; row < endRow; row++) {
        lines.push(buffer.getLine(row));
      }

      const lastLine = buffer.getLine(endRow);
      lines.push(lastLine.substring(0, endCol));

      selectedText = lines.join("\n");
    }

    return selectedText;
  }

  // Smart cut that handles both single and multi-cursor scenarios
  cutFromEditor(selection, buffer, cursor) {
    if (!selection || !selection.active) {
      return { success: false, message: "Nothing to cut" };
    }

    if (selection.hasContentSelection()) {
      // Cut selected text (standard behavior)
      const text = selection.getText();
      if (text) {
        this.copy(text);
        selection.delete();
        return { success: true, message: "Cut to clipboard" };
      }
    }

    // Multi-cursor cut (cut lines at cursor positions)
    const emptyCursors = selection.ranges.filter((r) => r.isEmpty());
    if (emptyCursors.length > 1) {
      const success = this._copyMultiCursor(selection, buffer);
      if (success) {
        this._cutLinesAtCursors(selection, buffer);
        const message = `Cut ${emptyCursors.length} lines to clipboard`;
        return { success: true, message };
      }
    }

    return { success: false, message: "Nothing to cut" };
  }

  _cutLinesAtCursors(selection, buffer) {
    // Get all cursor positions and sort by row (descending for safe deletion)
    const cursorRows = selection.ranges
      .filter((range) => range.isEmpty())
      .map((range) => range.head.row)
      .sort((a, b) => b - a); // Descending order

    // Remove duplicates
    const uniqueRows = [...new Set(cursorRows)];

    buffer.saveToHistory();

    // Delete lines from bottom to top to avoid index shifting
    for (const row of uniqueRows) {
      if (row >= 0 && row < buffer.lines.length) {
        buffer.lines.splice(row, 1);
      }
    }

    // Ensure we always have at least one line
    if (buffer.lines.length === 0) {
      buffer.lines = [""];
    }

    buffer.modified = true;

    // Clear selection and position cursor appropriately
    selection.clear();

    // Position cursor at the first deleted line (or last line if we deleted everything)
    const targetRow = Math.min(
      uniqueRows[uniqueRows.length - 1] || 0,
      buffer.lines.length - 1
    );
    selection.cursor.row = targetRow;
    selection.cursor.col = 0;
    if (typeof selection.cursor.clamp === "function") {
      selection.cursor.clamp();
    }
  }

  // Smart paste that handles all scenarios and returns result info
  pasteToEditor(buffer, cursor, selection = null) {
    if (!this.content) {
      return { success: false, message: "Nothing to paste" };
    }

    // Determine paste strategy and execute
    const result = this._executePaste(buffer, cursor, selection);

    if (result.success) {
      const cursorCount = this._getCursorCount(selection);
      const message =
        cursorCount > 1
          ? `Pasted to ${cursorCount} cursors`
          : "Pasted from clipboard";
      return { success: true, message, cursorCount };
    }

    return result;
  }

  // Internal method to execute the appropriate paste strategy
  _executePaste(buffer, cursor, selection) {
    // Multi-cursor paste
    if (selection && selection.active && selection.ranges.length > 0) {
      const emptyCursors = selection.ranges.filter((r) => r.isEmpty()).length;
      if (emptyCursors > 1) {
        const success = this._pasteMultiCursor(buffer, cursor, selection);
        return { success };
      }

      // Replace selected content with paste
      if (selection.hasContentSelection()) {
        const success = selection.replaceRanges(() => this.content);
        return { success };
      }
    }

    // Single cursor paste (fallback)
    const success = this._pasteSingleCursor(buffer, cursor);
    return { success };
  }

  _getCursorCount(selection) {
    if (!selection || !selection.active) return 1;
    return selection.ranges.filter((r) => r.isEmpty()).length || 1;
  }

  _pasteSingleCursor(buffer, cursor) {
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

  _pasteMultiCursor(buffer, cursor, selection) {
    if (!this.content) return false;

    // Filter to only empty ranges (cursors) for paste operation
    const cursorRanges = selection.ranges.filter((r) => r.isEmpty());
    if (cursorRanges.length === 0) {
      // Fallback to single cursor paste
      return this._pasteSingleCursor(buffer, cursor);
    }

    // Prepare text distribution based on cursor count
    const textParts = this.prepareTextForDistribution(cursorRanges.length);

    // Use selection's replaceRanges for atomic multi-cursor paste
    // This will automatically save to history
    return selection.replaceRanges((range, bounds, index) => {
      // Only paste at empty ranges (cursor positions)
      if (!range.isEmpty()) {
        return null; // Skip non-empty ranges
      }

      // Get the text for this cursor position
      const textForCursor =
        textParts[index] || textParts[textParts.length - 1] || "";
      return textForCursor;
    });
  }

  prepareTextForDistribution(cursorCount) {
    if (!this.content) return [];

    // Strategy 1: If clipboard contains multiple lines, distribute one line per cursor
    if (this.content.includes("\n")) {
      const lines = this.content.split("\n");

      // If we have exactly as many lines as cursors, distribute one per cursor
      if (lines.length === cursorCount) {
        return lines;
      }

      // If we have more lines than cursors, cycle through them
      if (lines.length > cursorCount) {
        return Array.from(
          { length: cursorCount },
          (_, i) => lines[i % lines.length]
        );
      }

      // If we have fewer lines than cursors, repeat the pattern
      const result = [];
      for (let i = 0; i < cursorCount; i++) {
        result.push(lines[i % lines.length]);
      }
      return result;
    }

    // Strategy 2: Single line content - duplicate to all cursors
    return Array(cursorCount).fill(this.content);
  }

  clear() {
    this.content = "";
    this.isLinewise = false;
  }
}

module.exports = { Clipboard };

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

module.exports = { Clipboard };


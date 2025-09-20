// ===== Cursor Management =====
class Cursor {
  constructor(buffer) {
    this.buffer = buffer;
    this.row = 0;
    this.col = 0;
    this.preferredCol = 0; // Remember column when moving up/down
  }

  // Movement methods
  moveLeft() {
    if (this.col > 0) {
      this.col--;
      this.preferredCol = this.col;
    } else if (this.row > 0) {
      this.row--;
      this.col = this.buffer.getLine(this.row).length;
      this.preferredCol = this.col;
    }
  }

  moveRight() {
    const lineLength = this.buffer.getLine(this.row).length;
    if (this.col < lineLength) {
      this.col++;
      this.preferredCol = this.col;
    } else if (this.row < this.buffer.getLineCount() - 1) {
      this.row++;
      this.col = 0;
      this.preferredCol = 0;
    }
  }

  moveUp() {
    if (this.row > 0) {
      this.row--;
      const lineLength = this.buffer.getLine(this.row).length;
      this.col = Math.min(this.preferredCol, lineLength);
    }
  }

  moveDown() {
    if (this.row < this.buffer.getLineCount() - 1) {
      this.row++;
      const lineLength = this.buffer.getLine(this.row).length;
      this.col = Math.min(this.preferredCol, lineLength);
    }
  }

  moveToLineStart() {
    this.col = 0;
    this.preferredCol = 0;
  }

  moveToLineEnd() {
    this.col = this.buffer.getLine(this.row).length;
    this.preferredCol = this.col;
  }

  moveToStart() {
    this.row = 0;
    this.col = 0;
    this.preferredCol = 0;
  }

  moveToEnd() {
    this.row = Math.max(0, this.buffer.getLineCount() - 1);
    this.col = this.buffer.getLine(this.row).length;
    this.preferredCol = this.col;
  }

  // Token type detection
  getTokenType(char) {
    if (/\s/.test(char)) return "whitespace";
    if (/\w/.test(char)) return "word";
    if (/[(){}[\]]/.test(char)) return "bracket";
    if (/[.,;:]/.test(char)) return "punctuation";
    if (/[+\-*/%=<>!&|^~]/.test(char)) return "operator";
    if (/["'`]/.test(char)) return "quote";
    return "symbol";
  }

  // Smart token-based movement
  moveTokenForward() {
    const line = this.buffer.getLine(this.row);
    let newCol = this.col;

    if (newCol >= line.length) {
      // Move to next line
      if (this.row < this.buffer.getLineCount() - 1) {
        this.row++;
        this.col = 0;
        this.preferredCol = 0;
      }
      return;
    }

    const currentType = this.getTokenType(line[newCol]);

    // Skip current token type
    while (
      newCol < line.length &&
      this.getTokenType(line[newCol]) === currentType
    ) {
      newCol++;
    }

    this.col = newCol;
    this.preferredCol = this.col;
  }

  moveTokenBackward() {
    const line = this.buffer.getLine(this.row);
    let newCol = this.col;

    if (newCol <= 0) {
      // Move to previous line
      if (this.row > 0) {
        this.row--;
        this.col = this.buffer.getLine(this.row).length;
        this.preferredCol = this.col;
      }
      return;
    }

    // Move back one position to check the character we're moving into
    newCol--;
    const targetType = this.getTokenType(line[newCol]);

    // Skip backwards through the same token type
    while (newCol > 0 && this.getTokenType(line[newCol - 1]) === targetType) {
      newCol--;
    }

    this.col = newCol;
    this.preferredCol = this.col;
  }

  // Ensure cursor is within valid bounds
  clamp() {
    this.row = Math.max(0, Math.min(this.row, this.buffer.getLineCount() - 1));
    const lineLength = this.buffer.getLine(this.row).length;
    this.col = Math.max(0, Math.min(this.col, lineLength));
  }
}

module.exports = { Cursor };

const { debugLog } = require("./core/debug-logger");

class SelectionRange {
  constructor(anchorRow, anchorCol, headRow, headCol) {
    this.anchor = { row: anchorRow, col: anchorCol };
    this.head = { row: headRow, col: headCol };
  }

  static fromCursor(cursor) {
    return new SelectionRange(cursor.row, cursor.col, cursor.row, cursor.col);
  }

  static fromPositions(anchorRow, anchorCol, headRow, headCol) {
    return new SelectionRange(anchorRow, anchorCol, headRow, headCol);
  }

  clone() {
    return new SelectionRange(
      this.anchor.row,
      this.anchor.col,
      this.head.row,
      this.head.col
    );
  }

  isEmpty() {
    return (
      this.anchor.row === this.head.row && this.anchor.col === this.head.col
    );
  }

  setAnchor(row, col) {
    this.anchor.row = row;
    this.anchor.col = col;
  }

  setHead(row, col) {
    this.head.row = row;
    this.head.col = col;
  }

  getBounds() {
    const { anchor, head } = this;
    if (
      anchor.row < head.row ||
      (anchor.row === head.row && anchor.col <= head.col)
    ) {
      return {
        startRow: anchor.row,
        startCol: anchor.col,
        endRow: head.row,
        endCol: head.col,
      };
    }

    return {
      startRow: head.row,
      startCol: head.col,
      endRow: anchor.row,
      endCol: anchor.col,
    };
  }

  contains(row, col) {
    const bounds = this.getBounds();
    if (!bounds) return false;

    const { startRow, startCol, endRow, endCol } = bounds;
    if (row < startRow || row > endRow) return false;
    if (row === startRow && col < startCol) return false;
    if (row === endRow && col >= endCol) return false;
    return true;
  }

  isRowSelected(row) {
    if (this.isEmpty()) return false;
    const bounds = this.getBounds();
    if (!bounds) return false;
    return row >= bounds.startRow && row <= bounds.endRow;
  }
}

class Selection {
  constructor(buffer, cursor) {
    this.buffer = buffer;
    this.cursor = cursor;
    this.ranges = [];
    this.primaryIndex = -1;
  }

  get active() {
    return this.ranges.length > 0;
  }

  hasMultipleRanges() {
    return this.ranges.length > 1;
  }

  hasContentSelection() {
    return this.ranges.some((range) => !range.isEmpty());
  }

  get primaryRange() {
    if (this.primaryIndex < 0 || this.primaryIndex >= this.ranges.length) {
      return null;
    }
    return this.ranges[this.primaryIndex];
  }

  setPrimaryRange(index) {
    if (index < 0 || index >= this.ranges.length) return;
    this.primaryIndex = index;
  }

  clear() {
    this.ranges = [];
    this.primaryIndex = -1;
  }

  start() {
    const range = SelectionRange.fromCursor(this.cursor);
    this.setRanges([range]);
  }

  update() {
    const primary = this.primaryRange;
    if (!primary) return;
    primary.setHead(this.cursor.row, this.cursor.col);
  }

  toggle() {
    if (this.active) {
      this.clear();
    } else {
      this.start();
    }
  }

  getBounds() {
    const primary = this.primaryRange;
    return primary ? primary.getBounds() : null;
  }

  getAllBounds() {
    return this.ranges.map((range) => range.getBounds());
  }

  contains(row, col) {
    return this.ranges.some((range) => range.contains(row, col));
  }

  isRowSelected(row) {
    return this.ranges.some((range) => range.isRowSelected(row));
  }

  setRanges(ranges, primaryIndex = ranges.length - 1) {
    this.ranges = ranges.map((range) => range.clone());
    if (this.ranges.length === 0) {
      this.primaryIndex = -1;
      return;
    }
    this.sortRanges();

    if (primaryIndex < 0 || primaryIndex >= this.ranges.length) {
      this.primaryIndex = this.ranges.length - 1;
    } else {
      this.primaryIndex = primaryIndex;
    }
  }

  sortRanges() {
    this.ranges.sort((a, b) => {
      const aBounds = a.getBounds();
      const bBounds = b.getBounds();
      if (aBounds.startRow !== bBounds.startRow) {
        return aBounds.startRow - bBounds.startRow;
      }
      return aBounds.startCol - bBounds.startCol;
    });
  }

  getOrderedRanges(order = "asc") {
    const ranges = this.ranges.map((range) => range.clone());
    ranges.sort((a, b) => {
      const aBounds = a.getBounds();
      const bBounds = b.getBounds();
      if (aBounds.startRow !== bBounds.startRow) {
        return aBounds.startRow - bBounds.startRow;
      }
      return aBounds.startCol - bBounds.startCol;
    });
    if (order === "desc") {
      ranges.reverse();
    }
    return ranges;
  }

  collapseToPrimaryRange() {
    const primary = this.primaryRange;
    if (!primary) {
      this.clear();
      return;
    }
    this.setRanges([primary]);
  }

  ensurePrimaryRange() {
    if (this.active) return;
    const range = SelectionRange.fromCursor(this.cursor);
    this.setRanges([range]);
  }

  getText() {
    if (!this.active) return "";

    const ranges = this.getOrderedRanges("asc");
    const pieces = ranges.map((range) =>
      this._getTextForBounds(range.getBounds())
    );
    return pieces.join("\n");
  }

  _getTextForBounds(bounds) {
    if (!bounds) return "";

    const { startRow, startCol, endRow, endCol } = bounds;
    let selectedText = "";

    if (startRow === endRow) {
      const line = this.buffer.getLine(startRow);
      selectedText = line.substring(startCol, endCol);
    } else {
      const lines = [];
      const firstLine = this.buffer.getLine(startRow);
      lines.push(firstLine.substring(startCol));

      for (let row = startRow + 1; row < endRow; row++) {
        lines.push(this.buffer.getLine(row));
      }

      const lastLine = this.buffer.getLine(endRow);
      lines.push(lastLine.substring(0, endCol));

      selectedText = lines.join("\n");
    }

    return selectedText;
  }

  delete() {
    if (!this.active) return false;

    const primaryBounds = this.primaryRange
      ? this.primaryRange.getBounds()
      : null;

    const ranges = this.getOrderedRanges("asc").filter(
      (range) => !range.isEmpty()
    );

    if (ranges.length === 0) {
      this.clear();
      return false;
    }

    this.buffer.saveToHistory();

    for (let i = ranges.length - 1; i >= 0; i--) {
      const bounds = ranges[i].getBounds();
      this._deleteBounds(bounds);
    }

    this.buffer.modified = true;

    const targetBounds = primaryBounds || ranges[0].getBounds();
    this.clear();

    if (targetBounds) {
      this.cursor.row = targetBounds.startRow;
      this.cursor.col = targetBounds.startCol;
      if (typeof this.cursor.clamp === "function") {
        this.cursor.clamp();
      }
    }

    return true;
  }

  _deleteBounds(bounds) {
    const { startRow, startCol, endRow, endCol } = bounds;

    if (startRow === endRow) {
      const line = this.buffer.getLine(startRow);
      this.buffer.lines[startRow] =
        line.substring(0, startCol) + line.substring(endCol);
    } else {
      const firstLine = this.buffer.getLine(startRow);
      const lastLine = this.buffer.getLine(endRow);

      this.buffer.lines[startRow] =
        firstLine.substring(0, startCol) + lastLine.substring(endCol);

      this.buffer.lines.splice(startRow + 1, endRow - startRow);
    }
  }

  selectLine(row = this.cursor.row) {
    const line = this.buffer.getLine(row);
    const range = SelectionRange.fromPositions(
      row,
      0,
      row,
      line.length
    );
    this.setRanges([range]);
    this.cursor.row = range.head.row;
    this.cursor.col = range.head.col;
  }

  selectWord() {
    const line = this.buffer.getLine(this.cursor.row);
    const col = this.cursor.col;

    if (!line) {
      this.clear();
      return false;
    }

    let start = col;
    let end = col;

    if (col < line.length && /\w/.test(line[col])) {
      while (start > 0 && /\w/.test(line[start - 1])) {
        start--;
      }
      while (end < line.length && /\w/.test(line[end])) {
        end++;
      }
    } else {
      while (start > 0 && !/\w/.test(line[start - 1])) {
        start--;
      }
      while (start > 0 && /\w/.test(line[start - 1])) {
        start--;
      }

      while (end < line.length && !/\w/.test(line[end])) {
        end++;
      }
      while (end < line.length && /\w/.test(line[end])) {
        end++;
      }
    }

    if (start < end) {
      const range = SelectionRange.fromPositions(
        this.cursor.row,
        start,
        this.cursor.row,
        end
      );
      this.setRanges([range]);
      this.cursor.col = end;
      return true;
    }

    this.clear();
    return false;
  }

  selectAll() {
    const lastRow = Math.max(0, this.buffer.getLineCount() - 1);
    const lastCol = this.buffer.getLine(lastRow).length;
    const range = SelectionRange.fromPositions(0, 0, lastRow, lastCol);
    this.setRanges([range]);
    this.cursor.row = range.head.row;
    this.cursor.col = range.head.col;
  }

  extendTo(row, col) {
    const primary = this.primaryRange;
    if (!primary) {
      this.start();
      return;
    }
    primary.setHead(row, col);
  }

  replaceRanges(getReplacement) {
    if (!this.active) return false;

    const ordered = this.getOrderedRanges("asc");
    if (ordered.length === 0) {
      return false;
    }

    const primaryBounds = this.primaryRange
      ? this.primaryRange.getBounds()
      : null;
    const primaryKey = primaryBounds ? this._boundsKey(primaryBounds) : null;
    const orderedKeys = ordered.map((range) =>
      this._boundsKey(range.getBounds())
    );

    const actions = ordered.map((range, index) => {
      const originalBounds = range.getBounds();
      const result = getReplacement(range, originalBounds, index);

      if (result === null || result === undefined) {
        return {
          perform: false,
          bounds: originalBounds,
          text: "",
        };
      }

      let text = "";
      let targetBounds = originalBounds;

      if (typeof result === "object" && result !== null && !Array.isArray(result)) {
        text = result.text !== undefined ? String(result.text) : "";
        targetBounds = result.bounds ? result.bounds : originalBounds;
      } else {
        text = String(result);
      }

      const normalizedBounds = this._normalizeBounds(targetBounds);
      const isEmptyBounds = this._isEmptyBounds(normalizedBounds);
      const willModify = !isEmptyBounds || text.length > 0;

      return {
        perform: willModify,
        bounds: normalizedBounds,
        text,
      };
    });

    const shouldModify = actions.some((action) => action.perform);
    if (!shouldModify) {
      return false;
    }

    this.buffer.saveToHistory();

    for (let i = actions.length - 1; i >= 0; i--) {
      const action = actions[i];
      if (!action.perform) {
        action.newPosition = {
          row: action.bounds.startRow,
          col: action.bounds.startCol,
        };
        continue;
      }

      if (!this._isEmptyBounds(action.bounds)) {
        this._deleteBounds(action.bounds);
      }

      action.newPosition = this._insertTextAt(
        action.bounds.startRow,
        action.bounds.startCol,
        action.text
      );
    }

    this.buffer.modified = true;

    const newRanges = actions.map((action) =>
      SelectionRange.fromPositions(
        action.newPosition.row,
        action.newPosition.col,
        action.newPosition.row,
        action.newPosition.col
      )
    );

    let primaryIndex = newRanges.length - 1;
    if (primaryKey) {
      const foundIndex = orderedKeys.findIndex((key) => key === primaryKey);
      if (foundIndex !== -1) {
        primaryIndex = foundIndex;
      }
    }

    this.setRanges(newRanges, primaryIndex);

    const primary = this.primaryRange;
    if (primary) {
      this.cursor.row = primary.head.row;
      this.cursor.col = primary.head.col;
      if (typeof this.cursor.clamp === "function") {
        this.cursor.clamp();
      }
    }

    return true;
  }

  _normalizeBounds(bounds) {
    if (!bounds) return null;
    const { startRow, startCol, endRow, endCol } = bounds;

    if (
      startRow < endRow ||
      (startRow === endRow && startCol <= endCol)
    ) {
      return { startRow, startCol, endRow, endCol };
    }

    return {
      startRow: endRow,
      startCol: endCol,
      endRow: startRow,
      endCol: startCol,
    };
  }

  _isEmptyBounds(bounds) {
    if (!bounds) return true;
    return (
      bounds.startRow === bounds.endRow && bounds.startCol === bounds.endCol
    );
  }

  _boundsKey(bounds) {
    if (!bounds) return null;
    return `${bounds.startRow}:${bounds.startCol}:${bounds.endRow}:${bounds.endCol}`;
  }

  _insertTextAt(row, col, text) {
    if (text === undefined || text === null || text.length === 0) {
      return { row, col };
    }

    while (this.buffer.lines.length <= row) {
      this.buffer.lines.push("");
    }

    const originalLine = this.buffer.lines[row] || "";
    const before = originalLine.slice(0, col);
    const after = originalLine.slice(col);
    const parts = String(text).split("\n");

    if (parts.length === 1) {
      this.buffer.lines[row] = before + parts[0] + after;
      return { row, col: col + parts[0].length };
    }

    this.buffer.lines[row] = before + parts[0];
    let insertIndex = row + 1;

    for (let i = 1; i < parts.length; i++) {
      this.buffer.lines.splice(insertIndex, 0, parts[i]);
      insertIndex++;
    }

    const lastRow = row + parts.length - 1;
    this.buffer.lines[lastRow] += after;

    return {
      row: lastRow,
      col: parts[parts.length - 1].length,
    };
  }

  deleteBackward() {
    if (!this.active) return false;

    return this.replaceRanges((range, bounds) => {
      if (!range.isEmpty()) {
        return { text: "", bounds };
      }

      const startRow = bounds.startRow;
      const startCol = bounds.startCol;

      if (startCol > 0) {
        return {
          text: "",
          bounds: {
            startRow,
            startCol: startCol - 1,
            endRow: startRow,
            endCol: startCol,
          },
        };
      }

      if (startRow === 0) {
        return null;
      }

      const prevLineLength = this.buffer.getLine(startRow - 1).length;
      return {
        text: "",
        bounds: {
          startRow: startRow - 1,
          startCol: prevLineLength,
          endRow: startRow,
          endCol: startCol,
        },
      };
    });
  }

  deleteForward() {
    if (!this.active) return false;

    return this.replaceRanges((range, bounds) => {
      if (!range.isEmpty()) {
        return { text: "", bounds };
      }

      const startRow = bounds.startRow;
      const startCol = bounds.startCol;
      const line = this.buffer.getLine(startRow);

      if (startCol < line.length) {
        return {
          text: "",
          bounds: {
            startRow,
            startCol,
            endRow: startRow,
            endCol: startCol + 1,
          },
        };
      }

      const lastRowIndex = this.buffer.getLineCount() - 1;
      if (startRow >= lastRowIndex) {
        return null;
      }

      return {
        text: "",
        bounds: {
          startRow,
          startCol,
          endRow: startRow + 1,
          endCol: 0,
        },
      };
    });
  }

  addRange(range, makePrimary = true) {
    const cloned = range.clone();
    this.ranges.push(cloned);
    this.sortRanges();
    if (makePrimary) {
      this.primaryIndex = this.ranges.indexOf(cloned);
      if (this.primaryIndex === -1) {
        this.primaryIndex = this.ranges.length - 1;
      }
    }
  }

  addNextOccurrence(options = {}) {
    const { loop = false } = options;

    if (!this.active) {
      const selected = this.selectWord();
      return selected;
    }

    const primary = this.primaryRange;
    if (!primary) return false;

    const primaryBounds = primary.getBounds();
    const searchText = this._getTextForBounds(primaryBounds);
    if (!searchText) return false;

    const bufferLineCount = this.buffer.getLineCount();
    let row = primaryBounds.endRow;
    let col = primaryBounds.endCol;

    const visitKey = (r, c) => `${r}:${c}`;
    const visited = new Set(
      this.ranges.map((range) => {
        const bounds = range.getBounds();
        return visitKey(bounds.startRow, bounds.startCol);
      })
    );

    const originalKey = visitKey(primaryBounds.startRow, primaryBounds.startCol);

    const searchForward = () => {
      while (row < bufferLineCount) {
        const line = this.buffer.getLine(row);
        const fromIndex = col;
        const index = line.indexOf(searchText, fromIndex);
        if (index !== -1) {
          const key = visitKey(row, index);
          if (!visited.has(key)) {
            const candidate = SelectionRange.fromPositions(
              row,
              index,
              row,
              index + searchText.length
            );
            const cloned = candidate.clone();
            this.ranges.push(cloned);
            this.sortRanges();
            this.primaryIndex = this.ranges.indexOf(cloned);
            this.cursor.row = cloned.head.row;
            this.cursor.col = cloned.head.col;
            if (typeof this.cursor.clamp === "function") {
              this.cursor.clamp();
            }
            return true;
          }
          col = index + Math.max(1, searchText.length);
        } else {
          row++;
          col = 0;
        }
      }
      return false;
    };

    if (searchForward()) return true;
    if (!loop) return false;

    row = 0;
    col = 0;
    while (row < bufferLineCount) {
      const line = this.buffer.getLine(row);
      const index = line.indexOf(searchText, col);
      if (index === -1) {
        row++;
        col = 0;
        continue;
      }
      const key = visitKey(row, index);
      if (key === originalKey) break;
      if (!visited.has(key)) {
        const candidate = SelectionRange.fromPositions(
          row,
          index,
          row,
          index + searchText.length
        );
        const cloned = candidate.clone();
        this.ranges.push(cloned);
        this.sortRanges();
        this.primaryIndex = this.ranges.indexOf(cloned);
        this.cursor.row = cloned.head.row;
        this.cursor.col = cloned.head.col;
        if (typeof this.cursor.clamp === "function") {
          this.cursor.clamp();
        }
        return true;
      }
      col = index + Math.max(1, searchText.length);
    }

    return false;
  }
}

class Clipboard {
  constructor() {
    this.content = "";
    this.isLinewise = false;
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
      const lines = this.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        buffer.lines.splice(cursor.row + i + 1, 0, lines[i]);
      }
      cursor.row++;
      cursor.col = 0;
    } else {
      const line = buffer.getLine(cursor.row);
      const before = line.substring(0, cursor.col);
      const after = line.substring(cursor.col);

      if (this.content.includes("\n")) {
        const pasteLines = this.content.split("\n");
        buffer.lines[cursor.row] = before + pasteLines[0];

        for (let i = 1; i < pasteLines.length - 1; i++) {
          buffer.lines.splice(cursor.row + i, 0, pasteLines[i]);
        }

        const lastIndex = pasteLines.length - 1;
        buffer.lines.splice(
          cursor.row + lastIndex,
          0,
          pasteLines[lastIndex] + after
        );

        cursor.row += lastIndex;
        cursor.col = pasteLines[lastIndex].length;
      } else {
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

module.exports = { Selection, Clipboard, SelectionRange };

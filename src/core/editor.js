const blessed = require("blessed");
const { Buffer } = require("./buffer");
const { Cursor } = require("./cursor");
const { UI } = require("./ui");
const { Selection } = require("../selection");
const { Clipboard } = require("../features/clipboard");
const { CommandHandler } = require("../features/command-handler");

// ===== Main Editor Class =====
class TextEditor {
  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      title: "Terminal Code Editor",
      keys: true,
      input: process.stdin,
      output: process.stdout,
    });

    this.buffer = new Buffer();
    this.cursor = new Cursor(this.buffer);

    // Add selection and clipboard
    this.selection = new Selection(this.buffer, this.cursor);
    this.clipboard = new Clipboard();

    this.ui = new UI(this.screen, this.buffer, this.cursor, this.selection);
    this.commands = new CommandHandler(this);

    this.ui.render();
  }

  // Cursor movement
  moveCursor(direction, extending = false) {
    const prevRow = this.cursor.row;
    const prevCol = this.cursor.col;

    switch (direction) {
      case "up":
        this.cursor.moveUp();
        break;
      case "down":
        this.cursor.moveDown();
        break;
      case "left":
        this.cursor.moveLeft();
        break;
      case "right":
        this.cursor.moveRight();
        break;
      case "home":
        this.cursor.moveToLineStart();
        break;
      case "end":
        this.cursor.moveToLineEnd();
        break;
      case "pageup":
        for (let i = 0; i < this.ui.textArea.height; i++) {
          this.cursor.moveUp();
        }
        break;
      case "pagedown":
        for (let i = 0; i < this.ui.textArea.height; i++) {
          this.cursor.moveDown();
        }
        break;
      case "token-left":
        this.cursor.moveTokenBackward();
        break;
      case "token-right":
        this.cursor.moveTokenForward();
        break;
    }

    if (this.selection.active) {
      if (extending) {
        this.selection.update();
      } else {
        this.selection.clear();
      }
    }

    this.ui.render();
  }

  swapLines(direction) {
    if (direction === "up" && this.cursor.row > 0) {
      const temp = this.buffer.lines[this.cursor.row];
      this.buffer.lines[this.cursor.row] =
        this.buffer.lines[this.cursor.row - 1];
      this.buffer.lines[this.cursor.row - 1] = temp;
      this.cursor.row--;
    } else if (
      direction === "down" &&
      this.cursor.row < this.buffer.lines.length - 1
    ) {
      const temp = this.buffer.lines[this.cursor.row];
      this.buffer.lines[this.cursor.row] =
        this.buffer.lines[this.cursor.row + 1];
      this.buffer.lines[this.cursor.row + 1] = temp;
      this.cursor.row++;
    }
    this.buffer.modified = true;
    this.buffer.saveToHistory();
    this.ui.render();
  }

  // Text editing
  insertChar(char) {
    if (this.selection.active) {
      const replaced = this.selection.replaceRanges(() => char);
      if (replaced) {
        this.cursor.preferredCol = this.cursor.col;
        this.ui.render();
        return;
      }
    }

    this.buffer.insertChar(this.cursor.row, this.cursor.col, char);
    this.cursor.col += char.length;
    this.ui.render();
  }

  insertNewline() {
    if (this.selection.active) {
      const replaced = this.selection.replaceRanges(() => "\n");
      if (replaced) {
        this.cursor.preferredCol = this.cursor.col;
        this.ui.render();
        return;
      }
    }

    this.buffer.insertLine(this.cursor.row, this.cursor.col);
    this.cursor.row++;
    this.cursor.col = 0;
    this.cursor.preferredCol = 0;
    this.ui.render();
  }

  deleteChar() {
    if (this.selection.active) {
      const handled = this.selection.hasContentSelection()
        ? this.selection.replaceRanges(() => "")
        : this.selection.deleteBackward();
      if (handled) {
        this.cursor.preferredCol = this.cursor.col;
        this.ui.render();
        return;
      }
    }
    const aboveRowLength =
      this.cursor.row > 0 ? this.buffer.getLine(this.cursor.row - 1).length : 0;
    const moved = this.buffer.deleteChar(this.cursor.row, this.cursor.col);
    if (moved) {
      if (this.cursor.col > 0) {
        this.cursor.col--;
      } else if (this.cursor.row > 0) {
        this.cursor.row--;
        this.cursor.col = aboveRowLength;
      }
    }
    this.ui.render();
  }

  deleteForward() {
    if (this.selection.active) {
      const handled = this.selection.hasContentSelection()
        ? this.selection.replaceRanges(() => "")
        : this.selection.deleteForward();
      if (handled) {
        this.cursor.preferredCol = this.cursor.col;
        this.ui.render();
        return;
      }
    }
    const line = this.buffer.getLine(this.cursor.row);
    if (this.cursor.col < line.length) {
      this.cursor.col++;
      this.deleteChar();
    } else if (this.cursor.row < this.buffer.getLineCount() - 1) {
      // Join next line
      const nextLine = this.buffer.getLine(this.cursor.row + 1);
      this.buffer.lines[this.cursor.row] += nextLine;
      this.buffer.lines.splice(this.cursor.row + 1, 1);
      this.buffer.modified = true;
      this.buffer.saveToHistory();
      this.ui.render();
    }
  }

  // File operations
  async save() {
    if (!this.buffer.filename) {
      const filename = await this.ui.promptInput("Save as: ");
      if (!filename) {
        this.ui.showMessage("Save cancelled", "warning");
        return;
      }
      this.buffer.filename = filename;
    }

    const success = await this.buffer.saveFile();
    if (success) {
      this.ui.showMessage(`Saved to ${this.buffer.filename}`, "success");
    } else {
      this.ui.showMessage("Failed to save file", "error");
    }
    this.ui.render();
  }

  async open() {
    const filename = await this.ui.promptInput("Open file: ");
    if (!filename) {
      this.ui.showMessage("Open cancelled", "warning");
      return;
    }

    const success = await this.buffer.loadFile(filename);
    if (success) {
      this.cursor.moveToStart();
      this.ui.showMessage(`Opened ${filename}`, "success");
    } else {
      this.ui.showMessage(`Failed to open ${filename}`, "error");
    }
    this.ui.render();
  }

  // Undo/Redo
  undo() {
    if (this.buffer.undo()) {
      this.cursor.clamp();
      this.ui.showMessage("Undo", "info");
      this.ui.render();
    }
  }

  redo() {
    if (this.buffer.redo()) {
      this.cursor.clamp();
      this.ui.showMessage("Redo", "info");
      this.ui.render();
    }
  }

  // Search
  async search() {
    const searchTerm = await this.ui.promptInput("Search: ");
    if (searchTerm) {
      this.ui.searchTerm = searchTerm;
      // TODO: Implement find next/previous functionality
      this.ui.render();
    }
  }

  selectNextOccurrence() {
    const added = this.selection.addNextOccurrence();
    if (!added) {
      this.ui.showMessage("No further matches", "warning");
    } else {
      const count = this.selection.ranges.length;
      const message =
        count > 1 ? `Added occurrence (${count})` : "Word selected";
      this.ui.showMessage(message, "info");
    }
    this.ui.render();
  }

  // Help
  showHelp() {
    const helpText = `
SILENT EDIT - Key Bindings:

NAVIGATION:
  Arrow Keys        - Move cursor
  Ctrl+Left/Right   - Move by token/word
  Home/End          - Start/end of line
  Page Up/Down      - Scroll page

SELECTION:
  Shift+Arrows      - Select characters
  Alt+Shift+Arrows  - Select by tokens
  Ctrl+E            - Extend selection right by token
  Ctrl+B            - Extend selection left by token
  Ctrl+A            - Select all
  Ctrl+L            - Select line
  Ctrl+D            - Select word
  Ctrl+Space        - Toggle selection mode

EDITING:
  Ctrl+C            - Copy
  Ctrl+X            - Cut  
  Ctrl+V            - Paste
  Ctrl+Z            - Undo
  Ctrl+Y            - Redo

FILE:
  Ctrl+S            - Save
  Ctrl+O            - Open
  Ctrl+F            - Search
  Ctrl+Q            - Quit
  
Press any key to continue...`;

    this.ui.showMessage(helpText, "info");
  }

  // Exit handling
  handleEscape() {
    if (this.selection.active) {
      this.selection.clear();
      this.ui.showMessage("Selection cleared", "info");
    }
    this.ui.searchTerm = "";
    this.ui.render();
  }

  async quit() {
    if (this.buffer.modified) {
      const response = await this.ui.promptInput(
        "Unsaved changes. Save before quit? (y/n/c): "
      );
      if (response === "y") {
        await this.save();
        process.exit(0);
      } else if (response === "n") {
        process.exit(0);
      }
      // 'c' or anything else cancels quit
    } else {
      process.exit(0);
    }
  }

  // Start the editor
  run() {
    const args = process.argv.slice(2);
    if (args.length > 0) {
      this.buffer.loadFile(args[0]).then(() => {
        this.ui.render();
      });
    }
  }
}

module.exports = { TextEditor };

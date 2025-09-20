const { debugLog } = require("../core/debug-logger");

// ===== Command Handler =====
class CommandHandler {
  constructor(editor) {
    this.editor = editor;
    this.setupKeyBindings();
    this.setupSelectionBindings();
  }

  setupKeyBindings() {
    const screen = this.editor.screen;

    // Text input
    screen.on("keypress", (ch, key) => {
      if (key && (key.ctrl || key.meta || key.name === "escape")) return;

      if (
        ch &&
        ch.length === 1 &&
        key.name !== "enter" &&
        key.name !== "return" &&
        key.name !== "backspace" &&
        key.name !== "tab"
      ) {
        this.editor.insertChar(ch);
      }
    });

    // Special keys
    screen.key(["up"], () => this.editor.moveCursor("up"));
    screen.key(["down"], () => this.editor.moveCursor("down"));
    screen.key(["left"], () => this.editor.moveCursor("left"));
    screen.key(["right"], () => this.editor.moveCursor("right"));
    screen.key(["home", "M-home"], (ch, key) => {
      if (key.meta) {
        if (!this.editor.selection.active) this.editor.selection.start();
        this.editor.moveCursor("home", true);
      } else {
        this.editor.moveCursor("home");
      }
    });
    screen.key(["end", "M-end"], (ch, key) => {
      if (key.meta) {
        if (!this.editor.selection.active) this.editor.selection.start();
        this.editor.moveCursor("end", true);
      } else {
        this.editor.moveCursor("end");
      }
    });
    screen.key(["pageup"], () => this.editor.moveCursor("pageup"));
    screen.key(["pagedown"], () => this.editor.moveCursor("pagedown"));

    // Smart word/token movement
    screen.key(["C-left"], () => this.editor.moveCursor("token-left"));
    screen.key(["C-right"], () => this.editor.moveCursor("token-right"));

    // Editing
    screen.key(["enter"], () => this.editor.insertNewline());
    screen.key(["backspace"], () => this.editor.deleteChar());
    screen.key(["delete"], () => this.editor.deleteForward());
    screen.key(["tab"], () => this.editor.insertChar("  ")); // 2 spaces
    screen.key(["C-up"], () => this.editor.swapLines("up"));
    screen.key(["C-down"], () => this.editor.swapLines("down"));

    // File operations
    screen.key(["C-s"], () => this.editor.save());
    screen.key(["C-o"], () => this.editor.open());

    // Undo/Redo
    screen.key(["C-z"], () => this.editor.undo());
    screen.key(["C-y"], () => this.editor.redo());

    // Search
    screen.key(["C-f"], () => this.editor.search());

    // Help
    screen.key(["C-h"], () => this.editor.showHelp());

    // Quit
    screen.key(["C-q"], () => this.editor.quit());
    screen.key(["escape"], () => this.editor.handleEscape());
  }

  setupSelectionBindings() {
    const screen = this.editor.screen;

    // Selection mode toggle
    screen.key(["C-space"], () => {
      this.editor.selection.toggle();
      this.editor.ui.showMessage(
        this.editor.selection.active
          ? "Selection started"
          : "Selection cleared",
        "info"
      );
      this.editor.ui.render();
    });

    // Movement with selection (Shift + arrows)
    screen.key(["S-up"], () => {
      if (!this.editor.selection.active) this.editor.selection.start();
      this.editor.moveCursor("up", true);
    });

    screen.key(["S-down"], () => {
      if (!this.editor.selection.active) this.editor.selection.start();
      this.editor.moveCursor("down", true);
    });

    screen.key(["S-left"], () => {
      if (!this.editor.selection.active) this.editor.selection.start();
      this.editor.moveCursor("left", true);
    });

    screen.key(["S-right"], () => {
      if (!this.editor.selection.active) this.editor.selection.start();
      this.editor.moveCursor("right", true);
    });

    // Token selection with Ctrl+Shift
    screen.key(["C-M-left"], () => {
      if (!this.editor.selection.active) this.editor.selection.start();
      this.editor.moveCursor("token-left", true);
    });

    screen.key(["C-M-right"], () => {
      if (!this.editor.selection.active) this.editor.selection.start();
      this.editor.moveCursor("token-right", true);
    });

    // Select all
    screen.key(["C-a"], () => {
      this.editor.selection.selectAll();
      this.editor.ui.showMessage("All text selected", "info");
      this.editor.ui.render();
    });

    // Select current line
    screen.key(["C-l"], () => {
      this.editor.selection.selectLine();
      this.editor.ui.showMessage("Line selected", "info");
      this.editor.ui.render();
    });

    // Select current word
    screen.key(["C-d"], () => {
      this.editor.selectNextOccurrence();
    });

    // Copy/Cut/Paste
    screen.key(["C-c"], () => {
      if (
        this.editor.selection.active &&
        this.editor.selection.hasContentSelection()
      ) {
        const text = this.editor.selection.getText();
        this.editor.clipboard.copy(text);
        this.editor.selection.clear();
        this.editor.ui.showMessage("Copied to clipboard", "success");
        this.editor.ui.render();
      }
    });

    screen.key(["C-x"], () => {
      if (
        this.editor.selection.active &&
        this.editor.selection.hasContentSelection()
      ) {
        this.editor.clipboard.cut(
          this.editor.selection,
          this.editor.buffer,
          this.editor.cursor
        );
        this.editor.ui.showMessage("Cut to clipboard", "success");
        this.editor.ui.render();
      }
    });

    screen.key(["C-v"], () => {
      this.editor.clipboard.paste(this.editor.buffer, this.editor.cursor);
      this.editor.selection.clear();
      this.editor.ui.showMessage("Pasted from clipboard", "success");
      this.editor.ui.render();
    });

    // Delete selection
    screen.key(["delete"], () => {
      this.editor.deleteForward();
    });
  }
}

module.exports = { CommandHandler };

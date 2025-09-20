const { debugLog } = require("../core/debug-logger");

// ===== Command Handler =====
class CommandHandler {
  constructor(editor) {
    this.editor = editor;
    this.setupKeyDispatch();
  }

  setupKeyDispatch() {
    const screen = this.editor.screen;

    // Define key mappings with their handlers and overlay behavior
    this.keyMap = {
      // Navigation (blocked by overlay)
      up: { handler: () => this.editor.moveCursor("up"), blockOnOverlay: true },
      down: {
        handler: () => this.editor.moveCursor("down"),
        blockOnOverlay: true,
      },
      left: {
        handler: () => this.editor.moveCursor("left"),
        blockOnOverlay: true,
      },
      right: {
        handler: () => this.editor.moveCursor("right"),
        blockOnOverlay: true,
      },
      pageup: {
        handler: () => this.editor.moveCursor("pageup"),
        blockOnOverlay: true,
      },
      pagedown: {
        handler: () => this.editor.moveCursor("pagedown"),
        blockOnOverlay: true,
      },

      // Smart movement (blocked by overlay)
      "C-left": {
        handler: () => this.editor.moveCursor("token-left"),
        blockOnOverlay: true,
      },
      "C-right": {
        handler: () => this.editor.moveCursor("token-right"),
        blockOnOverlay: true,
      },

      // Editing (blocked by overlay)
      enter: {
        handler: () => this.editor.insertNewline(),
        blockOnOverlay: true,
      },
      backspace: {
        handler: () => this.editor.deleteChar(),
        blockOnOverlay: true,
      },
      delete: {
        handler: () => this.editor.deleteForward(),
        blockOnOverlay: true,
      },
      tab: {
        handler: () => this.editor.insertChar("  "),
        blockOnOverlay: true,
      },
      "C-up": {
        handler: () => this.editor.swapLines("up"),
        blockOnOverlay: true,
      },
      "C-down": {
        handler: () => this.editor.swapLines("down"),
        blockOnOverlay: true,
      },

      // File operations (blocked by overlay)
      "C-s": { handler: () => this.editor.save(), blockOnOverlay: true },
      "C-o": { handler: () => this.editor.open(), blockOnOverlay: true },
      "C-f": { handler: () => this.editor.search(), blockOnOverlay: true },

      // Undo/Redo (blocked by overlay)
      "C-z": { handler: () => this.editor.undo(), blockOnOverlay: true },
      "C-y": { handler: () => this.editor.redo(), blockOnOverlay: true },

      // Help (blocked by overlay)
      "C-h": { handler: () => this.editor.showHelp(), blockOnOverlay: true },

      // Selection (blocked by overlay)
      "C-space": {
        handler: () => this.handleSelectionToggle(),
        blockOnOverlay: true,
      },
      "C-a": { handler: () => this.handleSelectAll(), blockOnOverlay: true },
      "C-l": { handler: () => this.handleSelectLine(), blockOnOverlay: true },
      "C-d": {
        handler: () => this.editor.selectNextOccurrence(),
        blockOnOverlay: true,
      },

      // Selection with movement (blocked by overlay)
      "S-up": {
        handler: () => this.handleSelectionMove("up"),
        blockOnOverlay: true,
      },
      "S-down": {
        handler: () => this.handleSelectionMove("down"),
        blockOnOverlay: true,
      },
      "S-left": {
        handler: () => this.handleSelectionMove("left"),
        blockOnOverlay: true,
      },
      "S-right": {
        handler: () => this.handleSelectionMove("right"),
        blockOnOverlay: true,
      },
      "C-M-left": {
        handler: () => this.handleSelectionMove("token-left"),
        blockOnOverlay: true,
      },
      "C-M-right": {
        handler: () => this.handleSelectionMove("token-right"),
        blockOnOverlay: true,
      },

      // Clipboard (blocked by overlay)
      "C-c": { handler: () => this.handleCopy(), blockOnOverlay: true },
      "C-x": { handler: () => this.handleCut(), blockOnOverlay: true },
      "C-v": { handler: () => this.handlePaste(), blockOnOverlay: true },

      // Special overlay-aware keys
      "C-p": { handler: () => this.handleFileSearch(), blockOnOverlay: false },
      "C-q": { handler: () => this.handleQuit(), blockOnOverlay: false },
      escape: {
        handler: () => this.editor.handleEscape(),
        blockOnOverlay: false,
      },
    };

    // Complex keys that need special handling
    this.setupComplexKeys(screen);

    // Set up the main key dispatcher
    this.setupKeyDispatcher(screen);

    // Handle text input
    this.setupTextInput(screen);
  }

  setupKeyDispatcher(screen) {
    // Register all simple key mappings
    Object.entries(this.keyMap).forEach(([keyCombo, config]) => {
      screen.key([keyCombo], () => {
        if (config.blockOnOverlay && this.editor.isOverlayActive()) return;
        config.handler();
      });
    });
  }

  setupTextInput(screen) {
    screen.on("keypress", (ch, key) => {
      if (this.editor.isOverlayActive()) return;
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
  }

  setupComplexKeys(screen) {
    // Keys that need access to the key object for meta/shift detection
    screen.key(["home", "M-home"], (ch, key) => {
      if (this.editor.isOverlayActive()) return;
      if (key.meta) {
        if (!this.editor.selection.active) this.editor.selection.start();
        this.editor.moveCursor("home", true);
      } else {
        this.editor.moveCursor("home");
      }
    });

    screen.key(["end", "M-end"], (ch, key) => {
      if (this.editor.isOverlayActive()) return;
      if (key.meta) {
        if (!this.editor.selection.active) this.editor.selection.start();
        this.editor.moveCursor("end", true);
      } else {
        this.editor.moveCursor("end");
      }
    });
  }

  // Handler methods for cleaner organization
  handleSelectionToggle() {
    this.editor.selection.toggle();
    this.editor.ui.showMessage(
      this.editor.selection.active ? "Selection started" : "Selection cleared",
      "info"
    );
    this.editor.ui.render();
  }

  handleSelectAll() {
    this.editor.selection.selectAll();
    this.editor.ui.showMessage("All text selected", "info");
    this.editor.ui.render();
  }

  handleSelectLine() {
    this.editor.selection.selectLine();
    this.editor.ui.showMessage("Line selected", "info");
    this.editor.ui.render();
  }

  handleSelectionMove(direction) {
    if (!this.editor.selection.active) this.editor.selection.start();
    this.editor.moveCursor(direction, true);
  }

  handleCopy() {
    const result = this.editor.clipboard.copyFromEditor(
      this.editor.selection,
      this.editor.buffer
    );

    if (result.success) {
      this.editor.selection.clear();
      this.editor.ui.showMessage(result.message, "success");
    } else {
      this.editor.ui.showMessage(result.message, "warning");
    }

    this.editor.ui.render();
  }

  handleCut() {
    const result = this.editor.clipboard.cutFromEditor(
      this.editor.selection,
      this.editor.buffer,
      this.editor.cursor
    );

    this.editor.ui.showMessage(
      result.message,
      result.success ? "success" : "warning"
    );
    this.editor.ui.render();
  }

  handlePaste() {
    const result = this.editor.clipboard.pasteToEditor(
      this.editor.buffer,
      this.editor.cursor,
      this.editor.selection
    );

    if (result.success) {
      // Only clear selection for single cursor operations
      if (!result.cursorCount || result.cursorCount <= 1) {
        this.editor.selection.clear();
      }
    }

    this.editor.ui.showMessage(
      result.message,
      result.success ? "success" : "warning"
    );
    this.editor.ui.render();
  }

  handleFileSearch() {
    if (this.editor.isOverlayActive()) {
      this.editor.hideOverlay();
    } else {
      this.editor.showFileSearch();
    }
  }

  handleQuit() {
    if (this.editor.isOverlayActive()) {
      this.editor.hideOverlay();
    }
    this.editor.quit();
  }
}

module.exports = { CommandHandler };

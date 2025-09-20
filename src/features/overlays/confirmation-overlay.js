const blessed = require("blessed");
const { debugLog } = require("../../core/debug-logger");

const COLORS = {
  modalBg: "black",
  modalBorder: "cyan",
  buttonBg: "gray",
  buttonFg: "white",
  buttonSelectedBg: "cyan",
  buttonSelectedFg: "black",
  textFg: "white",
  muted: "gray",
  warning: "yellow",
};

/**
 * ConfirmationOverlay displays a centered modal dialog for user confirmation.
 * Supports customizable message, details, and button choices.
 *
 * Usage:
 *   const overlay = new ConfirmationOverlay(screen, {
 *     message: "Discard unsaved changes?",
 *     details: "filename.txt",
 *     choices: [
 *       { key: "y", label: "Save & Continue", action: "save" },
 *       { key: "n", label: "Discard", action: "discard" },
 *       { key: "c", label: "Cancel", action: "cancel" }
 *     ],
 *     onConfirm: (action) => console.log("User chose:", action),
 *     onCancel: () => console.log("User cancelled")
 *   });
 */
class ConfirmationOverlay {
  constructor(screen, options = {}) {
    this.screen = screen;
    this.options = options;

    // Configuration
    this.message = options.message || "Are you sure?";
    this.details = options.details || null;
    this.choices = options.choices || [
      { key: "y", label: "Yes", action: "confirm" },
      { key: "n", label: "No", action: "cancel" },
    ];

    // Callbacks
    this.onConfirm = options.onConfirm || (() => {});
    this.onCancel = options.onCancel || (() => {});

    // State
    this.selectedIndex = 0;
    this.container = null;
    this.buttons = [];

    // Promise resolution (for async usage)
    this.resolvePromise = null;
    this.rejectPromise = null;
  }

  attach(parent) {
    if (this.container) return;

    // Calculate modal dimensions
    const maxWidth = Math.min(60, Math.floor(this.screen.width * 0.8));
    const height =
      8 + (this.details ? 1 : 0) + Math.ceil(this.choices.length / 3);

    this.container = blessed.box({
      parent,
      top: "center",
      left: "center",
      width: maxWidth,
      height: height,
      padding: { top: 1, right: 2, bottom: 1, left: 2 },
      border: { type: "line", fg: COLORS.modalBorder },
      style: { fg: COLORS.textFg, bg: COLORS.modalBg },
      label: " Confirmation ",
      keys: true,
      mouse: true,
      focusable: true,
      input: true,
      keyable: true,
    });

    // Message text
    this.messageBox = blessed.box({
      parent: this.container,
      top: 0,
      left: 1,
      right: 1,
      height: 2,
      tags: true,
      style: { fg: COLORS.textFg, bg: COLORS.modalBg },
      content: this.formatMessage(),
    });

    // Details text (optional)
    let detailsHeight = 0;
    if (this.details) {
      detailsHeight = 1;
      this.detailsBox = blessed.box({
        parent: this.container,
        top: 2,
        left: 1,
        right: 1,
        height: 1,
        tags: true,
        style: { fg: COLORS.muted, bg: COLORS.modalBg },
        content: `{gray-fg}${this.details}{/}`,
      });
    }

    // Button container
    this.buttonContainer = blessed.box({
      parent: this.container,
      top: 3 + detailsHeight,
      left: 1,
      right: 1,
      bottom: 1,
      style: { bg: COLORS.modalBg },
    });

    this.createButtons();
    this.registerEvents();
    this.updateButtonStyles();
  }

  detach() {
    if (!this.container) return;
    this.container.destroy();
    this.container = null;
    this.buttons = [];
    this.messageBox = null;
    this.detailsBox = null;
    this.buttonContainer = null;
  }

  onShow() {
    // Reset selection to first button
    this.selectedIndex = 0;
    this.updateButtonStyles();
  }

  onHide() {
    // Clean up any pending promises
    if (this.rejectPromise) {
      this.rejectPromise(new Error("Overlay closed"));
      this.resolvePromise = null;
      this.rejectPromise = null;
    }
  }

  focus() {
    // Focus the container instead of individual buttons
    if (this.container) {
      this.container.focus();
    }
  }

  formatMessage() {
    return `{bold}${this.message}{/}`;
  }

  createButtons() {
    this.buttons = [];
    const buttonWidth = Math.floor(
      (this.container.width - 4) / this.choices.length
    );

    this.choices.forEach((choice, index) => {
      const button = blessed.box({
        parent: this.buttonContainer,
        top: 0,
        left: index * buttonWidth,
        width: buttonWidth - 1,
        height: 3,
        tags: true,
        keys: false, // Disable individual button key handling
        mouse: true,
        border: { type: "line" },
        style: {
          fg: COLORS.buttonFg,
          bg: COLORS.buttonBg,
          border: { fg: COLORS.modalBorder },
        },
        content: `{center}${choice.key.toUpperCase()}: ${
          choice.label
        }{/center}`,
      });

      // Button click handler
      button.on("click", () => {
        this.selectedIndex = index;
        this.confirmSelection();
      });

      this.buttons.push(button);
    });
  }

  registerEvents() {
    if (!this.container) return;

    // Navigation keys
    this.container.key(["left", "h"], () => {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateButtonStyles();
    });

    this.container.key(["right", "l"], () => {
      this.selectedIndex = Math.min(
        this.choices.length - 1,
        this.selectedIndex + 1
      );
      this.updateButtonStyles();
    });

    // Confirm selection
    this.container.key(["enter", "space"], () => {
      this.confirmSelection();
    });

    // Direct key bindings for each choice
    this.choices.forEach((choice, index) => {
      this.container.key(
        [choice.key.toLowerCase(), choice.key.toUpperCase()],
        () => {
          this.selectedIndex = index;
          this.confirmSelection();
        }
      );
    });

    // Catch-all key handler for debugging
    this.container.on("keypress", (ch, key) => {
      // This will help us see what keys are being received
      if (key && key.name) {
        // Only log if it's not a handled key to avoid spam
        const handledKeys = [
          "left",
          "right",
          "h",
          "l",
          "enter",
          "space",
          "escape",
        ];
        const choiceKeys = this.choices.map((c) => c.key.toLowerCase());
        if (!handledKeys.includes(key.name) && !choiceKeys.includes(key.name)) {
          debugLog.log("Unhandled key:", key.name, "ch:", ch);
        }
      }
    });

    // Escape key - always cancels
    this.container.key(["escape"], () => {
      this.cancel();
    });

    // Additional shortcuts for polish
    // Ctrl+S to trigger save action (if available)
    this.container.key(["C-s"], () => {
      const saveChoiceIndex = this.choices.findIndex(
        (choice) => choice.action === "save"
      );
      if (saveChoiceIndex !== -1) {
        this.selectedIndex = saveChoiceIndex;
        this.confirmSelection();
      }
    });

    // Make container focusable
    this.container.key([], () => {
      // Catch all other keys to maintain focus
    });
  }

  updateButtonStyles() {
    this.buttons.forEach((button, index) => {
      if (index === this.selectedIndex) {
        button.style.fg = COLORS.buttonSelectedFg;
        button.style.bg = COLORS.buttonSelectedBg;
        button.style.border.fg = COLORS.buttonSelectedBg;
      } else {
        button.style.fg = COLORS.buttonFg;
        button.style.bg = COLORS.buttonBg;
        button.style.border.fg = COLORS.modalBorder;
      }
    });
    this.screen.render();
  }

  confirmSelection() {
    const choice = this.choices[this.selectedIndex];
    if (!choice) return;

    const action = choice.action;

    // Resolve promise if one exists
    if (this.resolvePromise) {
      this.resolvePromise(action);
      this.resolvePromise = null;
      this.rejectPromise = null;
    }

    // Call callback
    this.onConfirm(action);
  }

  cancel() {
    // Resolve promise with cancel/false
    if (this.resolvePromise) {
      this.resolvePromise("cancel");
      this.resolvePromise = null;
      this.rejectPromise = null;
    }

    // Call callback
    this.onCancel();
  }

  /**
   * Returns a promise that resolves when the user makes a choice.
   * This enables async/await usage: const result = await overlay.getResult();
   */
  getResult() {
    return new Promise((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });
  }
}

module.exports = { ConfirmationOverlay };

#!/usr/bin/env node

/**
 * Silent Edit - Terminal Code Editor
 * Main entry point for the modular version
 */

const { TextEditor } = require("./core/editor");

// ===== Entry Point =====
if (require.main === module) {
  const editor = new TextEditor();
  editor.run();
}

module.exports = { TextEditor };

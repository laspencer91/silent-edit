const fsSync = require("fs");

// ===== Debug Logger =====
class DebugLogger {
  constructor(logFile = "debug.log") {
    this.logFile = logFile;
    this.enabled = true;

    // Clear log file on startup
    try {
      fsSync.writeFileSync(this.logFile, "=== Debug Log Started ===\n");
    } catch (err) {
      // Ignore errors
    }
  }

  log(...args) {
    if (!this.enabled) return;

    try {
      const timestamp = new Date().toISOString();
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(" ");

      const logLine = `[${timestamp}] ${message}\n`;
      fsSync.appendFileSync(this.logFile, logLine);
    } catch (err) {
      // Ignore logging errors to avoid breaking the app
    }
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }
}

// Create singleton instance
const debugLog = new DebugLogger();

module.exports = { DebugLogger, debugLog };


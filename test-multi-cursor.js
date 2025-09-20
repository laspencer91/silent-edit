#!/usr/bin/env node

/**
 * Test script for multi-cursor visual functionality
 * This creates a test file with sample content and instructions
 */

const fs = require("fs");
const path = require("path");

const testContent = `// Multi-cursor test file
// Instructions for testing:
// 1. Open this file in Silent Edit
// 2. Use Ctrl+D to select word occurrences
// 3. Try typing to see multiple cursors in action
// 4. Test clipboard operations with multiple cursors

function testFunction() {
  const variable = "test";
  const another = "test";
  const third = "test";
  return variable + another + third;
}

class TestClass {
  constructor() {
    this.value = 42;
    this.name = "example";
    this.data = { key: "value" };
  }
  
  method() {
    console.log("method called");
    console.log("another method");
    console.log("third method");
  }
}

// Test multi-cursor editing:
// - Select "test" and use Ctrl+D to add more cursors
// - Select "console.log" and use Ctrl+D to add more cursors
// - Try typing to replace all selected instances
// - Use arrow keys with Shift to extend selections

// Test multi-cursor clipboard operations:
// 1. Position cursors on multiple lines (use Ctrl+D on "const")
// 2. Press Ctrl+C to copy all lines with cursors
// 3. Move to empty area and press Ctrl+V to paste
// 4. Try Ctrl+X to cut multiple lines at once
// 5. Test undo (Ctrl+Z) after multi-cursor paste - should undo all pasted content

const array = [1, 2, 3, 4, 5];
const result = array.map(x => x * 2);
const filtered = array.filter(x => x > 2);
const reduced = array.reduce((a, b) => a + b, 0);

// Empty area for testing paste operations:




// More test lines for clipboard operations:
line1
line2  
line3
line4
line5
`;

// Write test file
const testFilePath = path.join(__dirname, "multi-cursor-test.js");
fs.writeFileSync(testFilePath, testContent);

console.log("Multi-cursor test file created: multi-cursor-test.js");
console.log("");
console.log("To test multi-cursor functionality:");
console.log("1. Run: node src/index.js multi-cursor-test.js");
console.log("");
console.log("VISUAL TESTING:");
console.log('   - Position cursor on "test" and press Ctrl+D multiple times');
console.log('   - Position cursor on "console.log" and press Ctrl+D');
console.log("   - Type to see all cursors editing simultaneously");
console.log("   - Use Shift+Arrow keys to extend selections");
console.log("   - Check status bar for cursor count");
console.log("");
console.log("CLIPBOARD TESTING:");
console.log('   - Position cursor on "const" and press Ctrl+D multiple times');
console.log("   - Press Ctrl+C to copy lines at all cursor positions");
console.log("   - Move to empty area and press Ctrl+V to paste");
console.log("   - Try Ctrl+X to cut multiple lines at once");
console.log("   - Test pasting multi-line content to multiple cursors");
console.log("   - Test Ctrl+Z (undo) after multi-cursor paste operations");
console.log("");
console.log("Expected behavior:");
console.log("   - Primary cursor: white inverse highlight");
console.log("   - Secondary cursors: cyan inverse highlight");
console.log("   - Status bar shows cursor/selection count");
console.log("   - Copy/cut works with multiple cursors");
console.log("   - Paste distributes content across cursors");
console.log("   - Multi-line paste cycles through cursors");

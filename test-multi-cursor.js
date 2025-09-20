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
// 4. Use Ctrl+Space to toggle selection mode

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

const array = [1, 2, 3, 4, 5];
const result = array.map(x => x * 2);
const filtered = array.filter(x => x > 2);
const reduced = array.reduce((a, b) => a + b, 0);
`;

// Write test file
const testFilePath = path.join(__dirname, "multi-cursor-test.js");
fs.writeFileSync(testFilePath, testContent);

console.log("Multi-cursor test file created: multi-cursor-test.js");
console.log("");
console.log("To test multi-cursor visual functionality:");
console.log("1. Run: node src/index.js multi-cursor-test.js");
console.log("2. Try these operations:");
console.log('   - Position cursor on "test" and press Ctrl+D multiple times');
console.log('   - Position cursor on "console.log" and press Ctrl+D');
console.log("   - Type to see all cursors editing simultaneously");
console.log("   - Use Shift+Arrow keys to extend selections");
console.log("   - Check status bar for cursor count");
console.log("");
console.log("Expected visual behavior:");
console.log("   - Primary cursor: white inverse highlight");
console.log("   - Secondary cursors: cyan inverse highlight");
console.log("   - Status bar shows cursor count");
console.log("   - All cursors should be visible and distinct");

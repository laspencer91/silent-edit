# Plugin Architecture Plan for Silent Edit

## Overview

This document outlines the design and implementation plan for adding a plugin architecture to the Silent Edit text editor. The goal is to replace hardcoded event handling (like selection logic) with a flexible, event-driven system that allows plugins to extend editor functionality.

## Current State Analysis

### Hardcoded Behaviors Identified

- **Selection Management**: Lines 76-78 in `editor.js` hardcode selection updates after cursor movement
- **Command Handling**: Direct method calls in `command-handler.js` for all editor operations
- **UI Updates**: Hardcoded `ui.render()` calls throughout the codebase
- **Buffer Operations**: Direct coupling between buffer changes and history management
- **Clipboard Operations**: Tightly coupled with selection and buffer systems

### Current Architecture Issues

1. **Tight Coupling**: Components directly reference each other
2. **No Extension Points**: No way to add new functionality without modifying core code
3. **Hardcoded Workflows**: Event sequences are baked into method implementations
4. **Limited Customization**: No way to modify or extend existing behaviors

## Proposed Plugin Architecture

### 1. Core Event System

#### EventEmitter Integration

```javascript
// Core event emitter for the editor
class EditorEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Allow many plugins
  }
}
```

#### Event Categories

- **Cursor Events**: `cursor:move`, `cursor:position-changed`
- **Buffer Events**: `buffer:insert`, `buffer:delete`, `buffer:change`, `buffer:save`, `buffer:load`
- **Selection Events**: `selection:start`, `selection:update`, `selection:clear`, `selection:change`
- **UI Events**: `ui:render`, `ui:message`, `ui:prompt`
- **Command Events**: `command:execute`, `command:before`, `command:after`
- **File Events**: `file:open`, `file:save`, `file:close`
- **Plugin Events**: `plugin:load`, `plugin:unload`, `plugin:error`

### 2. Plugin Manager

#### Core Responsibilities

- Plugin discovery and loading
- Dependency management
- Lifecycle management (load, enable, disable, unload)
- Event routing and isolation
- Error handling and plugin sandboxing

#### Plugin Registry

```javascript
class PluginManager {
  constructor(editor) {
    this.editor = editor;
    this.plugins = new Map();
    this.loadOrder = [];
    this.hooks = new Map();
  }
}
```

### 3. Plugin API Interface

#### Plugin Structure

```javascript
class Plugin {
  constructor(editor, config = {}) {
    this.editor = editor;
    this.config = config;
    this.name = "plugin-name";
    this.version = "1.0.0";
    this.dependencies = [];
  }

  // Lifecycle methods
  async load() {}
  async enable() {}
  async disable() {}
  async unload() {}

  // Event registration
  registerEvents() {}
  unregisterEvents() {}
}
```

#### Plugin Capabilities

- **Event Listeners**: Subscribe to editor events
- **Event Emitters**: Emit custom events
- **Command Registration**: Add new commands
- **UI Extensions**: Add UI elements or modify existing ones
- **Buffer Transformations**: Process text changes
- **Keybinding Registration**: Add custom key combinations

### 4. Event Flow Architecture

#### Before (Current)

```
User Input → Command Handler → Direct Method Call → UI Update
```

#### After (Plugin Architecture)

```
User Input → Event Emission → Plugin Listeners → Event Handlers → UI Update
```

#### Event Lifecycle

1. **Pre-Event**: `before:action` - Allow plugins to prevent or modify
2. **Event**: `action` - Main event with data
3. **Post-Event**: `after:action` - Cleanup and follow-up actions

### 5. Core System Modifications

#### Editor Class Changes

- Add EventEmitter inheritance or composition
- Replace direct method calls with event emissions
- Add plugin manager integration
- Implement event-driven architecture

#### Buffer Class Changes

- Emit events for all operations (insert, delete, save, load)
- Allow plugins to intercept and modify operations
- Provide hooks for custom buffer behaviors

#### Selection Class Changes

- Convert to plugin-based system
- Emit selection events instead of direct updates
- Allow multiple selection handlers

#### UI Class Changes

- Emit rendering events
- Allow plugins to modify UI elements
- Support custom UI components

## Implementation Phases

### Phase 1: Core Event System (Week 1)

- [ ] Implement EventEmitter integration in Editor class
- [ ] Define core event types and data structures
- [ ] Add basic event emission to cursor movements
- [ ] Create event debugging/logging system

### Phase 2: Plugin Manager (Week 2)

- [ ] Implement PluginManager class
- [ ] Create plugin loading and registration system
- [ ] Add plugin lifecycle management
- [ ] Implement error handling and sandboxing

### Phase 3: Core Plugin Conversion (Week 3)

- [ ] Convert Selection to plugin
- [ ] Convert Clipboard to plugin
- [ ] Convert Command Handler to plugin-based system
- [ ] Refactor Buffer operations to emit events

### Phase 4: Plugin API & Examples (Week 4)

- [ ] Finalize Plugin API interface
- [ ] Create example plugins (syntax highlighting, auto-save, etc.)
- [ ] Add plugin configuration system
- [ ] Create plugin development documentation

### Phase 5: Advanced Features (Week 5)

- [ ] Plugin dependency management
- [ ] Hot plugin reloading
- [ ] Plugin marketplace/discovery
- [ ] Performance optimization

## Plugin Examples

### 1. Selection Plugin (Core)

```javascript
class SelectionPlugin extends Plugin {
  registerEvents() {
    this.editor.on("cursor:move", this.handleCursorMove.bind(this));
    this.editor.on("selection:start", this.handleSelectionStart.bind(this));
  }

  handleCursorMove(event) {
    if (event.extending && this.selection.active) {
      this.selection.update();
      this.editor.emit("selection:update", { selection: this.selection });
    }
  }
}
```

### 2. Auto-Save Plugin

```javascript
class AutoSavePlugin extends Plugin {
  registerEvents() {
    this.editor.on("buffer:change", this.scheduleAutoSave.bind(this));
  }

  scheduleAutoSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.editor.save();
    }, this.config.delay || 5000);
  }
}
```

### 3. Syntax Highlighting Plugin

```javascript
class SyntaxHighlightPlugin extends Plugin {
  registerEvents() {
    this.editor.on("buffer:change", this.updateHighlighting.bind(this));
    this.editor.on("ui:render", this.applyHighlighting.bind(this));
  }

  updateHighlighting(event) {
    // Parse and highlight syntax
  }
}
```

## File Structure Changes

```
src/
├── core/
│   ├── editor.js (modified - add EventEmitter)
│   ├── buffer.js (modified - add events)
│   ├── cursor.js (modified - add events)
│   ├── ui.js (modified - add events)
│   ├── event-emitter.js (new)
│   └── plugin-manager.js (new)
├── plugins/
│   ├── core/
│   │   ├── selection.plugin.js (converted)
│   │   ├── clipboard.plugin.js (converted)
│   │   └── command-handler.plugin.js (converted)
│   ├── examples/
│   │   ├── auto-save.plugin.js
│   │   ├── syntax-highlight.plugin.js
│   │   └── line-numbers.plugin.js
│   └── plugin-base.js (new)
├── api/
│   ├── plugin-api.js (new)
│   └── event-types.js (new)
└── config/
    └── plugins.json (new)
```

## Configuration System

### Plugin Configuration

```json
{
  "plugins": {
    "core": {
      "selection": { "enabled": true },
      "clipboard": { "enabled": true },
      "command-handler": { "enabled": true }
    },
    "optional": {
      "auto-save": {
        "enabled": true,
        "delay": 5000
      },
      "syntax-highlight": {
        "enabled": true,
        "theme": "default"
      }
    }
  }
}
```

### Editor Configuration

```javascript
const editorConfig = {
  plugins: {
    directory: "./src/plugins",
    autoload: true,
    config: "./config/plugins.json",
  },
  events: {
    maxListeners: 50,
    debug: false,
  },
};
```

## Benefits of This Architecture

### For Users

- **Customizable**: Enable/disable features as needed
- **Extensible**: Add new functionality without core modifications
- **Maintainable**: Isolated features reduce complexity
- **Performant**: Only load needed functionality

### For Developers

- **Modular**: Clear separation of concerns
- **Testable**: Each plugin can be tested independently
- **Reusable**: Plugins can be shared across projects
- **Scalable**: Easy to add new features

### For the Codebase

- **Decoupled**: Reduced dependencies between components
- **Event-Driven**: Clear data flow and communication
- **Extensible**: New features don't require core changes
- **Maintainable**: Smaller, focused modules

## Migration Strategy

### Backward Compatibility

- Keep existing API during transition
- Gradual migration of features to plugins
- Deprecation warnings for old patterns
- Clear migration guide for users

### Testing Strategy

- Unit tests for each plugin
- Integration tests for plugin interactions
- Event flow testing
- Performance benchmarking

### Documentation

- Plugin development guide
- API reference documentation
- Migration guide from current system
- Example plugin tutorials

## Risk Mitigation

### Performance Concerns

- Event emission overhead monitoring
- Plugin execution time limits
- Lazy loading of plugins
- Caching strategies for frequent operations

### Complexity Management

- Clear plugin API boundaries
- Standardized plugin structure
- Comprehensive error handling
- Plugin isolation and sandboxing

### Maintenance Overhead

- Automated plugin testing
- Version compatibility checking
- Plugin update mechanisms
- Clear deprecation policies

## Success Metrics

- [ ] All current functionality converted to plugins
- [ ] Zero performance regression
- [ ] At least 3 example plugins created
- [ ] Plugin development documentation complete
- [ ] Successful third-party plugin integration

## Conclusion

This plugin architecture will transform Silent Edit from a monolithic editor into a flexible, extensible platform. The event-driven approach will eliminate hardcoded behaviors while providing a clean API for extending functionality. The phased implementation approach ensures stability while gradually introducing the new architecture.

The key to success will be maintaining backward compatibility during the transition and providing clear documentation and examples for plugin developers.

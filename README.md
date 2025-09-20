# Silent Edit

A powerful terminal-based code editor built with Node.js, featuring multi-cursor editing, fuzzy file search, and an extensible architecture.

## Features

- **Multi-cursor editing** with sophisticated selection management
- **Fuzzy file search** with workspace integration
- **Smart clipboard operations** supporting multi-cursor scenarios
- **Undo/redo** with comprehensive history management
- **Overlay system** for modals and dialogs
- **Token-based navigation** for efficient code traversal
- **Configurable workspace** management

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd silent-edit

# Install dependencies
npm install

# Run the editor
npm start [filename]
```

## Usage

### Basic Commands

| Key Combination | Action |
|----------------|--------|
| `Ctrl+S` | Save file |
| `Ctrl+O` | Open file |
| `Ctrl+P` | Fuzzy file search |
| `Ctrl+F` | Search in file |
| `Ctrl+Q` | Quit |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

### Navigation

| Key Combination | Action |
|----------------|--------|
| `Arrow Keys` | Move cursor |
| `Ctrl+Left/Right` | Move by word/token |
| `Home/End` | Start/end of line |
| `Page Up/Down` | Scroll by page |
| `Ctrl+Up/Down` | Swap lines |

### Selection & Multi-cursor

| Key Combination | Action |
|----------------|--------|
| `Shift+Arrows` | Extend selection |
| `Ctrl+A` | Select all |
| `Ctrl+L` | Select line |
| `Ctrl+D` | Select word / Add next occurrence |
| `Ctrl+Space` | Toggle selection mode |

### Clipboard Operations

| Key Combination | Action |
|----------------|--------|
| `Ctrl+C` | Copy |
| `Ctrl+X` | Cut |
| `Ctrl+V` | Paste |

The clipboard system intelligently handles multi-cursor scenarios, distributing pasted content across multiple cursor positions.

## Project Structure

```
silent-edit/
├── src/
│   ├── core/                    # Core editor functionality
│   │   ├── editor.js           # Main editor class and orchestration
│   │   ├── ui.js               # Terminal UI rendering and management
│   │   ├── buffer.js           # Text buffer with undo/redo
│   │   ├── cursor.js           # Cursor movement and positioning
│   │   ├── overlay-host.js     # Modal/overlay management
│   │   └── debug-logger.js     # Development logging utility
│   ├── features/               # Feature modules
│   │   ├── clipboard.js        # Clipboard operations
│   │   ├── command-handler.js  # Keyboard command processing
│   │   ├── file-search/        # Fuzzy file search system
│   │   │   ├── file-search-service.js
│   │   │   └── file-search-overlay.js
│   │   └── overlays/           # UI overlay components
│   │       └── confirmation-overlay.js
│   ├── selection.js            # Multi-cursor selection system
│   └── index.js               # Application entry point
├── package.json
└── README.md
```

### Architecture Overview

**Silent Edit** follows a modular architecture with clear separation of concerns:

#### Core Modules

- **Editor** (`src/core/editor.js`): Central orchestrator that manages all editor components and user interactions
- **UI** (`src/core/ui.js`): Handles terminal rendering, viewport management, and visual feedback using the Blessed library
- **Buffer** (`src/core/buffer.js`): Manages text content, file I/O, and maintains undo/redo history
- **Cursor** (`src/core/cursor.js`): Handles cursor positioning and smart navigation (word-based movement, token detection)

#### Feature Modules

- **Selection** (`src/selection.js`): Sophisticated multi-cursor and selection management with range operations
- **Clipboard** (`src/features/clipboard.js`): Intelligent copy/paste operations with multi-cursor support
- **Command Handler** (`src/features/command-handler.js`): Centralized keyboard input processing and command dispatch
- **File Search** (`src/features/file-search/`): Fuzzy file search with workspace awareness and git-ignore support

#### Key Design Patterns

1. **Dependency Injection**: Core classes receive dependencies through constructors, enabling testability
2. **Command Pattern**: CommandHandler centralizes input processing and command execution
3. **Observer Pattern**: Components communicate through callbacks and event-like mechanisms
4. **Strategy Pattern**: Pluggable overlays and search algorithms

## Development

### Future Architecture Plans

The project includes comprehensive planning documents for evolution:

- **Plugin Architecture** (`PLAN.md`): Detailed plan for converting to an event-driven, plugin-based system
- **Syntax Highlighting** (`SYNTAX_HIGHLIGH_PLAN.md`): Architecture for adding syntax highlighting support

### Key Features in Development

- **Event-driven architecture** to replace direct coupling
- **Plugin system** for extensible functionality
- **Syntax highlighting** with theme support
- **Enhanced error handling** and validation

### Contributing

1. Follow the existing code organization patterns
2. Maintain separation between core and feature modules
3. Add comprehensive error handling for new features
4. Consider the plugin architecture plans when adding new functionality

## Technical Details

### Dependencies

- **blessed**: Terminal UI framework for creating rich console interfaces
- **Node.js**: Requires Node.js 16.0.0 or higher

### Multi-cursor Implementation

The selection system supports:
- Multiple independent cursor positions
- Range-based text selection with multiple ranges
- Smart clipboard operations that distribute content across cursors
- Unified operations (insert, delete, replace) across all cursor positions

### File Search

The fuzzy search implementation includes:
- Workspace-aware file discovery
- Git-ignore integration
- Caching for performance
- Configurable ignore patterns
- Scoring algorithm for relevance ranking

## License

MIT
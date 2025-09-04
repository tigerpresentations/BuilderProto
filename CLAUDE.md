# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BuilderProto is a professional-grade Three.js-based 3D texture editing application that enables real-time texture manipulation on GLB/GLTF models. The project demonstrates advanced implementations of canvas-to-texture pipelines, adaptive performance optimization, and intuitive user interfaces for 3D content creation.

## Core Architecture

### Main Application

**index.html** (formerly glb-scene-editor-1024.html) - Primary application with comprehensive features:
- GLB/GLTF model loading with drag-and-drop support
- Automatic material detection (finds materials with "Image" in the name)
- Real-time canvas-to-texture pipeline (1024x1024 with adaptive fallback to 512x512 or 256x256)
- UV-based layer system for resolution-independent image manipulation
- 8-handle resize system for precise layer control
- Professional lighting system with developer console (Alt+L)
- Performance monitoring with automatic quality adjustments
- Supabase authentication integration
- Scene state serialization/deserialization with file-based persistence

**glb-scene-editor-1024-backup.html** - Simplified backup version for fallback scenarios

### JavaScript Modules

The application uses a modular architecture with window globals for cross-module communication:

1. **main.js** - Application orchestrator
   - Device capability detection using Three.js renderer
   - Performance monitoring with FPS tracking
   - Adaptive quality system (automatic canvas resolution fallback)
   - Module coordination and initialization

2. **scene-manager.js** - Three.js scene management
   - Professional 3-light setup (hemisphere, directional key light, fill light)
   - OrbitControls integration
   - Renderer optimization with pixel ratio clamping
   - Shadow mapping for realistic rendering
   - Grid overlay system with raycast exclusion

3. **model-loader.js** - GLB/GLTF loading system
   - Automatic material detection with UUID-based deduplication
   - Proper geometry and material disposal
   - Support for both single materials and material arrays
   - Library-based model loading integration

4. **optimized-selection-system.js** - Modern selection and manipulation system
   - GPU-based OutlinePass selection visualization
   - Set-based TransformControls detection for performance
   - Proper event coordination with Three.js TransformControls
   - Background deselection logic

5. **transform-controls-manager.js** - Three.js TransformControls integration
   - XZ-plane constrained movement (Y-axis disabled)
   - Keyboard shortcuts (G/R/S/ESC)
   - OrbitControls coordination during manipulation
   - Mode switching and visual configuration

6. **model-library.js** - Supabase model library browser
   - Database model fetching and caching
   - Search and filtering functionality
   - Model metadata display and loading

7. **simple-layer-manager.js** - UV-based layer system
   - ImageLayer class with resolution-independent positioning
   - Hit testing for selection
   - Z-order management
   - Efficient compositing to canvas

8. **simple-interactive-editor.js** - Mouse interaction handler
   - Drag and resize operations
   - 8-handle resize system (corners + edges)
   - Cursor state management
   - Event coordination

9. **ui-controls.js** - User interface system
   - Collapsible panels with resize handles
   - Developer lighting console with presets (Studio, Outdoor, Soft, Dramatic)
   - File upload handlers
   - Real-time value displays

10. **auth.js** - Authentication integration
    - Supabase email/password authentication
    - Session management
    - Login/logout functionality

## Key Technical Details

### Performance Optimization
- Three.js renderer optimizations (pixel ratio clamping to max 2)
- Adaptive canvas resolution based on device capabilities
- FPS monitoring with performance.memory API
- Automatic quality degradation when FPS drops below 30
- Proper Three.js resource disposal

### Canvas-to-Texture Pipeline
- Uses `THREE.CanvasTexture` with `needsUpdate` flag for real-time updates
- Texture orientation: `flipY = false` for GLB compatibility
- Filters set to `LinearFilter` without mipmaps for performance
- Target 60 FPS with immediate texture updates

### Material Detection
```javascript
// Materials are detected with this pattern:
if (materialName.toLowerCase().includes('image')) {
    // Apply canvas texture to this material
}
```

### UV-Based Coordinate System
- All layer positions use 0-1 UV space
- Resolution-independent rendering
- Automatic scaling based on canvas size
- Consistent behavior across different devices

## Development Commands

```bash
# Open the application
open index.html  # macOS
start index.html  # Windows

# Development server (if using)
python -m http.server 8000  # Python 3
# or
npx http-server

# Test with included GLB files
# Default model: 91x91_4.glb (loaded automatically if present)
```

## Testing Workflow

1. Open `index.html` in a browser
2. The system will attempt to load `91x91_4.glb` automatically if present
3. Drag and drop any GLB/GLTF file or use the file picker
4. Materials with "Image" in their name will automatically receive the canvas texture
5. Use the canvas editor to add/manipulate image layers
6. Test the developer lighting console with Alt+L
7. Monitor performance metrics in the UI
8. Test scene saving/loading with Download/Load Scene buttons

## File Structure

```
BuilderProto/
├── index.html                    # Main application
├── glb-scene-editor-1024-backup.html  # Backup version
├── main.js                       # Application orchestrator
├── scene-manager.js              # Three.js scene setup
├── model-loader.js               # GLB/GLTF loading
├── model-library.js              # Supabase model library browser
├── optimized-selection-system.js # Modern selection and manipulation
├── transform-controls-manager.js # Three.js TransformControls integration
├── simple-layer-manager.js       # UV-based layer system
├── simple-interactive-editor.js  # Mouse interactions
├── ui-controls.js                # UI components
├── auth.js                       # Supabase authentication
├── .claude/docs/                 # Project documentation
│   ├── active/                   # Active development docs
│   ├── project_overview.md
│   ├── file-relationships.md
│   └── current-issues.md
└── 91x91_4.glb                     # Default test model
```

## External Dependencies

All loaded via CDN:
- Three.js r128
- GLTFLoader
- OrbitControls
- Supabase Client Library

## Browser Requirements

- Modern browser with WebGL support
- File API for save/load functionality
- ES6 JavaScript support
- Canvas 2D context support

## Known Limitations

- Large GLB files create large JSON save files due to base64 encoding
- Browser memory limits may affect very large models
- Touch events not fully optimized (mouse-first design)
- Maximum canvas size: 1024x1024 (with automatic fallback)

## Development Guidelines

When working on this codebase:

1. **Simplicity First**: Prefer simple, standard solutions over complex novel approaches
2. **Stability**: This will be a production tool - prioritize reliability and maintainability
3. **Performance**: Always consider performance implications, especially for real-time updates
4. **No Legacy Code**: This is an unreleased product - remove rather than maintain old code
5. **Test Impact**: Always verify changes don't break existing features
6. **UI Consistency**: Don't modify the UI without explicit instruction
7. **Focus**: Stay on the requested task, avoid feature creep

## Documentation Maintenance System

### **Documentation Update Protocol**
When making changes to source code, **always update related documentation**:

1. **Identify affected docs** - which `.claude/docs/` files relate to your changes
2. **Update immediately** - don't defer documentation updates
3. **Version control docs** - commit documentation changes with code changes
4. **Validate accuracy** - ensure docs match current implementation

### **Required Updates for Common Changes**

| Change Type | Files to Update |
|-------------|----------------|
| New feature added | `project-overview.md`, relevant research docs |
| File structure changes | `file-relationships.md`, `project-overview.md` |
| Performance issues discovered | `current-issues.md`, performance research docs |
| Integration problems | Relevant integration research docs |
| Deployment changes | Deployment optimization docs |

## Agent Communication

When communicating with AI agents about this project:
- Emphasize simple solutions, standard and proven approaches over novelty and complexity. 
- Remind them this is meant to be a usable tool, not a technical showcase
- Stability, maintainability, and reliability are paramount
- Advanced features are not the goal - working features are

## Maintenance Notes

**Last Updated**: YYYY-MM-DD [Update this date when making changes]
**Next Review**: YYYY-MM-DD [Set reminder to review documentation currency]

**Critical Reminders**:
- Update this file when architectural decisions change
- Keep `.claude/docs/` synchronized with actual implementation
- Test documentation accuracy during each development cycle
- Archive outdated research when approaches change
- Diligently update your documentation in .claude/docs/active
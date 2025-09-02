# BuilderProto Project Analysis

## Project Overview

BuilderProto is a Three.js-based 3D texture editing application that allows users to load GLB/GLTF 3D models and apply real-time canvas-based textures to materials with "Image" in their names. The project consists of two main HTML applications and a modular JavaScript architecture.

## Current Architecture

### HTML Applications

1. **glb-scene-editor-1024.html** - Main high-resolution application
   - Full-featured UI with collapsible panels
   - 1024x1024 texture resolution (with fallbacks to 512x512 and 256x256)
   - Modern Three.js editor-style interface
   - Authentication integration with Supabase
   - Advanced lighting console with presets
   - Layer-based image management system
   - Drag-and-drop support for GLB files and images
   - Real-time performance monitoring

2. **glb-scene-editor-1024-backup.html** - Simplified backup version
   - Basic functionality with legacy UI components
   - Mixed implementation patterns (some embedded script)
   - Performance monitoring code embedded in HTML

### Core JavaScript Modules

#### 1. **main.js** - Application orchestrator (14,469 lines)
**Key Features:**
- Device capability detection using Three.js renderer capabilities
- Performance monitoring with automatic quality fallback
- Drag-and-drop handler for both GLB files and images
- Main application initialization sequence
- UVTextureEditor class for Three.js texture integration
- Memory monitoring and optimization
- Global state management

**Architecture Pattern:**
```javascript
// Initialization sequence:
1. Initialize Three.js scene (scene-manager.js)
2. Setup camera and renderer with optimizations
3. Initialize image layer management (simple-layer-manager.js)
4. Setup interactive editor (simple-interactive-editor.js)
5. Configure UV texture editor for Three.js integration
6. Setup event handlers and drag-and-drop
7. Start animation loop with performance monitoring
```

#### 2. **scene-manager.js** - Three.js scene setup (7,514 lines)
**Key Features:**
- Professional lighting system with hemisphere, directional, and fill lights
- Optimized shadow mapping with configurable parameters
- ACES Filmic tone mapping
- WebGL renderer with performance optimizations
- OrbitControls integration
- Lighting configuration object for dev console

**Lighting System:**
```javascript
// Three-light setup:
- HemisphereLight: Natural sky/ground lighting
- DirectionalLight: Main key light with shadows
- DirectionalLight: Fill light for contrast
// Shadow optimizations with bias and camera frustum tuning
```

#### 3. **model-loader.js** - GLB/GLTF model handling (10,999 lines)
**Key Features:**
- GLTFLoader integration with Three.js
- Automatic material detection for "Image" materials (case-insensitive)
- Model placement and centering on floor
- Auto-scaling for oversized models
- Material optimization for texture editing
- Backlight effect system
- Memory cleanup and disposal
- Transform controls integration

**Material Detection Pattern:**
```javascript
if (materialName.toLowerCase().includes('image')) {
    // Apply canvas texture to this material
    material.map = canvasTexture;
    material.transparent = true;
    material.alphaTest = 0.001;
}
```

#### 4. **simple-layer-manager.js** - Image layer system (8,783 lines)
**Key Features:**
- UV-based coordinate system (0-1 space) for resolution independence
- ImageLayer class with transform properties
- Z-order management for layer stacking
- Hit testing for selection
- Resize handle system (8 handles: corners and edges)
- Rendering to target canvas size
- Layer list UI management

**UV Coordinate System:**
```javascript
// All positions stored in UV space (0-1)
uvX: 0.5,      // Center horizontal
uvY: 0.5,      // Center vertical  
uvWidth: 0.3,  // 30% of canvas width
uvHeight: 0.3  // 30% of canvas height
```

#### 5. **simple-interactive-editor.js** - User interaction (6,793 lines)
**Key Features:**
- Mouse event handling for drag and resize operations
- Screen-to-UV coordinate conversion
- Handle detection and cursor management
- Constraint system for keeping layers in bounds
- Real-time layer manipulation
- Context preservation for event handlers

#### 6. **auth.js** - Supabase authentication (5,984 lines)
**Key Features:**
- Email/password authentication
- Session management
- UI state updates based on auth status
- Notification system integration
- Error handling and user feedback

#### 7. **ui-controls.js** - UI management system (25,000+ lines)
**Key Features:**
- Collapsible panel system (Three.js editor style)
- UI resizing with pointer capture
- Color picker modal with RGB/hex conversion
- Recent color swatches system
- Lighting developer console with presets
- Event handler management
- Notification system

**Developer Console Features:**
- Real-time lighting adjustment
- Shadow parameter tuning  
- Tone mapping controls
- Preset lighting setups (Studio, Outdoor, Soft, Dramatic)
- Keyboard shortcut (Alt+L)

### Supporting Files

- **91x91_4.glb** - Default 3D model for testing
- **WhiteSpace 91 Brite Wall.jpg** - Test image asset
- **inject-env.js** - Environment variable injection for Netlify
- **netlify.toml** - Deployment configuration

## Technical Implementation Details

### Canvas-to-Texture Pipeline

1. **Display Canvas (1024x1024)** - User interaction surface
2. **UV Texture Editor** - Three.js CanvasTexture integration
3. **Layer Management** - Resolution-independent coordinate system
4. **Real-time Updates** - Immediate texture.needsUpdate on changes

**Key Settings for GLB Compatibility:**
```javascript
texture.flipY = false;           // Critical for GLB models
texture.wrapS = THREE.ClampToEdgeWrapping;
texture.wrapT = THREE.ClampToEdgeWrapping;
texture.minFilter = THREE.LinearFilter;
texture.magFilter = THREE.LinearFilter;
```

### Performance Optimization

1. **Adaptive Quality System:**
   - Starts at 1024x1024 on capable devices
   - Automatically falls back to 512x512 or 256x256 based on FPS
   - Device capability detection using Three.js renderer

2. **Three.js Optimizations:**
   - Pixel ratio clamped to 2 for performance
   - Shadow map auto-update disabled (manual control)
   - Material optimization for texture editing
   - Geometry disposal on model replacement

3. **Memory Management:**
   - Performance.memory monitoring
   - Texture disposal on model cleanup  
   - URL.revokeObjectURL for blob cleanup
   - Interval-based memory reporting

### Material Detection System

**Search Pattern:**
- Case-insensitive search for "image" in material names
- Supports both single materials and material arrays
- UUID-based deduplication to avoid processing same material twice
- Automatic texture application to discovered materials

### Authentication Integration

**Supabase Integration:**
- Email/password authentication
- Session persistence
- UI state synchronization
- Status display integration
- Error handling with notifications

## Project Structure Patterns

### Modular Architecture
- Each major feature in separate JavaScript file
- Window global exports for cross-module communication
- Event-driven communication between modules
- Separation of concerns (UI, 3D scene, auth, etc.)

### UI Design Philosophy
- Three.js editor-inspired interface
- Collapsible panel system
- Professional dark theme
- Responsive resizing
- Performance information display

### Error Handling
- Graceful fallbacks for missing features
- Device capability detection
- Progressive enhancement
- Console logging for debugging

## Current Issues & Observations

### Code Quality
- **Strengths:** Well-modularized, performance-conscious, comprehensive feature set
- **Areas for improvement:** Some duplication between main and backup HTML files, embedded inline scripts in backup version

### Performance Considerations
- Automatic quality fallback system works well
- Memory monitoring helps prevent crashes
- Three.js optimizations are properly implemented

### User Experience
- Intuitive drag-and-drop interface
- Real-time visual feedback
- Professional appearance matching Three.js editor standards
- Comprehensive lighting controls for advanced users

## Dependencies

### External CDN Libraries
- Three.js r128 (core, GLTFLoader, OrbitControls)
- Supabase JavaScript client v2.39.3

### Browser Requirements
- WebGL support
- File API for drag-and-drop
- Performance API for monitoring
- Modern ES6+ features

## Key Technical Decisions

1. **UV-based coordinate system** - Ensures resolution independence
2. **Single canvas approach** - Simpler than multi-canvas pipeline  
3. **Three.js CanvasTexture** - Direct integration with 3D rendering
4. **Material name detection** - Simple but effective pattern matching
5. **Modular architecture** - Maintainable and extensible codebase
6. **Performance monitoring** - Proactive quality management

## Conclusion

BuilderProto demonstrates a well-architected 3D texture editing application with professional-grade features. The codebase shows good understanding of Three.js optimization patterns, modern web development practices, and user experience design. The UV-based coordinate system and automatic performance scaling make it robust across different devices and use cases.

The main application (glb-scene-editor-1024.html) represents the current production version, while the backup version serves as a fallback. The modular JavaScript architecture makes the codebase maintainable and allows for easy feature additions or modifications.
# BuilderProto Project Overview

## Project Description
BuilderProto is a Three.js-based 3D texture editing application that enables real-time texture manipulation on GLB/GLTF models. The project demonstrates professional-grade implementations of canvas-to-texture pipelines, adaptive performance optimization, and intuitive user interfaces for 3D content creation.

## Current State

### What Works
- **GLB/GLTF Model Loading**: Drag-and-drop or file picker support for 3D models
- **Automatic Material Detection**: Finds and applies textures to materials with "image" in their name
- **Real-Time Canvas-to-Texture Pipeline**: 1024x1024 canvas with adaptive quality fallback (512x512, 256x256)
- **UV-Based Layer System**: Resolution-independent image layers with drag and resize capabilities
- **Smooth Scaling System**: Enhanced 8-handle resize with boundary-aware scaling (allows 3x canvas size)
- **Smart Image Positioning**: Images can extend beyond canvas edges while remaining manageable  
- **Global Mouse Tracking**: Drag/resize operations continue smoothly when mouse leaves canvas bounds
- **Smart Selection System**: Clean texture output with multiple selection clearing methods (Escape key, click empty space, Clear Selection button)
- **Smooth Camera Animation**: Double-click centering with 75% viewport coverage and 1-second easing
- **Professional Lighting System**: Three-light setup with developer console and presets
- **Performance Monitoring**: FPS tracking with automatic quality adjustments
- **Authentication Integration**: Supabase auth with login/logout functionality
- **Scene Persistence**: Save/load functionality with JSON serialization
- **Developer Tools**: Alt+L lighting console, performance metrics display
- **Responsive UI**: Collapsible panels with resize handles and dark theme

### What Doesn't Work / Known Issues
- **Memory Management**: Large GLB files create large JSON save files due to base64 encoding
- **Browser Limitations**: File API required for save/load functionality
- **Performance Constraints**: Browser memory limits may affect very large models
- **Touch Support**: Currently optimized for mouse interaction, touch events may need refinement
- **Layer Overflow**: Very large scaled images (>3x) may impact performance on lower-end devices

## Architecture Overview

### Main Application
- **index.html** (formerly glb-scene-editor-1024.html): Primary application with full feature set
- **glb-scene-editor-1024-backup.html**: Simplified backup version for fallback scenarios

### Core Modules
- **main.js**: Application orchestrator with device detection
- **scene-manager.js**: Three.js scene setup and management
- **model-loader.js**: GLB/GLTF loading and material detection
- **simple-layer-manager.js**: UV-based image layer management
- **simple-interactive-editor.js**: Mouse interaction handling
- **auth.js**: Authentication integration
- **ui-controls.js**: UI system with developer console

## Technical Stack
- **Three.js r128**: 3D rendering engine
- **GLTFLoader**: 3D model loading
- **OrbitControls**: Camera manipulation
- **Supabase**: Authentication backend
- **Vanilla JavaScript**: No framework dependencies
- **HTML5 Canvas**: Texture editing surface

## Performance Characteristics
- Target 60 FPS with automatic quality degradation
- Adaptive canvas resolution based on device capabilities
- Memory monitoring with performance.memory API
- Efficient texture update pipeline with needsUpdate flag
- Proper disposal of Three.js resources

## Development Status
The project is in active development with a stable core feature set. The modular architecture allows for easy extension and modification. The UV-based coordinate system ensures resolution independence and cross-device compatibility.

---
**Last Updated**: 2025-09-02 15:45 UTC  
**Next Review**: Check after major feature additions or architectural changes
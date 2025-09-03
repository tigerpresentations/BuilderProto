# File Relationships and Dependencies

## HTML Entry Points

### Primary Application
**index.html** (formerly glb-scene-editor-1024.html)
- Loads all JavaScript modules in specific order
- Dependencies:
  - auth.js (first - authentication setup)
  - scene-manager.js (Three.js scene initialization)
  - model-loader.js (GLB loading functionality)
  - object-selector.js (3D object selection system)
  - simple-layer-manager.js (layer management)
  - simple-interactive-editor.js (mouse interactions)
  - ui-controls.js (UI components)
  - main.js (last - orchestrates everything)
- External CDN dependencies:
  - Three.js r128
  - GLTFLoader
  - OrbitControls
  - Supabase client library

### Backup Version
**glb-scene-editor-1024-backup.html**
- Simplified version with same module structure
- Fallback when main application (index.html) has issues
- Same dependency chain as primary application

## JavaScript Module Dependencies

### main.js (Orchestrator)
- **Depends on ALL other modules** via window globals:
  - `window.sceneManager` (from scene-manager.js)
  - `window.modelLoader` (from model-loader.js)
  - `window.objectSelector` (from object-selector.js)
  - `window.layerManager` (from simple-layer-manager.js)
  - `window.interactiveEditor` (from simple-interactive-editor.js)
  - `window.uiControls` (from ui-controls.js)
  - `window.auth` (from auth.js)
- Coordinates initialization and communication between modules
- Manages device detection and performance monitoring

### scene-manager.js (Three.js Core)
- **No internal dependencies**
- **Exports**: `window.sceneManager`, `window.floor`
- **Provides**:
  - Three.js scene, camera, renderer
  - Lighting system (hemisphere, directional, fill)
  - OrbitControls integration
  - Floor geometry with global access for controls
  - Canvas creation and management
- **Used by**: main.js, model-loader.js, ui-controls.js

### model-loader.js (3D Model Handler)
- **Depends on**: scene-manager.js (accesses scene, materials), object-selector.js (updates selectable objects)
- **Exports**: `window.modelLoader`
- **Provides**:
  - GLB/GLTF loading functionality
  - Material detection ("image" materials)
  - Model disposal and cleanup
- **Used by**: main.js

### object-selector.js (3D Object Selection)
- **Depends on**: scene-manager.js (scene, camera, renderer access)
- **Exports**: `window.objectSelector`, `window.ObjectSelector`
- **Provides**:
  - Raycasting-based object selection
  - Visual selection feedback (green outline)
  - Mouse click event handling
  - UI integration with selection info display
- **Used by**: main.js, model-loader.js (for updating selectable objects)

### simple-layer-manager.js (Layer System)
- **No direct module dependencies**
- **Exports**: `window.layerManager`
- **Provides**:
  - ImageLayer class
  - UV-based coordinate system
  - Layer rendering and compositing
  - Hit testing for selection
- **Used by**: main.js, simple-interactive-editor.js

### simple-interactive-editor.js (Interaction Handler)
- **Depends on**: simple-layer-manager.js (layer manipulation)
- **Exports**: `window.interactiveEditor`
- **Provides**:
  - Mouse event handling
  - Drag and resize operations
  - 8-handle resize system
  - Cursor state management
- **Used by**: main.js

### ui-controls.js (User Interface)
- **Depends on**: 
  - scene-manager.js (lighting controls, floor object access)
  - model-loader.js (material property updates)
  - Internal references to canvas and model elements
- **Exports**: `window.uiControls`
- **Provides**:
  - Panel collapse/expand functionality
  - Developer lighting console
  - Enhanced floor control system with presets and bi-directional sync
  - Unified control layout (slider + input field) for all numeric controls
  - Material brightness and lighting intensity controls
  - File upload handlers
  - UI state management
- **Used by**: main.js

### auth.js (Authentication)
- **No internal module dependencies**
- **Exports**: `window.auth`
- **External dependency**: Supabase client
- **Provides**:
  - Login/logout functionality
  - Session management
  - User state tracking
- **Used by**: main.js

## Data Flow Patterns

### Model Loading Flow
1. User uploads GLB via ui-controls.js
2. main.js receives file and calls modelLoader.loadModel()
3. model-loader.js loads model into scene-manager.js scene
4. model-loader.js detects "image" materials
5. model-loader.js updates object-selector.js with selectable objects
6. main.js applies canvas texture to detected materials

### Canvas-to-Texture Pipeline
1. simple-layer-manager.js renders layers to canvas
2. main.js creates/updates THREE.CanvasTexture
3. Texture applied to materials found by model-loader.js
4. scene-manager.js renders updated scene

### User Interaction Flow
1. Mouse events captured by simple-interactive-editor.js OR object-selector.js
2. Editor determines action (drag, resize, etc.) OR selector handles 3D object selection
3. Updates layers via simple-layer-manager.js OR updates selection state
4. main.js triggers canvas redraw OR UI updates with selection info
5. Texture updates propagate to 3D scene OR visual feedback displays

### Object Selection Flow
1. User clicks on 3D scene via object-selector.js
2. Raycasting determines clicked object
3. Visual outline effect added to selected object
4. Selection info updates in UI panel via custom events
5. OrbitControls remain functional for camera movement

## Event Communication
- Modules communicate primarily through:
  - Direct method calls via window globals
  - Canvas element as shared drawing surface
  - DOM events for user interactions
  - Custom events for object selection (objectSelected, objectDeselected)
  - No formal event bus or message passing system

## Critical Dependencies
- **Three.js r128**: Core 3D engine (CDN)
- **Canvas Element**: Central to texture pipeline
- **Window Globals**: Module communication mechanism
- **RequestAnimationFrame**: Render loop coordination

---
**Last Updated**: 2025-09-03 (Enhanced Floor Controls and UI System)  
**Architecture Status**: Stable - modular design with clear separation of concerns  
**Next Review**: After major architectural changes or new module additions

## Recent Changes
**2025-09-03**: 
- Enhanced floor control system with bi-directional slider/input synchronization
- Added floor global export (`window.floor`) for UI control access
- Extended ui-controls.js with unified control layout across all numeric inputs
- Improved model-loader.js rotation control handling with input field support
- Made floor intentionally non-selectable in object-selector.js for better UX
- Added floor preset functionality for common dimensions
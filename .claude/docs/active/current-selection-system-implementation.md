# Current Selection System Implementation - BuilderProto

## System Overview

The BuilderProto application currently implements a modern Three.js-based selection and transformation system consisting of two primary components that work together:

1. **OptimizedSelectionSystem** - Handles selection detection, visual feedback, and deselection logic
2. **TransformControlsManager** - Manages Three.js TransformControls for object manipulation

## Architecture

### Core Components

#### 1. OptimizedSelectionSystem (optimized-selection-system.js)
- **Purpose**: Manages object selection, deselection, and visual feedback
- **Location**: `/optimized-selection-system.js`
- **Global Access**: `window.optimizedSelectionSystem`
- **Initialization**: Immediate with efficient retry using `requestAnimationFrame`

#### 2. TransformControlsManager (transform-controls-manager.js)
- **Purpose**: Wraps Three.js TransformControls for object manipulation
- **Location**: `/transform-controls-manager.js`
- **Global Access**: `window.transformControlsManager`
- **Initialization**: 100ms delay after OptimizedSelectionSystem

### Initialization Flow

```javascript
// main.js initialization sequence (lines 307-324)
1. OptimizedSelectionSystem - Immediate initialization
2. TransformControlsManager - 100ms delay
3. Connection established via connectTransformControls()
```

## Selection System Details

### Selection Process

1. **Mouse Click Detection** (optimized-selection-system.js:112-267)
   - Uses `pointerdown` event on renderer canvas
   - Performs raycasting to detect clicked objects
   - Filters out excluded objects (grid, lights, UI elements)
   - Checks `userData.selectable` flag in object hierarchy

2. **Object Selectability Check** (optimized-selection-system.js:311-333)
   ```javascript
   // Objects are selectable if:
   - userData.selectable === true (explicit)
   - Parent has userData.selectable === true
   - Default: false (safer approach)
   ```

3. **Selection Visualization** (optimized-selection-system.js:336-381)
   - **Primary**: SimpleSelectionVisualization with wireframe geometry (green outline, #00ff00)
   - **Fallback**: EdgesGeometry for when SimpleSelectionVisualization fails
   - **Transform Inheritance**: Wireframe added as child of selected object
   - **Matrix-based Positioning**: Handles meshes with local transforms correctly
   - TransformControls automatically attached
   - Keyboard shortcuts overlay displayed

### Deselection Triggers

1. **Background Click** (optimized-selection-system.js:196-204)
   - Clicking empty space with no raycast hits
   - Immediately calls `deselectObject()`

2. **Infrastructure Click** (optimized-selection-system.js:216-229)
   - Clicking non-selectable objects (floor, lights, grid)
   - Treated as background click for deselection

3. **Escape Key** (optimized-selection-system.js:276-279)
   - Keyboard shortcut for immediate deselection
   - Works globally when no input field is active

4. **Object Deletion** (optimized-selection-system.js:430-461)
   - Deselects before removing from scene
   - Properly disposes of Three.js resources

5. **Programmatic** (optimized-selection-system.js:383-428)
   - Called by other systems as needed
   - Ensures clean state transition

### Deselection Process

When `deselectObject()` is called:
1. Clears visual selection (OutlinePass or EdgesGeometry)
2. Detaches TransformControls from object
3. **Removes TransformControls from scene** (critical for proper hiding)
4. Clears internal selection state
5. Hides keyboard shortcuts overlay
6. Emits 'object-deselected' event

## Transform Controls Integration

### TransformControls Lifecycle

1. **Creation**: Single instance created at initialization
2. **Scene Addition**: Added to scene ONLY when object is selected
3. **Scene Removal**: Removed from scene when object is deselected
4. **Attachment**: Managed by OptimizedSelectionSystem

### Mode Management

Three manipulation modes available:
- **Translate (G key)**: XZ-plane movement (Y-axis disabled)
- **Rotate (R key)**: Y-axis rotation only
- **Scale (S key)**: Uniform scaling on all axes

### OrbitControls Coordination

```javascript
// Automatic coordination (transform-controls-manager.js:53-59)
transformControls.addEventListener('dragging-changed', (event) => {
    orbitControls.enabled = !event.value;
});
```

## Event System

### Event Flow
1. Mouse events → OptimizedSelectionSystem
2. Selection changes → TransformControlsManager (via connection)
3. Keyboard events → Both systems (coordinated handling)

### Critical Event Handling

**TransformControls Active Detection** (optimized-selection-system.js:132-143)
- Prevents selection changes during active manipulation
- Uses `isTransformControlsActive` flag
- Skips all interaction when TransformControls is dragging

**TransformControls Object Caching** (optimized-selection-system.js:511-523)
- Uses Set for O(1) lookup performance
- Caches all gizmo objects on initialization
- Prevents selecting TransformControls helpers

## Performance Optimizations

### GPU-Based Selection
- OutlinePass for hardware-accelerated selection visualization
- No CPU-intensive pulsing effects
- Efficient matrix updates only when needed

### Raycasting Optimization
- Single raycast per click
- Filtered results to exclude infrastructure
- Force camera matrix update to prevent stale matrices

### Event Efficiency
- Single mouse event handler
- No conflicting event listeners
- Proper event delegation between systems

## Current Issues and Solutions

### Issue: TransformControls Not Hiding on Deselection
**Status**: RESOLVED
**Solution**: TransformControls are now properly removed from scene on deselection

### Issue: Click Detection Conflicts
**Status**: RESOLVED  
**Solution**: Proper event coordination with `isTransformControlsActive` flag

### Issue: Selection During Manipulation
**Status**: RESOLVED
**Solution**: Skip all interaction when TransformControls is actively dragging

### Issue: Wireframe Transform Issues (RESOLVED 2025-09-04)
**Status**: RESOLVED
**Problem**: Wireframe visualization didn't inherit GLB scale and had Y-axis offsets for some meshes
**Solution**: 
- Wireframe is now added as child of selected object (automatic transform inheritance)
- Uses matrix-based relative positioning to handle meshes with local transforms
- Proper coordinate space calculations prevent Y-axis offsets

## Debug Features

### Detailed Click Analysis (optimized-selection-system.js:160-194)
Logs comprehensive information:
- Intersect count and details
- Mouse coordinates
- Current selection state
- TransformControls visibility
- Camera and raycaster validity

### Selection State Logging
- Every selection/deselection logged
- Mode changes tracked
- Event flow visible in console

## Best Practices Implemented

1. **Single Source of Truth**: OptimizedSelectionSystem manages all selection state
2. **Three.js Native Patterns**: Uses standard TransformControls
3. **Proper Resource Management**: Scene addition/removal for TransformControls
4. **Event Coordination**: No conflicting event handlers
5. **Performance First**: GPU-based visualization, efficient lookups

## Usage Examples

### Select an Object
```javascript
// Automatic via mouse click on selectable object
// OR programmatically:
window.optimizedSelectionSystem.selectObject(object);
```

### Deselect Current Selection
```javascript
// Via ESC key
// Via background click
// OR programmatically:
window.optimizedSelectionSystem.deselectObject();
```

### Change Transform Mode
```javascript
// Via keyboard: G (translate), R (rotate), S (scale)
// OR programmatically:
window.transformControlsManager.setMode('rotate');
```

## System Dependencies

- **Three.js r128**: Core 3D library
- **EffectComposer**: Post-processing for OutlinePass
- **OutlinePass**: GPU-based selection visualization
- **TransformControls**: Object manipulation

## Maintenance Notes

- **Last Updated**: 2025-09-04
- **Version**: Current implementation with proper scene management
- **Status**: Fully functional with all deselection triggers working

## Future Considerations

1. **Multi-Selection**: Currently single-selection only
2. **Touch Support**: Mouse-first design, touch events not optimized
3. **Custom Gizmos**: Using standard Three.js gizmos
4. **Snapping**: No grid snapping implemented yet
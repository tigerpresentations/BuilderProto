# Three.js Native Selection System - Replacement Recommendations

## Overview

This document provides specific recommendations for replacing custom implementations in the BuilderProto selection system with Three.js native/built-in systems. Based on analysis of the current implementation and official Three.js patterns, we can significantly simplify the codebase by leveraging Three.js conventions.

## Current Custom Implementations Analysis

### 1. Custom Event System (.on/.emit)

**Current Implementation** (optimized-selection-system.js:651-673):
```javascript
// Custom event system - minimal overhead
this.eventListeners = new Map();

on(event, callback) {
    if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
}

emit(event, data) {
    if (this.eventListeners.has(event)) {
        const callbacks = this.eventListeners.get(event);
        callbacks.forEach(callback => callback(data));
    }
}
```

**Three.js Native Alternative**:
```javascript
// Use Three.js EventDispatcher - built into Three.js core
class OptimizedSelectionSystem extends THREE.EventDispatcher {
    constructor(scene, camera, renderer, orbitControls) {
        super(); // Initialize EventDispatcher
        // ... rest of constructor
    }
    
    selectObject(object) {
        this.selectedObject = object;
        // Replace this.emit('object-selected', { object });
        this.dispatchEvent({ type: 'object-selected', object: object });
    }
    
    deselectObject() {
        const object = this.selectedObject;
        this.selectedObject = null;
        // Replace this.emit('object-deselected', { object });
        this.dispatchEvent({ type: 'object-deselected', object: object });
    }
}

// Usage in main.js - replace custom .on() calls
// OLD: window.optimizedSelectionSystem.on('object-selected', (data) => {
window.optimizedSelectionSystem.addEventListener('object-selected', (event) => {
    console.log('Object selected:', event.object);
    window.transformControlsManager.onObjectSelected(event.object);
});
```

**Benefits**:
- Standard Three.js pattern used throughout the library
- Better integration with Three.js ecosystem
- No custom event system maintenance required
- Compatible with existing Three.js tools and debugging

### 2. Timing-Based Initialization

**Current Implementation** (main.js:318-321):
```javascript
setTimeout(() => {
    console.log('🔧 Executing setupTransformControls now...');
    setupTransformControls();
}, 100); // Minimal delay for system coordination
```

**Three.js Native Alternative**:
```javascript
// Use Promise-based initialization following Three.js loader patterns
class SelectionSystemInitializer {
    static async initialize(scene, camera, renderer, orbitControls) {
        // Wait for all dependencies to be available
        await this.waitForDependencies({ scene, camera, renderer, orbitControls });
        
        // Create selection system
        const selectionSystem = new OptimizedSelectionSystem(scene, camera, renderer, orbitControls);
        
        // Create transform controls and connect immediately
        const transformManager = new TransformControlsManager(scene, camera, renderer, orbitControls);
        
        // Connect systems - no timing dependency
        selectionSystem.connectTransformControls(transformManager.transformControls);
        
        return { selectionSystem, transformManager };
    }
    
    static waitForDependencies(deps) {
        return new Promise((resolve, reject) => {
            const checkDependencies = () => {
                const allReady = Object.values(deps).every(dep => dep && dep.isObject3D !== undefined || dep.domElement || typeof dep.setFromCamera === 'function');
                
                if (allReady) {
                    resolve();
                } else {
                    requestAnimationFrame(checkDependencies);
                }
            };
            
            checkDependencies();
            
            // Timeout after 5 seconds
            setTimeout(() => reject(new Error('Dependencies timeout')), 5000);
        });
    }
}

// Usage in main.js
async function initializeSelectionSystems() {
    try {
        const { selectionSystem, transformManager } = await SelectionSystemInitializer.initialize(
            window.scene, 
            window.camera, 
            window.renderer, 
            window.controls
        );
        
        window.optimizedSelectionSystem = selectionSystem;
        window.transformControlsManager = transformManager;
        
        console.log('✅ Selection systems initialized');
    } catch (error) {
        console.error('❌ Failed to initialize selection systems:', error);
    }
}
```

**Benefits**:
- Eliminates race conditions
- Proper dependency checking
- Error handling with timeouts
- Follows Three.js async loading patterns

### 3. Selection Visualization - Using Three.js Native Materials

**Current Implementation**: Custom OutlinePass with fallback to EdgesGeometry

**Three.js Native Alternative**:
```javascript
class NativeSelectionSystem extends THREE.EventDispatcher {
    constructor(scene, camera, renderer, orbitControls) {
        super();
        this.scene = scene;
        // ... other properties
        
        // Use native Three.js materials for selection
        this.selectionMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        
        this.outlineMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2
        });
        
        this.selectedHelpers = new Map();
    }
    
    createSelectionVisualization(object) {
        // Create wireframe overlay using Three.js native materials
        const geometry = object.geometry.clone();
        const wireframe = new THREE.WireframeGeometry(geometry);
        const line = new THREE.LineSegments(wireframe, this.outlineMaterial);
        
        // Match object transform
        line.position.copy(object.position);
        line.rotation.copy(object.rotation);
        line.scale.copy(object.scale);
        
        this.scene.add(line);
        this.selectedHelpers.set(object, line);
        
        return line;
    }
    
    removeSelectionVisualization(object) {
        const helper = this.selectedHelpers.get(object);
        if (helper) {
            this.scene.remove(helper);
            helper.geometry.dispose();
            this.selectedHelpers.delete(object);
        }
    }
}
```

**Benefits**:
- Uses standard Three.js materials and geometries
- No post-processing dependencies (EffectComposer, OutlinePass)
- Better performance on low-end devices
- Simpler debugging and maintenance

### 4. Resource Management - Using Three.js dispose() Pattern

**Current Implementation**: Custom resource tracking and disposal

**Three.js Native Alternative**:
```javascript
class NativeSelectionSystem extends THREE.EventDispatcher {
    constructor(scene, camera, renderer, orbitControls) {
        super();
        this.disposables = []; // Track all disposable resources
        // ... rest of constructor
    }
    
    createSelectionVisualization(object) {
        const geometry = object.geometry.clone();
        const wireframe = new THREE.WireframeGeometry(geometry);
        const line = new THREE.LineSegments(wireframe, this.outlineMaterial);
        
        // Track disposables following Three.js pattern
        this.disposables.push(geometry, wireframe);
        
        // ... rest of method
    }
    
    dispose() {
        // Follow Three.js disposal pattern
        console.log('🗑️ Disposing NativeSelectionSystem...');
        
        // Remove event listeners
        this.removeEventListener(); // EventDispatcher cleanup
        
        // Dispose of all tracked resources
        this.disposables.forEach(disposable => {
            if (disposable && typeof disposable.dispose === 'function') {
                disposable.dispose();
            }
        });
        
        // Clear selection helpers
        this.selectedHelpers.forEach((helper) => {
            this.scene.remove(helper);
            if (helper.geometry) helper.geometry.dispose();
            if (helper.material) helper.material.dispose();
        });
        
        this.disposables.length = 0;
        this.selectedHelpers.clear();
        
        console.log('✅ NativeSelectionSystem disposed');
    }
}
```

**Benefits**:
- Standard Three.js disposal pattern
- Automatic resource tracking
- Prevents memory leaks
- Easy to debug and maintain

### 5. Performance Monitoring - Using Three.js Stats.js Integration

**Current Implementation**: Custom performance metrics

**Three.js Native Alternative**:
```javascript
// Use official Three.js Stats.js (commonly used in examples)
import Stats from 'three/addons/libs/stats.module.js';

class NativeSelectionSystem extends THREE.EventDispatcher {
    constructor(scene, camera, renderer, orbitControls) {
        super();
        // ... other properties
        
        // Optional performance monitoring using Three.js ecosystem
        if (window.location.search.includes('debug')) {
            this.stats = new Stats();
            this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb
            document.body.appendChild(this.stats.dom);
        }
    }
    
    selectObject(object) {
        if (this.stats) this.stats.begin();
        
        // Selection logic here
        const start = performance.now();
        
        // ... selection implementation
        
        const duration = performance.now() - start;
        
        // Log slow operations following Three.js patterns
        if (duration > 16) { // Over one frame at 60fps
            console.warn(`[THREE.Selection] Slow selection: ${duration.toFixed(2)}ms`);
        }
        
        if (this.stats) this.stats.end();
        
        this.dispatchEvent({ type: 'object-selected', object: object, duration: duration });
    }
}
```

**Benefits**:
- Uses official Three.js ecosystem tool (Stats.js)
- Standard performance monitoring approach
- Integrates with Three.js examples and debugging
- Optional inclusion for production builds

## Implementation Roadmap

### Phase 1: Core Event System Migration (Immediate)

**Goal**: Replace custom .on/.emit with Three.js EventDispatcher

**Changes**:
1. Extend `OptimizedSelectionSystem` from `THREE.EventDispatcher`
2. Replace all `.emit()` calls with `.dispatchEvent()`
3. Update main.js to use `.addEventListener()` instead of `.on()`
4. Remove custom event system code (651-673 lines)

**Code Changes**:
```javascript
// optimized-selection-system.js
class OptimizedSelectionSystem extends THREE.EventDispatcher {
    // Remove lines 30, 651-673
    // Replace emit calls with dispatchEvent
}

// main.js lines 202, 217
window.optimizedSelectionSystem.addEventListener('object-selected', (event) => {
    console.log('Object selected:', event.object);
    window.transformControlsManager.onObjectSelected(event.object);
});
```

### Phase 2: Eliminate Timing Dependencies (1 day)

**Goal**: Replace setTimeout with Promise-based initialization

**Changes**:
1. Create `SelectionSystemInitializer` class
2. Implement dependency waiting logic
3. Replace setTimeout in main.js with async initialization
4. Add proper error handling and timeouts

### Phase 3: Simplify Selection Visualization (2 days)

**Goal**: Replace OutlinePass with native Three.js materials

**Changes**:
1. Create native wireframe selection visualization
2. Remove EffectComposer dependencies
3. Simplify selection helpers management
4. Improve performance on low-end devices

### Phase 4: Standardize Resource Management (1 day)

**Goal**: Follow Three.js disposal patterns

**Changes**:
1. Track all disposable resources
2. Implement standard dispose() method
3. Follow Three.js memory management patterns
4. Add development-mode memory monitoring

## Code Examples from Official Three.js Sources

### Official Interactive Raycasting Pattern

Based on Three.js official examples (`webgl_interactive_raycasting_points.html`):

```javascript
// Standard Three.js raycasting pattern
function onPointerMove(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function checkIntersections() {
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(selectableObjects, false);
    
    if (intersections.length > 0) {
        const intersection = intersections[0];
        // Handle selection
        selectObject(intersection.object);
    }
}
```

### Official EventDispatcher Pattern

From Three.js documentation:

```javascript
class SelectionSystem extends THREE.EventDispatcher {
    selectObject(object) {
        this.selectedObject = object;
        this.dispatchEvent({ type: 'object-selected', object: object });
    }
}

// Usage
const selectionSystem = new SelectionSystem();
selectionSystem.addEventListener('object-selected', (event) => {
    console.log('Selected:', event.object);
});
```

### Official TransformControls Integration

From Three.js examples:

```javascript
const transformControls = new THREE.TransformControls(camera, renderer.domElement);
scene.add(transformControls);

transformControls.addEventListener('change', () => {
    render(); // Update during transformation
});

transformControls.addEventListener('dragging-changed', (event) => {
    orbitControls.enabled = !event.value;
});

transformControls.addEventListener('object-changed', () => {
    // Handle final transformation change
    saveObjectState();
});
```

## Benefits of Native Three.js Approach

### 1. Ecosystem Compatibility
- Works with all Three.js tools and extensions
- Compatible with Three.js debugging tools
- Follows patterns used in official examples

### 2. Reduced Maintenance
- No custom event system to maintain
- Less code to debug and update
- Leverages well-tested Three.js code

### 3. Better Performance
- Native Three.js optimizations
- No unnecessary abstraction layers
- Direct integration with Three.js rendering loop

### 4. Developer Experience
- Familiar patterns for Three.js developers
- Better IDE support and autocomplete
- Standard debugging approaches

### 5. Future-Proofing
- Follows Three.js evolution
- Compatible with future Three.js versions
- Consistent with Three.js best practices

## Recommended Implementation Priority

1. **High Priority**: Replace custom event system with EventDispatcher
2. **High Priority**: Eliminate setTimeout-based initialization
3. **Medium Priority**: Simplify selection visualization
4. **Low Priority**: Add native performance monitoring

## Testing Strategy

### Unit Tests Following Three.js Patterns
```javascript
describe('NativeSelectionSystem', () => {
    test('should dispatch object-selected event', () => {
        const selectionSystem = new NativeSelectionSystem(scene, camera, renderer, controls);
        let selectedObject = null;
        
        selectionSystem.addEventListener('object-selected', (event) => {
            selectedObject = event.object;
        });
        
        const testObject = new THREE.Mesh();
        selectionSystem.selectObject(testObject);
        
        expect(selectedObject).toBe(testObject);
    });
    
    test('should properly dispose resources', () => {
        const selectionSystem = new NativeSelectionSystem(scene, camera, renderer, controls);
        const initialMaterialCount = scene.children.length;
        
        selectionSystem.selectObject(new THREE.Mesh());
        selectionSystem.dispose();
        
        expect(scene.children.length).toBe(initialMaterialCount);
    });
});
```

## Conclusion

The current selection system can be significantly simplified by leveraging Three.js native patterns and built-in systems. The recommended changes will:

- **Reduce code complexity** by ~200 lines
- **Improve maintainability** by using standard patterns  
- **Eliminate timing dependencies** that cause race conditions
- **Enhance performance** with native Three.js optimizations
- **Provide better debugging** with standard Three.js tools

The migration can be done incrementally, starting with the event system replacement which provides immediate benefits with minimal risk.

---
**Created**: 2025-09-04  
**Status**: Implementation Ready  
**Priority**: High (Event System), Medium (Initialization), Low (Visualization)
**Estimated Effort**: 4-5 days total implementation
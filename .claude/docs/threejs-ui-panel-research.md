# Three.js Research: UI Panel Management for Canvas Editors

## Problem Analysis

The TigerBuilder project needs sophisticated UI panel functionality for its canvas editor interface, specifically:

- **Panel Resizing**: Dynamic resizing of the canvas editor sidebar without breaking 3D scene rendering
- **Panel Collapsing/Expanding**: Show/hide functionality for UI components to maximize 3D viewport space  
- **Canvas Integration**: Proper coordination between the main WebGL canvas and secondary editing canvases
- **Performance**: Minimal impact on Three.js rendering performance during UI interactions

Current implementation uses a fixed 350px sidebar with CSS flexbox layout, which limits user workspace flexibility.

## Official Examples Research

### Three.js Editor Architecture
**Source**: `https://github.com/mrdoob/three.js/tree/master/editor`

The Three.js official editor demonstrates sophisticated UI panel management:

**Key Components**:
- `Resizer.js` - Handles interactive panel resizing with pointer events
- `Sidebar.js` - Manages tabbed panel interfaces with dynamic content
- `UIElement.js` base class - Provides core DOM manipulation and event handling
- Modular component architecture with ES6 imports

**Resizer Implementation Pattern**:
```javascript
// Three.js Editor Resizer.js pattern
class Resizer extends UIElement {
    constructor() {
        super();
        this.dom.addEventListener('pointerdown', this.onPointerDown);
    }
    
    onPointerDown(event) {
        if (event.isPrimary === false) return;
        this.dom.setPointerCapture(event.pointerId);
        // Calculate and apply new panel dimensions
        // Dispatch windowResize signal to update other components
    }
}
```

**Sidebar Tab Management**:
```javascript
// Three.js Editor Sidebar.js pattern  
class Sidebar extends UIElement {
    constructor() {
        super();
        const container = new UITabbedPanel();
        container.addTab('scene', 'Scene', new SidebarScene());
        container.addTab('properties', 'Properties', new SidebarProperties());
        container.select('scene'); // Default active tab
    }
}
```

### Interactive Control Examples
**Sources**: 
- `webgl_geometry_spline_editor.html`
- `misc_controls_transform.html`
- `webgpu_tsl_editor.html`

**UI Overlay Patterns Identified**:

1. **lil-gui Integration**: Uses external UI library for parameter controls alongside Three.js
2. **Absolute Positioning**: UI panels positioned absolutely over WebGL canvas
3. **Event Coordination**: Proper event handling to prevent UI/3D interaction conflicts
4. **Dynamic Panel Creation**: Runtime creation of control elements based on scene state

**Example Pattern from Transform Controls**:
```javascript
// Transform controls example pattern
function onWindowResize() {
    const container = document.querySelector('.viewer');
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    // Update UI panel dimensions accordingly
}
```

### WebGPU Editor Layout
**Source**: `webgpu_tsl_editor.html`

**Advanced UI Patterns**:
- Split-screen layout (50/50 vertical split)  
- Real-time editor with Monaco integration
- Small preview canvas (200x200) alongside main editor
- Debounced compilation for performance

## Recommended Approach

### 1. Three.js Native UI Architecture

**Use Three.js Editor Patterns**:
- Adopt the modular `UIElement` base class approach for consistent DOM manipulation
- Implement pointer-based resizing following the official `Resizer.js` pattern
- Use tabbed panels (`UITabbedPanel`) for organizing canvas editing tools

**Key Classes to Implement**:
```javascript
class UIElement {
    // Base DOM manipulation and event handling
    setClass(className) { this.dom.className = className; return this; }
    add(child) { this.dom.appendChild(child.dom || child); return this; }
    // Event method generation via forEach
}

class UITabbedPanel extends UIElement {
    // Tab management and content switching
    addTab(id, label, content) { /* tab creation */ }
    select(id) { /* show/hide tab content */ }
}

class CanvasEditorPanel extends UIElement {
    // Specialized panel for canvas editing functionality
    constructor(drawCanvas, controls) { /* setup */ }
}
```

### 2. Panel Resizing Implementation

**Follow Three.js Editor Resizer Pattern**:
```javascript
class PanelResizer extends UIElement {
    constructor(targetPanel, viewerContainer) {
        super();
        this.panel = targetPanel;
        this.viewer = viewerContainer;
        this.minWidth = 280; // Minimum panel width
        this.maxWidth = 600; // Maximum panel width
        
        this.dom.addEventListener('pointerdown', this.onPointerDown.bind(this));
        this.dom.addEventListener('pointermove', this.onPointerMove.bind(this));
        this.dom.addEventListener('pointerup', this.onPointerUp.bind(this));
    }
    
    onPointerMove(event) {
        if (!this.isResizing) return;
        
        const newWidth = window.innerWidth - event.clientX;
        const clampedWidth = Math.max(this.minWidth, Math.min(this.maxWidth, newWidth));
        
        // Update panel width
        this.panel.setStyle('width', clampedWidth + 'px');
        
        // Trigger Three.js renderer resize
        this.dispatchEvent('panelResize', { width: clampedWidth });
    }
}
```

### 3. Collapsible Panel Architecture

**Expandable Interface Pattern**:
```javascript
class CollapsiblePanel extends UIElement {
    constructor(title, content, defaultExpanded = true) {
        super();
        this.isExpanded = defaultExpanded;
        this.createHeader(title);
        this.createContent(content);
        this.updateVisibility();
    }
    
    toggle() {
        this.isExpanded = !this.isExpanded;
        this.updateVisibility();
        this.dispatchEvent('panelToggle', { expanded: this.isExpanded });
    }
    
    updateVisibility() {
        this.content.setStyle('display', this.isExpanded ? 'block' : 'none');
        this.header.setClass(this.isExpanded ? 'expanded' : 'collapsed');
    }
}
```

### 4. Canvas Integration Best Practices

**Multi-Canvas Coordination**:
```javascript
class CanvasManager {
    constructor(mainCanvas, editCanvas) {
        this.main = mainCanvas;
        this.edit = editCanvas;
        this.setupEventDelegation();
    }
    
    setupEventDelegation() {
        // Prevent edit canvas events from affecting main canvas
        this.edit.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // Prevent OrbitControls activation
        });
        
        // Coordinate texture updates
        this.edit.addEventListener('canvasChange', () => {
            this.updateMainCanvasTexture();
        });
    }
    
    updateMainCanvasTexture() {
        if (this.canvasTexture) {
            this.canvasTexture.needsUpdate = true;
            // Use requestAnimationFrame to batch texture updates
            if (!this.updateScheduled) {
                this.updateScheduled = true;
                requestAnimationFrame(() => {
                    this.render();
                    this.updateScheduled = false;
                });
            }
        }
    }
}
```

## Implementation Roadmap

### Phase 1: Foundation (Simple Implementation)
1. **Extract current sidebar into modular components**:
   - Create `UIElement` base class following Three.js patterns
   - Wrap existing control groups in `UIElement` instances
   - Add basic show/hide functionality to control groups

2. **Add basic panel resizing**:
   - Implement simple drag handle between viewer and sidebar
   - Use `pointerdown`/`pointermove`/`pointerup` events (not mouse events)
   - Update Three.js renderer size when panel width changes

3. **Improve canvas event handling**:
   - Add `stopPropagation()` to canvas editor mouse events
   - Coordinate `needsUpdate` texture flags with rendering loop

### Phase 2: Enhanced UI (Moderate Complexity)
1. **Implement collapsible control groups**:
   - Add expand/collapse icons to control group headers
   - Smooth CSS transitions for panel animations
   - Save expanded state in scene serialization

2. **Add tabbed interface**:
   - Convert sidebar into `UITabbedPanel` with tabs for different tool categories
   - Separate canvas editing, transform controls, and scene management into tabs
   - Implement tab switching without losing tool state

3. **Advanced resizing features**:
   - Add minimum/maximum width constraints
   - Implement snap-to positions for common panel sizes
   - Double-click resize handle to auto-fit content

### Phase 3: Professional Polish (Advanced Features)  
1. **Responsive design**:
   - Mobile-friendly collapsible panels that overlay instead of sidebars
   - Touch-friendly resize handles and controls
   - Adaptive layout based on viewport dimensions

2. **Dockable panels**:
   - Floating panels that can be docked to different edges
   - Panel persistence and restoration
   - Custom panel arrangements

3. **Performance optimization**:
   - Lazy loading of panel content
   - Virtual scrolling for large control lists  
   - Debounced updates for intensive operations

## Performance Considerations

### Canvas Texture Updates
Based on Three.js community research:

**Optimization Strategies**:
- **Batch texture updates**: Use `requestAnimationFrame` to batch `needsUpdate` calls
- **Conditional updates**: Only update when canvas actually changes
- **Texture size limits**: Keep canvas textures at 256x256 or 512x512 maximum
- **Format optimization**: Use JPEG for opaque textures, PNG only when transparency needed

**Implementation Pattern**:
```javascript
class OptimizedCanvasTexture {
    constructor(canvas) {
        this.canvas = canvas;
        this.texture = new THREE.CanvasTexture(canvas);
        this.texture.generateMipmaps = false; // Better performance
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.updateScheduled = false;
    }
    
    scheduleUpdate() {
        if (!this.updateScheduled) {
            this.updateScheduled = true;
            requestAnimationFrame(() => {
                this.texture.needsUpdate = true;
                this.updateScheduled = false;
            });
        }
    }
}
```

### Memory Management
**UI Component Cleanup**:
```javascript
class UIElement {
    dispose() {
        // Remove event listeners
        this.removeAllEventListeners();
        // Clean up DOM references
        if (this.dom && this.dom.parentNode) {
            this.dom.parentNode.removeChild(this.dom);
        }
        // Clear internal references
        this.dom = null;
    }
}
```

## Integration with Current Project

### Minimal Changes Approach
The current `integrated-scene.html` implementation can be enhanced incrementally:

1. **Wrap existing sidebar in UIElement**:
```javascript
class SidebarManager extends UIElement {
    constructor() {
        super();
        this.dom = document.querySelector('.sidebar');
        this.addResizer();
    }
    
    addResizer() {
        const resizer = new PanelResizer(this, document.querySelector('.viewer'));
        this.add(resizer);
    }
}
```

2. **Add collapsible control groups**:
```javascript
document.querySelectorAll('.control-group').forEach(group => {
    const title = group.querySelector('h4').textContent;
    const content = Array.from(group.children).slice(1); // Skip h4
    const collapsible = new CollapsiblePanel(title, content, true);
    group.parentNode.replaceChild(collapsible.dom, group);
});
```

3. **Enhanced canvas coordination**:
```javascript
// Add to existing canvas setup
const canvasManager = new CanvasManager(
    document.getElementById('mainCanvas'), 
    document.getElementById('drawCanvas')
);

// Replace existing needsTextureUpdate logic
function markTextureUpdate() {
    canvasManager.scheduleTextureUpdate();
}
```

## References

### Three.js Official Sources
- **Three.js Editor**: https://github.com/mrdoob/three.js/tree/master/editor
- **Resizer Component**: https://github.com/mrdoob/three.js/blob/master/editor/js/Resizer.js  
- **UI Framework**: https://github.com/mrdoob/three.js/blob/master/editor/js/libs/ui.js
- **Sidebar Implementation**: https://github.com/mrdoob/three.js/blob/master/editor/js/Sidebar.js

### Interactive Examples
- **Transform Controls**: https://github.com/mrdoob/three.js/blob/master/examples/misc_controls_transform.html
- **Spline Editor**: https://github.com/mrdoob/three.js/blob/master/examples/webgl_geometry_spline_editor.html
- **TSL Editor**: https://github.com/mrdoob/three.js/blob/master/examples/webgpu_tsl_editor.html

### Performance Research
- **Canvas Texture Performance**: Multiple Stack Overflow discussions on `needsUpdate` optimization
- **Three.js Forum**: Performance discussions on dynamic texture updates
- **Browser Compatibility**: Pointer Events API support for modern resizing interactions

### Community Best Practices
- **Event Delegation**: Proper separation of UI and 3D interaction events
- **Memory Management**: Disposal patterns for dynamic UI elements
- **Responsive Design**: Mobile-friendly Three.js applications with complex UI
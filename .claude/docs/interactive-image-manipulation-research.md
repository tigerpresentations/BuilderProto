# Interactive Image Manipulation Research: Professional Canvas Resize Handles and Drag Systems

## Executive Summary

This research documents battle-tested patterns for implementing professional-grade interactive image manipulation in HTML5 Canvas applications, specifically for TigerBuilder's Phase 2 implementation. The findings focus on established techniques from successful web applications like Figma, Photopea, and proven canvas libraries like Konva.js and Fabric.js.

## Technical Challenge Analysis

### Problem Statement
TigerBuilder requires professional-grade canvas image manipulation with:
- Click-and-drag movement within canvas bounds
- Visual resize handles (corner and edge handles)
- Aspect ratio preservation during scaling
- Real-time visual feedback during transformations
- Smooth performance at 60fps
- Touch device compatibility

### Performance Requirements
- Maintain 60fps during drag operations
- Support canvas sizes up to 1024x1024 pixels
- Handle multiple simultaneous images
- Memory-efficient transformation calculations
- Cross-browser compatibility (Chrome, Firefox, Safari, Edge)

## Established Canvas Event Handling Patterns

### 1. Core Event Architecture

Based on research from Konva.js and industry standards, the proven event handling pattern follows a three-phase approach:

```javascript
// Phase 1: Event Capture and Coordinate Translation
function getCanvasCoordinates(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

// Phase 2: Hit Detection with Tolerance
function isPointInHandle(point, handle, tolerance = 5) {
    return Math.abs(point.x - handle.x) <= tolerance && 
           Math.abs(point.y - handle.y) <= tolerance;
}

// Phase 3: State Management
const manipulationState = {
    isDragging: false,
    isResizing: false,
    activeHandle: null,
    startPosition: null,
    originalBounds: null
};
```

### 2. Event Lifecycle Management

Proven pattern from Konva.js Transformer implementation:

```javascript
// Event Registration Pattern
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);

// Touch Support (Critical for Mobile)
canvas.addEventListener('touchstart', handleTouchStart, {passive: false});
canvas.addEventListener('touchmove', handleTouchMove, {passive: false});
canvas.addEventListener('touchend', handleTouchEnd);

function handleMouseDown(event) {
    event.preventDefault();
    const coords = getCanvasCoordinates(canvas, event);
    const handle = detectHandle(coords);
    
    if (handle) {
        startResize(handle, coords);
    } else if (isInsideImage(coords)) {
        startDrag(coords);
    }
}
```

## Handle System Architecture and Detection Algorithms

### 1. Handle Positioning Strategy

Based on Figma and Photopea patterns, handles are positioned relative to image bounds:

```javascript
function generateHandles(imageBounds) {
    const { x, y, width, height } = imageBounds;
    const handleSize = Math.max(8, Math.min(12, width * 0.03)); // Responsive sizing
    
    return {
        // Corner handles for proportional scaling
        topLeft: { x: x - handleSize/2, y: y - handleSize/2, type: 'corner', anchor: 'bottomRight' },
        topRight: { x: x + width - handleSize/2, y: y - handleSize/2, type: 'corner', anchor: 'bottomLeft' },
        bottomLeft: { x: x - handleSize/2, y: y + height - handleSize/2, type: 'corner', anchor: 'topRight' },
        bottomRight: { x: x + width - handleSize/2, y: y + height - handleSize/2, type: 'corner', anchor: 'topLeft' },
        
        // Edge handles for single-axis scaling
        topCenter: { x: x + width/2 - handleSize/2, y: y - handleSize/2, type: 'edge', axis: 'vertical', anchor: 'bottom' },
        bottomCenter: { x: x + width/2 - handleSize/2, y: y + height - handleSize/2, type: 'edge', axis: 'vertical', anchor: 'top' },
        leftCenter: { x: x - handleSize/2, y: y + height/2 - handleSize/2, type: 'edge', axis: 'horizontal', anchor: 'right' },
        rightCenter: { x: x + width - handleSize/2, y: y + height/2 - handleSize/2, type: 'edge', axis: 'horizontal', anchor: 'left' }
    };
}
```

### 2. Hit Detection Algorithm

Optimized two-pass detection system from Konva.js research:

```javascript
function detectHandle(mousePos, handles) {
    const tolerance = 10; // Industry standard 10px tolerance
    
    // Pass 1: Bounding box pre-filter (performance optimization)
    const candidates = Object.entries(handles).filter(([name, handle]) => {
        const bounds = {
            left: handle.x - tolerance,
            right: handle.x + handle.size + tolerance,
            top: handle.y - tolerance,
            bottom: handle.y + handle.size + tolerance
        };
        return mousePos.x >= bounds.left && mousePos.x <= bounds.right &&
               mousePos.y >= bounds.top && mousePos.y <= bounds.bottom;
    });
    
    // Pass 2: Precise distance calculation
    for (const [name, handle] of candidates) {
        const distance = Math.sqrt(
            Math.pow(mousePos.x - (handle.x + handle.size/2), 2) +
            Math.pow(mousePos.y - (handle.y + handle.size/2), 2)
        );
        if (distance <= tolerance) {
            return { name, handle };
        }
    }
    
    return null;
}
```

### 3. Cursor Management System

Industry-standard cursor mapping based on Figma patterns:

```javascript
const CURSOR_MAP = {
    // Corner handles
    'topLeft': 'nw-resize',
    'topRight': 'ne-resize',
    'bottomLeft': 'sw-resize',
    'bottomRight': 'se-resize',
    
    // Edge handles
    'topCenter': 'n-resize',
    'bottomCenter': 's-resize',
    'leftCenter': 'w-resize',
    'rightCenter': 'e-resize',
    
    // States
    'dragging': 'move',
    'default': 'default'
};

function updateCursor(activeHandle, isDragging) {
    if (isDragging) {
        canvas.style.cursor = CURSOR_MAP['dragging'];
    } else if (activeHandle) {
        canvas.style.cursor = CURSOR_MAP[activeHandle.name];
    } else {
        canvas.style.cursor = CURSOR_MAP['default'];
    }
}
```

## Transform Mathematics for Scaling and Positioning

### 1. Corner Handle Scaling with Aspect Ratio Preservation

Based on MDN Canvas transformations and Figma implementation:

```javascript
function calculateCornerScale(startBounds, currentMousePos, handle, preserveAspectRatio = true) {
    const anchor = getAnchorPoint(startBounds, handle.anchor);
    
    // Calculate new dimensions
    let newWidth = Math.abs(currentMousePos.x - anchor.x);
    let newHeight = Math.abs(currentMousePos.y - anchor.y);
    
    if (preserveAspectRatio) {
        const originalRatio = startBounds.width / startBounds.height;
        const currentRatio = newWidth / newHeight;
        
        if (currentRatio > originalRatio) {
            // Constrain by height
            newWidth = newHeight * originalRatio;
        } else {
            // Constrain by width
            newHeight = newWidth / originalRatio;
        }
    }
    
    // Minimum size constraints (industry standard: 10x10px)
    newWidth = Math.max(10, newWidth);
    newHeight = Math.max(10, newHeight);
    
    return {
        x: Math.min(currentMousePos.x, anchor.x),
        y: Math.min(currentMousePos.y, anchor.y),
        width: newWidth,
        height: newHeight
    };
}
```

### 2. Edge Handle Single-Axis Scaling

```javascript
function calculateEdgeScale(startBounds, currentMousePos, handle) {
    const newBounds = { ...startBounds };
    
    switch (handle.type) {
        case 'vertical':
            if (handle.anchor === 'top') {
                newBounds.height = Math.max(10, currentMousePos.y - startBounds.y);
            } else { // anchor === 'bottom'
                const newHeight = Math.max(10, startBounds.y + startBounds.height - currentMousePos.y);
                newBounds.y = startBounds.y + startBounds.height - newHeight;
                newBounds.height = newHeight;
            }
            break;
            
        case 'horizontal':
            if (handle.anchor === 'left') {
                newBounds.width = Math.max(10, currentMousePos.x - startBounds.x);
            } else { // anchor === 'right'
                const newWidth = Math.max(10, startBounds.x + startBounds.width - currentMousePos.x);
                newBounds.x = startBounds.x + startBounds.width - newWidth;
                newBounds.width = newWidth;
            }
            break;
    }
    
    return newBounds;
}
```

### 3. Canvas Boundary Constraints

```javascript
function constrainToCanvas(imageBounds, canvasBounds) {
    const constrained = { ...imageBounds };
    
    // Ensure minimum visibility (at least 10px visible)
    const minVisible = 10;
    
    constrained.x = Math.max(-constrained.width + minVisible, 
                            Math.min(canvasBounds.width - minVisible, constrained.x));
    constrained.y = Math.max(-constrained.height + minVisible, 
                            Math.min(canvasBounds.height - minVisible, constrained.y));
    
    // Constrain size to canvas if needed
    constrained.width = Math.min(constrained.width, canvasBounds.width + constrained.x);
    constrained.height = Math.min(constrained.height, canvasBounds.height + constrained.y);
    
    return constrained;
}
```

## Performance Optimization Techniques

### 1. RequestAnimationFrame Integration

Based on web.dev research and industry best practices:

```javascript
class ImageManipulator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.animationFrame = null;
        this.needsRedraw = false;
    }
    
    scheduleRedraw() {
        if (!this.animationFrame) {
            this.needsRedraw = true;
            this.animationFrame = requestAnimationFrame(() => {
                if (this.needsRedraw) {
                    this.render();
                    this.needsRedraw = false;
                }
                this.animationFrame = null;
            });
        }
    }
    
    render() {
        // Use efficient clearing strategy
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Batch drawing operations
        this.renderImages();
        this.renderHandles();
    }
}
```

### 2. Efficient Redraw Strategies

Based on Konva.js performance documentation:

```javascript
// Layering strategy for performance
class LayeredCanvas {
    constructor(container) {
        // Background layer (static content)
        this.backgroundCanvas = this.createCanvas(container);
        
        // Interactive layer (images being manipulated)
        this.interactiveCanvas = this.createCanvas(container);
        
        // Handles layer (always on top)
        this.handlesCanvas = this.createCanvas(container);
    }
    
    // Only redraw affected layers during manipulation
    updateDuringDrag(imageData) {
        // Don't redraw background
        this.clearLayer(this.interactiveCanvas);
        this.renderImage(this.interactiveCanvas, imageData);
        this.scheduleHandleUpdate();
    }
}
```

### 3. Memory Management

```javascript
// Efficient handle rendering with object pooling
class HandleRenderer {
    constructor() {
        this.handlePool = new Map();
        this.activeHandles = [];
    }
    
    getHandle(id, type) {
        const key = `${type}-${id}`;
        if (!this.handlePool.has(key)) {
            this.handlePool.set(key, this.createHandle(type));
        }
        return this.handlePool.get(key);
    }
    
    // Dispose unused handles to prevent memory leaks
    cleanup() {
        for (const [key, handle] of this.handlePool) {
            if (!this.activeHandles.includes(key)) {
                this.handlePool.delete(key);
            }
        }
    }
}
```

## Industry Examples and Established Patterns

### 1. Figma's Approach
- **Image as Fill Pattern**: Images are treated as fills on rectangles, making transformation consistent
- **Non-destructive Editing**: All transformations preserve original image data
- **Snap-to-Grid**: Provides guided alignment during transformations
- **Multi-selection Support**: Unified transform controls for multiple objects

### 2. Konva.js Transformer Pattern
- **Built-in Transformer Object**: Specialized group for interactive manipulation
- **Event Lifecycle**: transformstart → transform → transformend
- **Scale-based Transformations**: Modifies scaleX/scaleY instead of dimensions
- **Boundary Functions**: Configurable constraint system

### 3. Fabric.js Control System
- **Custom Control API**: Extensible handle system
- **Interactive Object Model**: Object-oriented approach to canvas elements
- **Built-in Drag Handles**: Automatic generation of resize handles
- **Cross-framework Support**: Works with React, Vue, Angular

## Mobile Touch Handling Considerations

### 1. Touch Event Adaptation

```javascript
function adaptTouchEvents(touchEvent) {
    // Prevent default to avoid scrolling during manipulation
    touchEvent.preventDefault();
    
    // Handle multi-touch scenarios
    const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
    
    return {
        clientX: touch.clientX,
        clientY: touch.clientY,
        // Add touch-specific properties
        pressure: touch.force || 1.0,
        touchRadius: touch.radiusX || 10
    };
}

// Increased tolerance for touch interactions
const TOUCH_TOLERANCE = 15; // vs 10 for mouse
```

### 2. Gesture Recognition

```javascript
class TouchGestureHandler {
    constructor() {
        this.lastTouchDistance = 0;
        this.lastTouchCenter = null;
    }
    
    handleTouchStart(event) {
        if (event.touches.length === 2) {
            // Two-finger pinch/zoom gesture
            this.initializePinchGesture(event.touches);
        } else {
            // Single finger drag/tap
            this.initializeDragGesture(event.touches[0]);
        }
    }
}
```

## Integration Strategy with TigerBuilder

### 1. UV Coordinate System Integration

```javascript
// Convert canvas coordinates to UV space (0-1 range)
function canvasToUV(canvasCoords, canvasSize) {
    return {
        u: canvasCoords.x / canvasSize.width,
        v: canvasCoords.y / canvasSize.height
    };
}

// Convert UV coordinates back to canvas space
function uvToCanvas(uvCoords, canvasSize) {
    return {
        x: uvCoords.u * canvasSize.width,
        y: uvCoords.v * canvasSize.height
    };
}
```

### 2. Three.js Texture Update Integration

```javascript
function updateTextureFromCanvas(canvas, texture) {
    // Efficient texture update pattern
    texture.needsUpdate = true;
    texture.flipY = false; // Critical for GLB compatibility
    
    // Only update if canvas has changed
    if (canvas.lastUpdateTime !== canvas.currentUpdateTime) {
        texture.source.data = canvas;
        canvas.lastUpdateTime = canvas.currentUpdateTime;
    }
}
```

### 3. State Persistence

```javascript
// Serialize manipulation state for scene saving
function serializeImageState(imageData) {
    return {
        id: imageData.id,
        bounds: imageData.bounds,
        transformMatrix: imageData.transformMatrix,
        originalDimensions: imageData.originalDimensions,
        uvMapping: imageData.uvMapping
    };
}
```

## Accessibility Considerations

### 1. Keyboard Navigation Support

```javascript
// Handle keyboard-based transformations
function handleKeyDown(event) {
    if (!selectedImage) return;
    
    const MOVE_INCREMENT = event.shiftKey ? 10 : 1;
    
    switch (event.key) {
        case 'ArrowLeft':
            moveImage(selectedImage, -MOVE_INCREMENT, 0);
            break;
        case 'ArrowRight':
            moveImage(selectedImage, MOVE_INCREMENT, 0);
            break;
        // ... additional arrow key handlers
    }
}
```

### 2. Screen Reader Support

```javascript
// ARIA labels for canvas manipulation
function updateARIALabels(imageData) {
    canvas.setAttribute('aria-label', 
        `Image positioned at ${imageData.bounds.x}, ${imageData.bounds.y}, 
         size ${imageData.bounds.width} by ${imageData.bounds.height} pixels`);
}
```

## Implementation Recommendations

### 1. Phased Implementation Approach

**Phase 1: Basic Drag and Drop**
- Implement core event handling system
- Add simple drag functionality with boundary constraints
- Basic cursor management

**Phase 2: Resize Handle System**
- Add handle generation and detection
- Implement corner handle scaling with aspect ratio preservation
- Add visual feedback during transformations

**Phase 3: Advanced Features**
- Edge handle scaling
- Multi-image selection
- Touch gesture support
- Performance optimizations

### 2. Testing Strategy

```javascript
// Performance testing utilities
function measureManipulationPerformance() {
    const metrics = {
        frameTimes: [],
        memoryUsage: [],
        eventLatency: []
    };
    
    // Track frame rate during manipulation
    let lastFrame = performance.now();
    function trackFrameRate() {
        const currentFrame = performance.now();
        metrics.frameTimes.push(currentFrame - lastFrame);
        lastFrame = currentFrame;
        requestAnimationFrame(trackFrameRate);
    }
    
    return metrics;
}
```

### 3. Browser Compatibility Layer

```javascript
// Cross-browser event handling
function normalizeEvent(event) {
    return {
        clientX: event.clientX || event.touches?.[0]?.clientX || 0,
        clientY: event.clientY || event.touches?.[0]?.clientY || 0,
        button: event.button ?? (event.which ? event.which - 1 : 0),
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation()
    };
}
```

## Performance Benchmarks and Targets

### Target Performance Metrics
- **Frame Rate**: Maintain 60fps during all manipulations
- **Event Latency**: < 16ms response time for interactions
- **Memory Usage**: < 50MB for typical use cases
- **Touch Response**: < 100ms first response to touch input

### Optimization Checkpoints
- Use `requestAnimationFrame` for all animations
- Implement object pooling for handles and temporary objects
- Use layered canvas approach for complex scenes
- Minimize canvas state changes during operations
- Cache transformation calculations where possible

## References and Further Reading

### Official Documentation
- [MDN Canvas API Transformations](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Transformations)
- [MDN Canvas Optimization Guide](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [HTML5 Canvas Performance Tips](https://web.dev/articles/canvas-performance)

### Production Implementation Examples
- [Konva.js Transformer Documentation](https://konvajs.org/docs/select_and_transform/Basic_demo.html)
- [Konva.js Performance Tips](https://konvajs.org/docs/performance/All_Performance_Tips.html)
- [Fabric.js Custom Controls](https://fabricjs.com/controls-api)

### Performance and Optimization Resources
- [Canvas Hit Detection Methods](https://joshuatz.com/posts/2022/canvas-hit-detection-methods/)
- [Collision Detection Algorithms](https://www.jeffreythompson.org/collision-detection/)
- [RequestAnimationFrame Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

## Conclusion

This research provides a comprehensive foundation for implementing professional-grade interactive image manipulation in TigerBuilder. The documented patterns are based on proven techniques from successful web applications and established canvas libraries, ensuring reliability and performance for production use.

Key takeaways:
1. **Event-driven architecture** with proper coordinate transformation is essential
2. **Handle detection algorithms** should use two-pass optimization for performance
3. **Transform mathematics** must account for different scaling origins and constraints
4. **Performance optimization** through layering and requestAnimationFrame is critical
5. **Mobile touch support** requires increased tolerance and gesture recognition
6. **Integration** with TigerBuilder's UV coordinate system maintains consistency

The implementation should follow the phased approach outlined, prioritizing stability and maintainability over advanced features, in alignment with TigerBuilder's philosophy of simple, reliable solutions.
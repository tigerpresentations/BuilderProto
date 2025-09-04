# Current Issues and Problems

## Active Issues

*No active issues - all major selection and manipulation problems have been resolved.*

## Issue Template
When documenting issues, use this format:

### Issue: [Brief Description]
- **Date Identified**: 
- **Severity**: Critical / High / Medium / Low
- **Component(s) Affected**: 
- **Description**: 
- **Steps to Reproduce**: 
- **Expected Behavior**: 
- **Actual Behavior**: 
- **Potential Solutions**: 
- **Status**: Open / In Progress / Resolved

## Recently Resolved Issues

### Issue: Selection System Event Conflicts (Resolved 2025-09-04)
- **Date Identified**: 2025-09-04
- **Severity**: Critical
- **Component(s) Affected**: Multiple competing mouse event systems
- **Description**: Multiple selection systems (OptimizedSelectionSystem, CleanSelectionSystem, SimpleInteractiveEditor) were competing for mouse events, preventing selection from working
- **Solution**: Consolidated to single OptimizedSelectionSystem with Promise-based initialization, removed conflicting CleanSelectionSystem
- **Status**: Resolved

### Issue: Wireframe Transform Inheritance (Resolved 2025-09-04)  
- **Date Identified**: 2025-09-04
- **Severity**: High
- **Component(s) Affected**: SimpleSelectionVisualization wireframe rendering
- **Description**: Wireframe visualization didn't inherit GLB transforms (scale) and had Y-axis offsets for meshes with local transforms
- **Solution**: 
  - Wireframe added as child of selected object for automatic transform inheritance
  - Matrix-based relative positioning for meshes with local transforms
  - Proper coordinate space calculations
- **Status**: Resolved

### Issue: ObjectManipulator Event Handling (Resolved 2025-09-04)
- **Date Identified**: 2025-09-03  
- **Severity**: High
- **Component(s) Affected**: object-manipulator.js, replaced with Three.js TransformControls
- **Description**: Mouse events not reaching ObjectManipulator, causing manipulation failures
- **Solution**: Replaced custom ObjectManipulator with standard Three.js TransformControls integration
- **Status**: Resolved

### Issue: Camera Centering Auto-Trigger (Resolved 2025-09-02)
- **Date Identified**: 2025-09-02  
- **Severity**: Low
- **Component(s) Affected**: model-loader.js (placeModelOnFloor function)
- **Description**: Camera auto-centering on model load was interfering with expected user workflow
- **Solution**: Removed automatic centerCameraOnModel() call, restored original instant positioning, kept double-click behavior
- **Status**: Resolved

### Issue: Image Scaling Boundary Constraints (Resolved 2025-09-02)
- **Date Identified**: 2025-09-02
- **Severity**: Medium
- **Component(s) Affected**: simple-interactive-editor.js (handleResize function)
- **Description**: Images could not be scaled further when touching canvas boundaries due to hard position constraints during resize
- **Solution**: Removed position constraints during resize, increased max scale to 3.0x, implemented smart overflow system for dragging
- **Status**: Resolved

### Issue: Abrupt Scaling Behavior (Resolved 2025-09-02)
- **Date Identified**: 2025-09-02  
- **Severity**: Medium
- **Component(s) Affected**: simple-interactive-editor.js (handleResize function)
- **Description**: Image scaling felt jumpy and imprecise due to hard minimums (0.05) and complex distance calculations
- **Solution**: Simplified to center-based distance calculations, reduced minimum to 0.02, eliminated complex offset formulas
- **Status**: Resolved

### Issue: Image Import Default Size (Resolved 2025-09-02)
- **Date Identified**: 2025-09-02
- **Severity**: Low  
- **Component(s) Affected**: simple-layer-manager.js (ImageLayer constructor)
- **Description**: Images imported at 30% maximum size were too small for typical usage
- **Solution**: Increased default maximum size from 0.3 to 0.75 (75% of canvas)
- **Status**: Resolved

### Issue: Mouse Events Lost Outside Canvas Bounds (Resolved 2025-09-02)
- **Date Identified**: 2025-09-02
- **Severity**: Medium
- **Component(s) Affected**: simple-interactive-editor.js (mouse event handling)
- **Description**: Drag/resize operations stopped when mouse cursor left canvas area
- **Solution**: Implemented global event promotion system - switches to document-level events during active operations
- **Status**: Resolved

### Issue: Selection Border Contaminating Texture (Resolved 2025-09-02)
- **Date Identified**: 2025-09-02
- **Severity**: High
- **Component(s) Affected**: simple-layer-manager.js (renderLayers function)
- **Description**: Selection borders were rendered directly onto canvas texture, appearing on 3D model
- **Solution**: Separated rendering logic - renderLayers() for clean texture, renderWithSelection() for UI, multiple clearing methods (Escape key, click empty space, Clear Selection button)
- **Status**: Resolved

## Notes
- This document will be actively maintained as development progresses
- Issues should be specific and actionable
- Include any relevant error messages or console output
- Link to related code sections when applicable

---
**Last Updated**: 2025-09-04 15:30 UTC  
**Issues Active This Session**: 0 (All resolved)  
**Next Review**: As needed when new issues arise

## Major System Improvements (2025-09-04)
- ✅ **Selection system fully modernized** with Three.js native patterns
- ✅ **Event conflicts resolved** by consolidating to single system
- ✅ **Promise-based initialization** eliminates race conditions
- ✅ **Wireframe visualization fixed** with proper transform inheritance
- ✅ **TransformControls integration** working correctly
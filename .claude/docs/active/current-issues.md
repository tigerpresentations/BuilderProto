# Current Issues and Problems

## Active Issues

### Issue: ObjectManipulator Event Handling
- **Date Identified**: 2025-09-03
- **Severity**: High  
- **Component(s) Affected**: object-manipulator.js, integration with ObjectSelector and OrbitControls
- **Description**: Mouse events are not properly reaching ObjectManipulator when clicking on selected objects or manipulation handles (green rotation ring). Event listeners are correctly attached to renderer domElement with capture phase, but mouse events are not firing.
- **Steps to Reproduce**:
  1. Select an object (green outline appears)
  2. Green rotation ring appears at top of object
  3. Try to drag object or click green ring
  4. Object manipulation does not occur (camera moves instead via OrbitControls)
- **Expected Behavior**: Clicking and dragging selected objects should move them in XZ plane; clicking and dragging green ring should rotate object around Y-axis
- **Actual Behavior**: Mouse events are captured by OrbitControls, causing camera movement instead of object manipulation
- **Current Progress**: 
  - ObjectManipulator system fully implemented with visual helpers
  - ObjectSelector properly maintains selection when clicking manipulation helpers
  - Event listeners attached with capture phase and non-passive options
  - Console logs show "ObjectManipulator event listeners added" but mouse events never fire
- **Potential Solutions**: 
  - Investigate event propagation chain more deeply
  - Try different event attachment strategies (window vs renderer element)
  - Consider Z-fighting or ray casting priority issues
  - Review Three.js raycasting integration with manipulation helpers
- **Status**: In Progress

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
**Last Updated**: 2025-09-03 12:30 UTC  
**Issues Active This Session**: 1 (Object manipulation event handling)  
**Next Review**: After resolving ObjectManipulator event capture
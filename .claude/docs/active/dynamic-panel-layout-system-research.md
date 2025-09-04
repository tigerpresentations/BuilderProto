# Dynamic Panel Layout System Research

**Date**: 2025-01-15  
**Status**: Research Phase - Not Yet Implemented  
**Priority**: Medium - Quality of Life Improvement  

## Problem Statement

The current BuilderProto application has multiple control panels that can potentially overlap and create poor user experience:
- Saved Designs panel
- Model Library panel  
- Authentication section
- Developer consoles (lighting, shadows)
- File upload controls
- Canvas controls

Currently there's no systematic way to handle panel positioning, causing layout conflicts and overlapping interfaces.

## Proposed Solution: Zone-Based Layout Manager

### Core Concept: Layout Zones
Define logical screen regions where panels can dock:
- **Left Sidebar**: Model library, saved designs, etc.
- **Right Sidebar**: Properties, inspector panels
- **Bottom Panel**: Console, logs, dev tools
- **Floating**: Modal-style panels that need to overlay content
- **Top Bar**: Authentication, global actions

### Key Features

#### 1. Panel Registration System
Panels register themselves with preferred zones and metadata:
```javascript
panelLayoutManager.registerPanel('saved-designs', {
  preferredZone: 'left-sidebar',
  priority: 1,
  minWidth: '250px',
  title: 'Saved Designs',
  collapsible: true
});
```

#### 2. Dynamic CSS Grid Layout
Main page uses CSS Grid with dynamic column/row sizing:
- Left/Right sidebars expand/contract based on content
- Bottom panel appears/disappears without affecting main canvas
- Smooth CSS transitions for all changes

#### 3. Smart Reflow Algorithm
- When panels show/hide, automatically recalculate grid dimensions
- Handle conflicts (multiple panels in same zone)
- Responsive breakpoints for mobile/tablet

#### 4. Panel State Management
- Remember open/closed state
- Handle panel minimized vs expanded
- Drag-and-drop panels between zones (future enhancement)

#### 5. Collision Avoidance
- Stack panels vertically within zones
- Auto-collapse less important panels if space is tight
- Tabbed interface as fallback for overcrowded zones

### Technical Implementation Approach

#### 1. CSS Custom Properties
Use CSS variables to dynamically adjust grid dimensions:
```css
.main-layout {
  display: grid;
  grid-template-columns: var(--left-width, 0) 1fr var(--right-width, 0);
  grid-template-rows: var(--top-height, 0) 1fr var(--bottom-height, 0);
}
```

#### 2. Event-Driven Architecture
Panels dispatch show/hide events, layout manager responds

#### 3. Resize Observers
Automatically detect content size changes

#### 4. Animation Coordination
Ensure smooth transitions don't conflict

### Benefits
- No more overlapping panels
- Professional IDE-like experience  
- Graceful responsive behavior
- Easy to add new panels without layout conflicts
- Canvas automatically adjusts to available space

### Open Questions for Implementation

1. **Panel Mobility**: Do you want panels to be **draggable between zones**, or is fixed assignment okay?

2. **Panel Resizing**: Should panels be **resizable within their zones**?

3. **Priority System**: Any **specific panel priority hierarchy** you have in mind?

4. **Persistence**: Should the system **persist panel layouts** across sessions?

### Implementation Strategy

#### Phase 1: Core Infrastructure
- Create PanelLayoutManager class
- Set up CSS Grid system with custom properties
- Implement basic zone assignment

#### Phase 2: Panel Integration  
- Migrate existing panels to new system
- Add show/hide event handling
- Implement collision avoidance

#### Phase 3: Advanced Features
- Add panel resizing
- Implement state persistence
- Add responsive breakpoints

#### Phase 4: Polish
- Smooth animations
- Drag-and-drop (if desired)
- Mobile optimization

### Current Panel Inventory

**Existing Panels to Migrate:**
- Saved Designs panel (`saved-designs-ui.js`)
- Model Library panel (`model-library.js`)
- Authentication section (`auth.js`)
- Lighting Dev Console (Alt+L)
- Shadow Dev Console (Alt+S)
- Canvas Editor controls
- File upload interface

**Suggested Zone Assignments:**
- Left Sidebar: Model Library, Saved Designs
- Right Sidebar: Object properties, material editor
- Bottom Panel: Developer consoles, logs
- Top Bar: Authentication, global actions
- Floating: File upload modal

### Research Notes

This system would provide a foundation for future panel additions without needing to worry about layout conflicts. The zone-based approach is commonly used in professional IDEs and would give BuilderProto a more polished, production-ready feel.

### Next Steps When Ready to Implement

1. Answer the open questions above
2. Create basic PanelLayoutManager class
3. Start with migrating one simple panel (e.g., Saved Designs)
4. Incrementally migrate other panels
5. Add advanced features based on usage feedback

### Related Files
- `index.html` - Main layout structure
- `saved-designs-ui.js` - First panel to migrate
- `model-library.js` - Second panel to migrate
- `ui-controls.js` - Contains dev console logic

---

**Note**: This is a significant architectural change that would improve user experience but requires careful implementation to avoid breaking existing functionality. Consider implementing during a dedicated UI/UX improvement sprint.
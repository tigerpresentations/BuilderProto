# Three.js Version Stability Research

## Problem Analysis

The TigerBuilder project currently uses Three.js r128 and needs guidance on version stability for production deployment. Key concerns include:

- Current version vs. latest version compatibility
- Breaking changes that affect core functionality (GLTFLoader, OrbitControls, CanvasTexture, lighting)
- Long-term maintenance strategy for production applications
- Migration complexity and risk assessment

## Current Three.js Version Status (January 2025)

### Latest Version
- **Current stable release**: r179 (v0.179.1 on npm)
- **Release pattern**: Monthly incremental releases
- **Version numbering**: Uses revision system (r128, r129, etc.) converted to semver on npm (0.128.0, 0.129.0)

### LTS Policy
**Three.js does NOT have LTS versions**. Unlike Node.js, Three.js follows a continuous release model where:
- All releases are considered production-ready
- No designated long-term support versions exist
- Stability comes from version pinning, not official support commitments

## Major Breaking Changes: r128 → r179

### Critical Breaking Changes Affecting TigerBuilder

#### 1. ES6 Module Migration (r128)
**Impact**: HIGH - Affects all loader imports
- `examples/js` directory removed entirely
- All addons (GLTFLoader, OrbitControls) now ES6 modules only
- CDN usage patterns changed

```javascript
// OLD (r127 and earlier) - NO LONGER WORKS
<script src="three.js"></script>
<script src="examples/js/loaders/GLTFLoader.js"></script>

// NEW (r128+) - REQUIRED
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
```

#### 2. Lighting System Changes (r155)
**Impact**: MEDIUM - Affects scene lighting
- `WebGLRenderer.useLegacyLights` now defaults to `false`
- Lights now use physically correct intensities by default
- May require intensity adjustments for existing scenes

#### 3. Material System Updates
**Impact**: LOW-MEDIUM - May affect material detection
- r151: Changing `Material.transparent` after use requires `needsUpdate = true`
- r148: `Material.type` is now static (read-only)
- Material detection patterns should remain stable

#### 4. OrbitControls Changes (r129)
**Impact**: LOW - Minor behavioral changes
- Now uses Pointer Events instead of mouse events
- Better touch device support
- Should not affect existing implementations significantly

### GLTFLoader Specific Changes

#### Maintained Compatibility
- Core loading API remains stable
- Material detection workflows unchanged
- Canvas texture application methods stable

#### Minor Changes
- r114: Returns `Group` instead of `Scene` (likely already handled in r128)
- Node ordering now matches glTF asset order
- Removed support for deprecated extensions (KHR_materials_pbrSpecularGlossiness)

### CanvasTexture Stability
- API remains stable across all versions
- `flipY` behavior unchanged
- `needsUpdate` pattern consistent

## Production Recommendations

### Option 1: Stay with r128 (Conservative)
**Pros:**
- Zero migration risk
- Proven stability in current implementation
- All current features work as expected

**Cons:**
- Missing 51 releases of bug fixes and improvements
- Potential security vulnerabilities not patched
- Limited community support for older versions
- Missing performance optimizations

**Recommendation**: Only if migration resources are severely constrained

### Option 2: Upgrade to r140-r150 (Balanced)
**Pros:**
- Significant bug fixes and improvements
- Before major lighting system changes
- Manageable migration scope
- Good stability-to-improvement ratio

**Cons:**
- Still requires ES6 module migration effort
- Some testing required for material system changes

**Recommendation**: Good middle ground for production stability

### Option 3: Upgrade to Latest r179 (Progressive)
**Pros:**
- Latest bug fixes and security patches
- Best performance optimizations
- Full community support
- Future-proof architecture

**Cons:**
- Lighting system changes require testing
- More migration complexity
- Potential for unexpected edge cases

**Recommendation**: Best for long-term maintenance

## Migration Strategy

### Recommended Approach: Incremental Upgrade to r150

1. **Phase 1: ES6 Module Migration (r128 → r135)**
   - Convert all imports to ES6 modules
   - Test GLTFLoader, OrbitControls functionality
   - Validate material detection pipeline
   - Test canvas-to-texture workflow

2. **Phase 2: Stability Improvements (r135 → r150)**
   - Benefit from bug fixes and performance improvements
   - Material system stabilizes
   - Still before major lighting changes

3. **Phase 3: Future Consideration (r150 → Latest)**
   - Evaluate lighting system impact
   - Plan for modern Three.js features
   - Consider when resources allow

### Implementation Plan

#### Step 1: Development Environment Setup
```bash
# Test migration in development
npm install three@0.150.0
```

#### Step 2: Import Conversion
```javascript
// Update all files to ES6 imports
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
```

#### Step 3: Testing Checklist
- [ ] GLB model loading functionality
- [ ] Material detection ("Image" materials)
- [ ] Canvas-to-texture pipeline (256x256)
- [ ] Scene serialization/deserialization
- [ ] Camera controls responsiveness
- [ ] Performance benchmarks

#### Step 4: Validation
- [ ] Cross-browser testing
- [ ] Mobile device compatibility
- [ ] File loading/saving functionality
- [ ] Memory usage patterns

## Risk Assessment

### Low Risk (Recommended: r150)
- **Migration effort**: 1-2 days
- **Breaking changes**: Minimal beyond ES6 imports
- **Testing scope**: Standard regression testing
- **Rollback complexity**: Simple version revert

### Medium Risk (Consider: r179)
- **Migration effort**: 3-5 days
- **Breaking changes**: Lighting system adjustments needed
- **Testing scope**: Extended lighting and rendering validation
- **Rollback complexity**: May require lighting reconfiguration

## Long-term Maintenance Strategy

### Version Management
1. **Pin exact versions** in package.json
2. **Monthly review** of Three.js releases for critical security/bug fixes
3. **Quarterly evaluation** of major feature updates
4. **Annual major upgrade** planning cycle

### Monitoring
- Watch GitHub releases for breaking changes
- Follow Three.js forum for community-reported issues
- Monitor browser compatibility changes
- Track performance regression reports

## Conclusion

**For immediate production deployment**: Upgrade to **Three.js r150**
- Provides 22 releases of improvements over r128
- Avoids major lighting system changes in r155+
- Manageable migration scope
- Good long-term stability foundation

**Migration timeline**: 1-2 development days + thorough testing
**Risk level**: Low to medium
**Long-term benefits**: Significant improvement in stability and performance over r128

The ES6 module migration is the primary effort, but it future-proofs the application and aligns with modern JavaScript practices. The r150 target provides an excellent balance of improvements without introducing complex lighting system migrations.

## References

- [Three.js Official Releases](https://github.com/mrdoob/three.js/releases)
- [Three.js Migration Guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide)
- [Three.js NPM Package](https://www.npmjs.com/package/three)
- [Three.js Official Documentation](https://threejs.org/docs/)
# Supabase Research: Native Three.js Scene Serialization Integration

## Requirements Analysis

### Core Requirements
- Native Three.js ObjectLoader/toJSON() serialization (r128)
- Clean Supabase integration without custom bridges
- Efficient handling of scene JSON + binary assets (GLB, textures)
- Production-ready performance for complex 3D scenes
- Maintain separation of concerns between Three.js and Supabase

### Data Flow Patterns
- Scene creation/modification in Three.js
- Native JSON serialization via toJSON()
- Storage and retrieval through Supabase
- Asset relationship management
- Cross-device scene synchronization

## Supabase Capabilities Research

### Storage vs Database for Scene JSON

**Supabase Storage (Recommended for Scene JSON)**
```javascript
// Native Three.js serialization
const sceneData = scene.toJSON();

// Direct storage without transformation
const { data, error } = await supabase.storage
  .from('scenes')
  .upload(`user-scenes/${userId}/${sceneId}.json`, JSON.stringify(sceneData), {
    contentType: 'application/json',
    cacheControl: '3600'
  });
```

**Benefits:**
- No size limitations (PostgreSQL JSONB has practical limits)
- Optimized for large JSON structures
- Built-in CDN delivery
- Versioning support
- Direct URL access for Three.js ObjectLoader

**PostgreSQL JSONB (Not Recommended for Full Scenes)**
```sql
-- JSONB better suited for scene metadata only
CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  metadata JSONB, -- Small metadata only
  scene_url TEXT, -- Reference to Storage file
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Asset Strategy - Hybrid Approach

**Database Schema:**
```sql
-- Scene registry with metadata
CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  scene_json_url TEXT NOT NULL, -- Storage path to Three.js JSON
  thumbnail_url TEXT,
  metadata JSONB, -- Search-friendly data only
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Asset registry for dependency tracking
CREATE TABLE scene_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL, -- 'glb', 'texture', 'canvas'
  asset_url TEXT NOT NULL, -- Storage path
  asset_name TEXT,
  file_size BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Row Level Security:**
```sql
-- Scene access control
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own scenes" ON scenes
  FOR ALL USING (auth.uid() = user_id);

-- Asset access control
ALTER TABLE scene_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage assets for their scenes" ON scene_assets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM scenes 
      WHERE id = scene_assets.scene_id 
      AND user_id = auth.uid()
    )
  );
```

## Recommended Architecture

### 1. Native Three.js Serialization Pattern

```javascript
// scene-persistence.js - Native Three.js integration
class NativeScenePersistence {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.objectLoader = new THREE.ObjectLoader();
  }

  // Save scene using native Three.js serialization
  async saveScene(scene, sceneName, metadata = {}) {
    try {
      // Native Three.js JSON serialization
      const sceneData = scene.toJSON();
      
      // Generate scene ID
      const sceneId = crypto.randomUUID();
      const userId = (await this.supabase.auth.getUser()).data.user?.id;
      
      // Store JSON in Supabase Storage
      const jsonPath = `scenes/${userId}/${sceneId}.json`;
      const { error: storageError } = await this.supabase.storage
        .from('user-content')
        .upload(jsonPath, JSON.stringify(sceneData, null, 2), {
          contentType: 'application/json',
          cacheControl: '3600'
        });
      
      if (storageError) throw storageError;
      
      // Create database record
      const { data: sceneRecord, error: dbError } = await this.supabase
        .from('scenes')
        .insert({
          id: sceneId,
          name: sceneName,
          scene_json_url: jsonPath,
          metadata: {
            ...metadata,
            objectCount: this.countObjects(scene),
            hasLighting: this.hasLighting(scene)
          }
        })
        .select()
        .single();
      
      if (dbError) throw dbError;
      
      return sceneRecord;
      
    } catch (error) {
      console.error('Scene save failed:', error);
      throw error;
    }
  }

  // Load scene using native Three.js ObjectLoader
  async loadScene(sceneId) {
    try {
      // Get scene record
      const { data: sceneRecord, error: dbError } = await this.supabase
        .from('scenes')
        .select('*')
        .eq('id', sceneId)
        .single();
      
      if (dbError) throw dbError;
      
      // Get JSON from storage
      const { data: jsonData, error: storageError } = await this.supabase.storage
        .from('user-content')
        .download(sceneRecord.scene_json_url);
      
      if (storageError) throw storageError;
      
      // Parse and load with native ObjectLoader
      const jsonText = await jsonData.text();
      const sceneData = JSON.parse(jsonText);
      
      // Native Three.js deserialization
      const loadedScene = this.objectLoader.parse(sceneData);
      
      return {
        scene: loadedScene,
        metadata: sceneRecord
      };
      
    } catch (error) {
      console.error('Scene load failed:', error);
      throw error;
    }
  }
  
  // Helper methods
  countObjects(scene) {
    let count = 0;
    scene.traverse(() => count++);
    return count;
  }
  
  hasLighting(scene) {
    let hasLights = false;
    scene.traverse((child) => {
      if (child.isLight) hasLights = true;
    });
    return hasLights;
  }
}
```

### 2. Asset Relationship Management

```javascript
// asset-manager.js - Handle GLB and texture assets
class SceneAssetManager {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  // Upload and register scene assets
  async uploadSceneAsset(sceneId, file, assetType) {
    const userId = (await this.supabase.auth.getUser()).data.user?.id;
    const assetPath = `assets/${userId}/${sceneId}/${file.name}`;
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await this.supabase.storage
      .from('user-content')
      .upload(assetPath, file, {
        cacheControl: '3600'
      });
    
    if (uploadError) throw uploadError;
    
    // Register in database
    const { data: assetRecord, error: dbError } = await this.supabase
      .from('scene_assets')
      .insert({
        scene_id: sceneId,
        asset_type: assetType,
        asset_url: assetPath,
        asset_name: file.name,
        file_size: file.size
      })
      .select()
      .single();
    
    if (dbError) throw dbError;
    
    // Return public URL for Three.js loading
    const { data: publicUrl } = this.supabase.storage
      .from('user-content')
      .getPublicUrl(assetPath);
    
    return {
      asset: assetRecord,
      publicUrl: publicUrl.publicUrl
    };
  }

  // Get all assets for a scene
  async getSceneAssets(sceneId) {
    const { data: assets, error } = await this.supabase
      .from('scene_assets')
      .select('*')
      .eq('scene_id', sceneId);
    
    if (error) throw error;
    
    // Add public URLs
    return assets.map(asset => ({
      ...asset,
      publicUrl: this.supabase.storage
        .from('user-content')
        .getPublicUrl(asset.asset_url).data.publicUrl
    }));
  }
}
```

### 3. Complete Integration Example

```javascript
// Complete usage example
class SceneManager {
  constructor() {
    this.supabase = window.supabase; // Assumes global Supabase client
    this.persistence = new NativeScenePersistence(this.supabase);
    this.assetManager = new SceneAssetManager(this.supabase);
  }

  async saveCurrentScene(sceneName) {
    try {
      // Save scene JSON natively
      const sceneRecord = await this.persistence.saveScene(
        window.scene, 
        sceneName,
        {
          appVersion: '1.0',
          threeVersion: THREE.REVISION
        }
      );

      // Upload any new assets (example: canvas textures)
      await this.saveCanvasTextures(sceneRecord.id);
      
      return sceneRecord;
      
    } catch (error) {
      console.error('Save failed:', error);
      throw error;
    }
  }

  async loadScene(sceneId) {
    try {
      // Load scene JSON natively
      const { scene: loadedScene, metadata } = await this.persistence.loadScene(sceneId);
      
      // Replace current scene
      window.scene.clear();
      loadedScene.children.forEach(child => {
        window.scene.add(child);
      });
      
      // Load associated assets
      const assets = await this.assetManager.getSceneAssets(sceneId);
      await this.restoreAssets(assets);
      
      return metadata;
      
    } catch (error) {
      console.error('Load failed:', error);
      throw error;
    }
  }

  async saveCanvasTextures(sceneId) {
    // Convert canvas to blob and save
    if (window.canvas) {
      const blob = await new Promise(resolve => 
        window.canvas.toBlob(resolve, 'image/png')
      );
      
      await this.assetManager.uploadSceneAsset(
        sceneId, 
        new File([blob], 'canvas-texture.png'), 
        'canvas'
      );
    }
  }

  async restoreAssets(assets) {
    for (const asset of assets) {
      if (asset.asset_type === 'canvas') {
        await this.loadCanvasTexture(asset.publicUrl);
      }
    }
  }

  async loadCanvasTexture(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const ctx = window.canvas.getContext('2d');
      ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
      ctx.drawImage(img, 0, 0);
      
      // Trigger texture update
      if (window.canvasTexture) {
        window.canvasTexture.needsUpdate = true;
      }
    };
    img.src = url;
  }
}
```

## Integration Strategy

### Frontend Integration
```javascript
// Initialize in main.js
window.sceneManager = new SceneManager();

// Save scene
document.getElementById('save-scene').addEventListener('click', async () => {
  const sceneName = prompt('Scene name:');
  if (sceneName) {
    try {
      await window.sceneManager.saveCurrentScene(sceneName);
      alert('Scene saved successfully!');
    } catch (error) {
      alert('Save failed: ' + error.message);
    }
  }
});

// Load scene
async function loadScene(sceneId) {
  try {
    await window.sceneManager.loadScene(sceneId);
    alert('Scene loaded successfully!');
  } catch (error) {
    alert('Load failed: ' + error.message);
  }
}
```

### Authentication Integration
```javascript
// Ensure user is authenticated before scene operations
class AuthenticatedSceneManager extends SceneManager {
  async ensureAuthenticated() {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be logged in to save/load scenes');
    }
    return user;
  }

  async saveCurrentScene(sceneName) {
    await this.ensureAuthenticated();
    return super.saveCurrentScene(sceneName);
  }

  async loadScene(sceneId) {
    await this.ensureAuthenticated();
    return super.loadScene(sceneId);
  }
}
```

## Implementation Plan

### Phase 1: Core Integration
1. Set up Supabase Storage bucket for scene data
2. Create database schema for scene registry
3. Implement NativeScenePersistence class
4. Test basic save/load with Three.js ObjectLoader

### Phase 2: Asset Management
1. Implement SceneAssetManager for binary assets
2. Add canvas texture serialization
3. Test GLB file association and loading
4. Implement asset cleanup on scene deletion

### Phase 3: Production Features
1. Add scene versioning and history
2. Implement scene sharing and permissions
3. Add thumbnail generation
4. Performance optimization and caching

### Phase 4: Advanced Features
1. Real-time collaborative editing
2. Scene templates and presets
3. Asset optimization and compression
4. Advanced search and filtering

## Code Examples & Patterns

### Supabase Storage Configuration
```javascript
// Storage bucket setup (run once in Supabase dashboard or via SQL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-content', 'user-content', true);

-- Storage policies
CREATE POLICY "Users can upload their own content" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-content' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own content" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'user-content' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

### Three.js ObjectLoader Error Handling
```javascript
// Robust loading with error recovery
async loadSceneWithFallback(sceneId) {
  try {
    return await this.persistence.loadScene(sceneId);
  } catch (error) {
    console.error('Scene load failed:', error);
    
    // Attempt to recover scene structure
    if (error.message.includes('parse')) {
      // JSON parsing failed - corrupted data
      throw new Error('Scene data corrupted - cannot recover');
    }
    
    if (error.message.includes('ObjectLoader')) {
      // Three.js loading failed - version mismatch?
      console.warn('ObjectLoader failed, attempting manual reconstruction');
      return await this.reconstructSceneManually(sceneId);
    }
    
    throw error;
  }
}
```

### Performance Optimization
```javascript
// Large scene handling
async saveSceneOptimized(scene, sceneName) {
  // Check scene size before serialization
  const objectCount = this.countObjects(scene);
  
  if (objectCount > 1000) {
    console.warn('Large scene detected, optimizing...');
    
    // Option 1: Split into multiple files
    return await this.saveSceneChunked(scene, sceneName);
    
    // Option 2: Compress JSON
    const sceneData = JSON.stringify(scene.toJSON());
    const compressed = await this.compressJSON(sceneData);
    
    // Upload compressed version
    const { error } = await this.supabase.storage
      .from('user-content')
      .upload(jsonPath, compressed, {
        contentType: 'application/json',
        contentEncoding: 'gzip'
      });
  } else {
    // Standard save for smaller scenes
    return await this.persistence.saveScene(scene, sceneName);
  }
}
```

## References

### Three.js Documentation
- [ObjectLoader](https://threejs.org/docs/#api/en/loaders/ObjectLoader)
- [Object3D.toJSON()](https://threejs.org/docs/#api/en/core/Object3D.toJSON)
- [Scene serialization examples](https://threejs.org/examples/?q=loader)

### Supabase Documentation
- [Storage API](https://supabase.com/docs/reference/javascript/storage)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [JSONB vs Storage decision guide](https://supabase.com/docs/guides/database/json)

### Community Examples
- [Three.js Scene Persistence Patterns](https://discourse.threejs.org/c/questions/9)
- [Supabase + Three.js Integration Examples](https://github.com/supabase/supabase/discussions)

### Performance Resources
- [Three.js Performance Best Practices](https://threejs.org/docs/#manual/en/introduction/Performance)
- [Supabase Storage Performance](https://supabase.com/docs/guides/storage/performance)

---

# IMPLEMENTATION COMPLETE - ISSUES AND SOLUTIONS LOG

## Overview

This document has been updated with the actual implementation experience of integrating Three.js native serialization with Supabase. The following sections document the real issues encountered and their solutions.

## Implementation Timeline and Issues

### Phase 1: Schema Migration (Completed)
- **Issue**: Legacy JSONB columns (scene_data, camera_data, lighting_data) needed removal
- **Solution**: Added scene_json_url column for Storage references
- **Status**: ✅ Complete

### Phase 2: Authentication Integration Issues

#### Issue 1: "You must be logged in to save designs" Error
- **Root Cause**: SavedSceneManager not properly initialized with SceneSerializationManager
- **Solution**: Fixed constructor in saved-scene-manager.js to create SceneSerializationManager instance
- **Code Fix**: Added `this.serializer = new SceneSerializationManager(supabase);`
- **Status**: ✅ Fixed

#### Issue 2: Missing Script Dependencies
- **Root Cause**: saved-scene-manager.js not loaded in index.html
- **Solution**: Added script tag to index.html
- **Impact**: Prevented SavedDesignsUI from finding SavedSceneManager
- **Status**: ✅ Fixed

#### Issue 3: Duplicate ResourceTracker Class
- **Root Cause**: ResourceTracker class defined in both resource-tracker.js and scene-serialization-manager.js
- **Solution**: Removed duplicate from scene-serialization-manager.js
- **Status**: ✅ Fixed

### Phase 3: Storage RLS Policy Issues

#### Issue 1: Storage Objects Policy
- **Root Cause**: Policy checking wrong array index for user ID validation
- **Error**: `(storage.foldername(name))[1]` checking "scenes" instead of user ID
- **Solution**: Changed to `(storage.foldername(name))[2]` for correct user ID validation
- **Status**: ✅ Fixed

#### Issue 2: Database Scenes Table Policy
- **Root Cause**: INSERT statement missing required user_id field
- **Error**: RLS policy `(user_id = auth.uid())` failing due to NULL user_id
- **Solution**: Added `user_id: user.id` to INSERT statement
- **Status**: ✅ Fixed

### Phase 4: Method Compatibility Issues

#### Issue 1: Incorrect Layer Manager Method
- **Root Cause**: Calling `clearAllLayers()` instead of `clearLayers()`
- **Solution**: Updated all references to use correct method name
- **Status**: ✅ Fixed

#### Issue 2: TransformControls Method Missing
- **Root Cause**: Calling non-existent `detach()` method on transformControlsManager
- **Solution**: Use selection system's `deselectAll()` method instead
- **Status**: ✅ Fixed

### Phase 5: Loading System Integration

#### Issue 1: Legacy Loading System Still Active
- **Root Cause**: SavedSceneManager using old custom loading instead of SceneSerializationManager
- **Solution**: Updated SavedSceneManager.loadScene() to delegate to SceneSerializationManager
- **Impact**: Now uses Three.js native ObjectLoader for proper scene restoration
- **Status**: ✅ Fixed

#### Issue 2: Syntax Errors from Incomplete Code Removal
- **Root Cause**: Partial removal of legacy code left orphaned catch blocks
- **Solution**: Completely removed legacy loading methods
- **Status**: ✅ Fixed

## Current Status: Functional with Three.js Native Serialization

### Working Features
✅ **Saving**: Uses Three.js scene.toJSON() with Supabase Storage backend  
✅ **Loading**: Uses Three.js ObjectLoader.parse() for proper scene restoration  
✅ **Authentication**: Properly integrated with both AuthManager and Supabase auth  
✅ **Storage**: Files stored as JSON in Supabase Storage with proper RLS policies  
✅ **Resource Management**: Proper disposal and cleanup during scene operations  

### Scene Loading Success Indicators
- "✅ Added 105 restored objects to scene" - Objects properly restored
- Selection system finds objects after load
- Transform controls properly attach to loaded objects
- Canvas textures and layers restore correctly

### Remaining Optimizations
- Performance monitoring during large scene loads
- Texture resolution optimization for loaded scenes
- Selection state persistence improvements

## Architecture Changes Made

### File Structure Updates
- **scene-serialization-manager.js**: New Three.js native serialization system
- **saved-scene-manager.js**: Updated to delegate to SerializationManager
- **saved-designs-ui.js**: Authentication logic simplified
- **index.html**: Added missing script dependencies

### Database Schema
```sql
-- New Storage-based approach
scenes table:
- scene_json_url (references Supabase Storage)
- Removed: scene_data, camera_data, lighting_data (JSONB)

-- Storage bucket: 'user-scenes'
-- Path pattern: scenes/{user_id}/{scene_id}.json
```

### RLS Policies Fixed
```sql
-- Storage INSERT policy (corrected)
auth.uid()::text = (storage.foldername(name))[2]

-- Scenes table INSERT policy
user_id = auth.uid()
```

## Testing Results

### Scene Save/Load Cycle
1. **Save**: Three.js scene.toJSON() → Supabase Storage → Database metadata ✅
2. **Load**: Database lookup → Storage download → ObjectLoader.parse() → Scene restoration ✅
3. **Selection**: Loaded objects properly selectable and manipulatable ✅
4. **Transform**: TransformControls attach correctly to loaded objects ✅

### Performance
- Large scenes (100+ objects) load successfully
- Proper resource disposal prevents memory leaks
- Canvas texture pipeline maintains performance

## Lessons Learned

1. **Authentication Flow**: Multiple auth systems require careful coordination
2. **Method Compatibility**: API changes need thorough compatibility checking
3. **Resource Management**: Three.js ObjectLoader requires proper disposal patterns
4. **RLS Policies**: Storage path structure must match policy validation logic
5. **Dependency Loading**: Script load order critical for system initialization

## Next Steps for Future Development

1. **Performance Optimization**: Monitor large scene loading performance
2. **Error Recovery**: Improve error handling for corrupted scene files
3. **Version Management**: Add scene versioning for backward compatibility
4. **Asset Management**: Optimize texture and asset loading pipeline

---

**Status**: Three.js native serialization integration completed and functional  
**Performance**: Good for typical scenes, monitoring large scene performance  
**Stability**: All major integration issues resolved  

## Conclusion

The recommended approach leverages native Three.js serialization with Supabase Storage for JSON data and the database for metadata and relationships. This pattern:

1. **Avoids custom bridges** - Uses Three.js ObjectLoader directly
2. **Follows Supabase best practices** - Separates large data (Storage) from queryable metadata (Database)  
3. **Maintains clean separation** - Three.js handles serialization, Supabase handles persistence
4. **Scales efficiently** - No size limits, proper asset management
5. **Production-ready** - Includes auth, RLS, and error handling

This architecture provides a solid foundation for native Three.js scene persistence in BuilderProto.
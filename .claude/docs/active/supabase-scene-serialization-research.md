# Supabase Research: Three.js Scene Serialization System

## Requirements Analysis

### Feature Requirements Overview
- **Scene Persistence**: Store complete Three.js scenes with all components (models, textures, lighting, camera)
- **Asset Management**: Handle large binary assets (GLB files, textures) efficiently
- **User Ownership**: Multi-tenant system with user authentication and scene ownership
- **Collaboration**: Scene sharing and collaborative editing capabilities
- **Version Control**: History tracking and versioning for scene changes
- **Performance**: Fast loading, minimal data transfer, optimized queries
- **Real-time Updates**: Support for live collaborative editing

### Data Flow and User Interaction Patterns
- **Scene Creation**: User creates new scene → generates UUID → stores metadata + serialized data
- **Asset Upload**: User uploads GLB/textures → Storage bucket → metadata in database
- **Scene Loading**: Query scene metadata → fetch assets → deserialize Three.js objects
- **Collaboration**: Multiple users editing → real-time updates → conflict resolution
- **Version History**: Track changes → create snapshots → enable rollback

### Security and Performance Considerations
- **RLS Policies**: User-based access control for scenes and assets
- **Asset Security**: Secure storage with controlled access to binary files
- **Query Optimization**: Efficient loading of scene metadata without heavy assets
- **Bandwidth Management**: Progressive loading of assets, compression strategies
- **Scalability**: Design for thousands of scenes per user, large file handling

## Supabase Capabilities Research

### Database (PostgreSQL) Features
- **JSONB Support**: Native JSON storage for Three.js serialized data with indexing
- **UUID Primary Keys**: Built-in UUID generation for distributed systems
- **Foreign Key Relationships**: Maintain referential integrity across tables
- **Indexes**: Composite indexes for performance on user-scene queries
- **Triggers**: Automatic timestamp updates, cleanup operations

### Storage Service
- **Bucket Organization**: Hierarchical storage with user-based paths
- **File Size Limits**: 50MB per file (suitable for most GLB assets)
- **CDN Integration**: Global distribution for fast asset delivery
- **Access Control**: RLS integration with storage policies
- **Mime Type Validation**: Automatic validation for GLB, GLTF, image files

### Authentication Integration
- **User Management**: Built-in user system with email/password
- **Session Handling**: JWT tokens with automatic renewal
- **Role-Based Access**: Custom claims for advanced permissions
- **Social Auth**: Optional GitHub, Google integration for collaboration

### Real-time Subscriptions
- **Scene Updates**: Live notifications when scenes change
- **Presence Tracking**: Who's currently editing a scene
- **Collaborative Cursors**: Real-time position tracking for collaboration
- **Change Streams**: Delta updates for efficient synchronization

## Recommended Architecture

### Database Schema Design

```sql
-- Users table (provided by Supabase Auth)
-- auth.users contains: id, email, created_at, etc.

-- Scenes table - Core scene metadata
CREATE TABLE scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT, -- Storage URL for scene thumbnail
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Scene configuration
    canvas_resolution INTEGER DEFAULT 1024,
    lighting_preset TEXT DEFAULT 'studio',
    
    -- Serialized Three.js data (compressed)
    scene_data JSONB NOT NULL,
    camera_data JSONB NOT NULL,
    lighting_data JSONB NOT NULL,
    
    -- Performance metadata
    asset_count INTEGER DEFAULT 0,
    total_file_size BIGINT DEFAULT 0,
    
    -- Version tracking
    version_number INTEGER DEFAULT 1,
    parent_version_id UUID REFERENCES scenes(id)
);

-- Scene assets table - Track all binary assets
CREATE TABLE scene_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Asset metadata
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('glb', 'gltf', 'texture', 'image')),
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    
    -- Storage reference
    storage_path TEXT NOT NULL UNIQUE, -- Path in Supabase Storage
    storage_bucket TEXT DEFAULT 'scene-assets',
    
    -- Usage tracking
    reference_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Asset metadata for 3D files
    model_metadata JSONB, -- Vertex count, material count, etc.
    
    UNIQUE(scene_id, name)
);

-- Scene materials table - Track material definitions
CREATE TABLE scene_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Material identification
    material_name TEXT NOT NULL,
    material_uuid TEXT, -- Three.js UUID
    
    -- Material properties
    material_data JSONB NOT NULL, -- Color, roughness, metalness, etc.
    
    -- Texture references
    texture_assets UUID[] DEFAULT '{}', -- Array of asset IDs
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(scene_id, material_name)
);

-- Canvas layers table - UV-based layer system
CREATE TABLE canvas_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Layer properties
    layer_name TEXT NOT NULL,
    z_order INTEGER NOT NULL DEFAULT 0,
    visible BOOLEAN DEFAULT true,
    opacity REAL DEFAULT 1.0,
    
    -- UV positioning (0-1 coordinates)
    uv_x REAL NOT NULL DEFAULT 0,
    uv_y REAL NOT NULL DEFAULT 0,
    uv_width REAL NOT NULL DEFAULT 1,
    uv_height REAL NOT NULL DEFAULT 1,
    
    -- Image asset reference
    image_asset_id UUID REFERENCES scene_assets(id) ON DELETE CASCADE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(scene_id, layer_name)
);

-- Scene sharing table - Collaboration features
CREATE TABLE scene_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_with_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Permission levels
    permission_level TEXT NOT NULL CHECK (permission_level IN ('view', 'edit', 'admin')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    UNIQUE(scene_id, shared_with_id)
);

-- Scene history table - Version control
CREATE TABLE scene_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Version metadata
    version_number INTEGER NOT NULL,
    change_description TEXT,
    
    -- Snapshot data (compressed JSONB)
    scene_snapshot JSONB NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(scene_id, version_number)
);
```

### Storage Organization Strategy

```
scene-assets/
├── {user_id}/
│   ├── scenes/
│   │   ├── {scene_id}/
│   │   │   ├── models/
│   │   │   │   ├── main.glb
│   │   │   │   └── detail-{uuid}.gltf
│   │   │   ├── textures/
│   │   │   │   ├── base-texture.jpg
│   │   │   │   └── normal-map.png
│   │   │   ├── canvas/
│   │   │   │   └── layers/
│   │   │   │       ├── layer-1.png
│   │   │   │       └── layer-2.jpg
│   │   │   └── thumbnails/
│   │   │       ├── scene-thumb.jpg
│   │   │       └── preview-{timestamp}.jpg
│   │   └── shared/
│   │       └── {shared_scene_id}/ (symlinks or references)
│   └── temp/
│       └── uploads/ (temporary upload location)
```

### Row Level Security Policies

```sql
-- Scenes RLS Policies
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;

-- Users can view their own scenes and shared scenes
CREATE POLICY "Users can view own scenes" ON scenes
    FOR SELECT USING (
        user_id = auth.uid() OR 
        is_public = true OR
        id IN (
            SELECT scene_id FROM scene_shares 
            WHERE shared_with_id = auth.uid()
        )
    );

-- Users can only create scenes for themselves
CREATE POLICY "Users can create own scenes" ON scenes
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own scenes or shared scenes with edit permission
CREATE POLICY "Users can update own or shared scenes" ON scenes
    FOR UPDATE USING (
        user_id = auth.uid() OR
        id IN (
            SELECT scene_id FROM scene_shares 
            WHERE shared_with_id = auth.uid() 
            AND permission_level IN ('edit', 'admin')
        )
    );

-- Users can delete their own scenes
CREATE POLICY "Users can delete own scenes" ON scenes
    FOR DELETE USING (user_id = auth.uid());

-- Scene Assets RLS Policies
ALTER TABLE scene_assets ENABLE ROW LEVEL SECURITY;

-- Users can view assets for scenes they have access to
CREATE POLICY "Users can view accessible scene assets" ON scene_assets
    FOR SELECT USING (
        user_id = auth.uid() OR
        scene_id IN (
            SELECT id FROM scenes WHERE 
            user_id = auth.uid() OR 
            is_public = true OR
            id IN (SELECT scene_id FROM scene_shares WHERE shared_with_id = auth.uid())
        )
    );

-- Similar policies for other tables...
```

### Storage Security Policies

```sql
-- Storage bucket policies for scene-assets
CREATE POLICY "Users can view own scene assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'scene-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload to own folder" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'scene-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own assets" ON storage.objects
    FOR UPDATE USING (bucket_id = 'scene-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own assets" ON storage.objects
    FOR DELETE USING (bucket_id = 'scene-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## Integration Strategy

### Frontend Integration Patterns

#### Scene Serialization Approach
```javascript
// Three.js scene serialization for storage
class SceneSerializer {
    static async serializeScene(scene, camera, lights) {
        const sceneData = {
            objects: [],
            materials: {},
            textures: {},
            version: '1.0'
        };
        
        // Serialize objects with asset references
        scene.traverse((object) => {
            if (object.isMesh) {
                sceneData.objects.push({
                    uuid: object.uuid,
                    name: object.name,
                    type: 'Mesh',
                    position: object.position.toArray(),
                    rotation: object.rotation.toArray(),
                    scale: object.scale.toArray(),
                    geometry: this.serializeGeometry(object.geometry),
                    material: this.serializeMaterial(object.material),
                    visible: object.visible,
                    castShadow: object.castShadow,
                    receiveShadow: object.receiveShadow
                });
            }
        });
        
        return {
            scene_data: sceneData,
            camera_data: this.serializeCamera(camera),
            lighting_data: this.serializeLights(lights)
        };
    }
    
    static serializeMaterial(material) {
        // Return asset reference instead of full material data
        return {
            uuid: material.uuid,
            type: material.type,
            assetRef: material.userData.assetRef || null
        };
    }
}
```

#### Asset Upload Strategy
```javascript
class AssetUploader {
    static async uploadSceneAsset(file, sceneId, assetType) {
        const { data: { user } } = await supabase.auth.getUser();
        const fileName = `${Date.now()}-${file.name}`;
        const storagePath = `${user.id}/scenes/${sceneId}/${assetType}s/${fileName}`;
        
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('scene-assets')
            .upload(storagePath, file);
            
        if (error) throw error;
        
        // Store metadata in database
        const { data: assetRecord, error: dbError } = await supabase
            .from('scene_assets')
            .insert({
                scene_id: sceneId,
                user_id: user.id,
                name: file.name,
                asset_type: assetType,
                file_size: file.size,
                mime_type: file.type,
                storage_path: storagePath
            })
            .select()
            .single();
            
        return assetRecord;
    }
}
```

### Authentication Flow Design
```javascript
class SceneManager {
    constructor() {
        this.supabase = supabase;
        this.currentScene = null;
        this.user = null;
        
        this.initAuth();
    }
    
    async initAuth() {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) {
            this.user = session.user;
            await this.loadUserScenes();
        }
        
        // Listen for auth changes
        this.supabase.auth.onAuthStateChange((event, session) => {
            this.user = session?.user || null;
            if (event === 'SIGNED_IN') {
                this.loadUserScenes();
            } else if (event === 'SIGNED_OUT') {
                this.clearScenes();
            }
        });
    }
}
```

### Error Handling and Validation
```javascript
class SceneValidator {
    static validateSceneData(sceneData) {
        const errors = [];
        
        if (!sceneData.scene_data || typeof sceneData.scene_data !== 'object') {
            errors.push('Invalid scene data format');
        }
        
        if (!sceneData.camera_data) {
            errors.push('Missing camera data');
        }
        
        // Validate asset references
        if (sceneData.scene_data.objects) {
            sceneData.scene_data.objects.forEach((obj, index) => {
                if (!obj.uuid) {
                    errors.push(`Object ${index} missing UUID`);
                }
            });
        }
        
        return errors;
    }
    
    static validateAssetFile(file, assetType) {
        const maxSize = 50 * 1024 * 1024; // 50MB
        const allowedTypes = {
            'glb': ['model/gltf-binary'],
            'gltf': ['model/gltf+json'],
            'texture': ['image/jpeg', 'image/png', 'image/webp'],
            'image': ['image/jpeg', 'image/png', 'image/webp']
        };
        
        if (file.size > maxSize) {
            throw new Error(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
        }
        
        if (!allowedTypes[assetType]?.includes(file.type)) {
            throw new Error(`Invalid file type for ${assetType}`);
        }
    }
}
```

### Performance Optimization Techniques
```javascript
// Progressive loading strategy
class SceneLoader {
    static async loadScene(sceneId, progressCallback) {
        try {
            // 1. Load scene metadata (lightweight)
            progressCallback({ step: 'metadata', progress: 10 });
            const scene = await this.loadSceneMetadata(sceneId);
            
            // 2. Load critical assets first (GLB models)
            progressCallback({ step: 'models', progress: 30 });
            const models = await this.loadModels(scene);
            
            // 3. Load textures (can be done progressively)
            progressCallback({ step: 'textures', progress: 60 });
            const textures = await this.loadTextures(scene);
            
            // 4. Load canvas layers (lowest priority)
            progressCallback({ step: 'layers', progress: 80 });
            const layers = await this.loadCanvasLayers(scene);
            
            progressCallback({ step: 'complete', progress: 100 });
            
            return { scene, models, textures, layers };
        } catch (error) {
            progressCallback({ step: 'error', error: error.message });
            throw error;
        }
    }
    
    static async loadSceneMetadata(sceneId) {
        const { data, error } = await supabase
            .from('scenes')
            .select(`
                id, name, description, canvas_resolution, lighting_preset,
                scene_data, camera_data, lighting_data,
                created_at, updated_at, version_number
            `)
            .eq('id', sceneId)
            .single();
            
        if (error) throw error;
        return data;
    }
}
```

## Implementation Plan

### Step 1: Database Setup
1. **Create tables** using the schema definitions above
2. **Set up RLS policies** for secure multi-tenant access
3. **Create indexes** for performance optimization
4. **Set up storage buckets** with appropriate policies
5. **Test basic CRUD operations** with sample data

### Step 2: Asset Management System
1. **Implement asset upload** with validation and compression
2. **Create asset reference system** for scene serialization
3. **Set up CDN caching** for frequently accessed assets
4. **Implement cleanup routines** for orphaned assets
5. **Test with real GLB files** and texture uploads

### Step 3: Scene Serialization
1. **Develop serialization utilities** for Three.js objects
2. **Implement compression** for large scene data
3. **Create versioning system** with delta tracking
4. **Add thumbnail generation** for scene previews
5. **Test serialization/deserialization** round-trips

### Step 4: Collaboration Features
1. **Set up real-time subscriptions** for scene changes
2. **Implement sharing system** with permission levels
3. **Add presence tracking** for active editors
4. **Create conflict resolution** for concurrent edits
5. **Test multi-user scenarios** with sample scenes

### Step 5: Performance Optimization
1. **Add database indexes** based on query patterns
2. **Implement caching strategies** for frequent queries
3. **Optimize asset loading** with progressive strategies
4. **Add monitoring** for query performance
5. **Load test** with realistic data volumes

## Code Examples & Patterns

### Database Queries with Supabase SDK

```javascript
// Create new scene
async function createScene(sceneData) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
        .from('scenes')
        .insert({
            user_id: user.id,
            name: sceneData.name,
            description: sceneData.description,
            scene_data: sceneData.serializedScene,
            camera_data: sceneData.cameraData,
            lighting_data: sceneData.lightingData,
            canvas_resolution: sceneData.canvasResolution || 1024
        })
        .select()
        .single();
        
    if (error) throw error;
    return data;
}

// Load scene with assets
async function loadSceneWithAssets(sceneId) {
    const { data: scene, error: sceneError } = await supabase
        .from('scenes')
        .select(`
            *,
            scene_assets (
                id, name, asset_type, storage_path, file_size
            ),
            canvas_layers (
                id, layer_name, z_order, visible, opacity,
                uv_x, uv_y, uv_width, uv_height,
                image_asset_id
            )
        `)
        .eq('id', sceneId)
        .single();
        
    if (sceneError) throw sceneError;
    return scene;
}

// Share scene with another user
async function shareScene(sceneId, userEmail, permissionLevel) {
    // First, find the user by email
    const { data: users, error: userError } = await supabase.rpc(
        'get_user_by_email', 
        { user_email: userEmail }
    );
    
    if (userError || !users.length) {
        throw new Error('User not found');
    }
    
    const { data, error } = await supabase
        .from('scene_shares')
        .upsert({
            scene_id: sceneId,
            owner_id: (await supabase.auth.getUser()).data.user.id,
            shared_with_id: users[0].id,
            permission_level: permissionLevel
        });
        
    if (error) throw error;
    return data;
}
```

### Real-time Subscriptions

```javascript
class CollaborativeSceneManager {
    constructor(sceneId) {
        this.sceneId = sceneId;
        this.subscribers = new Set();
        this.setupSubscriptions();
    }
    
    setupSubscriptions() {
        // Subscribe to scene changes
        this.sceneSubscription = supabase
            .channel(`scene-${this.sceneId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'scenes',
                filter: `id=eq.${this.sceneId}`
            }, (payload) => {
                this.handleSceneUpdate(payload);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'canvas_layers',
                filter: `scene_id=eq.${this.sceneId}`
            }, (payload) => {
                this.handleLayerUpdate(payload);
            })
            .subscribe();
            
        // Subscribe to presence (who's editing)
        this.presenceChannel = supabase
            .channel(`presence-${this.sceneId}`)
            .on('presence', { event: 'sync' }, () => {
                this.updateActiveUsers();
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                this.handleUserJoined(newPresences);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                this.handleUserLeft(leftPresences);
            })
            .subscribe();
    }
    
    async trackPresence(userInfo) {
        await this.presenceChannel.track({
            user_id: userInfo.id,
            email: userInfo.email,
            cursor_position: null,
            last_active: new Date().toISOString()
        });
    }
}
```

### Asset Optimization Patterns

```javascript
class AssetOptimizer {
    static async optimizeGLBForWeb(file) {
        // For production, integrate with services like:
        // - Draco compression for geometry
        // - Texture compression (KTX2, WEBP)
        // - LOD generation
        
        // Placeholder for optimization logic
        if (file.size > 10 * 1024 * 1024) { // 10MB
            console.warn('Large GLB file detected, consider optimization');
        }
        
        return file; // Return optimized file
    }
    
    static async generateThumbnail(sceneData, size = 256) {
        // Create off-screen renderer for thumbnail generation
        const renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true 
        });
        renderer.setSize(size, size);
        
        // Render scene to canvas and convert to blob
        const canvas = renderer.domElement;
        return new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.8);
        });
    }
}
```

## References

### Supabase Documentation
- [Database Design Guide](https://supabase.com/docs/guides/database/design)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Management](https://supabase.com/docs/guides/storage)
- [Real-time Subscriptions](https://supabase.com/docs/guides/realtime)
- [Performance Optimization](https://supabase.com/docs/guides/database/performance)

### Three.js Integration Resources
- [Three.js Object3D Serialization](https://threejs.org/docs/#api/en/core/Object3D)
- [GLTF Loader Documentation](https://threejs.org/docs/#examples/en/loaders/GLTFLoader)
- [WebGL Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)

### Performance and Scaling Resources
- [PostgreSQL JSONB Performance](https://www.postgresql.org/docs/current/datatype-json.html)
- [CDN Asset Optimization](https://web.dev/optimizing-content-efficiency-optimize-encoding-and-transfer/)
- [WebGL Memory Management](https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects)

### Security Best Practices
- [Supabase Security Checklist](https://supabase.com/docs/guides/security/checklist)
- [File Upload Security](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [JWT Token Security](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
# Three.js Research: Phase 6 Scene State Management and Persistence

## Problem Analysis

Phase 6 requires implementing comprehensive scene serialization and persistence for the TigerBuilder GLB Scene Editor. The current system has basic JSON serialization but needs enterprise-level state management supporting:

### Technical Challenge Overview
- **High-Resolution Canvas Textures**: 1024x1024 canvas textures create large DataURLs (~4MB each)
- **Complex Layer System State**: Layer-based editing with selections, transformations, and drawing data
- **Multi-Panel UI State**: Collapsible UI panels with custom sizing and configurations
- **GLB Model Data**: Binary GLB files embedded as base64 create massive JSON files
- **Browser Storage Limits**: localStorage ~5MB vs. potential scene sizes of 10-50MB+
- **Performance Requirements**: Fast save/load without blocking the main thread

### Three.js Specific Considerations
- **Official JSON Scene Format 4.3**: Three.js provides `scene.toJSON()` and `ObjectLoader`
- **Circular Reference Issues**: Scene graph parent/child relationships create cycles
- **Canvas Texture Serialization**: `CanvasTexture` doesn't serialize with standard toJSON()
- **Material Property Variations**: Different material types have unique serializable properties
- **Performance Bottlenecks**: Large texture serialization can freeze the UI

### Performance and Storage Implications
- **Modern Browser Limits (2025)**:
  - localStorage: ~5MB (varies by browser)
  - IndexedDB: Up to 50% of disk space (persistent storage)
  - OPFS (Origin Private File System): 4x faster than IndexedDB
  - File System Access API: Direct file operations with user permission
- **Memory Usage**: Multiple texture copies during serialization
- **Network Considerations**: Large files unsuitable for cloud sync without compression

## Official Three.js Research Analysis

### Three.js JSON Scene Format 4.3 Structure
Based on official Three.js documentation:

```javascript
// Official Three.js JSON Structure
{
  "metadata": {
    "version": "4.3",
    "type": "Object", 
    "generator": "ObjectExporter"
  },
  "geometries": [...],  // BufferGeometry definitions
  "materials": [...],   // Material property definitions
  "textures": [...],    // Texture references (not data)
  "images": [...],      // Image data (DataURLs)
  "object": {           // Scene graph hierarchy
    "uuid": "...",
    "type": "Scene",
    "children": [...]
  }
}
```

### Key Limitations of Standard toJSON()
1. **Canvas Textures**: `CanvasTexture` doesn't automatically serialize canvas data
2. **Custom Materials**: User modifications to materials may not serialize completely
3. **File Size**: Standard format creates very large JSON files for textured scenes
4. **Performance**: Synchronous serialization blocks UI for large scenes

### Recommended Hybrid Approach
Combine Three.js official format with custom optimizations for TigerBuilder's specific needs.

## Recommended Architecture

### 1. Multi-Tier Storage Strategy

```javascript
// Storage tiers based on data size and persistence needs
const STORAGE_TIERS = {
  MEMORY: 'memory',           // Current session only
  LOCAL_STORAGE: 'localStorage', // < 4MB, immediate access
  INDEXED_DB: 'indexedDB',    // 4MB-1GB, structured storage  
  OPFS: 'opfs',              // > 1GB, file-like operations
  FILE_DOWNLOAD: 'download'   // User-managed files
};

function selectStorageTier(dataSize, userPreference) {
  if (dataSize < 4 * 1024 * 1024) return STORAGE_TIERS.LOCAL_STORAGE;
  if (dataSize < 1024 * 1024 * 1024) return STORAGE_TIERS.INDEXED_DB;
  return STORAGE_TIERS.OPFS;
}
```

### 2. Progressive Serialization Architecture

```javascript
// Serialize in chunks to prevent UI blocking
class ProgressiveSceneSerializer {
  async serialize(scene, options = {}) {
    const chunks = {
      metadata: this.serializeMetadata(),
      camera: this.serializeCamera(),
      lighting: this.serializeLighting(),
      objects: await this.serializeObjectsProgressively(scene),
      textures: await this.serializeTexturesProgressively(),
      ui: this.serializeUIState()
    };
    
    return this.combineChunks(chunks);
  }
  
  async serializeObjectsProgressively(scene) {
    const objects = [];
    const meshes = [];
    
    scene.traverse(obj => {
      if (obj.isMesh && obj.name) meshes.push(obj);
    });
    
    // Process in batches to avoid blocking
    for (let i = 0; i < meshes.length; i += 10) {
      const batch = meshes.slice(i, i + 10);
      const serializedBatch = batch.map(mesh => this.serializeObject(mesh));
      objects.push(...serializedBatch);
      
      // Yield control to browser
      if (i % 50 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return objects;
  }
}
```

### 3. Smart Texture Compression Strategy

```javascript
class TextureCompressionManager {
  constructor() {
    this.compressionCache = new Map();
    this.qualitySettings = {
      thumbnail: { size: 64, quality: 0.6 },
      preview: { size: 256, quality: 0.8 },
      full: { size: 1024, quality: 0.9 }
    };
  }
  
  async compressCanvasTexture(canvas, level = 'preview') {
    const cacheKey = `${canvas.width}x${canvas.height}_${level}`;
    if (this.compressionCache.has(cacheKey)) {
      return this.compressionCache.get(cacheKey);
    }
    
    const settings = this.qualitySettings[level];
    const compressed = await this.resizeAndCompress(canvas, settings);
    
    this.compressionCache.set(cacheKey, compressed);
    return compressed;
  }
  
  async resizeAndCompress(canvas, { size, quality }) {
    // Use OffscreenCanvas for better performance when available
    const targetCanvas = new OffscreenCanvas ? 
      new OffscreenCanvas(size, size) : 
      document.createElement('canvas');
      
    targetCanvas.width = size;
    targetCanvas.height = size;
    
    const ctx = targetCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, size, size);
    
    // Detect transparency for optimal format selection
    const hasAlpha = this.detectTransparency(ctx, size, size);
    const format = hasAlpha ? 'image/png' : 'image/jpeg';
    const compressedQuality = hasAlpha ? undefined : quality;
    
    return targetCanvas.convertToBlob ? 
      await targetCanvas.convertToBlob({ type: format, quality: compressedQuality }) :
      targetCanvas.toDataURL(format, compressedQuality);
  }
}
```

## File Format Design

### TigerBuilder Scene Format (TSF v3.0)

```javascript
// Optimized scene format for TigerBuilder
const SCENE_FORMAT_V3 = {
  // Header with version and compatibility info
  header: {
    version: '3.0',
    generator: 'TigerBuilder',
    compatibility: '1.0+',
    created: '2025-01-01T00:00:00.000Z',
    modified: '2025-01-01T00:00:00.000Z'
  },
  
  // Metadata for optimization and validation
  metadata: {
    totalObjects: 4,
    totalTextures: 3,
    estimatedSize: '15.2MB',
    compressionUsed: true,
    hasLayers: true,
    deviceInfo: {
      pixelRatio: window.devicePixelRatio,
      maxTextureSize: 4096,
      browser: navigator.userAgent
    }
  },
  
  // Scene configuration
  scene: {
    background: 0xf0f0f0,
    fog: null,
    environment: null
  },
  
  // Camera state with full controls
  camera: {
    type: 'PerspectiveCamera',
    position: [0, 0, 5],
    target: [0, 0, 0],  // OrbitControls target
    fov: 75,
    near: 0.1,
    far: 1000,
    zoom: 1
  },
  
  // Lighting configuration
  lighting: {
    ambient: {
      type: 'AmbientLight',
      color: 0xffffff,
      intensity: 0.85
    },
    directional: [
      {
        type: 'DirectionalLight',
        color: 0xffffff,
        intensity: 0.5,
        position: [5, 10, 5]
      }
    ],
    hemisphere: {
      type: 'HemisphereLight',
      skyColor: 0xffffff,
      groundColor: 0xf0f0f0,
      intensity: 0.6,
      position: [0, 20, 0]
    }
  },
  
  // GLB model data with optimization
  models: [
    {
      id: 'primary_model',
      name: '91x91.glb',
      data: 'data:application/octet-stream;base64,UEsDBBQ...', // Base64 GLB
      size: 2048576, // Original size in bytes
      compressed: true,
      checksum: 'sha256:abc123...' // For integrity validation
    }
  ],
  
  // Texture atlas for efficient storage
  textures: {
    // Multiple resolution levels for each texture
    'canvas_texture_1': {
      full: 'data:image/webp;base64,...',      // 1024x1024 WebP
      preview: 'data:image/jpeg;base64,...',   // 256x256 JPEG
      thumbnail: 'data:image/jpeg;base64,...'  // 64x64 JPEG
    }
  },
  
  // Layer system state
  layers: [
    {
      id: 'layer_1',
      name: 'Background',
      visible: true,
      locked: false,
      opacity: 1.0,
      blendMode: 'source-over',
      bounds: { x: 0, y: 0, width: 1024, height: 1024 },
      data: 'data:image/png;base64,...' // Layer-specific image data
    }
  ],
  
  // 3D objects with full state
  objects: [
    {
      id: 'object_1',
      name: 'Cube',
      type: 'Mesh',
      geometryType: 'BoxGeometry',
      geometryParams: [1, 1, 1],
      
      // Transform data
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0], // Euler angles
        scale: [1, 1, 1],
        matrix: null // Optional full matrix if needed
      },
      
      // Material configuration
      material: {
        type: 'MeshStandardMaterial',
        name: 'Image',
        properties: {
          color: 0xffffff,
          metalness: 0.0,
          roughness: 0.5,
          opacity: 1.0,
          transparent: false,
          side: 0, // THREE.FrontSide
          alphaTest: 0
        },
        maps: {
          map: 'canvas_texture_1', // Reference to texture atlas
          normalMap: null,
          roughnessMap: null,
          metalnessMap: null
        }
      },
      
      // Render settings
      rendering: {
        visible: true,
        castShadow: true,
        receiveShadow: true,
        frustumCulled: true,
        renderOrder: 0
      },
      
      // Custom metadata
      userData: {
        category: 'container',
        tags: ['editable', 'primary'],
        created: '2025-01-01T00:00:00.000Z',
        modified: '2025-01-01T00:00:00.000Z'
      }
    }
  ],
  
  // UI panel configurations
  ui: {
    panels: {
      'model-upload': { collapsed: false, width: 350, height: 200 },
      'image-editor': { collapsed: false, width: 350, height: 400 },
      'object-transform': { collapsed: false, width: 350, height: 300 },
      'scene-management': { collapsed: false, width: 350, height: 150 }
    },
    layout: {
      sidebarWidth: 350,
      viewerWidth: 'auto'
    },
    preferences: {
      autoSave: true,
      autoSaveInterval: 60000, // 1 minute
      compressionLevel: 'medium',
      maxUndoStates: 50
    }
  }
};
```

## Implementation Strategy

### Phase 6A: Core Serialization Engine (Week 1)

#### Step 1: Smart Serialization Manager
```javascript
class TigerBuilderSceneManager {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.compressionManager = new TextureCompressionManager();
    this.storageManager = new StorageManager();
    this.version = '3.0';
  }
  
  async saveScene(options = {}) {
    const {
      includeTextures = true,
      compressionLevel = 'medium',
      storagePreference = 'auto'
    } = options;
    
    // Build scene data progressively
    const sceneData = await this.buildSceneData({
      includeTextures,
      compressionLevel
    });
    
    // Determine optimal storage method
    const storageMethod = this.storageManager.selectStorage(
      JSON.stringify(sceneData).length,
      storagePreference
    );
    
    // Save using selected method
    return await this.storageManager.save(sceneData, storageMethod);
  }
  
  async loadScene(source) {
    try {
      const sceneData = await this.storageManager.load(source);
      return await this.restoreScene(sceneData);
    } catch (error) {
      return await this.handleLoadError(error, source);
    }
  }
}
```

#### Step 2: Progressive Object Serialization
```javascript
async buildObjectData() {
  const objects = [];
  const meshes = [];
  
  // Collect all serializable objects
  this.scene.traverse(obj => {
    if (obj.isMesh && obj.name) meshes.push(obj);
  });
  
  // Serialize in batches to prevent UI blocking
  for (const mesh of meshes) {
    const objectData = {
      id: mesh.uuid,
      name: mesh.name,
      type: mesh.type,
      
      // Geometry data
      geometry: this.serializeGeometry(mesh.geometry),
      
      // Material data with texture references
      material: await this.serializeMaterial(mesh.material),
      
      // Transform data
      transform: {
        position: mesh.position.toArray(),
        rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
        scale: mesh.scale.toArray()
      },
      
      // Rendering properties
      rendering: {
        visible: mesh.visible,
        castShadow: mesh.castShadow,
        receiveShadow: mesh.receiveShadow,
        frustumCulled: mesh.frustumCulled,
        renderOrder: mesh.renderOrder
      },
      
      // User data (deep clone to avoid references)
      userData: JSON.parse(JSON.stringify(mesh.userData))
    };
    
    objects.push(objectData);
    
    // Yield control periodically
    if (objects.length % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return objects;
}
```

### Phase 6B: Advanced Storage Management (Week 2)

#### Step 3: Multi-Tier Storage System
```javascript
class StorageManager {
  constructor() {
    this.tiers = {
      localStorage: new LocalStorageAdapter(),
      indexedDB: new IndexedDBAdapter(),
      opfs: new OPFSAdapter(),
      fileSystem: new FileSystemAdapter()
    };
    this.defaultTier = 'localStorage';
  }
  
  async save(data, preferredTier = 'auto') {
    const dataSize = this.estimateSize(data);
    const tier = preferredTier === 'auto' ? 
      this.selectOptimalTier(dataSize) : 
      preferredTier;
    
    try {
      const adapter = this.tiers[tier];
      const result = await adapter.save(data);
      
      return {
        success: true,
        tier,
        size: dataSize,
        id: result.id,
        timestamp: Date.now()
      };
    } catch (error) {
      // Try fallback tiers
      return await this.saveWithFallback(data, tier, error);
    }
  }
  
  selectOptimalTier(dataSize) {
    if (dataSize < 4 * 1024 * 1024) return 'localStorage';
    if (dataSize < 100 * 1024 * 1024) return 'indexedDB';
    if ('showSaveFilePicker' in window) return 'fileSystem';
    return 'indexedDB'; // Fallback
  }
}
```

#### Step 4: OPFS Integration for Large Files
```javascript
class OPFSAdapter {
  constructor() {
    this.supported = 'navigator' in window && 
                    'storage' in navigator && 
                    'getDirectory' in navigator.storage;
    this.rootHandle = null;
  }
  
  async initialize() {
    if (!this.supported) throw new Error('OPFS not supported');
    this.rootHandle = await navigator.storage.getDirectory();
  }
  
  async save(data, filename = 'scene.json') {
    await this.initialize();
    
    const fileHandle = await this.rootHandle.getFileHandle(filename, {
      create: true
    });
    
    const writable = await fileHandle.createWritable();
    
    // Write data in chunks for better performance
    const jsonString = JSON.stringify(data, null, 2);
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(jsonString);
    
    const chunkSize = 1024 * 1024; // 1MB chunks
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      await writable.write(chunk);
    }
    
    await writable.close();
    
    return {
      id: filename,
      size: uint8Array.length,
      method: 'opfs'
    };
  }
}
```

### Phase 6C: User Experience and Error Handling (Week 3)

#### Step 5: Progress Indicators and User Feedback
```javascript
class SaveLoadUIManager {
  constructor() {
    this.progressElement = null;
    this.statusElement = null;
    this.createUI();
  }
  
  async showSaveProgress(savePromise, estimatedSize) {
    this.showProgress({
      title: 'Saving Scene',
      message: `Preparing ${this.formatFileSize(estimatedSize)}...`,
      cancellable: false
    });
    
    try {
      const result = await savePromise;
      
      this.showSuccess({
        title: 'Scene Saved Successfully',
        message: `${this.formatFileSize(result.size)} saved to ${result.tier}`,
        duration: 3000
      });
      
      return result;
    } catch (error) {
      this.showError({
        title: 'Save Failed',
        message: error.message,
        actions: ['Retry', 'Save to File', 'Cancel']
      });
      throw error;
    } finally {
      this.hideProgress();
    }
  }
  
  async showLoadProgress(loadPromise) {
    this.showProgress({
      title: 'Loading Scene',
      message: 'Restoring 3D objects and textures...',
      cancellable: true
    });
    
    try {
      const result = await loadPromise;
      
      this.showSuccess({
        title: 'Scene Loaded Successfully',
        message: `${result.objectCount} objects restored`,
        duration: 2000
      });
      
      return result;
    } catch (error) {
      this.showError({
        title: 'Load Failed', 
        message: this.getErrorMessage(error),
        actions: ['Try Again', 'Load Different File', 'Reset Scene']
      });
      throw error;
    } finally {
      this.hideProgress();
    }
  }
}
```

#### Step 6: Auto-Save and Recovery System
```javascript
class AutoSaveManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.autoSaveEnabled = true;
    this.autoSaveInterval = 60000; // 1 minute
    this.maxAutoSaveSlots = 5;
    this.lastSaveHash = null;
    this.autoSaveTimer = null;
    
    this.startAutoSave();
  }
  
  startAutoSave() {
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
    
    this.autoSaveTimer = setInterval(async () => {
      if (this.autoSaveEnabled && this.hasChanges()) {
        await this.performAutoSave();
      }
    }, this.autoSaveInterval);
  }
  
  async performAutoSave() {
    try {
      const sceneData = await this.sceneManager.buildSceneData({
        includeTextures: false, // Quick save without textures
        compressionLevel: 'low'
      });
      
      const hash = this.calculateHash(sceneData);
      if (hash === this.lastSaveHash) return; // No changes
      
      // Save to dedicated autosave slot
      const autoSaveKey = `autosave_${Date.now()}`;
      await this.sceneManager.storageManager.save(sceneData, autoSaveKey);
      
      this.lastSaveHash = hash;
      this.cleanupOldAutoSaves();
      
      this.showNotification('Auto-saved', 'info', 1000);
    } catch (error) {
      console.warn('Auto-save failed:', error);
      // Don't show error to user for auto-save failures
    }
  }
  
  async recoverFromCrash() {
    const autoSaves = await this.getAutoSaveList();
    if (autoSaves.length === 0) return null;
    
    const mostRecent = autoSaves[0];
    const shouldRecover = confirm(
      `Found auto-saved scene from ${new Date(mostRecent.timestamp).toLocaleString()}. ` +
      'Would you like to recover it?'
    );
    
    if (shouldRecover) {
      return await this.sceneManager.loadScene(mostRecent.id);
    }
    
    return null;
  }
}
```

## Performance Optimization Strategies

### Memory Management
```javascript
class MemoryManager {
  constructor() {
    this.disposalQueue = new Set();
    this.texturePool = new Map();
    this.geometryPool = new Map();
  }
  
  // Dispose of old resources before loading new ones
  async cleanupBeforeLoad() {
    // Dispose textures
    for (const texture of this.disposalQueue) {
      if (texture.dispose) texture.dispose();
    }
    
    // Force garbage collection if available
    if (window.gc) window.gc();
    
    this.disposalQueue.clear();
  }
  
  // Pool commonly used resources
  getPooledTexture(key, factory) {
    if (!this.texturePool.has(key)) {
      this.texturePool.set(key, factory());
    }
    return this.texturePool.get(key);
  }
}
```

### Async Processing with Web Workers
```javascript
// For CPU-intensive serialization tasks
class SerializationWorker {
  constructor() {
    this.worker = new Worker('/workers/scene-serializer.js');
    this.pendingTasks = new Map();
  }
  
  async serializeLargeTexture(imageData) {
    return new Promise((resolve, reject) => {
      const taskId = Math.random().toString(36);
      
      this.pendingTasks.set(taskId, { resolve, reject });
      
      this.worker.postMessage({
        type: 'compressTexture',
        taskId,
        imageData,
        options: { quality: 0.8, format: 'webp' }
      });
      
      setTimeout(() => {
        if (this.pendingTasks.has(taskId)) {
          this.pendingTasks.delete(taskId);
          reject(new Error('Texture compression timeout'));
        }
      }, 30000);
    });
  }
}
```

## Error Handling and Recovery

### Robust Error Handling
```javascript
class ErrorRecoveryManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.errorHandlers = new Map();
    this.setupErrorHandlers();
  }
  
  setupErrorHandlers() {
    this.errorHandlers.set('QuotaExceededError', this.handleQuotaExceeded.bind(this));
    this.errorHandlers.set('NetworkError', this.handleNetworkError.bind(this));
    this.errorHandlers.set('DataError', this.handleDataError.bind(this));
    this.errorHandlers.set('SecurityError', this.handleSecurityError.bind(this));
  }
  
  async handleError(error, context = {}) {
    const handler = this.errorHandlers.get(error.name);
    
    if (handler) {
      return await handler(error, context);
    }
    
    // Generic error handling
    return this.handleGenericError(error, context);
  }
  
  async handleQuotaExceeded(error, context) {
    // Try progressive quality reduction
    const strategies = [
      () => this.sceneManager.saveScene({ compressionLevel: 'high' }),
      () => this.sceneManager.saveScene({ includeTextures: false }),
      () => this.saveToFile(context.sceneData),
      () => this.saveMinimalState(context.sceneData)
    ];
    
    for (const strategy of strategies) {
      try {
        return await strategy();
      } catch (strategyError) {
        console.warn('Recovery strategy failed:', strategyError);
      }
    }
    
    throw new Error('Unable to save scene: Storage quota exceeded');
  }
}
```

## Testing and Validation Strategy

### Automated Testing Framework
```javascript
class SceneSerializationTester {
  constructor() {
    this.testSuites = [
      this.testBasicSerialization,
      this.testLargeSceneSerialization,
      this.testErrorRecovery,
      this.testPerformance
    ];
  }
  
  async runAllTests() {
    const results = [];
    
    for (const test of this.testSuites) {
      try {
        const result = await test.call(this);
        results.push({ test: test.name, status: 'passed', ...result });
      } catch (error) {
        results.push({ test: test.name, status: 'failed', error: error.message });
      }
    }
    
    return results;
  }
  
  async testBasicSerialization() {
    // Create test scene with various object types
    const testScene = this.createTestScene();
    const manager = new TigerBuilderSceneManager(testScene);
    
    // Save and load
    const saveResult = await manager.saveScene();
    const loadResult = await manager.loadScene(saveResult.id);
    
    // Validate scene integrity
    this.validateSceneIntegrity(testScene, loadResult.scene);
    
    return { objectCount: loadResult.objectCount, size: saveResult.size };
  }
}
```

## References

### Three.js Documentation
- [Official JSON Scene Format 4.3](https://github.com/mrdoob/three.js/wiki/JSON-Object-Scene-format-4) - Three.js official serialization format
- [ObjectLoader Documentation](https://threejs.org/docs/#api/en/loaders/ObjectLoader) - Standard Three.js scene loading
- [toJSON() Method](https://threejs.org/docs/#api/en/core/Object3D.toJSON) - Object serialization API

### Browser Storage APIs (2025)
- [Origin Private File System (OPFS)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) - Modern high-performance file storage
- [IndexedDB Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) - Large data storage
- [Storage Quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) - Browser storage limits

### TigerBuilder Project Files
- `/Users/david/Local Documents/BuilderProto/integrated-scene.html` - Current scene serialization implementation
- `/Users/david/Local Documents/BuilderProto/.claude/docs/threejs-complete-scene-serialization.md` - Existing research

## Implementation Timeline

### Week 1: Core Serialization (40 hours)
- Day 1-2: Implement `TigerBuilderSceneManager` class
- Day 3-4: Build progressive object serialization
- Day 5: Add smart texture compression

### Week 2: Storage Management (40 hours)  
- Day 1-2: Implement multi-tier storage system
- Day 3-4: Add OPFS integration for large files
- Day 5: Build IndexedDB fallback system

### Week 3: User Experience (40 hours)
- Day 1-2: Create progress indicators and error handling
- Day 3-4: Implement auto-save and recovery
- Day 5: Add validation and testing framework

## Key Success Metrics

1. **Performance**: Save/load operations complete in < 5 seconds for typical scenes
2. **Reliability**: 99.9% success rate for save/load operations
3. **Storage Efficiency**: 70% reduction in file size through smart compression
4. **User Experience**: Clear progress indicators and error recovery
5. **Compatibility**: Works across Chrome, Firefox, Safari, Edge (latest versions)

This architecture provides enterprise-level scene persistence while maintaining the simplicity and reliability principles of the TigerBuilder project. The progressive implementation approach ensures each phase delivers tangible value while building toward the complete solution.
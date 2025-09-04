// ResourceTracker - Official Three.js pattern for memory management
// Based on Three.js documentation: https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects

class ResourceTracker {
    constructor() {
        this.resources = new Set();
    }
    
    track(resource) {
        if (!resource) return resource;
        
        // Automatically dispose of object when it's no longer used
        if (resource.dispose || resource instanceof THREE.Object3D) {
            this.resources.add(resource);
        }
        return resource;
    }
    
    untrack(resource) {
        this.resources.delete(resource);
    }
    
    dispose() {
        for (const resource of this.resources) {
            if (resource instanceof THREE.Object3D) {
                if (resource.parent) {
                    resource.parent.remove(resource);
                }
            }
            
            if (resource.dispose) {
                resource.dispose();
            }
        }
        this.resources.clear();
    }
}

// Three.js Scene Manager with proper resource tracking
class ThreeJSSceneManager {
    constructor() {
        this.resourceTracker = new ResourceTracker();
        console.log('✅ ThreeJSSceneManager initialized with ResourceTracker');
    }
    
    // Wrap Three.js resource creation to auto-track
    createGeometry(geometryClass, ...args) {
        const geometry = new geometryClass(...args);
        return this.resourceTracker.track(geometry);
    }
    
    createMaterial(materialClass, ...args) {
        const material = new materialClass(...args);
        return this.resourceTracker.track(material);
    }
    
    createTexture(textureClass, ...args) {
        const texture = new textureClass(...args);
        return this.resourceTracker.track(texture);
    }
    
    // Load GLB with resource tracking
    async loadGLB(url) {
        const loader = new THREE.GLTFLoader();
        
        return new Promise((resolve, reject) => {
            loader.load(
                url,
                (gltf) => {
                    // Track all resources in the GLB
                    this.trackGLBResources(gltf);
                    resolve(gltf);
                },
                (progress) => {
                    console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('GLB loading error:', error);
                    reject(error);
                }
            );
        });
    }
    
    trackGLBResources(gltf) {
        // Track the root object
        this.resourceTracker.track(gltf.scene);
        
        // Track all geometries, materials, and textures in the GLB
        gltf.scene.traverse((child) => {
            if (child.geometry) {
                this.resourceTracker.track(child.geometry);
            }
            
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => {
                        this.resourceTracker.track(material);
                        this.trackMaterialTextures(material);
                    });
                } else {
                    this.resourceTracker.track(child.material);
                    this.trackMaterialTextures(child.material);
                }
            }
        });
        
        // Track animations
        if (gltf.animations) {
            gltf.animations.forEach(animation => {
                this.resourceTracker.track(animation);
            });
        }
        
        console.log(`✅ Tracked resources for GLB: ${gltf.scene.name}`);
    }
    
    trackMaterialTextures(material) {
        // Track all possible texture types
        const textureProperties = [
            'map', 'normalMap', 'bumpMap', 'displacementMap',
            'roughnessMap', 'metalnessMap', 'alphaMap',
            'envMap', 'lightMap', 'aoMap', 'emissiveMap'
        ];
        
        textureProperties.forEach(prop => {
            if (material[prop]) {
                this.resourceTracker.track(material[prop]);
            }
        });
    }
    
    // Proper scene clearing following Three.js best practices
    clearScene(scene) {
        console.log('🗑️ Clearing scene with proper disposal...');
        
        // First, clear any active selections to prevent conflicts
        if (window.optimizedSelectionSystem) {
            window.optimizedSelectionSystem.deselectAll();
        }
        
        // Detach TransformControls
        if (window.transformControlsManager && window.transformControlsManager.transformControls) {
            window.transformControlsManager.transformControls.detach();
            if (scene.children.includes(window.transformControlsManager.transformControls)) {
                scene.remove(window.transformControlsManager.transformControls);
            }
        }
        
        // Remove and dispose all objects in scene
        const objectsToRemove = [...scene.children];
        objectsToRemove.forEach(child => {
            // Skip lights, camera, helpers that should persist
            if (child.isLight || child.isCamera || 
                child.type === 'GridHelper' || child.type === 'AxesHelper') {
                return;
            }
            
            scene.remove(child);
            this.disposeObject3D(child);
        });
        
        // Dispose tracked resources
        this.resourceTracker.dispose();
        
        // Update selectable objects list
        if (window.optimizedSelectionSystem) {
            window.optimizedSelectionSystem.updateSelectableObjects();
        }
        
        console.log('✅ Scene cleared and resources disposed');
    }
    
    // Comprehensive Object3D disposal
    disposeObject3D(object) {
        if (!object) return;
        
        object.traverse((child) => {
            // Dispose geometry
            if (child.geometry) {
                child.geometry.dispose();
            }
            
            // Dispose materials
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => this.disposeMaterial(material));
                } else {
                    this.disposeMaterial(child.material);
                }
            }
        });
        
        // Remove from parent
        if (object.parent) {
            object.parent.remove(object);
        }
    }
    
    disposeMaterial(material) {
        if (!material) return;
        
        // Dispose all textures
        const textureProperties = [
            'map', 'normalMap', 'bumpMap', 'displacementMap',
            'roughnessMap', 'metalnessMap', 'alphaMap',
            'envMap', 'lightMap', 'aoMap', 'emissiveMap'
        ];
        
        textureProperties.forEach(prop => {
            if (material[prop] && material[prop].dispose) {
                material[prop].dispose();
            }
        });
        
        // Dispose material itself
        material.dispose();
    }
    
    // Three.js native serialization
    serializeScene(scene, customData = {}) {
        console.log('📦 Serializing scene using Three.js native format...');
        
        try {
            // Use Three.js native serialization
            const serializedScene = scene.toJSON();
            
            // Add BuilderProto-specific data
            const sceneData = {
                // Three.js native format
                threeJS: serializedScene,
                
                // BuilderProto extensions
                customData: {
                    version: '1.0',
                    timestamp: Date.now(),
                    canvasTexture: null, // Will be set by calling code
                    cameraState: null,   // Will be set by calling code
                    ...customData
                },
                
                // Metadata
                metadata: {
                    generator: 'BuilderProto',
                    threeJSVersion: THREE.REVISION,
                    format: 'native',
                    totalObjects: this.countSceneObjects(scene)
                }
            };
            
            console.log(`✅ Scene serialized: ${sceneData.metadata.totalObjects} objects`);
            return sceneData;
            
        } catch (error) {
            console.error('❌ Scene serialization failed:', error);
            throw error;
        }
    }
    
    // Three.js native deserialization
    async deserializeScene(sceneData) {
        console.log('📦 Deserializing scene using Three.js native format...');
        
        try {
            // Use Three.js ObjectLoader for native deserialization
            const loader = new THREE.ObjectLoader();
            
            // Parse the Three.js native format
            const restoredObject = loader.parse(sceneData.threeJS);
            
            // Track all restored resources
            this.trackRestoredObject(restoredObject);
            
            console.log(`✅ Scene deserialized: ${sceneData.metadata?.totalObjects || 'unknown'} objects`);
            
            return {
                scene: restoredObject,
                customData: sceneData.customData || {},
                metadata: sceneData.metadata || {}
            };
            
        } catch (error) {
            console.error('❌ Scene deserialization failed:', error);
            throw error;
        }
    }
    
    trackRestoredObject(object) {
        if (!object) return;
        
        // Track the root object
        this.resourceTracker.track(object);
        
        // Track all child objects and their resources
        object.traverse((child) => {
            this.resourceTracker.track(child);
            
            if (child.geometry) {
                this.resourceTracker.track(child.geometry);
            }
            
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => {
                        this.resourceTracker.track(material);
                        this.trackMaterialTextures(material);
                    });
                } else {
                    this.resourceTracker.track(child.material);
                    this.trackMaterialTextures(child.material);
                }
            }
        });
    }
    
    countSceneObjects(scene) {
        let count = 0;
        scene.traverse(() => count++);
        return count;
    }
    
    // Memory usage monitoring
    getResourceCount() {
        return this.resources.size;
    }
    
    dispose() {
        this.resourceTracker.dispose();
        console.log('✅ ThreeJSSceneManager disposed');
    }
}

// Export classes globally
window.ResourceTracker = ResourceTracker;
window.ThreeJSSceneManager = ThreeJSSceneManager;

console.log('✅ ResourceTracker and ThreeJSSceneManager loaded');
// Standard Three.js Resource Manager
// Follows Three.js disposal patterns for automatic memory management

class ResourceManager {
    constructor() {
        // Track created resources
        this.geometries = new Set();
        this.materials = new Set();
        this.textures = new Set();
        this.meshes = new Set();
        this.groups = new Set();
        
        // Track event listeners for cleanup
        this.eventListeners = new Map();
        
        console.log('🗂️ ResourceManager initialized');
    }
    
    // Register resources for automatic disposal
    registerGeometry(geometry) {
        this.geometries.add(geometry);
        return geometry;
    }
    
    registerMaterial(material) {
        this.materials.add(material);
        return material;
    }
    
    registerTexture(texture) {
        this.textures.add(texture);
        return texture;
    }
    
    registerMesh(mesh) {
        this.meshes.add(mesh);
        return mesh;
    }
    
    registerGroup(group) {
        this.groups.add(group);
        return group;
    }
    
    // Register event listeners for cleanup
    registerEventListener(element, event, handler, options) {
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, []);
        }
        
        const listenerData = { event, handler, options };
        this.eventListeners.get(element).push(listenerData);
        
        // Add the event listener
        element.addEventListener(event, handler, options);
        
        return listenerData;
    }
    
    // Create and register a standard material
    createBasicMaterial(options = {}) {
        const material = new THREE.MeshBasicMaterial(options);
        return this.registerMaterial(material);
    }
    
    createLineMaterial(options = {}) {
        const material = new THREE.LineBasicMaterial(options);
        return this.registerMaterial(material);
    }
    
    // Create and register a wireframe geometry
    createWireframeGeometry(geometry) {
        const wireframe = new THREE.WireframeGeometry(geometry);
        return this.registerGeometry(wireframe);
    }
    
    // Create and register edges geometry
    createEdgesGeometry(geometry) {
        const edges = new THREE.EdgesGeometry(geometry);
        return this.registerGeometry(edges);
    }
    
    // Dispose of a specific resource
    disposeGeometry(geometry) {
        if (geometry && typeof geometry.dispose === 'function') {
            geometry.dispose();
            this.geometries.delete(geometry);
        }
    }
    
    disposeMaterial(material) {
        if (material && typeof material.dispose === 'function') {
            material.dispose();
            this.materials.delete(material);
        }
    }
    
    disposeTexture(texture) {
        if (texture && typeof texture.dispose === 'function') {
            texture.dispose();
            this.textures.delete(texture);
        }
    }
    
    disposeMesh(mesh) {
        if (mesh) {\n            // Dispose of geometry and materials\n            if (mesh.geometry) this.disposeGeometry(mesh.geometry);\n            \n            if (mesh.material) {\n                if (Array.isArray(mesh.material)) {\n                    mesh.material.forEach(mat => this.disposeMaterial(mat));\n                } else {\n                    this.disposeMaterial(mesh.material);\n                }\n            }\n            \n            // Remove from parent\n            if (mesh.parent) {\n                mesh.parent.remove(mesh);\n            }\n            \n            this.meshes.delete(mesh);\n        }\n    }\n    \n    disposeGroup(group) {\n        if (group) {\n            // Dispose of all children\n            const children = [...group.children]; // Copy array to avoid modification during iteration\n            children.forEach(child => {\n                if (child.isMesh) {\n                    this.disposeMesh(child);\n                } else if (child.isGroup) {\n                    this.disposeGroup(child);\n                }\n            });\n            \n            // Remove from parent\n            if (group.parent) {\n                group.parent.remove(group);\n            }\n            \n            this.groups.delete(group);\n        }\n    }\n    \n    // Remove event listeners\n    removeEventListeners(element) {\n        const listeners = this.eventListeners.get(element);\n        if (listeners) {\n            listeners.forEach(({ event, handler, options }) => {\n                element.removeEventListener(event, handler, options);\n            });\n            this.eventListeners.delete(element);\n        }\n    }\n    \n    // Standard Three.js dispose pattern - dispose all resources\n    dispose() {\n        console.log('🗑️ Disposing ResourceManager resources...');\n        \n        // Dispose groups first (will handle meshes recursively)\n        this.groups.forEach(group => {\n            // Don't call this.disposeGroup to avoid modifying Set during iteration\n            group.traverse(child => {\n                if (child.isMesh) {\n                    if (child.geometry) child.geometry.dispose();\n                    if (child.material) {\n                        if (Array.isArray(child.material)) {\n                            child.material.forEach(mat => mat.dispose());\n                        } else {\n                            child.material.dispose();\n                        }\n                    }\n                }\n            });\n            if (group.parent) group.parent.remove(group);\n        });\n        \n        // Dispose remaining meshes\n        this.meshes.forEach(mesh => {\n            if (mesh.geometry) mesh.geometry.dispose();\n            if (mesh.material) {\n                if (Array.isArray(mesh.material)) {\n                    mesh.material.forEach(mat => mat.dispose());\n                } else {\n                    mesh.material.dispose();\n                }\n            }\n            if (mesh.parent) mesh.parent.remove(mesh);\n        });\n        \n        // Dispose remaining geometries\n        this.geometries.forEach(geometry => {\n            if (geometry.dispose) geometry.dispose();\n        });\n        \n        // Dispose materials\n        this.materials.forEach(material => {\n            if (material.dispose) material.dispose();\n        });\n        \n        // Dispose textures\n        this.textures.forEach(texture => {\n            if (texture.dispose) texture.dispose();\n        });\n        \n        // Remove all event listeners\n        this.eventListeners.forEach((listeners, element) => {\n            this.removeEventListeners(element);\n        });\n        \n        // Clear all sets\n        this.geometries.clear();\n        this.materials.clear();\n        this.textures.clear();\n        this.meshes.clear();\n        this.groups.clear();\n        this.eventListeners.clear();\n        \n        console.log('✅ ResourceManager disposed');\n    }\n    \n    // Get resource counts for debugging\n    getResourceCounts() {\n        return {\n            geometries: this.geometries.size,\n            materials: this.materials.size,\n            textures: this.textures.size,\n            meshes: this.meshes.size,\n            groups: this.groups.size,\n            eventListeners: this.eventListeners.size\n        };\n    }\n    \n    // Log resource usage\n    logResourceUsage() {\n        const counts = this.getResourceCounts();\n        console.log('📊 Resource usage:', counts);\n        return counts;\n    }\n}\n\n// Global resource manager instance\nwindow.resourceManager = new ResourceManager();\n\n// Export class\nwindow.ResourceManager = ResourceManager;
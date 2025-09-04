// Scene Serialization System for Three.js
// Handles serialization and deserialization of complete Three.js scenes

class SceneSerializer {
    constructor() {
        this.version = '1.0';
        this.supportedObjectTypes = ['Mesh', 'Group', 'Light', 'Camera'];
        this.supportedMaterialTypes = ['MeshStandardMaterial', 'MeshBasicMaterial', 'MeshLambertMaterial'];
    }

    /**
     * Serialize a complete Three.js scene for storage
     * @param {THREE.Scene} scene - The Three.js scene to serialize
     * @param {THREE.Camera} camera - The camera to serialize
     * @param {Array} lights - Array of lights in the scene
     * @param {Object} options - Serialization options
     * @returns {Object} Serialized scene data
     */
    async serializeScene(scene, camera, lights, options = {}) {
        console.log('🔄 Starting scene serialization...');
        
        const startTime = performance.now();
        const serializedData = {
            version: this.version,
            timestamp: new Date().toISOString(),
            metadata: {
                objectCount: 0,
                materialCount: 0,
                textureCount: 0,
                assetReferences: []
            }
        };

        try {
            // 1. Serialize scene objects
            serializedData.scene_data = await this.serializeSceneObjects(scene);
            
            // 2. Serialize camera
            serializedData.camera_data = this.serializeCamera(camera);
            
            // 3. Serialize lighting
            serializedData.lighting_data = this.serializeLighting(lights);
            
            // 4. Extract canvas texture data
            if (options.includeCanvasTexture) {
                serializedData.canvas_texture = await this.serializeCanvasTexture();
            }
            
            // 5. Update metadata
            serializedData.metadata.objectCount = serializedData.scene_data.objects.length;
            serializedData.metadata.materialCount = Object.keys(serializedData.scene_data.materials).length;
            serializedData.metadata.textureCount = Object.keys(serializedData.scene_data.textures).length;
            
            const endTime = performance.now();
            console.log(`✅ Scene serialization completed in ${(endTime - startTime).toFixed(2)}ms`, {
                objects: serializedData.metadata.objectCount,
                materials: serializedData.metadata.materialCount,
                textures: serializedData.metadata.textureCount
            });
            
            return serializedData;
            
        } catch (error) {
            console.error('❌ Scene serialization failed:', error);
            throw new Error(`Scene serialization failed: ${error.message}`);
        }
    }

    /**
     * Serialize all objects in the scene
     */
    async serializeSceneObjects(scene) {
        const sceneData = {
            objects: [],
            materials: {},
            textures: {},
            geometries: {}
        };

        // Track processed objects to avoid duplicates
        const processedMaterials = new Map();
        const processedTextures = new Map();
        const processedGeometries = new Map();

        scene.traverse((object) => {
            // Skip non-serializable objects
            if (!this.shouldSerializeObject(object)) {
                return;
            }

            console.log(`📦 Serializing object: ${object.name || 'unnamed'} (${object.type})`);

            const serializedObject = {
                uuid: object.uuid,
                name: object.name || '',
                type: object.type,
                visible: object.visible,
                position: {x: object.position.x, y: object.position.y, z: object.position.z},
                rotation: {x: object.rotation.x, y: object.rotation.y, z: object.rotation.z},
                scale: {x: object.scale.x, y: object.scale.y, z: object.scale.z},
                userData: this.serializeUserData(object.userData)
            };

            // Special handling for GLB models from library
            if (object.userData.assetId || object.userData.isMultiModelInstance) {
                serializedObject.type = 'library_model';
                serializedObject.libraryAssetId = object.userData.assetId; // Library model ID
                serializedObject.assetName = object.userData.assetName;
                serializedObject.instanceId = object.userData.instanceId;
                
                // Store the model URL if available (from library metadata)
                if (window.libraryBrowser && window.libraryBrowser.library) {
                    const libraryModel = window.libraryBrowser.library.getModelById(object.userData.assetId);
                    if (libraryModel) {
                        serializedObject.modelUrl = libraryModel.file_url;
                        serializedObject.modelScaleFactor = libraryModel.model_scale_factor;
                    }
                }
                
                console.log(`📦 Detected library model: ${object.name} (Library Asset ID: ${object.userData.assetId})`);
            }

            // Serialize object-specific properties
            if (object.isMesh) {
                serializedObject.castShadow = object.castShadow;
                serializedObject.receiveShadow = object.receiveShadow;
                
                // Serialize geometry reference
                if (object.geometry && !processedGeometries.has(object.geometry.uuid)) {
                    sceneData.geometries[object.geometry.uuid] = this.serializeGeometry(object.geometry);
                    processedGeometries.set(object.geometry.uuid, true);
                }
                serializedObject.geometry = object.geometry?.uuid;

                // Serialize material(s)
                serializedObject.material = this.serializeMaterialReference(
                    object.material, 
                    sceneData.materials, 
                    sceneData.textures,
                    processedMaterials,
                    processedTextures
                );
            }

            // Add parent-child relationships
            if (object.parent && object.parent !== scene) {
                serializedObject.parent = object.parent.uuid;
            }

            sceneData.objects.push(serializedObject);
        });

        return sceneData;
    }

    /**
     * Determine if an object should be serialized
     */
    shouldSerializeObject(object) {
        // Skip the scene root itself
        if (object.type === 'Scene' && !object.userData.isMultiModelInstance) return false;
        
        // Skip objects marked as non-serializable
        if (object.userData.excludeFromSerialization) return false;
        
        // Skip helper objects (grid, axes, etc.)
        if (object.userData.isHelper || object.name?.includes('Helper')) return false;
        
        // Skip lights (handled separately)
        if (object.isLight) return false;
        
        // Skip Transform Controls
        if (object.userData.isTransformControls || object.name?.includes('TransformControls')) return false;
        
        // Skip floor plane
        if (object.name === 'floor' || object.userData.isFloor) return false;
        
        // Skip child objects of multi-model instances (they'll be loaded with their parent)
        if (object.parent && object.parent.userData.isMultiModelInstance) return false;
        
        // Only serialize top-level model instances
        if (object.userData.isMultiModelInstance) return true;
        
        return this.supportedObjectTypes.includes(object.type);
    }

    /**
     * Serialize user data safely
     */
    serializeUserData(userData) {
        const safeUserData = {};
        
        for (const [key, value] of Object.entries(userData)) {
            // Skip functions and complex objects
            if (typeof value === 'function') continue;
            if (value && typeof value === 'object' && value.isTexture) continue;
            if (value && typeof value === 'object' && value.isMaterial) continue;
            
            // Include serializable data
            safeUserData[key] = value;
        }
        
        return safeUserData;
    }

    /**
     * Serialize geometry (minimal data, mainly metadata)
     */
    serializeGeometry(geometry) {
        return {
            uuid: geometry.uuid,
            type: geometry.type,
            // Store minimal metadata, not full vertex data
            attributes: {
                hasPosition: !!geometry.attributes.position,
                hasNormal: !!geometry.attributes.normal,
                hasUv: !!geometry.attributes.uv,
                vertexCount: geometry.attributes.position?.count || 0
            }
        };
    }

    /**
     * Serialize material and its textures
     */
    serializeMaterialReference(material, materialsData, texturesData, processedMaterials, processedTextures) {
        if (Array.isArray(material)) {
            return material.map(mat => this.serializeSingleMaterial(mat, materialsData, texturesData, processedMaterials, processedTextures));
        } else {
            return this.serializeSingleMaterial(material, materialsData, texturesData, processedMaterials, processedTextures);
        }
    }

    /**
     * Serialize a single material
     */
    serializeSingleMaterial(material, materialsData, texturesData, processedMaterials, processedTextures) {
        if (!material || processedMaterials.has(material.uuid)) {
            return material?.uuid;
        }

        console.log(`🎨 Serializing material: ${material.name || 'unnamed'} (${material.type})`);

        const serializedMaterial = {
            uuid: material.uuid,
            name: material.name || '',
            type: material.type,
            color: material.color?.getHex(),
            transparent: material.transparent,
            opacity: material.opacity,
            visible: material.visible
        };

        // Material-specific properties
        if (material.isMeshStandardMaterial) {
            serializedMaterial.roughness = material.roughness;
            serializedMaterial.metalness = material.metalness;
            serializedMaterial.emissive = material.emissive?.getHex();
        }

        // Serialize textures
        const textureProperties = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'];
        for (const prop of textureProperties) {
            if (material[prop]) {
                if (!processedTextures.has(material[prop].uuid)) {
                    texturesData[material[prop].uuid] = this.serializeTexture(material[prop]);
                    processedTextures.set(material[prop].uuid, true);
                }
                serializedMaterial[prop] = material[prop].uuid;
            }
        }

        // Check if this is a canvas texture material (our main use case)
        if (material.userData.isCanvasTexture) {
            serializedMaterial.isCanvasTexture = true;
            serializedMaterial.canvasResolution = material.userData.canvasResolution || 1024;
        }

        materialsData[material.uuid] = serializedMaterial;
        processedMaterials.set(material.uuid, true);

        return material.uuid;
    }

    /**
     * Serialize texture metadata
     */
    serializeTexture(texture) {
        return {
            uuid: texture.uuid,
            name: texture.name || '',
            format: texture.format,
            type: texture.type,
            mapping: texture.mapping,
            wrapS: texture.wrapS,
            wrapT: texture.wrapT,
            magFilter: texture.magFilter,
            minFilter: texture.minFilter,
            flipY: texture.flipY,
            // Note: Actual image data is handled separately via asset management
            isCanvasTexture: texture.userData?.isCanvasTexture || false,
            source: texture.userData?.source || 'unknown'
        };
    }

    /**
     * Serialize camera data
     */
    serializeCamera(camera) {
        const cameraData = {
            uuid: camera.uuid,
            name: camera.name || '',
            type: camera.type,
            position: camera.position.toArray(),
            rotation: camera.rotation.toArray(),
            up: camera.up.toArray(),
            matrixWorldInverse: camera.matrixWorldInverse.toArray()
        };
        
        // Save OrbitControls target if available
        if (window.controls && window.controls.target) {
            cameraData.target = window.controls.target.toArray();
        }

        if (camera.isPerspectiveCamera) {
            cameraData.fov = camera.fov;
            cameraData.aspect = camera.aspect;
            cameraData.near = camera.near;
            cameraData.far = camera.far;
        } else if (camera.isOrthographicCamera) {
            cameraData.left = camera.left;
            cameraData.right = camera.right;
            cameraData.top = camera.top;
            cameraData.bottom = camera.bottom;
            cameraData.near = camera.near;
            cameraData.far = camera.far;
        }

        return cameraData;
    }

    /**
     * Serialize lighting setup
     */
    serializeLighting(lights) {
        const lightingData = {
            lights: [],
            preset: 'custom' // Can be 'studio', 'outdoor', 'soft', etc.
        };

        lights.forEach(light => {
            if (light.isLight) {
                const serializedLight = {
                    uuid: light.uuid,
                    name: light.name || '',
                    type: light.type,
                    color: light.color?.getHex(),
                    intensity: light.intensity,
                    position: light.position.toArray(),
                    visible: light.visible
                };

                // Light-specific properties
                if (light.isDirectionalLight) {
                    serializedLight.target = light.target.position.toArray();
                    serializedLight.castShadow = light.castShadow;
                } else if (light.isPointLight || light.isSpotLight) {
                    serializedLight.distance = light.distance;
                    serializedLight.decay = light.decay;
                    if (light.isSpotLight) {
                        serializedLight.angle = light.angle;
                        serializedLight.penumbra = light.penumbra;
                        serializedLight.target = light.target.position.toArray();
                    }
                }

                lightingData.lights.push(serializedLight);
            }
        });

        return lightingData;
    }

    /**
     * Serialize current canvas texture to base64
     */
    async serializeCanvasTexture() {
        const canvas = document.getElementById('displayCanvas');
        if (!canvas) {
            console.warn('⚠️ Canvas not found for texture serialization');
            return null;
        }

        try {
            // Convert canvas to base64
            const base64Data = canvas.toDataURL('image/png');
            const dataSize = base64Data.length;
            
            console.log(`🖼️ Canvas texture serialized: ${(dataSize / 1024).toFixed(2)}KB`);
            
            return {
                data: base64Data,
                width: canvas.width,
                height: canvas.height,
                format: 'image/png',
                size: dataSize
            };
        } catch (error) {
            console.error('❌ Failed to serialize canvas texture:', error);
            return null;
        }
    }

    /**
     * Deserialize scene data back to Three.js objects
     */
    async deserializeScene(serializedData, scene, camera, targetLights) {
        console.log('🔄 Starting scene deserialization...');
        
        try {
            const startTime = performance.now();
            
            // Clear existing scene (except lights and camera)
            this.clearScene(scene);
            
            // 1. Restore camera
            this.deserializeCamera(serializedData.camera_data, camera);
            
            // 2. Restore lighting
            await this.deserializeLighting(serializedData.lighting_data, targetLights, scene);
            
            // 3. Restore scene objects
            await this.deserializeSceneObjects(serializedData.scene_data, scene);
            
            // 4. Restore canvas texture
            if (serializedData.canvas_texture) {
                await this.deserializeCanvasTexture(serializedData.canvas_texture);
            }
            
            const endTime = performance.now();
            console.log(`✅ Scene deserialization completed in ${(endTime - startTime).toFixed(2)}ms`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Scene deserialization failed:', error);
            throw new Error(`Scene deserialization failed: ${error.message}`);
        }
    }

    /**
     * Clear scene of user objects (preserve infrastructure)
     */
    clearScene(scene) {
        const objectsToRemove = [];
        
        scene.traverse((object) => {
            if (this.shouldSerializeObject(object)) {
                objectsToRemove.push(object);
            }
        });
        
        objectsToRemove.forEach(object => {
            if (object.parent) {
                object.parent.remove(object);
            }
        });
        
        console.log(`🗑️ Cleared ${objectsToRemove.length} objects from scene`);
    }

    /**
     * Restore camera from serialized data
     */
    deserializeCamera(cameraData, camera) {
        camera.position.fromArray(cameraData.position);
        camera.rotation.fromArray(cameraData.rotation);
        camera.up.fromArray(cameraData.up);
        
        if (camera.isPerspectiveCamera && cameraData.fov) {
            camera.fov = cameraData.fov;
            camera.aspect = cameraData.aspect;
            camera.near = cameraData.near;
            camera.far = cameraData.far;
        }
        
        camera.updateProjectionMatrix();
        console.log('📷 Camera restored from serialized data');
    }

    /**
     * Restore lighting from serialized data
     */
    async deserializeLighting(lightingData, targetLights, scene) {
        // This would restore lighting - for now we'll keep existing lighting
        console.log('💡 Lighting restoration (placeholder - using existing setup)');
        return true;
    }

    /**
     * Restore scene objects (placeholder - would need asset loading)
     */
    async deserializeSceneObjects(sceneData, scene) {
        console.log('📦 Scene object restoration (placeholder - needs asset system)');
        console.log('Objects to restore:', sceneData.objects.length);
        
        // This would need to:
        // 1. Load GLB assets from storage
        // 2. Recreate materials and textures
        // 3. Position objects according to serialized data
        // 4. Restore parent-child relationships
        
        return true;
    }

    /**
     * Restore canvas texture
     */
    async deserializeCanvasTexture(canvasTextureData) {
        if (!canvasTextureData || !canvasTextureData.data) {
            console.warn('⚠️ No canvas texture data to restore');
            return;
        }

        const canvas = document.getElementById('displayCanvas');
        if (!canvas) {
            console.warn('⚠️ Canvas not found for texture restoration');
            return;
        }

        try {
            const img = new Image();
            img.onload = () => {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                console.log('🖼️ Canvas texture restored');
                
                // Update the Three.js texture if it exists
                if (window.canvasTexture) {
                    window.canvasTexture.needsUpdate = true;
                }
            };
            img.src = canvasTextureData.data;
            
        } catch (error) {
            console.error('❌ Failed to restore canvas texture:', error);
        }
    }
}

// Export to global scope
window.SceneSerializer = SceneSerializer;

// Create global instance
window.sceneSerializer = new SceneSerializer();

console.log('✅ Scene Serialization System loaded');
// Saved Scene Management System
// Handles saving and loading complete Three.js scenes with Supabase integration

class SavedSceneManager {
    constructor(supabase) {
        this.supabase = supabase;
        this.serializer = window.sceneSerializer;
        this.assetManager = window.assetManager;
        this.currentScene = null;
        this.user = null;
        this.userScenes = [];
        
        // Validate Supabase client
        if (!this.supabase || !this.supabase.auth) {
            console.error('❌ Invalid Supabase client provided to SavedSceneManager');
            return;
        }
        
        this.initAuth();
    }

    /**
     * Initialize authentication and load user scenes
     */
    async initAuth() {
        try {
            // Wait for AuthManager to be available
            const waitForAuthManager = () => {
                return new Promise((resolve) => {
                    const checkAuthManager = setInterval(() => {
                        if (window.authManager) {
                            clearInterval(checkAuthManager);
                            resolve(window.authManager);
                        }
                    }, 100);
                });
            };
            
            const authManager = await waitForAuthManager();
            
            // Get initial auth state from AuthManager
            this.user = authManager.getCurrentUser();
            if (this.user) {
                await this.loadUserScenes();
                this.dispatchEvent('auth-changed', { user: this.user, scenes: this.userScenes });
            }
            
            // Listen for auth changes from Supabase (AuthManager already sets this up)
            this.supabase.auth.onAuthStateChange(async (event, session) => {
                this.user = session?.user || null;
                if (event === 'SIGNED_IN') {
                    await this.loadUserScenes();
                    this.dispatchEvent('auth-changed', { user: this.user, scenes: this.userScenes });
                } else if (event === 'SIGNED_OUT') {
                    this.clearUserData();
                    this.dispatchEvent('auth-changed', { user: null, scenes: [] });
                }
            });
            
            console.log('✅ Saved Scene Manager authentication initialized');
        } catch (error) {
            console.error('❌ Saved Scene Manager auth initialization failed:', error);
        }
    }

    /**
     * Save current scene to Supabase
     * @param {string} sceneName - Name for the scene
     * @param {string} description - Optional description
     * @param {Object} options - Save options
     * @returns {Object} Saved scene record
     */
    async saveScene(sceneName, description = '', options = {}) {
        if (!this.user) {
            throw new Error('User must be authenticated to save scenes');
        }

        if (!window.scene || !window.camera) {
            throw new Error('Scene and camera must be available to save');
        }

        console.log(`💾 Saving scene: ${sceneName}`);
        
        try {
            const startTime = performance.now();
            
            // 1. Serialize the current scene
            const serializedData = await this.serializer.serializeScene(
                window.scene,
                window.camera,
                this.getLightsFromScene(window.scene),
                {
                    includeCanvasTexture: options.includeCanvasTexture !== false,
                    generateThumbnail: options.generateThumbnail !== false
                }
            );
            
            // 2. Create scene record
            const sceneRecord = {
                user_id: this.user.id,
                name: sceneName,
                description: description,
                canvas_resolution: window.currentQuality || 1024,
                lighting_preset: 'studio', // TODO: Get from current lighting setup
                scene_data: serializedData.scene_data,
                camera_data: serializedData.camera_data,
                lighting_data: serializedData.lighting_data,
                asset_count: serializedData.metadata.objectCount,
                total_file_size: 0 // Will be updated as assets are uploaded
            };
            
            // 3. Insert scene record
            const { data: savedScene, error: sceneError } = await this.supabase
                .from('scenes')
                .insert(sceneRecord)
                .select()
                .single();
                
            if (sceneError) {
                throw new Error(`Failed to save scene: ${sceneError.message}`);
            }
            
            // 4. Save canvas texture as asset if requested
            if (options.includeCanvasTexture !== false && serializedData.canvas_texture) {
                try {
                    const canvas = document.getElementById('displayCanvas');
                    if (canvas && this.assetManager) {
                        await this.assetManager.uploadCanvasTexture(
                            savedScene.id,
                            canvas,
                            'main-texture'
                        );
                        console.log('✅ Canvas texture saved as asset');
                    }
                } catch (textureError) {
                    console.warn('⚠️ Failed to save canvas texture:', textureError);
                    // Don't fail the entire save if texture upload fails
                }
            }
            
            // 5. Update local scenes list
            this.userScenes.unshift(savedScene);
            this.currentScene = savedScene;
            
            const endTime = performance.now();
            console.log(`✅ Scene saved successfully in ${(endTime - startTime).toFixed(2)}ms:`, {
                id: savedScene.id,
                name: savedScene.name,
                objects: savedScene.asset_count
            });
            
            // Dispatch save event
            this.dispatchEvent('scene-saved', { scene: savedScene });
            
            return savedScene;
            
        } catch (error) {
            console.error('❌ Scene save failed:', error);
            throw error;
        }
    }

    /**
     * Get lights from scene
     */
    getLightsFromScene(scene) {
        const lights = [];
        scene.traverse((object) => {
            if (object.isLight) {
                lights.push(object);
            }
        });
        return lights;
    }

    /**
     * Load user's saved scenes
     */
    async loadUserScenes() {
        if (!this.user) {
            this.userScenes = [];
            return [];
        }

        try {
            const { data, error } = await this.supabase
                .from('scenes')
                .select(`
                    id, name, description, thumbnail_url, is_public,
                    created_at, updated_at, canvas_resolution,
                    asset_count, total_file_size
                `)
                .eq('user_id', this.user.id)
                .order('updated_at', { ascending: false });
                
            if (error) {
                throw error;
            }
            
            this.userScenes = data || [];
            console.log(`📋 Loaded ${this.userScenes.length} user scenes`);
            
            return this.userScenes;
        } catch (error) {
            console.error('❌ Failed to load user scenes:', error);
            this.userScenes = [];
            return [];
        }
    }

    /**
     * Delete a scene and its assets
     * @param {string} sceneId - Scene ID to delete
     * @returns {boolean} Success status
     */
    async deleteScene(sceneId) {
        if (!this.user) {
            throw new Error('User must be authenticated to delete scenes');
        }

        try {
            // Delete scene record (cascade will handle related records)
            const { error } = await this.supabase
                .from('scenes')
                .delete()
                .eq('id', sceneId)
                .eq('user_id', this.user.id); // Ensure user owns the scene
                
            if (error) {
                throw error;
            }
            
            // Update local scenes list
            this.userScenes = this.userScenes.filter(scene => scene.id !== sceneId);
            
            // Clear current scene if it was deleted
            if (this.currentScene?.id === sceneId) {
                this.currentScene = null;
            }
            
            console.log(`✅ Scene deleted: ${sceneId}`);
            
            // Dispatch delete event
            this.dispatchEvent('scene-deleted', { sceneId });
            
            return true;
            
        } catch (error) {
            console.error('❌ Scene deletion failed:', error);
            throw error;
        }
    }

    /**
     * Load a complete scene from Supabase
     * @param {string} sceneId - Scene ID to load
     * @returns {Object} Loaded scene data
     */
    async loadScene(sceneId) {
        if (!this.user) {
            throw new Error('User must be authenticated to load scenes');
        }

        try {
            console.log(`🔄 Loading scene: ${sceneId}`);
            const startTime = performance.now();

            // 1. Load scene data from database
            const { data: sceneData, error: sceneError } = await this.supabase
                .from('scenes')
                .select('*')
                .eq('id', sceneId)
                .single();

            if (sceneError) {
                throw new Error(`Failed to load scene: ${sceneError.message}`);
            }

            console.log('📊 Scene data loaded:', {
                name: sceneData.name,
                assetCount: sceneData.asset_count,
                canvasResolution: sceneData.canvas_resolution
            });

            // 2. Load scene assets from database
            const { data: sceneAssets, error: assetsError } = await this.supabase
                .from('scene_assets')
                .select('*')
                .eq('scene_id', sceneId)
                .order('created_at', { ascending: true });

            if (assetsError) {
                throw new Error(`Failed to load scene assets: ${assetsError.message}`);
            }

            console.log(`📦 Loaded ${sceneAssets?.length || 0} scene assets`);

            // 3. Clear current scene - remove ALL user-added models
            // First use the standard clearAllModels for tracked models
            if (window.clearAllModels) {
                window.clearAllModels();
            }
            
            // Then clean up any untracked models (from previous loads that weren't properly registered)
            const objectsToRemove = [];
            window.scene.traverse(child => {
                // Remove any Scene or Group that looks like a loaded model
                if ((child.type === 'Scene' || child.type === 'Group') && 
                    child.userData.isMultiModelInstance && 
                    child !== window.floor) {
                    objectsToRemove.push(child);
                }
            });
            
            objectsToRemove.forEach(obj => {
                console.log(`🗑️ Removing untracked model: ${obj.name}`);
                // Clean up the object
                obj.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
                // Remove from scene
                window.scene.remove(obj);
            });

            // 4. Deserialize and reconstruct scene
            const reconstructedScene = await this.reconstructScene(sceneData, sceneAssets);

            // 5. Apply camera and lighting
            if (sceneData.camera_data) {
                this.applyCameraData(sceneData.camera_data);
            }

            if (sceneData.lighting_data) {
                this.applyLightingData(sceneData.lighting_data);
            }

            this.currentScene = sceneData;
            
            const endTime = performance.now();
            console.log(`✅ Scene loaded successfully in ${(endTime - startTime).toFixed(2)}ms:`, {
                id: sceneData.id,
                name: sceneData.name,
                objects: sceneData.asset_count
            });

            // Dispatch load event
            this.dispatchEvent('scene-loaded', { 
                scene: sceneData, 
                assets: sceneAssets,
                reconstructedScene 
            });

            return {
                scene: sceneData,
                assets: sceneAssets,
                reconstructedScene
            };

        } catch (error) {
            console.error('❌ Scene loading failed:', error);
            throw error;
        }
    }

    /**
     * Reconstruct Three.js scene from serialized data
     */
    async reconstructScene(sceneData, sceneAssets) {
        console.log('🏗️ Reconstructing scene from serialized data...');
        
        const sceneObjects = sceneData.scene_data?.objects || [];
        const reconstructedObjects = [];

        for (const objectData of sceneObjects) {
            try {
                console.log(`🔧 Reconstructing object: ${objectData.name} (${objectData.type})`);
                
                // Handle library models (the main type we save)
                if (objectData.type === 'library_model' && (objectData.libraryAssetId || objectData.modelUrl)) {
                    // Load the model from the URL
                    let loadedModel = null;
                    
                    if (objectData.modelUrl) {
                        // Load directly from URL
                        console.log(`📥 Loading library model from URL: ${objectData.assetName}`);
                        
                        // Use the library browser's loader if available
                        if (window.libraryBrowser && window.libraryBrowser.loadModelFromUrl) {
                            loadedModel = await window.libraryBrowser.loadModelFromUrl(objectData.modelUrl);
                        } else {
                            // Fallback to direct GLTFLoader
                            const loader = new THREE.GLTFLoader();
                            const gltf = await new Promise((resolve, reject) => {
                                loader.load(
                                    objectData.modelUrl,
                                    resolve,
                                    (progress) => console.log('Loading...', progress),
                                    reject
                                );
                            });
                            loadedModel = gltf.scene;
                        }
                        
                        // Restore model metadata
                        if (loadedModel) {
                            loadedModel.userData.assetId = objectData.libraryAssetId;
                            loadedModel.userData.assetName = objectData.assetName;
                            loadedModel.userData.instanceId = objectData.instanceId;
                            loadedModel.userData.isMultiModelInstance = true;
                            loadedModel.userData.selectable = true;
                            
                            // Apply selectable flag to all mesh children (must use same instanceId throughout)
                            const tempInstanceId = objectData.instanceId || `model_${Date.now()}`;
                            loadedModel.userData.instanceId = tempInstanceId;
                            loadedModel.traverse(child => {
                                if (child.isMesh) {
                                    child.userData.selectable = true;
                                    child.userData.parentInstanceId = tempInstanceId;
                                }
                            });
                            
                            // First, process the model to detect materials with "Image" in the name
                            if (window.detectImageMaterials) {
                                window.detectImageMaterials(loadedModel);
                            }
                            
                            // Apply model scale factor FIRST (from library)
                            if (objectData.modelScaleFactor) {
                                loadedModel.scale.setScalar(objectData.modelScaleFactor);
                            }
                            
                            // Then apply the saved transform (user modifications)
                            if (objectData.scale) {
                                // This is the full scale including any user modifications
                                loadedModel.scale.set(objectData.scale.x, objectData.scale.y, objectData.scale.z);
                            }
                            
                            // Set position directly - don't use addModelToScene which would reposition
                            if (objectData.position) {
                                loadedModel.position.set(objectData.position.x, objectData.position.y, objectData.position.z);
                            }
                            
                            if (objectData.rotation) {
                                loadedModel.rotation.set(objectData.rotation.x, objectData.rotation.y, objectData.rotation.z);
                            }
                            
                            // Add directly to scene instead of using addModelToScene
                            // to preserve the exact saved position
                            window.scene.add(loadedModel);
                            
                            console.log(`📦 Added model to scene: ${loadedModel.name} (Type: ${loadedModel.type}, Selectable: ${loadedModel.userData.selectable})`);
                            
                            // Manually register with the model tracking system
                            if (window.sceneModels) {
                                // Ensure unique instanceId that won't conflict
                                const finalInstanceId = tempInstanceId.startsWith('model_') ? 
                                    tempInstanceId : `model_${tempInstanceId}`;
                                    
                                const modelData = {
                                    instanceId: finalInstanceId,
                                    model: loadedModel,
                                    name: objectData.assetName || 'Loaded Model',
                                    assetId: objectData.libraryAssetId,
                                    addedAt: new Date()
                                };
                                window.sceneModels.set(finalInstanceId, modelData);
                                
                                // Update the model's instanceId to match
                                loadedModel.userData.instanceId = finalInstanceId;
                                
                                console.log(`✅ Library model reconstructed: ${objectData.assetName} (Instance: ${finalInstanceId})`);
                                console.log(`📊 Total models tracked: ${window.sceneModels.size}`);
                            }
                            
                            reconstructedObjects.push(loadedModel);
                        }
                    }
                }
                // Keep backward compatibility for old format
                else if (objectData.type === 'glb_model' && objectData.assetId) {
                    console.warn(`⚠️ Old format GLB model found - skipping (no longer supported)`);
                }
            } catch (objectError) {
                console.warn(`⚠️ Failed to reconstruct object ${objectData.name}:`, objectError);
            }
        }
        
        // Update scene status to reflect loaded models
        if (window.updateSceneStatus) {
            window.updateSceneStatus();
        }
        
        // Update selection system after all models are loaded
        // Add a small delay to ensure everything is fully initialized
        setTimeout(() => {
            if (window.optimizedSelectionSystem) {
                console.log('🔄 Updating selection system after scene load...');
                window.optimizedSelectionSystem.updateSelectableObjects();
                
                // Debug: Check what's in the scene
                console.log('📊 Scene children after load:', window.scene.children.map(child => ({
                    name: child.name,
                    type: child.type,
                    selectable: child.userData.selectable,
                    hasChildren: child.children.length > 0
                })));
            }
        }, 100);

        // Restore canvas texture if available
        if (sceneData.scene_data?.canvasTexture && window.uvTextureEditor) {
            try {
                await this.restoreCanvasTexture(sceneData.scene_data.canvasTexture);
            } catch (textureError) {
                console.warn('⚠️ Failed to restore canvas texture:', textureError);
            }
        }

        return reconstructedObjects;
    }

    /**
     * Apply camera data to current camera
     */
    applyCameraData(cameraData) {
        if (!window.camera || !cameraData) return;

        console.log('📷 Applying camera data');
        
        if (cameraData.position) {
            if (Array.isArray(cameraData.position)) {
                window.camera.position.fromArray(cameraData.position);
            } else {
                window.camera.position.set(
                    cameraData.position.x,
                    cameraData.position.y,
                    cameraData.position.z
                );
            }
        }

        if (cameraData.rotation) {
            if (Array.isArray(cameraData.rotation)) {
                window.camera.rotation.fromArray(cameraData.rotation);
            } else {
                window.camera.rotation.set(
                    cameraData.rotation.x,
                    cameraData.rotation.y,
                    cameraData.rotation.z
                );
            }
        }

        // Update controls target if available
        if (window.controls && cameraData.target) {
            if (Array.isArray(cameraData.target)) {
                window.controls.target.fromArray(cameraData.target);
            } else {
                window.controls.target.set(
                    cameraData.target.x,
                    cameraData.target.y,
                    cameraData.target.z
                );
            }
            window.controls.update();
        }
    }

    /**
     * Apply lighting data to scene
     */
    applyLightingData(lightingData) {
        console.log('💡 Applying lighting data');
        
        // Apply lighting preset or custom lighting
        if (lightingData.preset && window.lightingConfig) {
            // Apply preset lighting if available
            console.log(`🎨 Applying lighting preset: ${lightingData.preset}`);
        }
        
        // Apply custom light settings if available
        if (lightingData.lights && window.updateLighting) {
            // Update individual light settings
            window.updateLighting();
        }
    }

    /**
     * Restore canvas texture from base64 data
     */
    async restoreCanvasTexture(canvasTextureData) {
        if (!canvasTextureData || !window.uvTextureEditor) return;

        console.log('🎨 Restoring canvas texture');
        
        // Create image from base64 data
        const img = new Image();
        img.onload = () => {
            // Draw to canvas editor
            const canvas = window.uvTextureEditor.getCanvas();
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Update texture
            if (window.uvTextureEditor.updateTexture) {
                window.uvTextureEditor.updateTexture();
            }
            
            console.log('✅ Canvas texture restored');
        };
        
        img.src = canvasTextureData;
    }

    /**
     * Clear user data
     */
    clearUserData() {
        this.user = null;
        this.userScenes = [];
        this.currentScene = null;
    }

    /**
     * Event dispatch system
     */
    dispatchEvent(eventType, data) {
        const event = new CustomEvent(`savedSceneManager:${eventType}`, { detail: data });
        document.dispatchEvent(event);
    }

    /**
     * Add event listener for scene manager events
     */
    addEventListener(eventType, callback) {
        document.addEventListener(`savedSceneManager:${eventType}`, callback);
    }

    /**
     * Remove event listener
     */
    removeEventListener(eventType, callback) {
        document.removeEventListener(`savedSceneManager:${eventType}`, callback);
    }
}

// Export to global scope
window.SavedSceneManager = SavedSceneManager;

// Initialize when both Supabase and AuthManager are available
const initializeSavedSceneManager = () => {
    const checkDependencies = setInterval(() => {
        if (window.supabase && window.authManager) {
            window.savedSceneManager = new SavedSceneManager(window.supabase);
            console.log('✅ Saved Scene Management System initialized');
            clearInterval(checkDependencies);
        }
    }, 500);
};

// Start initialization
initializeSavedSceneManager();
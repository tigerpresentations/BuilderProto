// Scene Serialization Manager - Three.js native approach
// Replaces custom serialization with Three.js ObjectLoader system
// Integrates with existing BuilderProto components

class SceneSerializationManager {
    constructor(supabaseClient = null) {
        this.objectLoader = new THREE.ObjectLoader();
        this.resourceTracker = new ResourceTracker();
        this.isLoading = false;
        this.isSaving = false;
        
        // Get Supabase client from multiple possible sources
        this.supabase = supabaseClient || 
                       window.supabase || 
                       window.authManager?.supabase ||
                       null;
        
        if (!this.supabase) {
            console.error('❌ No Supabase client found. Make sure auth.js is loaded first.');
        }
        
        console.log('✅ SceneSerializationManager initialized');
        console.log('🔍 Supabase client:', !!this.supabase);
        
        // Test method to verify the instance is working
        this.test = () => {
            console.log('🧪 Test method called - SceneSerializationManager is working');
            return 'working';
        };
    }
    
    // Save complete scene state to Supabase using Three.js native format
    async saveScene(sceneName = 'Untitled Scene', description = '') {
        console.log(`🚀 Starting saveScene: ${sceneName}`);
        
        if (this.isSaving) {
            console.warn('⚠️ Save already in progress');
            return null;
        }
        
        this.isSaving = true;
        
        try {
            console.log(`💾 Saving scene to Supabase: ${sceneName}`);
            console.log('🔍 Checking Supabase client...');
            
            if (!this.supabase) {
                console.error('❌ Supabase client not available');
                throw new Error('Supabase client not available');
            }
            console.log('✅ Supabase client available');
            
            // Check authentication with server validation
            console.log('🔍 Checking authentication...');
            console.log('🔍 Supabase client available:', !!this.supabase);
            console.log('🔍 Supabase auth available:', !!this.supabase?.auth);
            
            let { data: { user }, error: authError } = await this.supabase.auth.getUser();
            
            console.log('🔍 Auth response:', { user: !!user, userEmail: user?.email, error: authError });
            
            if (authError) {
                console.error('❌ Authentication error:', authError);
                throw new Error(`Authentication failed: ${authError.message}`);
            }
            
            if (!user) {
                console.error('❌ No user found - checking alternative auth sources...');
                
                // Check alternative auth sources
                const authManagerUser = window.authManager?.getCurrentUser();
                console.log('🔍 AuthManager user:', !!authManagerUser);
                
                if (authManagerUser) {
                    console.log('✅ Found user via AuthManager, using that instead');
                    user = authManagerUser;
                } else {
                    throw new Error('You must be logged in to save designs');
                }
            } else {
                console.log('✅ User authenticated via Supabase:', user.email);
            }
            
            // Native Three.js JSON serialization
            console.log('🔍 Starting Three.js scene serialization...');
            const sceneData = window.scene.toJSON();
            console.log('✅ Scene data serialized, size:', JSON.stringify(sceneData).length, 'chars');
            
            // Collect BuilderProto-specific data
            const customData = await this.collectCustomData();
            
            // Combine Three.js data with custom data
            const completeSceneData = {
                metadata: {
                    version: 4.3,
                    type: "Scene",
                    generator: "BuilderProto",
                    appVersion: "1.0",
                    threeVersion: THREE.REVISION
                },
                threeJsScene: sceneData,
                builderProtoData: customData
            };
            
            // Generate scene ID
            const sceneId = crypto.randomUUID();
            
            // Store JSON in Supabase Storage
            const jsonPath = `scenes/${user.id}/${sceneId}.json`;
            console.log('🔍 Uploading to Storage path:', jsonPath);
            const { error: storageError } = await this.supabase.storage
                .from('user-scenes')
                .upload(jsonPath, JSON.stringify(completeSceneData, null, 2), {
                    contentType: 'application/json',
                    cacheControl: '3600'
                });
            
            if (storageError) {
                console.error('❌ Storage upload error:', storageError);
                throw storageError;
            }
            console.log('✅ Scene JSON uploaded to Storage');
            
            // Save canvas texture as asset
            await this.saveCanvasTextureAsset(sceneId, user.id);
            
            // Create database record with metadata
            const { data: sceneRecord, error: dbError } = await this.supabase
                .from('scenes')
                .insert({
                    id: sceneId,
                    user_id: user.id,
                    name: sceneName,
                    description: description,
                    scene_json_url: jsonPath,
                    canvas_resolution: window.canvas?.width || 1024,
                    lighting_preset: this.detectLightingPreset(),
                    asset_count: this.countSceneAssets(),
                    total_file_size: JSON.stringify(completeSceneData).length
                })
                .select()
                .single();
            
            if (dbError) throw dbError;
            
            console.log(`✅ Scene saved to Supabase: ${sceneName}`, sceneRecord);
            return sceneRecord;
            
        } catch (error) {
            console.error('❌ Scene save failed:', error);
            throw error;
        } finally {
            this.isSaving = false;
        }
    }
    
    // Load scene from Supabase using Three.js native ObjectLoader
    async loadScene(sceneId) {
        if (this.isLoading) {
            console.warn('⚠️ Load already in progress');
            return false;
        }
        
        this.isLoading = true;
        
        try {
            console.log(`📂 Loading scene from Supabase: ${sceneId}`);
            
            if (!this.supabase) {
                throw new Error('Supabase client not available');
            }
            
            // Get scene record from database
            const { data: sceneRecord, error: dbError } = await this.supabase
                .from('scenes')
                .select('*')
                .eq('id', sceneId)
                .single();
            
            if (dbError) throw dbError;
            
            // Download scene JSON from Storage
            const { data: jsonData, error: storageError } = await this.supabase.storage
                .from('user-scenes')
                .download(sceneRecord.scene_json_url);
            
            if (storageError) throw storageError;
            
            // Parse scene data
            const jsonText = await jsonData.text();
            const completeSceneData = JSON.parse(jsonText);
            
            console.log(`📂 Loaded scene data for: ${sceneRecord.name}`);
            
            // Clear existing scene with proper disposal
            await this.clearCurrentScene();
            
            // Native Three.js deserialization
            const restoredScene = this.objectLoader.parse(completeSceneData.threeJsScene);
            
            // Add restored objects to main scene
            if (restoredScene) {
                this.addRestoredObjectsToScene(restoredScene);
            }
            
            // Restore BuilderProto-specific state
            if (completeSceneData.builderProtoData) {
                await this.restoreCustomData(completeSceneData.builderProtoData);
            }
            
            // Restore canvas texture from assets
            await this.restoreCanvasTextureAsset(sceneId);
            
            // Update all systems
            this.updateSystemsAfterLoad();
            
            console.log(`✅ Scene loaded from Supabase: ${sceneRecord.name}`);
            return sceneRecord;
            
        } catch (error) {
            console.error('❌ Scene load failed:', error);
            // Attempt recovery by clearing scene
            await this.clearCurrentScene();
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    async collectCustomData() {
        const customData = {};
        
        // Canvas texture data
        if (window.layerManager && window.layerManager.canvas) {
            try {
                customData.canvasTexture = window.layerManager.canvas.toDataURL('image/png');
                customData.canvasLayers = window.layerManager.exportLayerData();
            } catch (error) {
                console.warn('⚠️ Failed to save canvas data:', error);
            }
        }
        
        // Camera state
        if (window.camera && window.controls) {
            customData.cameraState = {
                position: window.camera.position.toArray(),
                rotation: window.camera.rotation.toArray(),
                target: window.controls.target.toArray(),
                zoom: window.camera.zoom || 1
            };
        }
        
        // Selection state (just IDs, not full objects)
        if (window.optimizedSelectionSystem) {
            const selectedObjects = window.optimizedSelectionSystem.getSelectedObjects();
            customData.selectedObjectNames = selectedObjects.map(obj => obj.name).filter(name => name);
        }
        
        // Model library references
        customData.libraryModels = this.collectLibraryModelReferences();
        
        // Lighting state
        customData.lightingState = this.collectLightingState();
        
        return customData;
    }
    
    collectLibraryModelReferences() {
        const references = [];
        
        if (window.scene) {
            window.scene.traverse((child) => {
                // Look for objects with library metadata
                if (child.userData.isLibraryModel) {
                    references.push({
                        name: child.name,
                        libraryId: child.userData.libraryId,
                        position: child.position.toArray(),
                        rotation: child.rotation.toArray(),
                        scale: child.scale.toArray(),
                        visible: child.visible
                    });
                }
            });
        }
        
        return references;
    }
    
    collectLightingState() {
        const lightingState = {};
        
        if (window.scene) {
            window.scene.traverse((child) => {
                if (child.isLight) {
                    lightingState[child.name || child.type] = {
                        type: child.type,
                        position: child.position.toArray(),
                        color: child.color.getHex(),
                        intensity: child.intensity,
                        visible: child.visible
                    };
                    
                    // Additional properties for specific light types
                    if (child.isDirectionalLight) {
                        lightingState[child.name || child.type].target = child.target.position.toArray();
                    }
                }
            });
        }
        
        return lightingState;
    }
    
    async clearCurrentScene() {
        console.log('🗑️ Clearing current scene...');
        
        // Clear selection and transform controls
        if (window.transformControls) {
            window.transformControls.detach();
        }
        
        if (window.selectedObjects) {
            window.selectedObjects.clear();
        }
        
        // Dispose of all tracked resources
        this.resourceTracker.dispose();
        
        // Clear scene children (preserve lights, camera, grid)
        const childrenToRemove = [];
        window.scene.children.forEach(child => {
            if (!child.isLight && !child.isCamera && !child.name?.includes('grid')) {
                childrenToRemove.push(child);
            }
        });
        
        childrenToRemove.forEach(child => {
            window.scene.remove(child);
        });
        
        // Clear canvas layers if they exist
        if (window.layerManager) {
            window.layerManager.clearLayers();
        }
        
        // Update texture
        if (window.uvTextureEditor) {
            window.uvTextureEditor.updateTexture();
        }
        
        console.log('✅ Current scene cleared with proper resource disposal');
    }
    
    addRestoredObjectsToScene(restoredScene) {
        if (!restoredScene || !window.scene) return;
        
        // Add all non-infrastructure objects to the main scene
        const objectsToAdd = [];
        
        restoredScene.traverse((child) => {
            // Skip the root scene object itself
            if (child === restoredScene) return;
            
            // Skip lights and infrastructure (they should be preserved)
            if (child.isLight || child.isCamera || 
                child.type === 'GridHelper' || child.type === 'AxesHelper') {
                return;
            }
            
            objectsToAdd.push(child);
        });
        
        // Add objects to main scene (maintaining hierarchy)
        objectsToAdd.forEach(obj => {
            if (!obj.parent || obj.parent === restoredScene) {
                window.scene.add(obj);
            }
        });
        
        console.log(`✅ Added ${objectsToAdd.length} restored objects to scene`);
    }
    
    async restoreCustomData(customData) {
        if (!customData) return;
        
        // Restore canvas texture and layers
        if (customData.canvasTexture && window.layerManager) {
            try {
                await this.restoreCanvasTexture(customData.canvasTexture);
                
                if (customData.canvasLayers) {
                    window.layerManager.importLayerData(customData.canvasLayers);
                }
            } catch (error) {
                console.warn('⚠️ Failed to restore canvas data:', error);
            }
        }
        
        // Restore camera state
        if (customData.cameraState && window.camera && window.controls) {
            this.restoreCameraState(customData.cameraState);
        }
        
        // Restore selection state (after objects are loaded)
        if (customData.selectedObjectNames && window.optimizedSelectionSystem) {
            setTimeout(() => {
                this.restoreSelectionState(customData.selectedObjectNames);
            }, 100);
        }
    }
    
    async restoreCanvasTexture(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = window.layerManager.canvas;
                const ctx = canvas.getContext('2d');
                
                // Clear and draw restored image
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Update Three.js texture
                if (window.uvTextureEditor) {
                    window.uvTextureEditor.updateTexture();
                }
                
                resolve();
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    }
    
    restoreCameraState(cameraState) {
        try {
            window.camera.position.fromArray(cameraState.position);
            window.camera.rotation.fromArray(cameraState.rotation);
            window.controls.target.fromArray(cameraState.target);
            
            if (cameraState.zoom) {
                window.camera.zoom = cameraState.zoom;
                window.camera.updateProjectionMatrix();
            }
            
            window.controls.update();
            console.log('✅ Camera state restored');
        } catch (error) {
            console.warn('⚠️ Failed to restore camera state:', error);
        }
    }
    
    restoreSelectionState(selectedObjectNames) {
        if (!selectedObjectNames.length) return;
        
        try {
            // Find objects by name and select them
            selectedObjectNames.forEach(name => {
                window.scene.traverse((child) => {
                    if (child.name === name) {
                        window.optimizedSelectionSystem.selectObject(child, false);
                    }
                });
            });
            
            console.log(`✅ Restored selection for ${selectedObjectNames.length} objects`);
        } catch (error) {
            console.warn('⚠️ Failed to restore selection state:', error);
        }
    }
    
    updateSystemsAfterLoad() {
        // Debug: Log what's actually in the scene
        console.log('🔍 Scene children after load:', window.scene.children.map(child => ({
            name: child.name || 'unnamed',
            type: child.type,
            hasChildren: child.children.length > 0,
            childCount: child.children.length,
            userData: child.userData
        })));
        
        // Update selectable objects list
        if (window.optimizedSelectionSystem) {
            // Clear current selection first (this properly detaches transform controls)
            window.optimizedSelectionSystem.deselectAll();
            // Then update selectable objects
            window.optimizedSelectionSystem.updateSelectableObjects();
        }
        
        // Update model library if needed
        if (window.modelLibrary) {
            window.modelLibrary.refreshPreview();
        }
        
        // Force render update
        if (window.renderer && window.scene && window.camera) {
            window.renderer.render(window.scene, window.camera);
        }
        
        console.log('✅ All systems updated after scene load');
    }
    
    generateSceneId() {
        return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // File loading helper
    loadFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file.name.endsWith('.scene.json')) {
                reject(new Error('Invalid file format. Expected .scene.json'));
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const sceneData = JSON.parse(e.target.result);
                    resolve(sceneData);
                } catch (error) {
                    reject(new Error('Invalid JSON format'));
                }
            };
            reader.onerror = () => reject(new Error('File reading failed'));
            reader.readAsText(file);
        });
    }
    
    // Supabase-specific methods
    async saveCanvasTextureAsset(sceneId, userId) {
        if (!window.canvas) return;
        
        try {
            const blob = await new Promise(resolve => 
                window.canvas.toBlob(resolve, 'image/png')
            );
            
            const assetPath = `assets/${userId}/${sceneId}/canvas-texture.png`;
            
            // Upload canvas texture
            const { error: uploadError } = await this.supabase.storage
                .from('scene-assets')
                .upload(assetPath, blob, {
                    cacheControl: '3600',
                    contentType: 'image/png'
                });
            
            if (uploadError) throw uploadError;
            
            // Get public URL
            const { data: publicUrlData } = this.supabase.storage
                .from('scene-assets')
                .getPublicUrl(assetPath);
            
            // Register in database
            await this.supabase
                .from('scene_assets')
                .insert({
                    scene_id: sceneId,
                    name: 'canvas-texture.png',
                    asset_type: 'texture',
                    file_size: blob.size,
                    mime_type: 'image/png',
                    storage_path: assetPath,
                    asset_url: publicUrlData.publicUrl
                });
                
            console.log('✅ Canvas texture saved as asset');
            
        } catch (error) {
            console.error('⚠️ Canvas texture save failed:', error);
        }
    }
    
    async restoreCanvasTextureAsset(sceneId) {
        try {
            const { data: assets, error } = await this.supabase
                .from('scene_assets')
                .select('*')
                .eq('scene_id', sceneId)
                .eq('asset_type', 'texture');
            
            if (error || !assets.length) return;
            
            const canvasAsset = assets.find(asset => asset.name === 'canvas-texture.png');
            if (!canvasAsset) return;
            
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                if (window.canvas) {
                    const ctx = window.canvas.getContext('2d');
                    ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
                    ctx.drawImage(img, 0, 0);
                    
                    // Trigger texture update
                    if (window.canvasTexture) {
                        window.canvasTexture.needsUpdate = true;
                    }
                    
                    this.updateMaterialReferences();
                    console.log('✅ Canvas texture restored from asset');
                }
            };
            img.src = canvasAsset.asset_url;
            
        } catch (error) {
            console.error('⚠️ Canvas texture restore failed:', error);
        }
    }
    
    updateMaterialReferences() {
        if (!window.canvasTexture) return;
        
        window.scene.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                    if (material.name && material.name.toLowerCase().includes('image')) {
                        material.map = window.canvasTexture;
                        material.needsUpdate = true;
                    }
                });
            }
        });
    }
    
    countSceneAssets() {
        let count = 0;
        window.scene.traverse((child) => {
            if (child.isMesh) count++;
        });
        return count;
    }
    
    detectLightingPreset() {
        const lights = [];
        window.scene.traverse((child) => {
            if (child.isLight) lights.push(child.type);
        });
        
        if (lights.includes('HemisphereLight') && lights.includes('DirectionalLight')) {
            return 'studio';
        }
        return 'custom';
    }
    
    // Debug authentication status
    async debugAuth() {
        console.log('=== Authentication Debug ===');
        
        // Check if Supabase client exists
        console.log('Supabase client:', !!this.supabase);
        console.log('Window supabase:', !!window.supabase);
        console.log('AuthManager:', !!window.authManager);
        
        if (window.authManager) {
            const authUser = window.authManager.getCurrentUser();
            console.log('AuthManager user:', authUser?.email || 'None');
        }
        
        if (this.supabase) {
            try {
                const { data: { user } } = await this.supabase.auth.getUser();
                console.log('Supabase getUser:', user?.email || 'None');
            } catch (error) {
                console.log('Supabase getUser error:', error.message);
            }
            
            try {
                const { data: { session } } = await this.supabase.auth.getSession();
                console.log('Supabase session:', session?.user?.email || 'None');
            } catch (error) {
                console.log('Supabase session error:', error.message);
            }
        }
        
        console.log('===========================');
    }
    
    // Scene management methods
    async listUserScenes() {
        try {
            const { data: scenes, error } = await this.supabase
                .from('scenes')
                .select('id, name, description, thumbnail_url, created_at, updated_at, asset_count')
                .order('updated_at', { ascending: false });
            
            if (error) throw error;
            return scenes;
            
        } catch (error) {
            console.error('Failed to list scenes:', error);
            throw error;
        }
    }
    
    async deleteScene(sceneId) {
        try {
            // Get scene record
            const { data: scene, error: fetchError } = await this.supabase
                .from('scenes')
                .select('scene_json_url')
                .eq('id', sceneId)
                .single();
            
            if (fetchError) throw fetchError;
            
            // Delete from storage
            const { error: storageError } = await this.supabase.storage
                .from('user-scenes')
                .remove([scene.scene_json_url]);
            
            if (storageError) console.warn('Storage cleanup failed:', storageError);
            
            // Delete scene assets
            await this.supabase
                .from('scene_assets')
                .delete()
                .eq('scene_id', sceneId);
            
            // Delete scene record
            const { error: deleteError } = await this.supabase
                .from('scenes')
                .delete()
                .eq('id', sceneId);
            
            if (deleteError) throw deleteError;
            
            console.log('Scene deleted successfully');
            
        } catch (error) {
            console.error('Delete failed:', error);
            throw error;
        }
    }

    dispose() {
        this.resourceTracker.dispose();
        console.log('✅ SceneSerializationManager disposed');
    }
}

// Export globally
window.SceneSerializationManager = SceneSerializationManager;

console.log('✅ SceneSerializationManager with Supabase integration loaded');
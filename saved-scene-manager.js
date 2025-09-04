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
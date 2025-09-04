// Asset Management System for Scene Serialization
// Handles upload, storage, and retrieval of scene assets via Supabase

class AssetManager {
    constructor(supabase) {
        this.supabase = supabase;
        this.bucket = 'scene-assets';
        this.supportedAssetTypes = {
            'glb': ['model/gltf-binary'],
            'gltf': ['model/gltf+json', 'application/json'],
            'texture': ['image/jpeg', 'image/png', 'image/webp'],
            'image': ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        };
        this.maxFileSize = 50 * 1024 * 1024; // 50MB
    }

    /**
     * Upload an asset to Supabase Storage and create database record
     * @param {File} file - The file to upload
     * @param {string} sceneId - The scene ID this asset belongs to
     * @param {string} assetType - Type of asset (glb, gltf, texture, image)
     * @param {Object} metadata - Additional metadata for the asset
     * @returns {Object} Asset record with storage path and metadata
     */
    async uploadAsset(file, sceneId, assetType, metadata = {}) {
        console.log(`📤 Uploading asset: ${file.name} (${assetType})`);
        
        try {
            // 1. Validate file
            this.validateAssetFile(file, assetType);
            
            // 2. Get current user
            const { data: { user }, error: userError } = await this.supabase.auth.getUser();
            if (userError || !user) {
                throw new Error('User authentication required');
            }
            
            // 3. Generate storage path
            const fileName = this.generateAssetFileName(file.name, assetType);
            const storagePath = `${user.id}/scenes/${sceneId}/${assetType}s/${fileName}`;
            
            // 4. Upload to Supabase Storage
            console.log(`📁 Uploading to storage path: ${storagePath}`);
            const { data: uploadData, error: uploadError } = await this.supabase.storage
                .from(this.bucket)
                .upload(storagePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });
                
            if (uploadError) {
                throw new Error(`Storage upload failed: ${uploadError.message}`);
            }
            
            // 5. Create database record
            const assetRecord = {
                scene_id: sceneId,
                user_id: user.id,
                name: file.name,
                asset_type: assetType,
                file_size: file.size,
                mime_type: file.type,
                storage_path: storagePath,
                storage_bucket: this.bucket,
                model_metadata: metadata.modelMetadata || null
            };
            
            const { data: dbData, error: dbError } = await this.supabase
                .from('scene_assets')
                .insert(assetRecord)
                .select()
                .single();
                
            if (dbError) {
                // Cleanup uploaded file if database insert fails
                await this.supabase.storage
                    .from(this.bucket)
                    .remove([storagePath]);
                throw new Error(`Database insert failed: ${dbError.message}`);
            }
            
            console.log(`✅ Asset uploaded successfully:`, {
                id: dbData.id,
                name: dbData.name,
                size: `${(dbData.file_size / 1024).toFixed(2)}KB`,
                path: dbData.storage_path
            });
            
            return dbData;
            
        } catch (error) {
            console.error('❌ Asset upload failed:', error);
            throw error;
        }
    }

    /**
     * Upload canvas texture as PNG asset
     * @param {string} sceneId - Scene ID
     * @param {HTMLCanvasElement} canvas - Canvas element to upload
     * @param {string} layerName - Name for the layer
     * @returns {Object} Asset record
     */
    async uploadCanvasTexture(sceneId, canvas, layerName = 'canvas-texture') {
        return new Promise((resolve, reject) => {
            canvas.toBlob(async (blob) => {
                try {
                    // Create File object from blob
                    const file = new File([blob], `${layerName}.png`, { type: 'image/png' });
                    
                    // Upload as image asset
                    const assetRecord = await this.uploadAsset(file, sceneId, 'image', {
                        isCanvasTexture: true,
                        canvasResolution: `${canvas.width}x${canvas.height}`
                    });
                    
                    resolve(assetRecord);
                } catch (error) {
                    reject(error);
                }
            }, 'image/png', 0.95);
        });
    }

    /**
     * Get signed URL for accessing an asset
     * @param {string} storagePath - Storage path of the asset
     * @param {number} expiresIn - Expiry time in seconds (default 1 hour)
     * @returns {string} Signed URL for asset access
     */
    async getAssetUrl(storagePath, expiresIn = 3600) {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucket)
                .createSignedUrl(storagePath, expiresIn);
                
            if (error) {
                throw error;
            }
            
            return data.signedUrl;
        } catch (error) {
            console.error('❌ Failed to get asset URL:', error);
            throw new Error(`Failed to get asset URL: ${error.message}`);
        }
    }

    /**
     * Get all assets for a scene
     * @param {string} sceneId - Scene ID
     * @returns {Array} Array of asset records
     */
    async getSceneAssets(sceneId) {
        try {
            const { data, error } = await this.supabase
                .from('scene_assets')
                .select('*')
                .eq('scene_id', sceneId)
                .order('created_at', { ascending: false });
                
            if (error) {
                throw error;
            }
            
            return data || [];
        } catch (error) {
            console.error('❌ Failed to get scene assets:', error);
            throw new Error(`Failed to get scene assets: ${error.message}`);
        }
    }

    /**
     * Delete an asset from storage and database
     * @param {string} assetId - Asset ID to delete
     * @returns {boolean} Success status
     */
    async deleteAsset(assetId) {
        try {
            // Get asset record first
            const { data: asset, error: getError } = await this.supabase
                .from('scene_assets')
                .select('*')
                .eq('id', assetId)
                .single();
                
            if (getError || !asset) {
                throw new Error('Asset not found');
            }
            
            // Delete from storage
            const { error: storageError } = await this.supabase.storage
                .from(this.bucket)
                .remove([asset.storage_path]);
                
            if (storageError) {
                console.warn('⚠️ Storage deletion failed:', storageError);
                // Continue with database deletion even if storage fails
            }
            
            // Delete from database
            const { error: dbError } = await this.supabase
                .from('scene_assets')
                .delete()
                .eq('id', assetId);
                
            if (dbError) {
                throw dbError;
            }
            
            console.log(`✅ Asset deleted: ${asset.name}`);
            return true;
            
        } catch (error) {
            console.error('❌ Asset deletion failed:', error);
            throw new Error(`Failed to delete asset: ${error.message}`);
        }
    }

    /**
     * Validate asset file before upload
     * @param {File} file - File to validate
     * @param {string} assetType - Expected asset type
     */
    validateAssetFile(file, assetType) {
        // Check file size
        if (file.size > this.maxFileSize) {
            throw new Error(`File size exceeds ${this.maxFileSize / 1024 / 1024}MB limit`);
        }
        
        // Check file type
        const allowedTypes = this.supportedAssetTypes[assetType];
        if (!allowedTypes || !allowedTypes.includes(file.type)) {
            throw new Error(`Invalid file type for ${assetType}. Allowed: ${allowedTypes?.join(', ')}`);
        }
        
        // Additional validation for specific types
        if (assetType === 'glb' && !file.name.toLowerCase().endsWith('.glb')) {
            throw new Error('GLB files must have .glb extension');
        }
        
        if (assetType === 'gltf' && !file.name.toLowerCase().endsWith('.gltf')) {
            throw new Error('GLTF files must have .gltf extension');
        }
    }

    /**
     * Generate unique filename for asset
     * @param {string} originalName - Original filename
     * @param {string} assetType - Asset type
     * @returns {string} Generated filename
     */
    generateAssetFileName(originalName, assetType) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const extension = originalName.split('.').pop();
        const baseName = originalName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, '_');
        
        return `${timestamp}_${random}_${baseName}.${extension}`;
    }

    /**
     * Load GLB asset from storage and return as Three.js object
     * @param {Object} assetRecord - Asset record from database
     * @returns {Promise<THREE.Object3D>} Loaded Three.js object
     */
    async loadGLBAsset(assetRecord) {
        if (assetRecord.asset_type !== 'glb') {
            throw new Error('Asset is not a GLB file');
        }
        
        try {
            // Get signed URL
            const assetUrl = await this.getAssetUrl(assetRecord.storage_path);
            
            // Load using Three.js GLTFLoader
            const loader = new THREE.GLTFLoader();
            
            return new Promise((resolve, reject) => {
                loader.load(
                    assetUrl,
                    (gltf) => {
                        console.log(`✅ GLB asset loaded: ${assetRecord.name}`);
                        
                        // Add metadata to the loaded object
                        const model = gltf.scene;
                        model.userData.assetId = assetRecord.id;
                        model.userData.assetName = assetRecord.name;
                        model.userData.fromStorage = true;
                        
                        resolve(model);
                    },
                    (progress) => {
                        const percent = (progress.loaded / progress.total * 100).toFixed(2);
                        console.log(`📥 Loading ${assetRecord.name}: ${percent}%`);
                    },
                    (error) => {
                        console.error(`❌ Failed to load GLB: ${assetRecord.name}`, error);
                        reject(new Error(`Failed to load GLB asset: ${error.message}`));
                    }
                );
            });
            
        } catch (error) {
            console.error('❌ GLB loading failed:', error);
            throw error;
        }
    }

    /**
     * Load texture asset from storage and return as Three.js texture
     * @param {Object} assetRecord - Asset record from database
     * @returns {Promise<THREE.Texture>} Loaded Three.js texture
     */
    async loadTextureAsset(assetRecord) {
        if (!['texture', 'image'].includes(assetRecord.asset_type)) {
            throw new Error('Asset is not a texture/image file');
        }
        
        try {
            // Get signed URL
            const assetUrl = await this.getAssetUrl(assetRecord.storage_path);
            
            // Load using Three.js TextureLoader
            const loader = new THREE.TextureLoader();
            
            return new Promise((resolve, reject) => {
                loader.load(
                    assetUrl,
                    (texture) => {
                        console.log(`✅ Texture asset loaded: ${assetRecord.name}`);
                        
                        // Add metadata to texture
                        texture.userData.assetId = assetRecord.id;
                        texture.userData.assetName = assetRecord.name;
                        texture.userData.fromStorage = true;
                        
                        resolve(texture);
                    },
                    (progress) => {
                        console.log(`📥 Loading texture: ${assetRecord.name}`);
                    },
                    (error) => {
                        console.error(`❌ Failed to load texture: ${assetRecord.name}`, error);
                        reject(new Error(`Failed to load texture asset: ${error.message}`));
                    }
                );
            });
            
        } catch (error) {
            console.error('❌ Texture loading failed:', error);
            throw error;
        }
    }

    /**
     * Cleanup unused assets for a scene
     * @param {string} sceneId - Scene ID
     * @returns {number} Number of assets cleaned up
     */
    async cleanupUnusedAssets(sceneId) {
        try {
            // This would implement logic to find and delete unused assets
            // For now, it's a placeholder
            console.log(`🧹 Cleanup unused assets for scene: ${sceneId} (placeholder)`);
            return 0;
        } catch (error) {
            console.error('❌ Asset cleanup failed:', error);
            throw error;
        }
    }

    /**
     * Get storage usage statistics for a user
     * @returns {Object} Storage usage stats
     */
    async getStorageStats() {
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            
            const { data, error } = await this.supabase
                .from('scene_assets')
                .select('file_size, asset_type')
                .eq('user_id', user.id);
                
            if (error) throw error;
            
            const stats = {
                totalSize: 0,
                totalAssets: data.length,
                byType: {}
            };
            
            data.forEach(asset => {
                stats.totalSize += asset.file_size;
                stats.byType[asset.asset_type] = (stats.byType[asset.asset_type] || 0) + 1;
            });
            
            return stats;
        } catch (error) {
            console.error('❌ Failed to get storage stats:', error);
            throw error;
        }
    }
}

// Export to global scope
window.AssetManager = AssetManager;

// Initialize with Supabase client when available
if (window.supabase) {
    window.assetManager = new AssetManager(window.supabase);
    console.log('✅ Asset Management System initialized');
} else {
    console.warn('⚠️ Supabase client not found - Asset Manager will initialize when available');
    
    // Watch for Supabase to become available
    const checkSupabase = setInterval(() => {
        if (window.supabase) {
            window.assetManager = new AssetManager(window.supabase);
            console.log('✅ Asset Management System initialized (delayed)');
            clearInterval(checkSupabase);
        }
    }, 1000);
}
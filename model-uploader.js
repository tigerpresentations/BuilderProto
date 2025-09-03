// Model Uploader and Inspector System
// Handles uploading GLB files to Supabase storage and provides dimension inspection tools

class ModelUploader {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.currentUpload = null;
    }

    async uploadGLBFile(file, onProgress = null) {
        if (!this.supabase) {
            throw new Error('Supabase client not available');
        }

        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `${timestamp}_${sanitizedName}`;

        try {
            // Upload to Supabase Storage
            const { data, error } = await this.supabase.storage
                .from('assets')
                .upload(filename, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            // Get public URL
            const { data: urlData } = this.supabase.storage
                .from('assets')
                .getPublicUrl(filename);

            return {
                filename: filename,
                originalName: file.name,
                size: file.size,
                url: urlData.publicUrl,
                storageData: data
            };

        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    async saveAssetToDatabase(uploadResult, assetData) {
        if (!this.supabase) {
            throw new Error('Supabase client not available');
        }

        try {
            const { data, error } = await this.supabase
                .from('assets')
                .insert({
                    name: assetData.name || uploadResult.originalName,
                    description: assetData.description || '',
                    category_id: assetData.category_id || null,
                    file_url: uploadResult.url,
                    file_name: uploadResult.originalName,
                    file_size_bytes: uploadResult.size,
                    mime_type: 'model/gltf-binary',
                    width_inches: assetData.width_inches || null,
                    height_inches: assetData.height_inches || null,
                    depth_inches: assetData.depth_inches || null,
                    model_scale_factor: assetData.model_scale_factor || null,
                    bounding_box_json: assetData.bounding_box_json || null,
                    material_count: assetData.material_count || null,
                    triangle_count: assetData.triangle_count || null,
                    editable_materials: assetData.editable_materials || [],
                    is_public: assetData.is_public || true
                })
                .select()
                .single();

            if (error) throw error;
            return data;

        } catch (error) {
            console.error('Database save error:', error);
            throw error;
        }
    }
}

class ModelInspector {
    constructor(model) {
        this.model = model;
        this.originalBounds = this.calculateBounds(model);
        this.measurements = this.extractMeasurements();
        this.originalScale = model.scale.clone();
    }
    
    calculateBounds(model) {
        const bbox = new THREE.Box3().setFromObject(model);
        return {
            min: bbox.min.clone(),
            max: bbox.max.clone(),
            size: bbox.getSize(new THREE.Vector3()),
            center: bbox.getCenter(new THREE.Vector3())
        };
    }
    
    extractMeasurements() {
        const size = this.originalBounds.size;
        return {
            width: size.x,
            height: size.y,
            depth: size.z,
            diagonal: size.length()
        };
    }

    getModelInfo() {
        let materialCount = 0;
        let triangleCount = 0;
        const editableMaterials = [];
        
        this.model.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry && child.geometry.attributes.position) {
                    triangleCount += child.geometry.attributes.position.count / 3;
                }
                
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(material => {
                        materialCount++;
                        if (material.name && material.name.toLowerCase().includes('image')) {
                            editableMaterials.push(material.name);
                        }
                    });
                }
            }
        });

        return {
            materialCount: Math.floor(materialCount),
            triangleCount: Math.floor(triangleCount),
            editableMaterials: [...new Set(editableMaterials)] // Remove duplicates
        };
    }
}

class ScaleCalculator {
    static calculateScaleFactor(currentDimension, realWorldDimension, units = 'inches') {
        const SCALE = {
            FEET_PER_UNIT: 1,
            INCHES_TO_UNITS: 1/12,
            METERS_TO_UNITS: 3.28084,
            CM_TO_UNITS: 1/30.48
        };

        let targetInThreeJSUnits;
        switch(units) {
            case 'inches':
                targetInThreeJSUnits = realWorldDimension * SCALE.INCHES_TO_UNITS;
                break;
            case 'feet':
                targetInThreeJSUnits = realWorldDimension * SCALE.FEET_PER_UNIT;
                break;
            case 'centimeters':
                targetInThreeJSUnits = realWorldDimension * SCALE.CM_TO_UNITS;
                break;
            case 'meters':
                targetInThreeJSUnits = realWorldDimension * SCALE.METERS_TO_UNITS;
                break;
            default:
                targetInThreeJSUnits = realWorldDimension * SCALE.INCHES_TO_UNITS;
        }
        
        return targetInThreeJSUnits / currentDimension;
    }
    
    static validateScaleFactor(factor) {
        return {
            isValid: factor >= 0.001 && factor <= 1000,
            warning: factor < 0.01 ? 'Model will be very small' : 
                    factor > 100 ? 'Model will be very large' : null
        };
    }

    static convertToInches(value, units) {
        const conversions = {
            'inches': 1,
            'feet': 12,
            'centimeters': 1/2.54,
            'meters': 39.3701
        };
        return value * conversions[units];
    }
}

class ScaleVisualizer {
    constructor(scene) {
        this.scene = scene;
        this.referenceObjects = new THREE.Group();
        this.scene.add(this.referenceObjects);
        this.currentBoundingBox = null;
    }
    
    addReferenceObjects() {
        this.clearVisualizations();
        
        // Human figure for scale reference (6 feet tall)
        const humanHeight = 6; // feet in Three.js units
        const humanGeometry = new THREE.CapsuleGeometry(0.5, humanHeight - 1, 4, 8);
        const humanMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.3 
        });
        const humanFigure = new THREE.Mesh(humanGeometry, humanMaterial);
        humanFigure.position.set(-8, humanHeight/2, 0);
        humanFigure.name = 'reference-human';
        this.referenceObjects.add(humanFigure);
        
        // Add a simple sign next to human figure
        const signGeometry = new THREE.PlaneGeometry(1, 0.5);
        const signMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(-6.5, 4, 0);
        sign.name = 'reference-sign';
        this.referenceObjects.add(sign);
    }
    
    showBoundingBox(model, color = 0xff0000) {
        // Remove existing bounding box
        if (this.currentBoundingBox) {
            this.referenceObjects.remove(this.currentBoundingBox);
            this.currentBoundingBox = null;
        }

        const bbox = new THREE.Box3().setFromObject(model);
        const helper = new THREE.Box3Helper(bbox, color);
        helper.name = 'bounding-box';
        this.referenceObjects.add(helper);
        this.currentBoundingBox = helper;
        return helper;
    }
    
    clearVisualizations() {
        this.referenceObjects.clear();
        this.currentBoundingBox = null;
    }

    showReferences(show) {
        this.referenceObjects.visible = show;
    }
}

class InspectorWorkflow {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.uploader = new ModelUploader(supabaseClient);
        this.inspector = null;
        this.visualizer = null;
        this.currentModel = null;
        this.originalScale = null;
        this.previewScale = null;
    }

    async handleFileUpload(file) {
        try {
            // Show loading state
            this.showMessage('Uploading file to storage...', 'info');
            
            // Upload to Supabase storage
            const uploadResult = await this.uploader.uploadGLBFile(file);
            
            // Load the model for inspection
            const model = await this.loadModelFromUrl(uploadResult.url);
            
            // Initialize inspector
            this.initializeInspector(model, uploadResult);
            
            this.showMessage('File uploaded. Configure scale and save to database.', 'success');
            
            return uploadResult;

        } catch (error) {
            console.error('Upload error:', error);
            this.showMessage('Upload failed: ' + error.message, 'error');
            throw error;
        }
    }

    async loadModelFromUrl(url) {
        return new Promise((resolve, reject) => {
            const loader = new THREE.GLTFLoader();
            loader.load(url, (gltf) => {
                resolve(gltf.scene);
            }, undefined, reject);
        });
    }

    initializeInspector(model, uploadResult) {
        this.currentModel = model;
        this.uploadResult = uploadResult;
        this.originalScale = model.scale.clone();
        
        // Create inspector and visualizer
        this.inspector = new ModelInspector(model);
        this.visualizer = new ScaleVisualizer(window.scene);
        
        // Place model in scene for inspection
        if (window.currentModel) {
            window.cleanupModel(window.currentModel);
            window.scene.remove(window.currentModel);
        }
        
        // Place model on floor
        this.placeModelForInspection(model);
        
        // Update UI with measurements
        this.updateInspectorUI();
        
        // Show inspector panel
        this.showInspectorPanel();
    }

    placeModelForInspection(model) {
        window.scene.add(model);
        
        // Calculate bounding box for placement
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Center and place on floor
        model.position.x = -center.x;
        model.position.z = -center.z;
        model.position.y = -box.min.y;
        
        // Set as current model
        window.currentModel = model;
        
        // Focus camera on model
        if (window.controls && window.camera) {
            const modelCenter = new THREE.Vector3();
            box.getCenter(modelCenter);
            modelCenter.y = size.y * 0.5;
            window.controls.target.copy(modelCenter);
            
            const distance = Math.max(size.x, size.y, size.z) * 2;
            window.camera.position.set(distance, distance * 0.7, distance);
            window.controls.update();
        }
    }

    updateInspectorUI() {
        if (!this.inspector) return;

        // Update dimension display
        document.getElementById('inspector-current-width').textContent = 
            this.inspector.measurements.width.toFixed(2);
        document.getElementById('inspector-current-height').textContent = 
            this.inspector.measurements.height.toFixed(2);
        document.getElementById('inspector-current-depth').textContent = 
            this.inspector.measurements.depth.toFixed(2);

        // Update model info if available
        const modelInfo = this.inspector.getModelInfo();
        const materialCountElement = document.getElementById('inspector-material-count');
        const triangleCountElement = document.getElementById('inspector-triangle-count');
        
        if (materialCountElement) {
            materialCountElement.textContent = modelInfo.materialCount;
        }
        if (triangleCountElement) {
            triangleCountElement.textContent = modelInfo.triangleCount.toLocaleString();
        }
    }

    previewScale() {
        console.log('previewScale called');
        console.log('inspector:', this.inspector);
        console.log('currentModel:', this.currentModel);
        
        if (!this.inspector || !this.currentModel) {
            this.showMessage('Please upload a model first', 'warning');
            return;
        }

        const dimensionType = document.getElementById('inspector-dimension-type').value;
        const realValue = parseFloat(document.getElementById('inspector-real-value').value);
        const units = document.getElementById('inspector-units').value;
        
        if (!realValue || realValue <= 0) {
            this.showMessage('Please enter a valid measurement', 'warning');
            return;
        }
        
        const currentDimension = this.inspector.measurements[dimensionType];
        const scaleFactor = ScaleCalculator.calculateScaleFactor(
            currentDimension, realValue, units
        );
        
        const validation = ScaleCalculator.validateScaleFactor(scaleFactor);
        if (!validation.isValid) {
            this.showMessage('Scale factor out of reasonable range (0.001 - 1000)', 'error');
            return;
        }
        
        // Apply preview scale
        this.currentModel.scale.copy(this.originalScale).multiplyScalar(scaleFactor);
        this.previewScale = scaleFactor;
        
        // Update UI
        document.getElementById('inspector-scale-factor').textContent = scaleFactor.toFixed(3);
        
        if (validation.warning) {
            this.showMessage(validation.warning, 'warning');
        }
        
        // Show bounding box for visual confirmation
        this.visualizer.showBoundingBox(this.currentModel);
    }

    async saveToDatabase() {
        if (!this.inspector || !this.uploadResult || !this.previewScale) {
            this.showMessage('Please preview scale before saving', 'warning');
            return;
        }

        try {
            const realValue = parseFloat(document.getElementById('inspector-real-value').value);
            const units = document.getElementById('inspector-units').value;
            const dimensionType = document.getElementById('inspector-dimension-type').value;
            
            const modelInfo = this.inspector.getModelInfo();
            
            // Calculate all dimensions in inches
            const scaledSize = this.inspector.originalBounds.size.clone().multiplyScalar(this.previewScale);
            
            const assetData = {
                name: document.getElementById('inspector-asset-name').value || this.uploadResult.originalName,
                description: document.getElementById('inspector-description').value || '',
                width_inches: ScaleCalculator.convertToInches(scaledSize.x, 'feet'), // Convert from Three.js units (feet) to inches
                height_inches: ScaleCalculator.convertToInches(scaledSize.y, 'feet'),
                depth_inches: ScaleCalculator.convertToInches(scaledSize.z, 'feet'),
                model_scale_factor: this.previewScale,
                bounding_box_json: JSON.stringify(this.inspector.originalBounds),
                material_count: modelInfo.materialCount,
                triangle_count: modelInfo.triangleCount,
                editable_materials: modelInfo.editableMaterials,
                is_public: true
            };

            const result = await this.uploader.saveAssetToDatabase(this.uploadResult, assetData);
            
            this.showMessage('Asset saved to database successfully!', 'success');
            this.hideInspectorPanel();
            
            return result;

        } catch (error) {
            console.error('Save error:', error);
            this.showMessage('Failed to save: ' + error.message, 'error');
            throw error;
        }
    }

    resetScale() {
        if (this.currentModel && this.originalScale) {
            this.currentModel.scale.copy(this.originalScale);
            this.previewScale = null;
            document.getElementById('inspector-scale-factor').textContent = '1.000';
            this.visualizer.clearVisualizations();
        }
    }

    showInspectorPanel() {
        const panel = document.getElementById('inspector-panel');
        if (panel) {
            panel.style.display = 'block';
            console.log('✅ Inspector panel shown');
        }
    }

    hideInspectorPanel() {
        const panel = document.getElementById('inspector-panel');
        if (panel) {
            panel.style.display = 'none';
            console.log('Inspector panel hidden');
        }
        
        // Clean up visualizations
        if (this.visualizer) {
            this.visualizer.clearVisualizations();
        }
        
        // Reset inspector state
        this.inspector = null;
        this.currentModel = null;
        this.originalScale = null;
        this.previewScale = null;
    }

    showMessage(message, type = 'info') {
        // Use existing notification system
        if (window.showNotification) {
            window.showNotification(message, type, 3000);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    toggleReference(show) {
        if (this.visualizer) {
            if (show) {
                this.visualizer.addReferenceObjects();
            } else {
                this.visualizer.clearVisualizations();
            }
        }
    }
}

// Export to global scope
window.ModelUploader = ModelUploader;
window.ModelInspector = ModelInspector;
window.ScaleCalculator = ScaleCalculator;
window.ScaleVisualizer = ScaleVisualizer;
window.InspectorWorkflow = InspectorWorkflow;
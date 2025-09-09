// GLB loader and model management
const loader = new THREE.GLTFLoader();
let currentModel = null; // Keep for backwards compatibility
let imageMaterials = [];

// Multi-model management system
let sceneModels = new Map(); // Map<instanceId, modelData>
let nextInstanceId = 1;
let modelPlacementGrid = {
    spacing: 3, // 3 feet between models
    currentRow: 0,
    currentCol: 0,
    maxCols: 5  // Max models per row before starting new row
};

// loadGLBFile removed - models are now loaded exclusively from Supabase library

// New multi-model function - adds models without replacing existing ones
function addModelToScene(model, scene, options = {}) {
    const instanceId = `model_${nextInstanceId++}`;
    
    console.log('🏗️ Adding model instance to scene:', {
        instanceId,
        modelName: model.name,
        modelType: model.type,
        totalModels: sceneModels.size + 1
    });
    
    // Set up model metadata
    model.userData.instanceId = instanceId;
    model.userData.selectable = true;
    model.userData.isMultiModelInstance = true;
    
    // Apply selectable flag to all mesh children
    model.traverse(child => {
        if (child.isMesh) {
            child.userData.selectable = true;
            child.userData.parentInstanceId = instanceId;
        }
    });
    
    // Calculate bounding box for placement
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Center model on its base
    model.position.x = -center.x;
    model.position.z = -center.z;
    model.position.y = -box.min.y; // Place on floor
    
    // Position model in grid layout to avoid overlapping
    const gridPosition = calculateGridPosition();
    model.position.x += gridPosition.x;
    model.position.z += gridPosition.z;
    
    // Add to scene
    scene.add(model);
    
    // Create a unique texture instance for this model
    let textureData = null;
    if (window.textureInstanceManager) {
        textureData = window.textureInstanceManager.createTextureInstance(instanceId, model.name || 'Model');
    }
    
    // Find and apply textures to "Image" materials using Three.js patterns
    const processedMaterials = new Set();
    const modelImageMaterials = []; // Materials for this specific model
    let imageMaterialCount = 0;
    
    model.traverse((child) => {
        if (child.isMesh && child.material) {
            // Handle both single materials and material arrays
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            
            materials.forEach(material => {
                // Avoid processing the same material multiple times
                if (!processedMaterials.has(material.uuid)) {
                    processedMaterials.add(material.uuid);
                    
                    const matName = material.name || '';
                    if (matName.toLowerCase().includes('image')) {
                        modelImageMaterials.push(material);
                        imageMaterialCount++;
                        
                        // Apply this model's unique texture
                        if (textureData) {
                            material.map = textureData.texture;
                        } else if (window.canvasTexture) {
                            // Fallback to global texture if texture manager not available
                            material.map = window.canvasTexture;
                        }
                        
                        // Three.js material optimization for texture editing
                        material.transparent = true;
                        material.alphaTest = 0.001; // Better than full transparency
                        material.depthWrite = true;
                        material.side = THREE.FrontSide; // Performance optimization
                        
                        // Initialize material properties for controls
                        if (!material.color) {
                            material.color = new THREE.Color(1, 1, 1); // White base color for brightness control
                        }
                        if (!material.emissive) {
                            material.emissive = new THREE.Color(0x000000); // Black = no emission
                        }
                        material.emissiveMap = null; // Will be set when emission is enabled
                        
                        material.needsUpdate = true;
                    }
                }
            });
            
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    // Register materials with texture instance
    if (textureData && window.textureInstanceManager) {
        window.textureInstanceManager.applyTextureToMaterials(instanceId, modelImageMaterials);
    }
    
    // Store in model tracking system
    const modelData = {
        instanceId,
        model,
        name: model.name || 'Unnamed Model',
        assetId: model.userData.assetId,
        dimensions: model.userData.dimensions,
        boundingBox: box,
        size,
        gridPosition,
        addedAt: new Date(),
        imageMaterialCount
    };
    
    sceneModels.set(instanceId, modelData);
    
    // Update selection system
    if (window.optimizedSelectionSystem) {
        window.optimizedSelectionSystem.updateSelectableObjects();
    }
    
    // Apply current material control values to the newly loaded model
    if (window.applyCurrentMaterialSettings) {
        window.applyCurrentMaterialSettings();
    }
    
    // Update scene status
    updateSceneStatus();
    
    console.log(`✅ Model instance added: ${instanceId} (${model.name})`, {
        imageMaterials: modelData.imageMaterialCount,
        textureApplied: window.canvasTexture ? true : false
    });
    
    return instanceId;
}

// Calculate next available grid position
function calculateGridPosition() {
    const spacing = window.feetToUnits ? window.feetToUnits(modelPlacementGrid.spacing) : modelPlacementGrid.spacing;
    
    const x = modelPlacementGrid.currentCol * spacing;
    const z = modelPlacementGrid.currentRow * spacing;
    
    // Advance to next grid position
    modelPlacementGrid.currentCol++;
    if (modelPlacementGrid.currentCol >= modelPlacementGrid.maxCols) {
        modelPlacementGrid.currentCol = 0;
        modelPlacementGrid.currentRow++;
    }
    
    return { x, z };
}

// Original single-model function - now calls addModelToScene for first model or replaces if preferred
function placeModelOnFloor(model, scene) {
    if (currentModel) {
        cleanupModel(currentModel);
        scene.remove(currentModel);
    }
    
    currentModel = model;
    
    console.log('🏗️ Adding model to scene:', {
        modelName: model.name,
        modelType: model.type,
        hasChildren: model.children.length > 0,
        children: model.children.map(c => ({name: c.name, type: c.type, isMesh: c.isMesh}))
    });
    
    scene.add(model);
    
    // All models from library are user-selectable
    const isSelectable = true;
    model.userData.selectable = isSelectable;
    
    // Apply selectable flag to all mesh children for consistency
    model.traverse(child => {
        if (child.isMesh) {
            child.userData.selectable = isSelectable;
        }
    });
    
    console.log(`🎯 Model selectability set to: ${isSelectable}`, {
        modelName: model.name,
        fromMetadata: window.currentAssetMetadata?.is_selectable,
        applied: isSelectable
    });
    
    // Calculate bounding box for placement
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Center and place on floor
    model.position.x = -center.x;
    model.position.z = -center.z;
    model.position.y = -box.min.y;
    
    // Note: No auto-scaling - models use their database-specified scale factors
    
    // Find and apply textures to "Image" materials using Three.js patterns
    imageMaterials = [];
    const processedMaterials = new Set();
    
    model.traverse((child) => {
        if (child.isMesh && child.material) {
            // Handle both single materials and material arrays
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            
            materials.forEach(material => {
                // Avoid processing the same material multiple times
                if (!processedMaterials.has(material.uuid)) {
                    processedMaterials.add(material.uuid);
                    
                    const matName = material.name || '';
                    if (matName.toLowerCase().includes('image')) {
                        imageMaterials.push(material);
                        
                        // Apply canvasTexture if available globally
                        if (window.canvasTexture) {
                            material.map = window.canvasTexture;
                        } else if (window.uvTextureEditor) {
                            // Get texture from UV editor if canvas texture isn't set yet
                            const texture = window.uvTextureEditor.getTexture();
                            if (texture) {
                                material.map = texture;
                            }
                        }
                        
                        // Three.js material optimization for texture editing
                        material.transparent = true;
                        material.alphaTest = 0.001; // Better than full transparency
                        material.depthWrite = true;
                        material.side = THREE.FrontSide; // Performance optimization
                        
                        // Initialize material properties for controls
                        if (!material.color) {
                            material.color = new THREE.Color(1, 1, 1); // White base color for brightness control
                        }
                        if (!material.emissive) {
                            material.emissive = new THREE.Color(0x000000); // Black = no emission
                        }
                        material.emissiveMap = null; // Will be set when emission is enabled
                        
                        material.needsUpdate = true;
                    }
                }
            });
            
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    // Reset backlight toggle
    const backlightToggle = document.getElementById('backlight-toggle');
    if (backlightToggle) {
        backlightToggle.checked = false;
    }
    
    // Update UI
    const modelControls = document.getElementById('model-controls');
    const status = document.getElementById('status');
    if (modelControls) modelControls.style.display = 'block';
    if (status) {
        status.textContent = `Loaded model (${imageMaterials.length} Image materials found)`;
    }
    
    updateModelControls(model);
    
    // Apply current material control values to the newly loaded model
    if (window.applyCurrentMaterialSettings) {
        window.applyCurrentMaterialSettings();
    }
    
    // Focus camera (original positioning without animation)
    const modelCenter = new THREE.Vector3();
    box.getCenter(modelCenter);
    modelCenter.y = size.y * 0.5;
    if (window.controls) {
        window.controls.target.copy(modelCenter);
        
        const distance = Math.max(size.x, size.y, size.z) * 2;
        if (window.camera) {
            window.camera.position.set(distance, distance * 0.7, distance);
        }
        window.controls.update();
    }
    
    // Update selectable objects for the optimized selection system
    if (window.optimizedSelectionSystem) {
        window.optimizedSelectionSystem.updateSelectableObjects();
    }
}

// Multi-model management functions
function removeModelInstance(instanceId) {
    const modelData = sceneModels.get(instanceId);
    if (!modelData) {
        console.warn(`Model instance ${instanceId} not found`);
        return false;
    }
    
    console.log(`🗑️ Removing model instance: ${instanceId} (${modelData.name})`);
    
    // Clean up texture instance
    if (window.textureInstanceManager) {
        window.textureInstanceManager.removeTextureInstance(instanceId);
    }
    
    // Clean up model
    cleanupModel(modelData.model);
    
    // Remove from scene
    if (window.scene) {
        window.scene.remove(modelData.model);
    }
    
    // Remove from tracking
    sceneModels.delete(instanceId);
    
    // Update selection system
    if (window.optimizedSelectionSystem) {
        window.optimizedSelectionSystem.updateSelectableObjects();
    }
    
    // Update scene status
    updateSceneStatus();
    
    console.log(`✅ Model instance removed: ${instanceId}`);
    return true;
}

function clearAllModels() {
    console.log(`🧹 Clearing all model instances (${sceneModels.size} models tracked)`);
    
    const instanceIds = Array.from(sceneModels.keys());
    console.log('📋 Models to clear:', instanceIds);
    instanceIds.forEach(id => removeModelInstance(id));
    
    // Reset grid positioning
    modelPlacementGrid.currentRow = 0;
    modelPlacementGrid.currentCol = 0;
    
    // Clear single model reference
    if (currentModel) {
        cleanupModel(currentModel);
        if (window.scene) {
            window.scene.remove(currentModel);
        }
        currentModel = null;
    }
    
    // Update scene status
    updateSceneStatus();
    
    console.log('✅ All models cleared');
}

function getModelInstance(instanceId) {
    return sceneModels.get(instanceId);
}

function getAllModelInstances() {
    return Array.from(sceneModels.values());
}

function getModelInstanceCount() {
    return sceneModels.size;
}

function updateSceneStatus() {
    const statusElement = document.getElementById('status');
    if (!statusElement) return;
    
    const modelCount = sceneModels.size;
    const currentText = statusElement.textContent;
    
    // Only update if we have models or if the current text mentions models
    if (modelCount > 0) {
        const modelText = modelCount === 1 ? '1 model loaded' : `${modelCount} models loaded`;
        
        // Preserve any authentication info that might be in the status
        const parts = currentText.split(' • ');
        const baseText = modelText;
        const authText = parts.find(part => part.includes('@') || part.includes('✓'));
        
        statusElement.textContent = authText ? `${baseText} • ${authText}` : baseText;
        statusElement.style.color = '#28a745'; // Green for active status
    } else {
        // Reset to default if no models
        const parts = currentText.split(' • ');
        const authText = parts.find(part => part.includes('@') || part.includes('✓'));
        
        if (authText) {
            statusElement.textContent = `Ready • ${authText}`;
        } else {
            statusElement.textContent = 'Ready to load models';
        }
        statusElement.style.color = '#666';
    }
}

function cleanupModel(model) {
    model.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (child.material.map && child.material.map !== window.canvasTexture) {
                child.material.map.dispose();
            }
            child.material.dispose();
        }
    });
}

function updateModelControls(model) {
    if (!model) return;
    
    // Update sliders and input fields
    const rotYSlider = document.getElementById('rot-y');
    const rotYInput = document.getElementById('rot-y-input');
    const rotation = (model.rotation.y * 180 / Math.PI) % 360;
    
    if (rotYSlider && parseFloat(rotYSlider.value) !== rotation) {
        rotYSlider.value = rotation;
    }
    if (rotYInput && parseFloat(rotYInput.value) !== rotation) {
        rotYInput.value = Math.round(rotation);
    }
}

function updateValueDisplays(model) {
    // This function is no longer needed since we removed the display spans
    // But keeping it for compatibility
}

function setupModelControlListeners() {
    // Model control sliders and inputs
    const rotYSlider = document.getElementById('rot-y');
    const rotYInput = document.getElementById('rot-y-input');
    
    if (rotYSlider) {
        rotYSlider.addEventListener('input', (e) => {
            if (currentModel) {
                const rotation = parseFloat(e.target.value);
                currentModel.rotation.y = rotation * Math.PI / 180;
                
                // Sync input field
                if (rotYInput && parseFloat(rotYInput.value) !== rotation) {
                    rotYInput.value = Math.round(rotation);
                }
            }
        });
    }
    
    if (rotYInput) {
        const updateRotationFromInput = () => {
            if (currentModel) {
                let rotation = parseFloat(rotYInput.value) || 0;
                rotation = ((rotation % 360) + 360) % 360; // Normalize to 0-360
                
                currentModel.rotation.y = rotation * Math.PI / 180;
                
                // Sync slider
                if (rotYSlider && parseFloat(rotYSlider.value) !== rotation) {
                    rotYSlider.value = rotation;
                }
                
                // Update input to normalized value
                rotYInput.value = Math.round(rotation);
            }
        };
        
        rotYInput.addEventListener('change', updateRotationFromInput);
        rotYInput.addEventListener('blur', updateRotationFromInput);
    }
    
}

// loadDefaultGLB removed - models are now loaded exclusively from Supabase library

// Export functions and variables
// window.loadGLBFile removed - using library-based loading only
window.placeModelOnFloor = placeModelOnFloor;
window.updateModelControls = updateModelControls;
window.setupModelControlListeners = setupModelControlListeners;
// window.loadDefaultGLB removed - using library-based loading only
window.cleanupModel = cleanupModel;
window.centerCameraOnModel = centerCameraOnModel;
window.setupModelDoubleClickHandler = setupModelDoubleClickHandler;

// Utility function to retroactively apply textures to existing models
function applyTexturesToAllModels() {
    console.log('🎨 Applying textures to all models in scene...');
    
    let totalImageMaterialsFound = 0;
    const processedMaterials = new Set();
    
    // Process the current single model if it exists
    if (currentModel) {
        console.log('🎯 Processing currentModel:', currentModel.name);
        totalImageMaterialsFound += applyTextureToModel(currentModel, processedMaterials);
    }
    
    // Process all multi-model instances
    sceneModels.forEach((modelData, instanceId) => {
        console.log(`🎯 Processing model instance: ${instanceId} (${modelData.name})`);
        totalImageMaterialsFound += applyTextureToModel(modelData.model, processedMaterials);
        
        // Update the stored material count
        modelData.imageMaterialCount = applyTextureToModel(modelData.model, new Set(), true); // Count only, don't apply
    });
    
    console.log(`✅ Texture application complete: ${totalImageMaterialsFound} image materials processed`);
    return totalImageMaterialsFound;
}

function applyTextureToModel(model, processedMaterials, countOnly = false) {
    let imageMaterialCount = 0;
    
    model.traverse((child) => {
        if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            
            materials.forEach(material => {
                if (!processedMaterials.has(material.uuid)) {
                    processedMaterials.add(material.uuid);
                    
                    const matName = material.name || '';
                    if (matName.toLowerCase().includes('image')) {
                        if (!countOnly) {
                            // Add to global registry if not already there
                            if (!imageMaterials.includes(material)) {
                                imageMaterials.push(material);
                            }
                            
                            // Apply canvasTexture if available globally
                            if (window.canvasTexture) {
                                material.map = window.canvasTexture;
                            } else if (window.uvTextureEditor) {
                                const texture = window.uvTextureEditor.getTexture();
                                if (texture) {
                                    material.map = texture;
                                }
                            }
                            
                            // Apply material optimizations
                            material.transparent = true;
                            material.alphaTest = 0.001;
                            material.depthWrite = true;
                            material.side = THREE.FrontSide;
                            
                            // Initialize material properties
                            if (!material.color) {
                                material.color = new THREE.Color(1, 1, 1);
                            }
                            if (!material.emissive) {
                                material.emissive = new THREE.Color(0x000000);
                            }
                            material.emissiveMap = null;
                            
                            material.needsUpdate = true;
                        }
                        
                        imageMaterialCount++;
                    }
                }
            });
        }
    });
    
    return imageMaterialCount;
}

// Export multi-model functions
window.addModelToScene = addModelToScene;
window.removeModelInstance = removeModelInstance;
window.clearAllModels = clearAllModels;
window.getModelInstance = getModelInstance;
window.getAllModelInstances = getAllModelInstances;
window.getModelInstanceCount = getModelInstanceCount;
window.updateSceneStatus = updateSceneStatus;
window.applyTexturesToAllModels = applyTexturesToAllModels;

// Export the sceneModels Map for direct access when loading saved scenes
window.sceneModels = sceneModels;

// Smooth camera animation functions with rotation awareness
function centerCameraOnModel(model, boundingBox, size) {
    if (!window.camera || !window.controls) {
        console.warn('Camera or controls not available for centering');
        return;
    }
    
    // Calculate the bounding box center and size
    const center = boundingBox.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Get model's rotation to position camera optimally
    const modelRotation = model.rotation.y; // Y-axis rotation is most common
    
    let distance;
    let newPosition;
    
    if (window.camera.isPerspectiveCamera) {
        // Perspective camera: calculate distance based on FOV
        const fov = window.camera.fov * (Math.PI / 180); // Convert to radians
        distance = maxDim / (2 * Math.tan(fov / 2)) * 1.2; // 1.2 factor for ~70% coverage
        
        // Calculate rotation-aware camera position
        // Position camera in front of where the model is facing
        const cameraAngle = modelRotation; // Same angle as model to be in front of where it's facing
        const heightOffset = maxDim * 0.2; // Slight elevation for better perspective
        
        newPosition = new THREE.Vector3(
            center.x + Math.sin(cameraAngle) * distance,
            center.y + heightOffset,
            center.z + Math.cos(cameraAngle) * distance
        );
        
        console.log('🎯 Rotation-aware camera positioning:', {
            modelRotation: (modelRotation * 180 / Math.PI).toFixed(1) + '°',
            cameraAngle: (cameraAngle * 180 / Math.PI).toFixed(1) + '°',
            distance: distance.toFixed(2)
        });
        
    } else {
        // Orthographic camera: similar rotation-aware positioning
        const currentDistance = window.camera.position.distanceTo(center);
        distance = Math.max(currentDistance, maxDim * 1.5);
        
        const cameraAngle = modelRotation; // Same angle as model to be in front of where it's facing
        const heightOffset = maxDim * 0.2;
        
        newPosition = new THREE.Vector3(
            center.x + Math.sin(cameraAngle) * distance,
            center.y + heightOffset,
            center.z + Math.cos(cameraAngle) * distance
        );
        
        // Adjust orthographic camera view size to fit the model
        const aspect = window.innerWidth / window.innerHeight;
        const viewSize = maxDim * 0.7; // Show ~70% of model bounds
        
        window.camera.left = -viewSize * aspect;
        window.camera.right = viewSize * aspect;
        window.camera.top = viewSize;
        window.camera.bottom = -viewSize;
        window.camera.updateProjectionMatrix();
        
        console.log('📐 Rotation-aware orthographic positioning:', {
            modelRotation: (modelRotation * 180 / Math.PI).toFixed(1) + '°',
            cameraAngle: (cameraAngle * 180 / Math.PI).toFixed(1) + '°',
            viewSize: viewSize,
            cameraType: 'orthographic'
        });
    }
    
    // Animate camera to new position, looking at model center
    animateCamera(newPosition, center);
}

function animateCamera(targetPosition, targetLookAt, duration = 1000) {
    if (!window.camera || !window.controls) return;
    
    const startPosition = window.camera.position.clone();
    const startTarget = window.controls.target.clone();
    const startTime = performance.now();
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Smooth easing function (ease-in-out)
        const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        // Interpolate camera position
        window.camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
        
        // Interpolate controls target
        window.controls.target.lerpVectors(startTarget, targetLookAt, easeProgress);
        
        // Update controls
        window.controls.update();
        
        // Continue animation if not complete
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

// Double-click handler for camera centering
function setupModelDoubleClickHandler() {
    if (!window.renderer || !window.renderer.domElement) return;
    
    window.renderer.domElement.addEventListener('dblclick', (event) => {
        // First try to center on selected object from optimized selection system
        let targetModel = null;
        
        if (window.optimizedSelectionSystem && window.optimizedSelectionSystem.primarySelection) {
            targetModel = window.optimizedSelectionSystem.primarySelection;
        } else if (currentModel) {
            // Fallback to currentModel for backwards compatibility
            targetModel = currentModel;
        }
        
        if (targetModel) {
            // Calculate bounding box for target model
            const box = new THREE.Box3().setFromObject(targetModel);
            const size = box.getSize(new THREE.Vector3());
            centerCameraOnModel(targetModel, box, size);
            
            console.log('🎯 Double-click centering on:', targetModel.name || 'model', {
                boundingBox: {
                    min: box.min,
                    max: box.max,
                    size: size
                }
            });
        } else {
            console.log('🎯 Double-click: No model to center on');
        }
    });
}

// Make variables available globally with proper referencing
Object.defineProperty(window, 'currentModel', {
    get: () => currentModel,
    set: (value) => { currentModel = value; }
});

Object.defineProperty(window, 'imageMaterials', {
    get: () => imageMaterials,
    set: (value) => { imageMaterials = value; }
});
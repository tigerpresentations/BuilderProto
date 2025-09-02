// GLB loader and model management
const loader = new THREE.GLTFLoader();
let currentModel = null;
let imageMaterials = [];

function loadGLBFile(file, scene) {
    const reader = new FileReader();
    reader.onload = (e) => {
        loader.parse(e.target.result, '', (gltf) => {
            placeModelOnFloor(gltf.scene, scene);
        }, (error) => {
            console.error('Error loading GLB:', error);
            const status = document.getElementById('status');
            if (status) {
                status.textContent = 'Error loading GLB file';
            }
        });
    };
    reader.readAsArrayBuffer(file);
}

function placeModelOnFloor(model, scene) {
    if (currentModel) {
        cleanupModel(currentModel);
        scene.remove(currentModel);
    }
    
    currentModel = model;
    scene.add(model);
    
    // Calculate bounding box for placement
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Center and place on floor
    model.position.x = -center.x;
    model.position.z = -center.z;
    model.position.y = -box.min.y;
    
    // Auto-scale if too large
    const maxDimension = Math.max(size.x, size.y, size.z);
    if (maxDimension > 8) {
        const scale = 8 / maxDimension;
        model.scale.setScalar(scale);
    }
    
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
                        
                        // Initialize backlight properties
                        material.emissive = new THREE.Color(0x000000);
                        material.emissiveIntensity = 0.0;
                        material.emissiveMap = null;
                        
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
    const clearModelBtn = document.getElementById('clear-model-btn');
    const modelControls = document.getElementById('model-controls');
    const status = document.getElementById('status');
    
    if (clearModelBtn) clearModelBtn.style.display = 'block';
    if (modelControls) modelControls.style.display = 'block';
    if (status) {
        status.textContent = `Loaded model (${imageMaterials.length} Image materials found)`;
    }
    
    updateModelControls(model);
    
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
    
    // Update sliders
    const posXSlider = document.getElementById('pos-x');
    const posZSlider = document.getElementById('pos-z');
    const scaleSlider = document.getElementById('scale');
    const rotYSlider = document.getElementById('rot-y');
    
    if (posXSlider) posXSlider.value = model.position.x;
    if (posZSlider) posZSlider.value = model.position.z;
    if (scaleSlider) scaleSlider.value = model.scale.x;
    if (rotYSlider) rotYSlider.value = (model.rotation.y * 180 / Math.PI) % 360;
    
    updateValueDisplays(model);
}

function updateValueDisplays(model) {
    if (!model) return;
    
    const posXVal = document.getElementById('pos-x-val');
    const posZVal = document.getElementById('pos-z-val');
    const scaleVal = document.getElementById('scale-val');
    const rotYVal = document.getElementById('rot-y-val');
    
    if (posXVal) posXVal.textContent = model.position.x.toFixed(1);
    if (posZVal) posZVal.textContent = model.position.z.toFixed(1);
    if (scaleVal) scaleVal.textContent = model.scale.x.toFixed(1);
    if (rotYVal) rotYVal.textContent = Math.round(model.rotation.y * 180 / Math.PI) + '°';
}

function setupModelControlListeners() {
    // Model control sliders
    ['pos-x', 'pos-z'].forEach((id, index) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', (e) => {
                if (currentModel) {
                    const coord = index === 0 ? 'x' : 'z';
                    currentModel.position[coord] = parseFloat(e.target.value);
                    updateValueDisplays(currentModel);
                }
            });
        }
    });
    
    const scaleSlider = document.getElementById('scale');
    if (scaleSlider) {
        scaleSlider.addEventListener('input', (e) => {
            if (currentModel) {
                const scale = parseFloat(e.target.value);
                currentModel.scale.set(scale, scale, scale);
                updateValueDisplays(currentModel);
            }
        });
    }
    
    const rotYSlider = document.getElementById('rot-y');
    if (rotYSlider) {
        rotYSlider.addEventListener('input', (e) => {
            if (currentModel) {
                currentModel.rotation.y = parseFloat(e.target.value) * Math.PI / 180;
                updateValueDisplays(currentModel);
            }
        });
    }
    
    // Backlight toggle
    const backlightToggle = document.getElementById('backlight-toggle');
    if (backlightToggle) {
        backlightToggle.addEventListener('change', (e) => {
            const backlightEnabled = e.target.checked;
            
            imageMaterials.forEach(material => {
                if (backlightEnabled) {
                    // Enable backlight glow effect
                    material.emissive = new THREE.Color(0xffffff);
                    material.emissiveIntensity = 0.3;
                    material.emissiveMap = window.canvasTexture; // Use same texture for glow
                } else {
                    // Disable backlight
                    material.emissive = new THREE.Color(0x000000);
                    material.emissiveIntensity = 0.0;
                    material.emissiveMap = null;
                }
                material.needsUpdate = true;
            });
        });
    }
    
    // Clear model button
    const clearModelBtn = document.getElementById('clear-model-btn');
    if (clearModelBtn) {
        clearModelBtn.addEventListener('click', () => {
            if (currentModel && window.scene) {
                cleanupModel(currentModel);
                window.scene.remove(currentModel);
                currentModel = null;
                imageMaterials = [];
                
                clearModelBtn.style.display = 'none';
                const modelControls = document.getElementById('model-controls');
                const backlightToggle = document.getElementById('backlight-toggle');
                const status = document.getElementById('status');
                
                if (modelControls) modelControls.style.display = 'none';
                if (backlightToggle) backlightToggle.checked = false;
                if (status) status.textContent = 'Drop a GLB file to begin';
                
                const dropZone = document.getElementById('drop-zone');
                if (dropZone) dropZone.classList.remove('hidden');
            }
        });
    }
}

function loadDefaultGLB(filename, scene) {
    fetch(filename)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
            loader.parse(arrayBuffer, '', (gltf) => {
                placeModelOnFloor(gltf.scene, scene);
                const dropZone = document.getElementById('drop-zone');
                if (dropZone) dropZone.classList.add('hidden');
            }, (error) => {
                console.warn('Could not load default GLB:', error);
            });
        })
        .catch(error => {
            console.warn('Default GLB file not found:', error);
        });
}

// Export functions and variables
window.loadGLBFile = loadGLBFile;
window.placeModelOnFloor = placeModelOnFloor;
window.updateModelControls = updateModelControls;
window.setupModelControlListeners = setupModelControlListeners;
window.loadDefaultGLB = loadDefaultGLB;
window.cleanupModel = cleanupModel;
window.centerCameraOnModel = centerCameraOnModel;
window.setupModelDoubleClickHandler = setupModelDoubleClickHandler;

// Smooth camera animation functions
function centerCameraOnModel(model, boundingBox, size) {
    if (!window.camera || !window.controls) {
        console.warn('Camera or controls not available for centering');
        return;
    }
    
    // Calculate the bounding box center and size
    const center = boundingBox.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Calculate distance to achieve ~75% viewport coverage
    const fov = window.camera.fov * (Math.PI / 180); // Convert to radians
    const distance = maxDim / (2 * Math.tan(fov / 2)) * 1.1; // 1.1 factor for ~75% coverage
    
    // Position camera in front of the model (negative Z relative to model center)
    const newPosition = new THREE.Vector3(center.x, center.y, center.z + distance);
    
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
        if (currentModel) {
            // Calculate bounding box for current model
            const box = new THREE.Box3().setFromObject(currentModel);
            const size = box.getSize(new THREE.Vector3());
            centerCameraOnModel(currentModel, box, size);
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
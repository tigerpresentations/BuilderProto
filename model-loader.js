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
            document.getElementById('status').textContent = 'Error loading GLB file';
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
    
    // Find and apply textures to "Image" materials
    imageMaterials = [];
    model.traverse((child) => {
        if (child.isMesh && child.material) {
            const matName = child.material.name || '';
            if (matName.toLowerCase().includes('image')) {
                imageMaterials.push(child.material);
                // Apply canvasTexture if available globally
                if (window.canvasTexture) {
                    child.material.map = window.canvasTexture;
                }
                
                // Initialize backlight properties
                child.material.emissive = new THREE.Color(0x000000);
                child.material.emissiveIntensity = 0.0;
                child.material.emissiveMap = null;
                
                child.material.needsUpdate = true;
            }
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    // Reset backlight toggle
    document.getElementById('backlight-toggle').checked = false;
    
    // Update UI
    document.getElementById('clear-model-btn').style.display = 'block';
    document.getElementById('model-controls').style.display = 'block';
    document.getElementById('status').textContent = 
        `Loaded model (${imageMaterials.length} Image materials found)`;
    
    updateModelControls(model);
    
    // Focus camera
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
                document.getElementById('model-controls').style.display = 'none';
                document.getElementById('backlight-toggle').checked = false;
                document.getElementById('status').textContent = 'Drop a GLB file to begin';
                
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

// Make variables available globally with proper referencing
Object.defineProperty(window, 'currentModel', {
    get: () => currentModel,
    set: (value) => { currentModel = value; }
});

Object.defineProperty(window, 'imageMaterials', {
    get: () => imageMaterials,
    set: (value) => { imageMaterials = value; }
});
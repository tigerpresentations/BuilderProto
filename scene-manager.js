// Scene setup variables (exported to window global scope)
let scene, camera, renderer, controls;
let hemisphereLight, mainLight, fillLight, floor, gridHelper;

// Scale conversion constants - 1 Three.js unit = 1 foot
const SCALE = {
    FEET_PER_UNIT: 1,
    INCHES_TO_UNITS: 1/12,        // Convert inches to Three.js units
    METERS_TO_UNITS: 3.28084,     // Convert meters to Three.js units
    UNITS_TO_FEET: 1,
    UNITS_TO_INCHES: 12,
    UNITS_TO_METERS: 1/3.28084
};

// Scale conversion utility functions
function inchesToUnits(inches) { return inches * SCALE.INCHES_TO_UNITS; }
function feetToUnits(feet) { return feet * SCALE.FEET_PER_UNIT; }
function metersToUnits(meters) { return meters * SCALE.METERS_TO_UNITS; }
function unitsToInches(units) { return units * SCALE.UNITS_TO_INCHES; }
function unitsToFeet(units) { return units * SCALE.UNITS_TO_FEET; }
function unitsToMeters(units) { return units * SCALE.UNITS_TO_METERS; }

// Lighting configuration object for dev panel
// Positions now in realistic feet-based measurements
window.lightingConfig = {
    hemisphere: {
        skyColor: 0x87ceeb,
        groundColor: 0x362f28,
        intensity: 0.5  // Balanced ambient lighting to preserve floor color
    },
    mainLight: {
        color: 0xffffff,
        intensity: 1.8,  // Balanced to maintain visibility while preserving floor darkness
        position: { x: 15, y: 12, z: 10 }, // 15ft away, 12ft high, 10ft side (in feet, converted in setupLighting)
        castShadow: true
    },
    fillLight: {
        color: 0xffffff,
        intensity: 0.5,  // Increased to provide adequate fill lighting
        position: { x: -8, y: 8, z: -5 }, // 8ft opposite side, 8ft high (in feet, converted in setupLighting)
        castShadow: false
    },
    shadows: {
        mapSize: 2048,
        cameraSize: 25,      // Increased to cover 25-foot area (appropriate for large booths)
        bias: -0.0005,
        normalBias: 0.02,
        radius: 1,
        blurScale: 1,
        penumbra: 0
    },
    toneMappingExposure: 1.0  // Restored to preserve original floor color appearance
};

function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddd); // Light grey default
    return scene;
}

function setupCamera() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Position camera for human perspective in trade show environment
    // 8 feet from booth, at eye level (5.5 feet), with slight viewing angle
    camera.position.set(feetToUnits(8), feetToUnits(5.5), feetToUnits(6));
    return camera;
}

function setupRenderer() {
    // Three.js optimized renderer setup
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance", // Better GPU selection
        stencil: false, // Performance optimization if not needed
        depth: true
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Clamp to 2 for performance
    
    // Three.js color management and tone mapping
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    // Optimized shadow settings
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; // Manual control for performance
    
    document.body.appendChild(renderer.domElement);
    
    // Setup OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI * 0.8;
    
    // Setup improved lighting system
    setupLighting();
    
    // Floor cube with Three.js material optimizations
    // Default 10×10 foot trade show booth space
    const floorGeometry = new THREE.BoxGeometry(feetToUnits(10), feetToUnits(0.1), feetToUnits(10));
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x222222, // Darker grey default
        roughness: 0.8,
        metalness: 0.1,
        // Performance optimizations
        transparent: false,
        alphaTest: 0
    });
    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -feetToUnits(0.05); // Half the height to sit on ground
    floor.receiveShadow = true;
    floor.castShadow = true;
    scene.add(floor);
    
    // Export floor globally for controls
    window.floor = floor;
    
    // Add grid overlay for scale reference
    setupGridOverlay();
    
    // Handle resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    return renderer;
}

function setupLighting() {
    const config = window.lightingConfig;
    
    // Replace harsh ambient light with natural hemisphere lighting
    hemisphereLight = new THREE.HemisphereLight(
        config.hemisphere.skyColor, 
        config.hemisphere.groundColor, 
        config.hemisphere.intensity
    );
    scene.add(hemisphereLight);
    
    // Main directional light (key light)
    mainLight = new THREE.DirectionalLight(config.mainLight.color, config.mainLight.intensity);
    mainLight.position.set(
        feetToUnits(config.mainLight.position.x), 
        feetToUnits(config.mainLight.position.y), 
        feetToUnits(config.mainLight.position.z)
    );
    mainLight.castShadow = config.mainLight.castShadow;
    
    // Optimized shadow settings for better quality
    const shadowMapSize = Math.min(config.shadows.mapSize, renderer.capabilities.maxTextureSize / 4);
    mainLight.shadow.mapSize.setScalar(shadowMapSize);
    mainLight.shadow.camera.near = 0.1;
    mainLight.shadow.camera.far = 50;
    
    // Tighter shadow camera frustum for better resolution
    const size = config.shadows.cameraSize;
    mainLight.shadow.camera.left = -size;
    mainLight.shadow.camera.right = size;
    mainLight.shadow.camera.top = size;
    mainLight.shadow.camera.bottom = -size;
    
    // Shadow bias to reduce artifacts
    mainLight.shadow.bias = config.shadows.bias;
    mainLight.shadow.normalBias = config.shadows.normalBias;
    
    // Shadow blur settings for soft shadows
    mainLight.shadow.radius = config.shadows.radius * config.shadows.blurScale;
    mainLight.penumbra = config.shadows.penumbra;
    
    // Update shadow camera projection matrix - this fixes the dark box issue
    mainLight.shadow.camera.updateProjectionMatrix();
    
    scene.add(mainLight);
    
    // Fill light for softer shadows and better contrast
    fillLight = new THREE.DirectionalLight(config.fillLight.color, config.fillLight.intensity);
    fillLight.position.set(
        feetToUnits(config.fillLight.position.x), 
        feetToUnits(config.fillLight.position.y), 
        feetToUnits(config.fillLight.position.z)
    );
    fillLight.castShadow = config.fillLight.castShadow;
    
    // Apply blur settings to fill light if it casts shadows
    if (config.fillLight.castShadow) {
        fillLight.shadow.radius = config.shadows.radius * config.shadows.blurScale;
        fillLight.penumbra = config.shadows.penumbra;
    }
    scene.add(fillLight);
    
    // Update tone mapping exposure
    renderer.toneMappingExposure = config.toneMappingExposure;
    
    // Force shadow map update and enable auto-update to prevent initial artifacts
    renderer.shadowMap.needsUpdate = true;
    renderer.shadowMap.autoUpdate = true;
    
    // Ensure all existing objects in scene have proper shadow properties
    scene.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    // Force an immediate render to initialize shadows properly
    if (window.scene && window.camera) {
        renderer.render(window.scene, window.camera);
    }
}

// Setup grid overlay for scale reference
function setupGridOverlay() {
    // Create a grid that shows 1-foot increments
    // Grid size: 30 feet x 30 feet to accommodate large booths
    const gridSize = feetToUnits(30);      // 30 feet total
    const gridDivisions = 30;              // 1 foot per division
    
    gridHelper = new THREE.GridHelper(
        gridSize,           // Size of the grid
        gridDivisions,      // Number of divisions
        0x666666,          // Center line color (medium grey)
        0x555555           // Grid line color (darker grey to blend better with floor)
    );
    
    // Position grid just above floor level
    gridHelper.position.y = feetToUnits(0.01); // 0.12 inches above floor to prevent interference
    
    // Initially visible for scale reference
    gridHelper.visible = true;
    
    scene.add(gridHelper);
    
    // Export for external control
    window.gridHelper = gridHelper;
}

function updateLighting() {
    const config = window.lightingConfig;
    
    // Update hemisphere light
    hemisphereLight.color.setHex(config.hemisphere.skyColor);
    hemisphereLight.groundColor.setHex(config.hemisphere.groundColor);
    hemisphereLight.intensity = config.hemisphere.intensity;
    
    // Update main light
    mainLight.color.setHex(config.mainLight.color);
    mainLight.intensity = config.mainLight.intensity;
    mainLight.position.set(
        feetToUnits(config.mainLight.position.x), 
        feetToUnits(config.mainLight.position.y), 
        feetToUnits(config.mainLight.position.z)
    );
    
    // Update shadow camera size
    const size = config.shadows.cameraSize;
    mainLight.shadow.camera.left = -size;
    mainLight.shadow.camera.right = size;
    mainLight.shadow.camera.top = size;
    mainLight.shadow.camera.bottom = -size;
    mainLight.shadow.camera.updateProjectionMatrix();
    
    // Update shadow bias
    mainLight.shadow.bias = config.shadows.bias;
    mainLight.shadow.normalBias = config.shadows.normalBias;
    
    // Update shadow blur settings
    mainLight.shadow.radius = config.shadows.radius * config.shadows.blurScale;
    mainLight.penumbra = config.shadows.penumbra;
    
    // Update fill light
    fillLight.color.setHex(config.fillLight.color);
    fillLight.intensity = config.fillLight.intensity;
    fillLight.position.set(
        feetToUnits(config.fillLight.position.x), 
        feetToUnits(config.fillLight.position.y), 
        feetToUnits(config.fillLight.position.z)
    );
    fillLight.castShadow = config.fillLight.castShadow;
    
    // Update fill light blur settings if it casts shadows
    if (config.fillLight.castShadow && fillLight.shadow) {
        fillLight.shadow.radius = config.shadows.radius * config.shadows.blurScale;
        fillLight.penumbra = config.shadows.penumbra;
    }
    
    // Update tone mapping exposure
    renderer.toneMappingExposure = config.toneMappingExposure;
    
    // Force shadow map update
    renderer.shadowMap.needsUpdate = true;
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Export scale utilities
window.SCALE = SCALE;
window.inchesToUnits = inchesToUnits;
window.feetToUnits = feetToUnits;
window.metersToUnits = metersToUnits;
window.unitsToInches = unitsToInches;
window.unitsToFeet = unitsToFeet;
window.unitsToMeters = unitsToMeters;

// Export functions
window.setupScene = setupScene;
window.setupCamera = setupCamera;
window.setupRenderer = setupRenderer;
window.animate = animate;
window.updateLighting = updateLighting;

// Export controls after they're created
window.getControls = () => controls;
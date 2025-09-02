// Scene setup variables (exported to window global scope)
let scene, camera, renderer, controls;
let hemisphereLight, mainLight, fillLight, floor;

// Lighting configuration object for dev panel
window.lightingConfig = {
    hemisphere: {
        skyColor: 0x87ceeb,
        groundColor: 0x362f28,
        intensity: 0.4
    },
    mainLight: {
        color: 0xffffff,
        intensity: 1.2,
        position: { x: 8, y: 12, z: 6 },
        castShadow: true
    },
    fillLight: {
        color: 0xffffff,
        intensity: 0.3,
        position: { x: -5, y: 8, z: -3 },
        castShadow: false
    },
    shadows: {
        mapSize: 2048,
        cameraSize: 5,
        bias: -0.0005,
        normalBias: 0.02
    },
    toneMappingExposure: 1.0
};

function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcccccc);
    return scene;
}

function setupCamera() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);
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
    
    // Floor plane with Three.js material optimizations
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x808080, 
        roughness: 0.8,
        metalness: 0.1,
        // Performance optimizations
        side: THREE.FrontSide,
        transparent: false,
        alphaTest: 0
    });
    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    scene.add(floor);
    
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
    mainLight.position.set(config.mainLight.position.x, config.mainLight.position.y, config.mainLight.position.z);
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
    
    // Update shadow camera projection matrix - this fixes the dark box issue
    mainLight.shadow.camera.updateProjectionMatrix();
    
    scene.add(mainLight);
    
    // Fill light for softer shadows and better contrast
    fillLight = new THREE.DirectionalLight(config.fillLight.color, config.fillLight.intensity);
    fillLight.position.set(config.fillLight.position.x, config.fillLight.position.y, config.fillLight.position.z);
    fillLight.castShadow = config.fillLight.castShadow;
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

function updateLighting() {
    const config = window.lightingConfig;
    
    // Update hemisphere light
    hemisphereLight.color.setHex(config.hemisphere.skyColor);
    hemisphereLight.groundColor.setHex(config.hemisphere.groundColor);
    hemisphereLight.intensity = config.hemisphere.intensity;
    
    // Update main light
    mainLight.color.setHex(config.mainLight.color);
    mainLight.intensity = config.mainLight.intensity;
    mainLight.position.set(config.mainLight.position.x, config.mainLight.position.y, config.mainLight.position.z);
    
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
    
    // Update fill light
    fillLight.color.setHex(config.fillLight.color);
    fillLight.intensity = config.fillLight.intensity;
    fillLight.position.set(config.fillLight.position.x, config.fillLight.position.y, config.fillLight.position.z);
    
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

// Export functions
window.setupScene = setupScene;
window.setupCamera = setupCamera;
window.setupRenderer = setupRenderer;
window.animate = animate;
window.updateLighting = updateLighting;

// Export controls after they're created
window.getControls = () => controls;
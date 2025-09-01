// Scene setup variables (exported to window global scope)
let scene, camera, renderer, controls;
let ambientLight, directionalLight, floor;

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
    
    // Setup lighting
    ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    // Optimize shadow map size based on device capabilities
    const shadowMapSize = Math.min(2048, renderer.capabilities.maxTextureSize / 4);
    directionalLight.shadow.mapSize.setScalar(shadowMapSize);
    
    // Optimize shadow camera settings
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);
    
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
// System Initializer - Promise-based initialization following Three.js patterns
// Eliminates timing-based race conditions

class SystemInitializer {
    constructor() {
        this.dependencies = new Map();
        this.systems = new Map();
        this.initPromises = new Map();
    }
    
    // Wait for a dependency to be available
    waitForDependency(name, getter, timeout = 5000) {
        if (this.dependencies.has(name)) {
            return this.dependencies.get(name);
        }
        
        const promise = new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const check = () => {
                const value = getter();
                if (value) {
                    console.log(`✅ Dependency '${name}' ready`);
                    resolve(value);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error(`Timeout waiting for dependency: ${name}`));
                } else {
                    requestAnimationFrame(check);
                }
            };
            
            check();
        });
        
        this.dependencies.set(name, promise);
        return promise;
    }
    
    // Wait for multiple dependencies
    async waitForDependencies(deps) {
        const promises = Object.entries(deps).map(([name, getter]) => 
            this.waitForDependency(name, getter)
        );
        
        const results = await Promise.all(promises);
        const depObject = {};
        Object.keys(deps).forEach((key, index) => {
            depObject[key] = results[index];
        });
        
        return depObject;
    }
    
    // Initialize selection system with proper dependency management
    async initializeSelectionSystem() {
        console.log('🚀 Initializing Selection System...');
        
        try {
            // Wait for core Three.js dependencies
            const deps = await this.waitForDependencies({
                scene: () => window.scene,
                camera: () => window.camera,
                renderer: () => window.renderer,
                orbitControls: () => window.controls
            });
            
            // Create OptimizedSelectionSystem
            const selectionSystem = new window.OptimizedSelectionSystem(
                deps.scene,
                deps.camera,
                deps.renderer,
                deps.orbitControls
            );
            
            // Store globally
            window.optimizedSelectionSystem = selectionSystem;
            
            // Update selectable objects
            selectionSystem.updateSelectableObjects();
            
            console.log('✅ OptimizedSelectionSystem initialized');
            
            // Store in systems map
            this.systems.set('selectionSystem', selectionSystem);
            
            return selectionSystem;
            
        } catch (error) {
            console.error('❌ Failed to initialize SelectionSystem:', error);
            throw error;
        }
    }
    
    // Initialize transform controls with proper dependency management
    async initializeTransformControls() {
        console.log('🔧 Initializing TransformControls...');
        
        try {
            // Wait for dependencies including selection system
            const deps = await this.waitForDependencies({
                scene: () => window.scene,
                camera: () => window.camera,
                renderer: () => window.renderer,
                orbitControls: () => window.controls,
                selectionSystem: () => window.optimizedSelectionSystem
            });
            
            // Create TransformControlsManager
            const transformManager = new window.TransformControlsManager(
                deps.scene,
                deps.camera,
                deps.renderer,
                deps.orbitControls
            );
            
            // Connect to selection system
            deps.selectionSystem.connectTransformControls(transformManager.transformControls);
            console.log('🔗 Connected TransformControls to OptimizedSelectionSystem');
            
            // Store globally
            window.transformControlsManager = transformManager;
            
            console.log('✅ TransformControlsManager initialized');
            
            // Store in systems map
            this.systems.set('transformControls', transformManager);
            
            return transformManager;
            
        } catch (error) {
            console.error('❌ Failed to initialize TransformControls:', error);
            throw error;
        }
    }
    
    // Initialize UI listeners after selection system is ready
    async initializeSelectionUIListeners() {
        console.log('🎨 Initializing Selection UI Listeners...');
        
        try {
            const selectionSystem = await this.waitForDependency(
                'selectionSystem',
                () => window.optimizedSelectionSystem
            );
            
            // Setup object-selected listener
            selectionSystem.addEventListener('object-selected', (event) => {
                const selectionInfo = document.getElementById('selection-info');
                const selectedName = document.getElementById('selected-name');
                const selectedUuid = document.getElementById('selected-uuid');
                const selectedPosition = document.getElementById('selected-position');
                
                if (selectionInfo && selectedName && selectedUuid && selectedPosition) {
                    selectionInfo.style.display = 'block';
                    selectedName.textContent = event.object.name || 'Unnamed';
                    selectedUuid.textContent = event.object.uuid.substring(0, 8) + '...';
                    const pos = event.object.position;
                    selectedPosition.textContent = `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`;
                }
            });
            
            // Setup object-deselected listener
            selectionSystem.addEventListener('object-deselected', () => {
                const selectionInfo = document.getElementById('selection-info');
                if (selectionInfo) {
                    selectionInfo.style.display = 'none';
                }
            });
            
            console.log('✅ Selection UI listeners connected');
            
        } catch (error) {
            console.error('❌ Failed to initialize Selection UI listeners:', error);
            throw error;
        }
    }
    
    // Initialize library system when ready
    async initializeLibrarySystem() {
        console.log('📚 Initializing Library System...');
        
        try {
            // Wait for library dependencies
            const deps = await this.waitForDependencies({
                libraryBrowser: () => window.libraryBrowser,
                authManager: () => window.authManager?.supabase
            });
            
            // Load default model
            if (typeof window.loadDefaultLibraryModel === 'function') {
                window.loadDefaultLibraryModel();
                console.log('✅ Default library model loading initiated');
            }
            
        } catch (error) {
            // Library is optional, so we just log the error
            console.log('📚 Library system not available - skipping default model load');
        }
    }
    
    // Main initialization sequence
    async initialize() {
        console.log('🎬 Starting promise-based system initialization...');
        
        try {
            // Initialize systems in proper dependency order
            // Selection system first (no dependencies on other custom systems)
            await this.initializeSelectionSystem();
            
            // TransformControls depends on selection system
            await this.initializeTransformControls();
            
            // UI listeners depend on selection system
            await this.initializeSelectionUIListeners();
            
            // Library system is independent and can fail gracefully
            this.initializeLibrarySystem().catch(err => {
                console.log('📚 Library initialization skipped:', err.message);
            });
            
            console.log('🎉 All core systems initialized successfully!');
            
            return {
                selectionSystem: this.systems.get('selectionSystem'),
                transformControls: this.systems.get('transformControls')
            };
            
        } catch (error) {
            console.error('❌ System initialization failed:', error);
            throw error;
        }
    }
}

// Create global instance
window.systemInitializer = new SystemInitializer();

// Export for use in main.js
window.SystemInitializer = SystemInitializer;
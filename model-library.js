// Model Library Browser System
// Handles loading and displaying models from the Supabase database

class ModelLibrary {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.models = [];
        this.selectedModel = null;
        this.filteredModels = [];
    }

    async fetchModels() {
        if (!this.supabase) {
            throw new Error('Supabase client not available');
        }

        try {
            const { data, error } = await this.supabase
                .from('assets')
                .select(`
                    id,
                    name,
                    description,
                    file_url,
                    width_inches,
                    height_inches,
                    depth_inches,
                    model_scale_factor,
                    material_count,
                    triangle_count,
                    editable_materials,
                    created_at
                `)
                .eq('is_public', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.models = data || [];
            this.filteredModels = [...this.models];
            
            console.log(`✅ Loaded ${this.models.length} models from library`);
            return this.models;

        } catch (error) {
            console.error('Failed to fetch models:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            throw error;
        }
    }

    filterModels(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredModels = [...this.models];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredModels = this.models.filter(model => 
                model.name.toLowerCase().includes(term) ||
                (model.description && model.description.toLowerCase().includes(term))
            );
        }
        
        return this.filteredModels;
    }

    formatDimensions(model) {
        if (model.width_inches && model.height_inches && model.depth_inches) {
            const w = Math.round(model.width_inches);
            const h = Math.round(model.height_inches);
            const d = Math.round(model.depth_inches);
            return `${w}" × ${h}" × ${d}"`;
        }
        return 'Dimensions not set';
    }

    formatMaterials(model) {
        const materialCount = model.material_count || 0;
        const editableCount = model.editable_materials ? model.editable_materials.length : 0;
        
        if (editableCount > 0) {
            return `${materialCount} materials (${editableCount} editable)`;
        }
        return `${materialCount} materials`;
    }

    getModelById(id) {
        return this.models.find(model => model.id === id);
    }
}

class ModelLibraryBrowser {
    constructor(supabaseClient) {
        this.library = new ModelLibrary(supabaseClient);
        this.isVisible = false;
        this.selectedModelId = null;
    }

    async showLibrary() {
        const panel = document.getElementById('library-panel');
        if (panel) {
            panel.style.display = 'block';
            this.isVisible = true;
            console.log('📚 Model library panel shown');
            
            // Initialize UI panel support if not already done
            if (!panel.hasAttribute('data-ui-initialized')) {
                if (window.UIPanel) {
                    new window.UIPanel(panel);
                    panel.setAttribute('data-ui-initialized', 'true');
                }
            }
            
            // Load models if not already loaded
            if (this.library.models.length === 0) {
                await this.loadModels();
            } else {
                this.renderModelList();
            }
        }
    }

    hideLibrary() {
        const panel = document.getElementById('library-panel');
        if (panel) {
            panel.style.display = 'none';
            this.isVisible = false;
            this.selectedModelId = null;
            this.updateSelectedModelInfo();
            console.log('Model library panel hidden');
        }
    }

    async loadModels() {
        const loadingElement = document.getElementById('library-loading');
        const modelListElement = document.getElementById('library-model-list');

        try {
            if (loadingElement) {
                loadingElement.textContent = 'Loading models...';
                loadingElement.style.display = 'block';
            }

            await this.library.fetchModels();
            this.renderModelList();

        } catch (error) {
            console.error('Failed to load models:', error);
            if (loadingElement) {
                loadingElement.textContent = 'Failed to load models. Please try again.';
                loadingElement.style.color = '#ff6b6b';
            }
            
            if (window.showNotification) {
                window.showNotification('Failed to load model library', 'error');
            }
        }
    }

    renderModelList() {
        const modelListElement = document.getElementById('library-model-list');
        const loadingElement = document.getElementById('library-loading');
        
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }

        if (!modelListElement) return;

        if (this.library.filteredModels.length === 0) {
            modelListElement.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666; font-size: 11px;">
                    ${this.library.models.length === 0 ? 'No models in library' : 'No models match your search'}
                </div>
            `;
            return;
        }

        const modelItems = this.library.filteredModels.map(model => {
            const dimensions = this.library.formatDimensions(model);
            const materials = this.library.formatMaterials(model);
            const isSelected = this.selectedModelId === model.id;

            return `
                <div class="library-model-item ${isSelected ? 'selected' : ''}" 
                     data-model-id="${model.id}" 
                     style="
                        padding: 8px 12px; 
                        border-bottom: 1px solid #333; 
                        cursor: pointer;
                        background: ${isSelected ? '#0084ff' : 'transparent'};
                        color: ${isSelected ? 'white' : '#ccc'};
                     "
                     onmouseover="this.style.background='${isSelected ? '#0084ff' : '#333'}'"
                     onmouseout="this.style.background='${isSelected ? '#0084ff' : 'transparent'}'">
                    <div style="font-size: 12px; font-weight: 500; margin-bottom: 2px;">${model.name}</div>
                    <div style="font-size: 10px; color: ${isSelected ? '#ccc' : '#888'};">
                        ${dimensions}<br>
                        ${materials}
                    </div>
                </div>
            `;
        }).join('');

        modelListElement.innerHTML = modelItems;

        // Add click handlers to model items
        const items = modelListElement.querySelectorAll('.library-model-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const modelId = parseInt(item.dataset.modelId);
                this.selectModel(modelId);
            });
        });
    }

    selectModel(modelId) {
        this.selectedModelId = modelId;
        this.renderModelList(); // Re-render to update selection
        this.updateSelectedModelInfo();
    }

    updateSelectedModelInfo() {
        const infoElement = document.getElementById('library-selected-info');
        const loadButton = document.getElementById('library-load-model');
        const nameElement = document.getElementById('library-selected-name');
        const dimensionsElement = document.getElementById('library-selected-dimensions');
        const materialsElement = document.getElementById('library-selected-materials');

        if (!this.selectedModelId || !infoElement) {
            if (infoElement) infoElement.style.display = 'none';
            if (loadButton) loadButton.disabled = true;
            return;
        }

        const model = this.library.getModelById(this.selectedModelId);
        if (!model) return;

        if (infoElement) infoElement.style.display = 'block';
        if (loadButton) loadButton.disabled = false;

        if (nameElement) nameElement.textContent = model.name;
        if (dimensionsElement) dimensionsElement.textContent = this.library.formatDimensions(model);
        if (materialsElement) materialsElement.textContent = this.library.formatMaterials(model);
    }

    async loadSelectedModel() {
        if (!this.selectedModelId) {
            if (window.showNotification) {
                window.showNotification('Please select a model first', 'warning');
            }
            return;
        }

        const model = this.library.getModelById(this.selectedModelId);
        if (!model) {
            console.error('Selected model not found');
            return;
        }

        try {
            // Show loading notification
            if (window.showNotification) {
                window.showNotification('Loading model...', 'info', 2000);
            }

            // Load the GLB model
            const loadedModel = await this.loadModelFromUrl(model.file_url);
            
            // Apply saved scale factor if available
            if (model.model_scale_factor) {
                loadedModel.scale.setScalar(model.model_scale_factor);
            }

            // Store model metadata globally for placeModelOnFloor to access
            window.currentAssetMetadata = model;
            
            // Store model metadata on the loaded model
            loadedModel.userData.assetId = model.id;
            loadedModel.userData.assetName = model.name;
            loadedModel.userData.dimensions = {
                width: model.width_inches,
                height: model.height_inches,
                depth: model.depth_inches
            };
            
            // Add to scene using multi-model system (supports multiple models)
            let instanceId = null;
            if (window.addModelToScene && window.scene) {
                instanceId = window.addModelToScene(loadedModel, window.scene);
                console.log(`🎯 Model instance created: ${instanceId}`);
            } else if (window.placeModelOnFloor && window.scene) {
                // Fallback to single-model system if multi-model not available
                window.placeModelOnFloor(loadedModel, window.scene);
                console.log('⚠️ Using single-model fallback (multi-model system not available)');
            }


            // Hide library panel
            this.hideLibrary();

            // Success notification
            if (window.showNotification) {
                const message = instanceId ? 
                    `✅ Added ${model.name} (${instanceId})` : 
                    `✅ Loaded ${model.name}`;
                window.showNotification(message, 'success');
            }

            const actionText = instanceId ? 'added to scene' : 'loaded';
            console.log(`✅ Successfully ${actionText}: ${model.name}`);

        } catch (error) {
            console.error('Failed to load model:', error);
            if (window.showNotification) {
                window.showNotification('Failed to load model: ' + error.message, 'error');
            }
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

    setupSearch() {
        const searchInput = document.getElementById('library-search');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.library.filterModels(e.target.value);
                    this.renderModelList();
                }, 300); // Debounce search
            });
        }
    }
}

// Model Library Integration
function setupModelLibrary() {
    // Check if we have Supabase client
    if (!window.authManager || !window.authManager.supabase) {
        console.warn('Supabase client not available for model library');
        return;
    }

    console.log('✅ Initializing model library system...');

    // Initialize library browser
    const libraryBrowser = new ModelLibraryBrowser(window.authManager.supabase);
    window.libraryBrowser = libraryBrowser; // Make globally available

    // Setup search functionality
    libraryBrowser.setupSearch();

    // Add Model Button Event Handler
    const addModelBtn = document.getElementById('add-model-btn');
    if (addModelBtn) {
        addModelBtn.addEventListener('click', () => {
            libraryBrowser.showLibrary();
        });
    }

    // Library Event Handlers
    setupLibraryEventHandlers(libraryBrowser);
}

function setupLibraryEventHandlers(libraryBrowser) {
    // Load Model Button
    const loadButton = document.getElementById('library-load-model');
    if (loadButton) {
        loadButton.addEventListener('click', async () => {
            await libraryBrowser.loadSelectedModel();
        });
    }

    // Close Library Button
    const closeButton = document.getElementById('library-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            libraryBrowser.hideLibrary();
        });
    }
}

// Export to global scope
window.ModelLibrary = ModelLibrary;
window.ModelLibraryBrowser = ModelLibraryBrowser;
window.setupModelLibrary = setupModelLibrary;
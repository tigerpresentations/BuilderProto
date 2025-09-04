// Saved Designs UI Controller
// Handles UI interactions for the saved designs system

class SavedDesignsUI {
    constructor() {
        this.savedSceneManager = null;
        this.isAuthenticated = false;
        this.currentScenes = [];
        
        this.initializeUI();
        this.waitForSavedSceneManager();
    }

    /**
     * Wait for SavedSceneManager to be available
     */
    waitForSavedSceneManager() {
        const checkManager = setInterval(() => {
            if (window.savedSceneManager && window.authManager) {
                this.savedSceneManager = window.savedSceneManager;
                this.setupEventListeners();
                
                // Wait a bit for auth state to stabilize, then update UI
                setTimeout(() => {
                    this.updateAuthState();
                }, 100);
                
                clearInterval(checkManager);
                console.log('✅ Saved Designs UI connected to SavedSceneManager and AuthManager');
            }
        }, 500);
    }

    /**
     * Initialize UI elements and event handlers
     */
    initializeUI() {
        // Get UI elements
        this.elements = {
            panel: document.getElementById('saved-designs'),
            nameInput: document.getElementById('scene-name-input'),
            descriptionInput: document.getElementById('scene-description-input'),
            saveBtn: document.getElementById('save-scene-btn'),
            savingBtn: document.getElementById('save-scene-loading'),
            scenesList: document.getElementById('saved-scenes-list'),
            loadingDiv: document.getElementById('scenes-loading'),
            emptyDiv: document.getElementById('scenes-empty'),
            refreshBtn: document.getElementById('refresh-scenes')
        };

        // Add keyboard shortcut to show saved designs panel
        document.addEventListener('keydown', (e) => {
            if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.showPanel();
            }
        });

        // Basic UI event handlers
        if (this.elements.saveBtn) {
            this.elements.saveBtn.addEventListener('click', () => this.handleSaveScene());
        }

        if (this.elements.refreshBtn) {
            this.elements.refreshBtn.addEventListener('click', () => this.refreshScenes());
        }

        // Auto-generate scene name based on current time
        if (this.elements.nameInput) {
            this.elements.nameInput.placeholder = this.generateDefaultSceneName();
        }
    }

    /**
     * Setup event listeners for SavedSceneManager events
     */
    setupEventListeners() {
        if (!this.savedSceneManager) return;

        // Listen for authentication changes
        this.savedSceneManager.addEventListener('auth-changed', (event) => {
            const { user, scenes } = event.detail;
            console.log('🔄 Auth changed event received:', { user: !!user, scenes: scenes?.length || 0 });
            this.currentScenes = scenes || [];
            this.updateAuthState(); // This will recalculate isAuthenticated
            this.renderScenesList();
        });

        // Listen for scene save events
        this.savedSceneManager.addEventListener('scene-saved', (event) => {
            const { scene } = event.detail;
            this.currentScenes.unshift(scene);
            this.renderScenesList();
            this.clearSaveForm();
            this.showSaveSuccess(scene.name);
        });

        // Listen for scene delete events
        this.savedSceneManager.addEventListener('scene-deleted', (event) => {
            const { sceneId } = event.detail;
            this.currentScenes = this.currentScenes.filter(scene => scene.id !== sceneId);
            this.renderScenesList();
        });
    }

    /**
     * Update UI based on authentication state
     */
    updateAuthState() {
        if (!this.elements.panel) return;

        // Check authentication state from both AuthManager and SavedSceneManager
        const authManagerAuthenticated = window.authManager?.isAuthenticated() || false;
        const savedSceneManagerAuthenticated = this.savedSceneManager?.user !== null;
        
        this.isAuthenticated = authManagerAuthenticated && savedSceneManagerAuthenticated;
        
        console.log('🔍 Auth state check:', {
            authManager: authManagerAuthenticated,
            savedSceneManager: savedSceneManagerAuthenticated,
            combined: this.isAuthenticated
        });

        if (this.isAuthenticated) {
            this.elements.panel.style.display = 'flex';
            this.refreshScenes();
        } else {
            // Show login message or hide panel
            this.renderLoginRequired();
        }
    }

    /**
     * Show the saved designs panel
     */
    showPanel() {
        if (this.elements.panel) {
            this.elements.panel.classList.remove('hidden');
            this.elements.panel.style.display = 'flex';
        }
    }

    /**
     * Hide the saved designs panel
     */
    hidePanel() {
        if (this.elements.panel) {
            this.elements.panel.classList.add('hidden');
            this.elements.panel.style.display = 'none';
        }
    }

    /**
     * Toggle the saved designs panel visibility
     */
    togglePanel() {
        if (this.elements.panel?.classList.contains('hidden')) {
            this.showPanel();
        } else {
            this.hidePanel();
        }
    }

    /**
     * Handle save scene button click
     */
    async handleSaveScene() {
        if (!this.savedSceneManager || !this.isAuthenticated) {
            this.showError('You must be logged in to save designs');
            return;
        }

        const sceneName = this.elements.nameInput.value.trim() || this.generateDefaultSceneName();
        const description = this.elements.descriptionInput.value.trim();

        if (sceneName.length < 2) {
            this.showError('Scene name must be at least 2 characters');
            return;
        }

        // Show loading state
        this.elements.saveBtn.style.display = 'none';
        this.elements.savingBtn.style.display = 'block';

        try {
            await this.savedSceneManager.saveScene(sceneName, description, {
                includeCanvasTexture: true,
                generateThumbnail: true
            });
            
        } catch (error) {
            console.error('Failed to save scene:', error);
            this.showError(`Failed to save design: ${error.message}`);
        } finally {
            // Restore button state
            this.elements.saveBtn.style.display = 'block';
            this.elements.savingBtn.style.display = 'none';
        }
    }

    /**
     * Refresh scenes list
     */
    async refreshScenes() {
        if (!this.savedSceneManager || !this.isAuthenticated) return;

        this.showLoading();

        try {
            const scenes = await this.savedSceneManager.loadUserScenes();
            this.currentScenes = scenes;
            this.renderScenesList();
        } catch (error) {
            console.error('Failed to refresh scenes:', error);
            this.showError('Failed to load your designs');
        }
    }

    /**
     * Render the scenes list
     */
    renderScenesList() {
        if (!this.elements.scenesList) return;

        this.hideLoading();

        if (!this.isAuthenticated) {
            this.renderLoginRequired();
            return;
        }

        if (this.currentScenes.length === 0) {
            this.elements.emptyDiv.style.display = 'block';
            this.elements.scenesList.innerHTML = '';
            this.elements.scenesList.appendChild(this.elements.emptyDiv);
            return;
        }

        this.elements.emptyDiv.style.display = 'none';
        
        const scenesHTML = this.currentScenes.map(scene => {
            const createdDate = new Date(scene.created_at).toLocaleDateString();
            const updatedDate = new Date(scene.updated_at).toLocaleDateString();
            
            return `
                <div class="scene-item" data-scene-id="${scene.id}" style="
                    border: 1px solid #555; 
                    border-radius: 4px; 
                    padding: 8px; 
                    margin-bottom: 8px; 
                    cursor: pointer;
                    transition: background-color 0.2s;
                " onmouseover="this.style.backgroundColor='#444'" onmouseout="this.style.backgroundColor='transparent'">
                    <div style="font-weight: bold; color: #fff; margin-bottom: 4px;">${scene.name}</div>
                    ${scene.description ? `<div style="font-size: 11px; color: #aaa; margin-bottom: 4px;">${scene.description}</div>` : ''}
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #888;">
                        <span>Objects: ${scene.asset_count || 0}</span>
                        <span>${scene.created_at === scene.updated_at ? createdDate : `Updated ${updatedDate}`}</span>
                    </div>
                    <div style="margin-top: 6px; display: flex; gap: 4px;">
                        <button onclick="savedDesignsUI.loadScene('${scene.id}')" style="
                            flex: 1; 
                            padding: 4px 8px; 
                            background: #0084ff; 
                            border: 1px solid #0084ff; 
                            color: white; 
                            border-radius: 2px; 
                            font-size: 10px;
                            cursor: pointer;
                        ">Load</button>
                        <button onclick="savedDesignsUI.confirmDeleteScene('${scene.id}', '${scene.name}')" style="
                            padding: 4px 8px; 
                            background: #dc3545; 
                            border: 1px solid #dc3545; 
                            color: white; 
                            border-radius: 2px; 
                            font-size: 10px;
                            cursor: pointer;
                        ">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        this.elements.scenesList.innerHTML = scenesHTML;
    }

    /**
     * Show login required message
     */
    renderLoginRequired() {
        if (!this.elements.scenesList) return;
        
        this.elements.scenesList.innerHTML = `
            <div style="text-align: center; color: #888; padding: 20px; font-size: 12px;">
                Please log in to save and load designs
            </div>
        `;
    }

    /**
     * Load a scene
     */
    async loadScene(sceneId) {
        if (!this.savedSceneManager) return;

        try {
            console.log(`Loading scene: ${sceneId}`);
            // TODO: Implement scene loading when the full system is ready
            this.showError('Scene loading not yet implemented - this will be available once the multi-GLB system is complete');
        } catch (error) {
            console.error('Failed to load scene:', error);
            this.showError(`Failed to load design: ${error.message}`);
        }
    }

    /**
     * Confirm scene deletion
     */
    confirmDeleteScene(sceneId, sceneName) {
        if (confirm(`Are you sure you want to delete "${sceneName}"? This action cannot be undone.`)) {
            this.deleteScene(sceneId);
        }
    }

    /**
     * Delete a scene
     */
    async deleteScene(sceneId) {
        if (!this.savedSceneManager) return;

        try {
            await this.savedSceneManager.deleteScene(sceneId);
            console.log('✅ Scene deleted successfully');
        } catch (error) {
            console.error('Failed to delete scene:', error);
            this.showError(`Failed to delete design: ${error.message}`);
        }
    }

    /**
     * Generate default scene name
     */
    generateDefaultSceneName() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        return `Design ${dateStr}`;
    }

    /**
     * Clear save form
     */
    clearSaveForm() {
        if (this.elements.nameInput) this.elements.nameInput.value = '';
        if (this.elements.descriptionInput) this.elements.descriptionInput.value = '';
        if (this.elements.nameInput) {
            this.elements.nameInput.placeholder = this.generateDefaultSceneName();
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (this.elements.loadingDiv) {
            this.elements.loadingDiv.style.display = 'block';
        }
        if (this.elements.emptyDiv) {
            this.elements.emptyDiv.style.display = 'none';
        }
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        if (this.elements.loadingDiv) {
            this.elements.loadingDiv.style.display = 'none';
        }
    }

    /**
     * Show success message
     */
    showSaveSuccess(sceneName) {
        if (window.showNotification) {
            window.showNotification(`✅ Saved "${sceneName}" successfully`, 'success', 3000);
        } else {
            console.log(`✅ Scene "${sceneName}" saved successfully`);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        if (window.showNotification) {
            window.showNotification(`❌ ${message}`, 'error', 5000);
        } else {
            alert(`Error: ${message}`);
        }
    }
}

// Initialize UI controller
window.savedDesignsUI = new SavedDesignsUI();

// Add global function for toggling panel (can be called from buttons)
window.toggleSavedDesigns = () => {
    window.savedDesignsUI.togglePanel();
};

console.log('✅ Saved Designs UI initialized');
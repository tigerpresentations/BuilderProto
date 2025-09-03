# GLB Model Inspector Tool Research

## Problem Analysis

3D models imported from Blender and other tools often lack consistent real-world scale information. Manual measurement and scale factor calculation is error-prone and time-consuming. An inspector tool is needed to bridge the gap between arbitrary model scales and accurate real-world dimensions for trade show display applications.

## Inspector Tool Requirements

### **Core Functionality**
- Display current model dimensions in Three.js units
- Accept real-world dimension input from user
- Calculate and apply appropriate scale factors
- Validate scale results with visual feedback
- Save scale factors to Supabase for future use
- Provide measurement reference objects for context

### **User Experience Goals**
- One-click measurement workflow
- Visual confirmation of scale accuracy
- Clear before/after comparison
- Error prevention for unrealistic scales
- Integration with existing model loading pipeline

## Technical Implementation Strategy

### **Dimension Detection System**
```javascript
class ModelInspector {
    constructor(model) {
        this.model = model;
        this.originalBounds = this.calculateBounds(model);
        this.measurements = this.extractMeasurements();
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
}
```

### **Scale Calculation and Application**
```javascript
class ScaleCalculator {
    static calculateScaleFactor(currentDimension, realWorldDimension, units = 'inches') {
        const targetInThreeJSUnits = this.convertToThreeJSUnits(realWorldDimension, units);
        return targetInThreeJSUnits / currentDimension;
    }
    
    static convertToThreeJSUnits(value, units) {
        const conversions = {
            'inches': 1/12,    // 1 Three.js unit = 1 foot
            'feet': 1,
            'centimeters': 1/30.48,
            'meters': 3.28084
        };
        return value * conversions[units];
    }
    
    static validateScaleFactor(factor) {
        return {
            isValid: factor >= 0.001 && factor <= 1000,
            warning: factor < 0.01 ? 'Model will be very small' : 
                    factor > 100 ? 'Model will be very large' : null
        };
    }
}
```

### **Visual Feedback System**
```javascript
class ScaleVisualizer {
    constructor(scene) {
        this.scene = scene;
        this.referenceObjects = new THREE.Group();
        this.scene.add(this.referenceObjects);
    }
    
    addReferenceObjects() {
        // Human figure for scale reference (6 feet tall)
        const humanHeight = 6; // feet in Three.js units
        const humanGeometry = new THREE.CapsuleGeometry(0.5, humanHeight - 1, 4, 8);
        const humanMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.3 
        });
        const humanFigure = new THREE.Mesh(humanGeometry, humanMaterial);
        humanFigure.position.set(-5, humanHeight/2, 0);
        this.referenceObjects.add(humanFigure);
        
        // Grid floor with foot markers
        const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
        this.referenceObjects.add(gridHelper);
    }
    
    showBoundingBox(model, color = 0xff0000) {
        const bbox = new THREE.Box3().setFromObject(model);
        const helper = new THREE.Box3Helper(bbox, color);
        this.referenceObjects.add(helper);
        return helper;
    }
    
    clearVisualizations() {
        this.referenceObjects.clear();
    }
}
```

## User Interface Design

### **Inspector Panel Layout**
```html
<div id="model-inspector" class="inspector-panel">
    <h3>Model Scale Inspector</h3>
    
    <!-- Current Dimensions Display -->
    <div class="current-dimensions">
        <h4>Current Size (Three.js units)</h4>
        <div class="dimension-grid">
            <span>Width: <span id="current-width">0.00</span></span>
            <span>Height: <span id="current-height">0.00</span></span>
            <span>Depth: <span id="current-depth">0.00</span></span>
        </div>
    </div>
    
    <!-- Real-World Input -->
    <div class="real-world-input">
        <h4>Real-World Dimensions</h4>
        <div class="input-group">
            <label>Known measurement:</label>
            <select id="dimension-type">
                <option value="height">Height</option>
                <option value="width">Width</option>
                <option value="depth">Depth</option>
            </select>
            <input type="number" id="real-value" step="0.1" placeholder="91">
            <select id="units">
                <option value="inches">inches</option>
                <option value="feet">feet</option>
                <option value="centimeters">cm</option>
                <option value="meters">meters</option>
            </select>
        </div>
    </div>
    
    <!-- Scale Preview -->
    <div class="scale-preview">
        <div class="scale-factor">
            Scale Factor: <span id="scale-factor">1.000</span>
        </div>
        <div class="validation-message" id="validation-message"></div>
    </div>
    
    <!-- Actions -->
    <div class="inspector-actions">
        <button id="preview-scale">Preview Scale</button>
        <button id="apply-scale">Apply Scale</button>
        <button id="save-to-database">Save to Database</button>
        <button id="reset-scale">Reset</button>
    </div>
    
    <!-- Visual Aids Toggle -->
    <div class="visual-aids">
        <label><input type="checkbox" id="show-bounds"> Show Bounding Box</label>
        <label><input type="checkbox" id="show-reference"> Show Reference Objects</label>
        <label><input type="checkbox" id="show-grid"> Show Grid</label>
    </div>
</div>
```

### **Workflow Integration**
```javascript
class InspectorWorkflow {
    constructor(model, supabaseClient) {
        this.model = model;
        this.supabase = supabaseClient;
        this.inspector = new ModelInspector(model);
        this.visualizer = new ScaleVisualizer(scene);
        this.originalScale = model.scale.clone();
    }
    
    async initializeInspector() {
        this.updateDimensionDisplay();
        this.setupEventListeners();
        this.visualizer.addReferenceObjects();
        
        // Check if scale data exists in database
        const existingScale = await this.checkExistingScale();
        if (existingScale) {
            this.populateFromDatabase(existingScale);
        }
    }
    
    updateDimensionDisplay() {
        document.getElementById('current-width').textContent = 
            this.inspector.measurements.width.toFixed(2);
        document.getElementById('current-height').textContent = 
            this.inspector.measurements.height.toFixed(2);
        document.getElementById('current-depth').textContent = 
            this.inspector.measurements.depth.toFixed(2);
    }
    
    previewScale() {
        const dimensionType = document.getElementById('dimension-type').value;
        const realValue = parseFloat(document.getElementById('real-value').value);
        const units = document.getElementById('units').value;
        
        if (!realValue || realValue <= 0) {
            this.showValidationError('Please enter a valid measurement');
            return;
        }
        
        const currentDimension = this.inspector.measurements[dimensionType];
        const scaleFactor = ScaleCalculator.calculateScaleFactor(
            currentDimension, realValue, units
        );
        
        const validation = ScaleCalculator.validateScaleFactor(scaleFactor);
        if (!validation.isValid) {
            this.showValidationError('Scale factor out of reasonable range');
            return;
        }
        
        // Apply preview scale
        this.model.scale.copy(this.originalScale).multiplyScalar(scaleFactor);
        
        // Update UI
        document.getElementById('scale-factor').textContent = scaleFactor.toFixed(3);
        if (validation.warning) {
            this.showValidationWarning(validation.warning);
        }
        
        // Show bounding box for visual confirmation
        this.visualizer.showBoundingBox(this.model);
    }
    
    async saveToDatabase() {
        const scaleFactor = parseFloat(document.getElementById('scale-factor').textContent);
        const realValue = parseFloat(document.getElementById('real-value').value);
        const units = document.getElementById('units').value;
        
        try {
            const { data, error } = await this.supabase
                .from('assets')
                .update({
                    model_scale_factor: scaleFactor,
                    height_inches: units === 'inches' ? realValue : realValue * 12,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.model.userData.assetId);
            
            if (error) throw error;
            
            this.showSuccessMessage('Scale factor saved to database');
        } catch (error) {
            this.showValidationError('Failed to save scale factor: ' + error.message);
        }
    }
}
```

## Integration with Existing Systems

### **Model Loading Integration**
```javascript
// Enhanced model loading with inspector option
async function loadModelWithInspector(assetId, showInspector = false) {
    const asset = await loadAssetFromDatabase(assetId);
    const model = await loadGLBFile(asset.file_url);
    
    // Apply saved scale if available
    if (asset.model_scale_factor) {
        model.scale.setScalar(asset.model_scale_factor);
    }
    
    // Launch inspector if requested
    if (showInspector) {
        const inspector = new InspectorWorkflow(model, supabase);
        await inspector.initializeInspector();
    }
    
    return model;
}
```

### **Database Schema Integration**
Requires the Supabase schema to include scale and dimension fields as specified in the database research document:
- `model_scale_factor` for the calculated multiplier
- `width_inches`, `height_inches`, `depth_inches` for real-world dimensions
- `bounding_box_json` for original model bounds

## Error Handling and Validation

### **Common Error Cases**
- Invalid or missing real-world measurements
- Extreme scale factors (too large or too small)
- Database connection failures
- Model geometry issues (empty or corrupted)

### **User Feedback System**
- Color-coded validation messages (green for success, yellow for warnings, red for errors)
- Real-time scale factor updates as user types
- Visual confirmation through bounding boxes and reference objects
- Undo functionality to revert changes

## Performance Considerations

### **Optimization Strategies**
- Lazy loading of inspector interface components
- Debounced scale preview updates during user input
- Efficient bounding box calculations using cached results
- Minimal DOM manipulation for real-time updates

### **Memory Management**
- Cleanup of visualization helpers when inspector closes
- Proper disposal of temporary geometry and materials
- Event listener cleanup on component destruction

## References

- Three.js Box3 and Object3D documentation for dimension calculations
- Web standards for measurement input validation and formatting
- UX patterns for technical measurement tools in CAD applications
- Supabase client SDK documentation for database operations
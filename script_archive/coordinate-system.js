// TigerBuilder Coordinate System - Normalized Device Coordinates (NDC) Implementation
// Industry standard pattern used by Three.js, WebGL, and professional graphics software

class TigerBuilderCoordinateSystem {
    constructor() {
        this.displaySize = 512; // Fixed display canvas size
        this.currentTextureSize = 1024; // Current texture resolution (changes with quality scaling)
    }
    
    // Update texture size when quality scaling occurs
    updateTextureSize(newSize) {
        console.log(`Coordinate system: texture size updated from ${this.currentTextureSize} to ${newSize}`);
        this.currentTextureSize = newSize;
    }
    
    // Convert display coordinates to UV space (0-1 normalized)
    displayToUV(displayX, displayY) {
        return {
            u: displayX / this.displaySize,
            v: displayY / this.displaySize
        };
    }
    
    // Convert UV space to display coordinates
    uvToDisplay(u, v) {
        return {
            x: u * this.displaySize,
            y: v * this.displaySize
        };
    }
    
    // Convert UV space to texture coordinates
    uvToTexture(u, v) {
        return {
            x: u * this.currentTextureSize,
            y: v * this.currentTextureSize
        };
    }
    
    // Convert texture coordinates to UV space
    textureToUV(textureX, textureY) {
        return {
            u: textureX / this.currentTextureSize,
            v: textureY / this.currentTextureSize
        };
    }
    
    
    // Scale UV coordinates (maintains aspect ratio and stays in 0-1 range)
    scaleUV(u, v, scaleX, scaleY) {
        return {
            u: Math.max(0, Math.min(1, u * scaleX)),
            v: Math.max(0, Math.min(1, v * scaleY))
        };
    }
    
    // Transform UV coordinates with position, scale, and rotation
    transformUV(u, v, transform) {
        const { posU, posV, scaleX, scaleY, rotation } = transform;
        
        // Apply rotation around center if specified
        let transformedU = u;
        let transformedV = v;
        
        if (rotation !== 0) {
            const centerU = posU;
            const centerV = posV;
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            
            const relU = u - centerU;
            const relV = v - centerV;
            
            transformedU = relU * cos - relV * sin + centerU;
            transformedV = relU * sin + relV * cos + centerV;
        }
        
        // Apply scale and position
        return {
            u: (transformedU * scaleX) + posU,
            v: (transformedV * scaleY) + posV
        };
    }
    
    // Get safe bounds for UV coordinates (ensures elements stay within 0-1 range)
    getSafeBounds(elementWidth, elementHeight, scaleX = 1, scaleY = 1) {
        // Convert element dimensions to UV space
        const uvWidth = (elementWidth / this.currentTextureSize) * scaleX;
        const uvHeight = (elementHeight / this.currentTextureSize) * scaleY;
        
        return {
            minU: uvWidth / 2,
            maxU: 1 - (uvWidth / 2),
            minV: uvHeight / 2,
            maxV: 1 - (uvHeight / 2),
            uvWidth,
            uvHeight
        };
    }
    
    
    // Get display coordinates from UV layer (for rendering display canvas)
    getDisplayCoords(uvLayer) {
        const display = this.uvToDisplay(uvLayer.uvX, uvLayer.uvY);
        
        // Calculate proper dimensions in display space
        // The originalWidth/Height are already in texture space, uvScale modifies them,
        // then we need to scale to display space (512px)
        const scaledWidth = uvLayer.originalWidth * uvLayer.uvScaleX * (this.displaySize / this.currentTextureSize);
        const scaledHeight = uvLayer.originalHeight * uvLayer.uvScaleY * (this.displaySize / this.currentTextureSize);
        
        return {
            x: display.x,
            y: display.y,
            scaleX: uvLayer.uvScaleX,
            scaleY: uvLayer.uvScaleY,
            width: scaledWidth,
            height: scaledHeight
        };
    }
    
    // Get texture coordinates from UV layer (for rendering texture canvas)
    getTextureCoords(uvLayer) {
        const texture = this.uvToTexture(uvLayer.uvX, uvLayer.uvY);
        
        // Use texture space dimensions directly
        const textureWidth = (uvLayer.originalWidth || 100) * uvLayer.uvScaleX;
        const textureHeight = (uvLayer.originalHeight || 100) * uvLayer.uvScaleY;
        
        return {
            x: texture.x,
            y: texture.y,
            scaleX: uvLayer.uvScaleX,
            scaleY: uvLayer.uvScaleY,
            width: textureWidth,
            height: textureHeight
        };
    }
    
    // Debug helper to validate coordinate consistency
    validateCoordinates(layer) {
        const isValidUV = (
            layer.uvX >= 0 && layer.uvX <= 1 &&
            layer.uvY >= 0 && layer.uvY <= 1
        );
        
        if (!isValidUV) {
            console.warn('Invalid UV coordinates:', { uvX: layer.uvX, uvY: layer.uvY });
            return false;
        }
        
        return true;
    }
    
    // Performance monitoring
    getConversionStats() {
        return {
            displaySize: this.displaySize,
            textureSize: this.currentTextureSize,
            scaleFactor: this.currentTextureSize / this.displaySize,
            memoryEfficiency: this.displaySize / this.currentTextureSize // Lower is better
        };
    }
}

// Export the coordinate system for global use
window.TigerBuilderCoordinateSystem = TigerBuilderCoordinateSystem;

// Initialize global coordinate system instance
window.coordinateSystem = new TigerBuilderCoordinateSystem();

console.log('TigerBuilder Coordinate System initialized - UV/NDC pattern active');
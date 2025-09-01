// Simple Coordinate System - No Scaling Required
// Everything works in 512x512 display space, texture scaling handled separately

class SimpleCoordinateSystem {
    constructor() {
        this.canvasSize = 512; // Fixed canvas size - everything works in this space
    }
    
    // No coordinate conversions needed - everything is already in 512x512 space!
    // Layers store their position and size directly in canvas pixels
    
    // The only conversion we need is for the final texture rendering
    getTextureScaleFactor(targetTextureSize) {
        return targetTextureSize / this.canvasSize;
    }
    
    // Convert 512x512 coordinates to texture coordinates for final rendering
    scaleForTexture(value, targetTextureSize) {
        return value * (targetTextureSize / this.canvasSize);
    }
    
    // Convert texture coordinates back to 512x512 for editing
    scaleFromTexture(value, sourceTextureSize) {
        return value * (this.canvasSize / sourceTextureSize);
    }
}

// Simplified Layer class that works entirely in 512x512 space
class SimpleImageLayer {
    constructor(image, options = {}) {
        this.id = 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.image = image;
        
        // Everything in 512x512 canvas coordinates - no UV, no scaling confusion!
        this.x = options.x !== undefined ? options.x : 256; // Center at 256,256
        this.y = options.y !== undefined ? options.y : 256;
        this.width = options.width || image.width;
        this.height = options.height || image.height;
        this.rotation = options.rotation || 0;
        this.opacity = options.opacity || 1;
        this.visible = options.visible !== false;
        this.selected = false;
    }
    
    // Simple bounds calculation - no coordinate conversion!
    getBounds() {
        return {
            left: this.x - this.width/2,
            top: this.y - this.height/2,
            right: this.x + this.width/2,
            bottom: this.y + this.height/2,
            width: this.width,
            height: this.height,
            centerX: this.x,
            centerY: this.y
        };
    }
    
    // Simple hit test - no coordinate conversion!
    hitTest(x, y) {
        const bounds = this.getBounds();
        return x >= bounds.left && x <= bounds.right && 
               y >= bounds.top && y <= bounds.bottom;
    }
    
    // Render to any canvas (display or texture) with appropriate scaling
    renderTo(ctx, targetSize) {
        const scale = targetSize / 512; // Only scaling happens here, at render time
        
        ctx.save();
        ctx.globalAlpha = this.opacity;
        
        // Scale all coordinates to target size
        ctx.translate(this.x * scale, this.y * scale);
        if (this.rotation) {
            ctx.rotate(this.rotation);
        }
        
        const scaledWidth = this.width * scale;
        const scaledHeight = this.height * scale;
        
        ctx.drawImage(this.image, -scaledWidth/2, -scaledHeight/2, scaledWidth, scaledHeight);
        
        // Selection outline (only on 512px display canvas)
        if (this.selected && targetSize === 512) {
            ctx.strokeStyle = '#ff8800';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(-scaledWidth/2, -scaledHeight/2, scaledWidth, scaledHeight);
            ctx.setLineDash([]);
        }
        
        ctx.restore();
    }
}

window.SimpleCoordinateSystem = SimpleCoordinateSystem;
window.SimpleImageLayer = SimpleImageLayer;
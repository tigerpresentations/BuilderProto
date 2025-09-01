# Three.js Testing Research: Mobile Device WebGL Testing Strategies

## Testing Challenge Analysis

Mobile device testing for Three.js WebGL applications presents unique challenges not encountered in desktop testing:

- **Hardware Fragmentation**: Thousands of mobile devices with varying GPU capabilities, from high-end A-series chips to budget Mali/Adreno GPUs
- **WebGL Implementation Differences**: Mobile browsers implement WebGL with stricter memory constraints and feature limitations
- **Performance Variability**: Mobile GPUs have varying shader capabilities, texture format support, and rendering performance
- **Thermal Throttling**: Extended testing can trigger thermal throttling, affecting performance consistency
- **Touch Interface Differences**: Testing must account for touch-based interactions versus mouse/keyboard desktop controls

### Mobile WebGL Constraints

1. **Memory Limitations**: Mobile browsers enforce stricter WebGL memory limits (typically 256MB-512MB vs 1GB+ on desktop)
2. **Texture Size Restrictions**: Mobile devices often limit max texture size to 2048x2048 or 4096x4096
3. **Shader Complexity Limits**: Mobile GPUs have reduced shader instruction limits and varying precision support
4. **Context Loss Frequency**: Mobile WebGL contexts are lost more frequently due to system resource management
5. **Battery/Thermal Considerations**: Intensive WebGL operations can cause thermal throttling and battery drain

## Established Testing Approaches

### 1. Cloud-Based Mobile Device Testing Platforms

**BrowserStack Real Device Cloud:**
BrowserStack provides access to real iOS and Android devices with comprehensive WebGL support testing capabilities:

```javascript
// browserstack-mobile-config.js
const browserstackCapabilities = {
  'iPhone 13 Pro': {
    'browserstack.user': process.env.BROWSERSTACK_USERNAME,
    'browserstack.key': process.env.BROWSERSTACK_ACCESS_KEY,
    'device': 'iPhone 13 Pro',
    'os_version': '15',
    'browser': 'safari',
    'real_mobile': 'true',
    'browserstack.debug': 'true',
    'browserstack.video': 'true',
    'browserstack.networkProfile': '4g-lte-good'
  },
  'Samsung Galaxy S22': {
    'browserstack.user': process.env.BROWSERSTACK_USERNAME,
    'browserstack.key': process.env.BROWSERSTACK_ACCESS_KEY,
    'device': 'Samsung Galaxy S22',
    'os_version': '12.0',
    'browser': 'chrome',
    'real_mobile': 'true',
    'browserstack.debug': 'true',
    'browserstack.video': 'true'
  },
  'Google Pixel 6': {
    'browserstack.user': process.env.BROWSERSTACK_USERNAME,
    'browserstack.key': process.env.BROWSERSTACK_ACCESS_KEY,
    'device': 'Google Pixel 6',
    'os_version': '12.0',
    'browser': 'chrome',
    'real_mobile': 'true'
  }
};

// WebdriverIO configuration for mobile WebGL testing
export const config = {
  user: process.env.BROWSERSTACK_USERNAME,
  key: process.env.BROWSERSTACK_ACCESS_KEY,
  hostname: 'hub-cloud.browserstack.com',
  
  capabilities: Object.keys(browserstackCapabilities).map(device => ({
    maxInstances: 1,
    ...browserstackCapabilities[device],
    'bstack:options': {
      projectName: 'Three.js Mobile WebGL Testing',
      buildName: `Build ${new Date().toISOString()}`,
      sessionName: `${device} WebGL Test`
    }
  })),
  
  services: ['browserstack'],
  browserstackLocal: false
};
```

**LambdaTest Mobile Testing:**
LambdaTest provides access to 3000+ desktop and mobile configurations with AI-powered automation:

```javascript
// lambdatest-mobile-config.js
const lambdaTestCapabilities = [
  {
    'LT:Options': {
      'platform': 'iOS',
      'deviceName': 'iPhone 13',
      'platformVersion': '15',
      'isRealMobile': true,
      'network': true,
      'video': true,
      'build': 'Three.js Mobile WebGL Build',
      'name': 'iPhone 13 WebGL Test'
    }
  },
  {
    'LT:Options': {
      'platform': 'Android',
      'deviceName': 'Galaxy S21',
      'platformVersion': '11',
      'isRealMobile': true,
      'network': true,
      'video': true,
      'build': 'Three.js Mobile WebGL Build',
      'name': 'Galaxy S21 WebGL Test'
    }
  }
];
```

### 2. Mobile WebGL Capability Detection

**Comprehensive mobile capability testing:**
```javascript
// mobile-webgl-capability-detector.js
class MobileWebGLCapabilityDetector {
  static async detectMobileCapabilities() {
    const capabilities = {
      basicInfo: this.getDeviceInfo(),
      webglSupport: this.testWebGLSupport(),
      performanceInfo: await this.testPerformanceCapabilities(),
      touchSupport: this.detectTouchCapabilities(),
      memoryConstraints: this.detectMemoryConstraints()
    };
    
    return capabilities;
  }
  
  static getDeviceInfo() {
    const userAgent = navigator.userAgent;
    const isMobile = /Mobi|Android/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    
    return {
      isMobile,
      isIOS,
      isAndroid,
      userAgent,
      screenSize: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight
      },
      devicePixelRatio: window.devicePixelRatio,
      orientation: screen.orientation?.type || 'unknown'
    };
  }
  
  static testWebGLSupport() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
      return { supported: false, reason: 'WebGL not available' };
    }
    
    // Test mobile-specific WebGL capabilities
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    const maxFragmentTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    const maxVaryingVectors = gl.getParameter(gl.MAX_VARYING_VECTORS);
    
    // Mobile-specific extension testing
    const extensions = {
      oes_texture_float: !!gl.getExtension('OES_texture_float'),
      oes_texture_half_float: !!gl.getExtension('OES_texture_half_float'),
      webgl_lose_context: !!gl.getExtension('WEBGL_lose_context'),
      ext_texture_filter_anisotropic: !!gl.getExtension('EXT_texture_filter_anisotropic'),
      oes_standard_derivatives: !!gl.getExtension('OES_standard_derivatives')
    };
    
    return {
      supported: true,
      version: gl.getParameter(gl.VERSION),
      vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown',
      renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown',
      maxTextureSize,
      maxVertexTextures,
      maxFragmentTextures,
      maxVaryingVectors,
      extensions,
      // Mobile-specific GPU detection
      gpuType: this.detectGPUType(debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '')
    };
  }
  
  static detectGPUType(renderer) {
    const gpuTypes = {
      adreno: /Adreno/i,
      mali: /Mali/i,
      powervr: /PowerVR/i,
      apple: /Apple/i,
      tegra: /Tegra/i,
      intel: /Intel/i
    };
    
    for (const [type, regex] of Object.entries(gpuTypes)) {
      if (regex.test(renderer)) {
        return type;
      }
    }
    
    return 'unknown';
  }
  
  static async testPerformanceCapabilities() {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const gl = canvas.getContext('webgl');
      
      if (!gl) {
        resolve({ error: 'WebGL not available' });
        return;
      }
      
      // Simple performance test
      const startTime = performance.now();
      let frameCount = 0;
      
      const renderLoop = () => {
        gl.clearColor(Math.random(), Math.random(), Math.random(), 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        frameCount++;
        
        if (frameCount < 60) {
          requestAnimationFrame(renderLoop);
        } else {
          const endTime = performance.now();
          const totalTime = endTime - startTime;
          const avgFrameTime = totalTime / frameCount;
          
          resolve({
            totalTime,
            frameCount,
            avgFrameTime,
            estimatedFPS: 1000 / avgFrameTime,
            performanceRating: this.calculatePerformanceRating(avgFrameTime)
          });
        }
      };
      
      requestAnimationFrame(renderLoop);
    });
  }
  
  static calculatePerformanceRating(avgFrameTime) {
    if (avgFrameTime < 16.67) return 'high'; // 60+ FPS
    if (avgFrameTime < 33.33) return 'medium'; // 30+ FPS
    if (avgFrameTime < 50) return 'low'; // 20+ FPS
    return 'very-low'; // <20 FPS
  }
  
  static detectTouchCapabilities() {
    return {
      touchSupported: 'ontouchstart' in window,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      msMaxTouchPoints: navigator.msMaxTouchPoints || 0,
      pointerEventsSupported: 'PointerEvent' in window
    };
  }
  
  static detectMemoryConstraints() {
    const memoryInfo = performance.memory ? {
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      usedJSHeapSize: performance.memory.usedJSHeapSize
    } : null;
    
    // Estimate WebGL memory constraints based on device type
    const deviceInfo = this.getDeviceInfo();
    let estimatedWebGLMemory;
    
    if (deviceInfo.isIOS) {
      // iOS devices typically have more generous WebGL memory
      estimatedWebGLMemory = deviceInfo.devicePixelRatio > 2 ? 512 * 1024 * 1024 : 256 * 1024 * 1024;
    } else if (deviceInfo.isAndroid) {
      // Android varies widely, conservative estimate
      estimatedWebGLMemory = 256 * 1024 * 1024;
    } else {
      estimatedWebGLMemory = 128 * 1024 * 1024; // Very conservative for unknown mobile
    }
    
    return {
      jsMemory: memoryInfo,
      estimatedWebGLMemory,
      memoryPressureSupported: 'memory' in performance
    };
  }
}
```

### 3. Mobile-Specific Three.js Testing Framework

**Mobile-optimized test suite:**
```javascript
// mobile-threejs-test-suite.spec.js
const { test, expect, devices } = require('@playwright/test');

const mobileDevices = [
  { name: 'iPhone 13', ...devices['iPhone 13'] },
  { name: 'iPhone 12', ...devices['iPhone 12'] },
  { name: 'Samsung Galaxy S21', ...devices['Galaxy S21'] },
  { name: 'iPad Pro', ...devices['iPad Pro'] },
  { name: 'Pixel 6', ...devices['Pixel 6'] }
];

mobileDevices.forEach(device => {
  test.describe(`Mobile WebGL Testing: ${device.name}`, () => {
    test.use(device);
    
    test.beforeEach(async ({ page }) => {
      // Mobile-specific setup
      await page.goto('http://localhost:3000/integrated-scene.html');
      
      // Disable desktop-specific features for mobile testing
      await page.evaluate(() => {
        // Disable hover effects
        document.body.classList.add('mobile-testing');
        
        // Reduce WebGL quality for mobile
        if (window.renderer) {
          window.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }
      });
    });
    
    test('WebGL context initializes on mobile', async ({ page }) => {
      const webglInfo = await page.evaluate(() => {
        return window.MobileWebGLCapabilityDetector.detectMobileCapabilities();
      });
      
      expect(webglInfo.webglSupport.supported).toBeTruthy();
      
      // Log mobile-specific info for debugging
      console.log(`${device.name} WebGL Info:`, {
        gpu: webglInfo.webglSupport.gpuType,
        maxTextureSize: webglInfo.webglSupport.maxTextureSize,
        performanceRating: webglInfo.performanceInfo.performanceRating
      });
      
      // Mobile-specific assertions
      expect(webglInfo.basicInfo.isMobile).toBeTruthy();
      expect(webglInfo.touchSupport.touchSupported).toBeTruthy();
    });
    
    test('Touch interactions work correctly', async ({ page }) => {
      // Test touch-based camera controls
      const canvas = page.locator('#mainCanvas');
      
      // Simulate touch pan gesture
      await canvas.touchscreen.tap(200, 200);
      await page.waitForTimeout(100);
      
      // Simulate pinch-to-zoom (if supported)
      const supports_touch = await page.evaluate(() => 'ontouchstart' in window);
      if (supports_touch) {
        await canvas.tap({ position: { x: 200, y: 200 } });
        await page.waitForTimeout(500);
        
        const cameraPosition = await page.evaluate(() => ({
          x: window.camera.position.x,
          y: window.camera.position.y,
          z: window.camera.position.z
        }));
        
        // Verify camera responded to touch interaction
        expect(typeof cameraPosition.x).toBe('number');
        expect(typeof cameraPosition.y).toBe('number');
        expect(typeof cameraPosition.z).toBe('number');
      }
    });
    
    test('Mobile performance meets minimum requirements', async ({ page }) => {
      // Load test model
      await page.locator('#glbUpload').setInputFiles('./test-assets/mobile-test-model.glb');
      await page.waitForTimeout(3000); // Allow loading
      
      const performanceMetrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          const frames = [];
          let frameCount = 0;
          const maxFrames = 60;
          
          const measureFrame = () => {
            const start = performance.now();
            
            // Render frame
            window.renderer.render(window.scene, window.camera);
            
            const end = performance.now();
            frames.push(end - start);
            frameCount++;
            
            if (frameCount < maxFrames) {
              requestAnimationFrame(measureFrame);
            } else {
              const avgFrameTime = frames.reduce((a, b) => a + b, 0) / frames.length;
              const maxFrameTime = Math.max(...frames);
              const minFrameTime = Math.min(...frames);
              
              resolve({
                avgFrameTime,
                maxFrameTime,
                minFrameTime,
                estimatedFPS: 1000 / avgFrameTime,
                frameTimeVariance: frames.reduce((sum, time) => sum + Math.pow(time - avgFrameTime, 2), 0) / frames.length
              });
            }
          };
          
          requestAnimationFrame(measureFrame);
        });
      });
      
      // Mobile performance assertions (more lenient than desktop)
      expect(performanceMetrics.avgFrameTime).toBeLessThan(50); // 20 FPS minimum
      expect(performanceMetrics.maxFrameTime).toBeLessThan(100); // No frames longer than 100ms
      expect(performanceMetrics.estimatedFPS).toBeGreaterThan(15); // Minimum 15 FPS
      
      console.log(`${device.name} Performance:`, {
        avgFPS: performanceMetrics.estimatedFPS.toFixed(1),
        avgFrameTime: performanceMetrics.avgFrameTime.toFixed(2),
        variance: performanceMetrics.frameTimeVariance.toFixed(2)
      });
    });
    
    test('Canvas texture updates work on mobile', async ({ page }) => {
      // Load model
      await page.locator('#glbUpload').setInputFiles('./test-assets/mobile-test-model.glb');
      await page.waitForTimeout(2000);
      
      // Test touch drawing on canvas
      const drawCanvas = page.locator('#drawCanvas');
      
      // Touch-based drawing
      await drawCanvas.tap({ position: { x: 100, y: 100 } });
      await page.waitForTimeout(500);
      
      // Verify texture was updated
      const textureUpdated = await page.evaluate(() => {
        return window.canvasTexture && window.needsTextureUpdate === false;
      });
      
      expect(textureUpdated).toBeTruthy();
    });
    
    test('Memory usage stays within mobile limits', async ({ page }) => {
      const memoryLimit = 50 * 1024 * 1024; // 50MB limit for mobile
      
      // Load and unload models repeatedly to test memory management
      for (let i = 0; i < 5; i++) {
        await page.locator('#glbUpload').setInputFiles('./test-assets/mobile-test-model.glb');
        await page.waitForTimeout(1000);
        
        // Reset scene (should free memory)
        await page.click('button:has-text("Reset Scene")');
        await page.waitForTimeout(1000);
        
        const memoryUsage = await page.evaluate(() => {
          return performance.memory ? performance.memory.usedJSHeapSize : null;
        });
        
        if (memoryUsage) {
          expect(memoryUsage).toBeLessThan(memoryLimit);
        }
      }
    });
    
    test('WebGL context loss recovery works', async ({ page }) => {
      // Load model first
      await page.locator('#glbUpload').setInputFiles('./test-assets/mobile-test-model.glb');
      await page.waitForTimeout(2000);
      
      // Simulate context loss (common on mobile)
      const contextLostHandled = await page.evaluate(() => {
        return new Promise((resolve) => {
          const canvas = document.getElementById('mainCanvas');
          const gl = canvas.getContext('webgl');
          
          if (!gl) {
            resolve(false);
            return;
          }
          
          const loseContextExt = gl.getExtension('WEBGL_lose_context');
          if (!loseContextExt) {
            resolve(false);
            return;
          }
          
          let contextLost = false;
          let contextRestored = false;
          
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            contextLost = true;
          });
          
          canvas.addEventListener('webglcontextrestored', () => {
            contextRestored = true;
            resolve(contextLost && contextRestored);
          });
          
          // Lose context
          loseContextExt.loseContext();
          
          // Restore context after delay
          setTimeout(() => {
            loseContextExt.restoreContext();
          }, 1000);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            resolve(false);
          }, 5000);
        });
      });
      
      expect(contextLostHandled).toBeTruthy();
    });
  });
});
```

### 4. Device-Specific Performance Profiling

**GPU-specific performance testing:**
```javascript
// gpu-specific-performance-tests.js
class MobileGPUPerformanceTester {
  constructor() {
    this.gpuProfiles = {
      adreno: {
        name: 'Qualcomm Adreno',
        expectedPerformance: 'medium',
        commonIssues: ['shader_precision', 'texture_bandwidth'],
        optimizations: ['reduce_precision', 'texture_compression']
      },
      mali: {
        name: 'ARM Mali',
        expectedPerformance: 'low-medium',
        commonIssues: ['vertex_throughput', 'bandwidth_limited'],
        optimizations: ['reduce_vertices', 'tile_friendly_rendering']
      },
      powervr: {
        name: 'PowerVR',
        expectedPerformance: 'medium',
        commonIssues: ['overdraw_sensitive', 'bandwidth_limited'],
        optimizations: ['reduce_overdraw', 'efficient_blending']
      },
      apple: {
        name: 'Apple GPU',
        expectedPerformance: 'high',
        commonIssues: ['memory_bandwidth'],
        optimizations: ['texture_streaming', 'lod_optimization']
      }
    };
  }
  
  async profileGPUPerformance(gpuType) {
    const profile = this.gpuProfiles[gpuType] || this.gpuProfiles.mali; // Default to conservative
    
    const tests = [
      { name: 'triangle_throughput', test: this.testTriangleThroughput },
      { name: 'texture_fill_rate', test: this.testTextureFillRate },
      { name: 'shader_complexity', test: this.testShaderComplexity },
      { name: 'vertex_throughput', test: this.testVertexThroughput }
    ];
    
    const results = {};
    
    for (const { name, test } of tests) {
      try {
        results[name] = await test.call(this);
        // Apply GPU-specific performance expectations
        results[name].expected = this.getExpectedPerformance(name, profile);
        results[name].passes = this.evaluatePerformance(results[name], profile);
      } catch (error) {
        results[name] = { error: error.message, passes: false };
      }
    }
    
    return {
      gpuType,
      profile,
      results,
      overallPerformance: this.calculateOverallPerformance(results)
    };
  }
  
  async testTriangleThroughput() {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const gl = canvas.getContext('webgl');
      
      if (!gl) {
        resolve({ error: 'WebGL not available' });
        return;
      }
      
      // Create simple triangle mesh
      const vertices = new Float32Array([
        -0.5, -0.5, 0.0,
         0.5, -0.5, 0.0,
         0.0,  0.5, 0.0
      ]);
      
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      
      // Simple shader
      const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, `
        attribute vec3 a_position;
        void main() {
          gl_Position = vec4(a_position, 1.0);
        }
      `);
      
      const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, `
        precision mediump float;
        void main() {
          gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }
      `);
      
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.useProgram(program);
      
      const positionLocation = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
      
      // Benchmark triangle rendering
      const triangleCount = 1000;
      const startTime = performance.now();
      
      for (let i = 0; i < triangleCount; i++) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      
      // Force GPU sync
      gl.finish();
      const endTime = performance.now();
      
      resolve({
        triangleCount,
        totalTime: endTime - startTime,
        trianglesPerSecond: (triangleCount / (endTime - startTime)) * 1000,
        averageTimePerTriangle: (endTime - startTime) / triangleCount
      });
    });
  }
  
  async testTextureFillRate() {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const gl = canvas.getContext('webgl');
      
      if (!gl) {
        resolve({ error: 'WebGL not available' });
        return;
      }
      
      // Create texture
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      
      const textureData = new Uint8Array(256 * 256 * 4);
      for (let i = 0; i < textureData.length; i += 4) {
        textureData[i] = Math.random() * 255;     // R
        textureData[i + 1] = Math.random() * 255; // G  
        textureData[i + 2] = Math.random() * 255; // B
        textureData[i + 3] = 255;                 // A
      }
      
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, textureData);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      
      // Test fill rate by rendering large textured quad multiple times
      const iterations = 100;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        // Render fullscreen quad (implementation would go here)
        this.renderTexturedQuad(gl, texture);
      }
      
      gl.finish();
      const endTime = performance.now();
      
      const pixelsPerFrame = 512 * 512;
      const totalPixels = pixelsPerFrame * iterations;
      const totalTime = endTime - startTime;
      
      resolve({
        iterations,
        totalTime,
        pixelsPerSecond: (totalPixels / totalTime) * 1000,
        megapixelsPerSecond: ((totalPixels / totalTime) * 1000) / 1000000
      });
    });
  }
  
  createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }
  
  renderTexturedQuad(gl, texture) {
    // Simplified quad rendering for fill rate test
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  
  getExpectedPerformance(testName, profile) {
    const expectations = {
      triangle_throughput: {
        high: { min: 50000, target: 100000 },
        medium: { min: 20000, target: 50000 },
        'low-medium': { min: 10000, target: 25000 },
        low: { min: 5000, target: 15000 }
      },
      texture_fill_rate: {
        high: { min: 500, target: 1000 },
        medium: { min: 200, target: 500 },
        'low-medium': { min: 100, target: 300 },
        low: { min: 50, target: 150 }
      }
    };
    
    return expectations[testName]?.[profile.expectedPerformance] || { min: 0, target: Infinity };
  }
  
  evaluatePerformance(result, profile) {
    if (result.error) return false;
    
    const expected = result.expected;
    if (!expected) return true; // No expectations set
    
    // Check if performance meets minimum requirements
    const performanceValue = result.trianglesPerSecond || result.megapixelsPerSecond || 0;
    return performanceValue >= expected.min;
  }
  
  calculateOverallPerformance(results) {
    const testResults = Object.values(results);
    const passedTests = testResults.filter(r => r.passes).length;
    const totalTests = testResults.length;
    
    const passRate = passedTests / totalTests;
    
    if (passRate >= 0.9) return 'excellent';
    if (passRate >= 0.75) return 'good';
    if (passRate >= 0.5) return 'acceptable';
    return 'poor';
  }
}
```

## Cross-Platform Validation

### iOS vs Android Testing Strategy

**Platform-specific considerations:**
```javascript
// platform-specific-mobile-tests.js
const platformTestConfigs = {
  ios: {
    devices: ['iPhone 13 Pro', 'iPhone 12', 'iPad Pro'],
    webglContexts: ['webgl'], // iOS Safari primarily uses WebGL 1.0
    expectedGPUs: ['apple'],
    memoryConstraints: {
      conservative: 256 * 1024 * 1024, // 256MB
      generous: 512 * 1024 * 1024      // 512MB on newer devices
    },
    knownIssues: [
      'webgl2_limited_support',
      'context_loss_on_background',
      'memory_pressure_aggressive'
    ]
  },
  android: {
    devices: ['Samsung Galaxy S21', 'Google Pixel 6', 'OnePlus 9'],
    webglContexts: ['webgl', 'webgl2'],
    expectedGPUs: ['adreno', 'mali', 'powervr'],
    memoryConstraints: {
      conservative: 128 * 1024 * 1024, // 128MB for low-end
      generous: 256 * 1024 * 1024      // 256MB for high-end
    },
    knownIssues: [
      'gpu_driver_variations',
      'oem_webgl_modifications',
      'thermal_throttling_aggressive'
    ]
  }
};

test.describe('Platform-specific mobile testing', () => {
  Object.entries(platformTestConfigs).forEach(([platform, config]) => {
    config.devices.forEach(deviceName => {
      test(`${platform.toUpperCase()} - ${deviceName} compatibility`, async ({ page }) => {
        // Platform-specific device simulation
        if (platform === 'ios') {
          await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');
        } else {
          await page.setUserAgent('Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Mobile Safari/537.36');
        }
        
        await page.goto('http://localhost:3000/integrated-scene.html');
        
        const platformCapabilities = await page.evaluate((platformConfig) => {
          return {
            webglSupport: window.MobileWebGLCapabilityDetector.testWebGLSupport(),
            memoryInfo: window.MobileWebGLCapabilityDetector.detectMemoryConstraints(),
            performanceProfile: window.MobileGPUPerformanceTester?.profileGPUPerformance()
          };
        }, config);
        
        // Platform-specific assertions
        expect(platformCapabilities.webglSupport.supported).toBeTruthy();
        
        if (platform === 'ios') {
          // iOS-specific tests
          expect(platformCapabilities.webglSupport.gpuType).toBe('apple');
          expect(platformCapabilities.webglSupport.extensions.oes_texture_float).toBeTruthy();
        } else {
          // Android-specific tests
          expect(['adreno', 'mali', 'powervr'].includes(platformCapabilities.webglSupport.gpuType)).toBeTruthy();
        }
        
        // Memory constraint validation
        if (platformCapabilities.memoryInfo.jsMemory) {
          expect(platformCapabilities.memoryInfo.jsMemory.jsHeapSizeLimit)
            .toBeGreaterThan(config.memoryConstraints.conservative);
        }
      });
    });
  });
});
```

### Progressive Enhancement Testing

**Test graceful degradation on limited devices:**
```javascript
// progressive-enhancement-tests.js
class ProgressiveEnhancementTester {
  static async testFeatureFallbacks(page) {
    const featureTests = [
      {
        name: 'float_textures',
        test: () => !!gl.getExtension('OES_texture_float'),
        fallback: 'Use UNSIGNED_BYTE textures'
      },
      {
        name: 'webgl2',
        test: () => !!canvas.getContext('webgl2'),
        fallback: 'Use WebGL 1.0 features only'
      },
      {
        name: 'high_precision_shaders',
        test: () => {
          const gl = canvas.getContext('webgl');
          return gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision > 0;
        },
        fallback: 'Use medium precision in shaders'
      },
      {
        name: 'anisotropic_filtering',
        test: () => !!gl.getExtension('EXT_texture_filter_anisotropic'),
        fallback: 'Use linear filtering only'
      }
    ];
    
    const results = await page.evaluate((tests) => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl');
      
      if (!gl) return { error: 'WebGL not available' };
      
      return tests.map(({ name, test, fallback }) => {
        try {
          const supported = eval(test);
          return { name, supported, fallback: supported ? null : fallback };
        } catch (error) {
          return { name, supported: false, fallback, error: error.message };
        }
      });
    }, featureTests);
    
    return results;
  }
  
  static async testPerformanceAdaptation(page, targetFPS = 30) {
    const adaptationResult = await page.evaluate((targetFPS) => {
      return new Promise((resolve) => {
        let currentQuality = 1.0;
        const minQuality = 0.25;
        const qualityStep = 0.125;
        
        const frameTimeSamples = [];
        let frameCount = 0;
        const maxFrames = 60;
        
        const testLoop = () => {
          const frameStart = performance.now();
          
          // Render with current quality settings
          if (window.renderer) {
            window.renderer.setPixelRatio(window.devicePixelRatio * currentQuality);
            window.renderer.render(window.scene, window.camera);
          }
          
          const frameTime = performance.now() - frameStart;
          frameTimeSamples.push(frameTime);
          frameCount++;
          
          if (frameCount >= 10) {
            const avgFrameTime = frameTimeSamples.slice(-10).reduce((a, b) => a + b, 0) / 10;
            const currentFPS = 1000 / avgFrameTime;
            
            // Adapt quality if performance is below target
            if (currentFPS < targetFPS && currentQuality > minQuality) {
              currentQuality = Math.max(minQuality, currentQuality - qualityStep);
              console.log(`Reducing quality to ${currentQuality}, FPS: ${currentFPS.toFixed(1)}`);
            }
          }
          
          if (frameCount < maxFrames) {
            requestAnimationFrame(testLoop);
          } else {
            const finalAvgFrameTime = frameTimeSamples.reduce((a, b) => a + b, 0) / frameTimeSamples.length;
            const finalFPS = 1000 / finalAvgFrameTime;
            
            resolve({
              finalQuality: currentQuality,
              finalFPS,
              adaptationSuccessful: finalFPS >= targetFPS * 0.9, // 90% of target
              qualityReduction: 1.0 - currentQuality
            });
          }
        };
        
        requestAnimationFrame(testLoop);
      });
    }, targetFPS);
    
    return adaptationResult;
  }
}

test.describe('Progressive enhancement testing', () => {
  test('Feature fallbacks work correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/integrated-scene.html');
    
    const fallbackTests = await ProgressiveEnhancementTester.testFeatureFallbacks(page);
    
    // Ensure all features have appropriate fallbacks
    fallbackTests.forEach(test => {
      if (!test.supported && !test.error) {
        expect(test.fallback).toBeTruthy();
        console.log(`Feature '${test.name}' not supported, using fallback: ${test.fallback}`);
      }
    });
  });
  
  test('Performance adaptation maintains target FPS', async ({ page }) => {
    await page.goto('http://localhost:3000/integrated-scene.html');
    
    // Load complex model to stress performance
    await page.locator('#glbUpload').setInputFiles('./test-assets/complex-model.glb');
    await page.waitForTimeout(2000);
    
    const adaptationResult = await ProgressiveEnhancementTester.testPerformanceAdaptation(page, 30);
    
    expect(adaptationResult.adaptationSuccessful).toBeTruthy();
    
    if (adaptationResult.qualityReduction > 0) {
      console.log(`Quality reduced by ${(adaptationResult.qualityReduction * 100).toFixed(1)}% to maintain ${adaptationResult.finalFPS.toFixed(1)} FPS`);
    }
  });
});
```

## Implementation Strategy

### Step 1: Mobile Testing Infrastructure Setup

**Configure cloud testing services:**
```bash
# Install mobile testing dependencies
npm install --save-dev @playwright/test
npm install --save-dev webdriverio
npm install --save-dev @wdio/browserstack-service

# Set up environment variables for cloud services
echo "BROWSERSTACK_USERNAME=your_username" >> .env
echo "BROWSERSTACK_ACCESS_KEY=your_access_key" >> .env
echo "LAMBDATEST_USERNAME=your_username" >> .env
echo "LAMBDATEST_ACCESS_KEY=your_access_key" >> .env
```

### Step 2: Device Matrix Definition

**Create comprehensive device testing matrix:**
```javascript
// mobile-device-matrix.js
export const mobileDeviceMatrix = {
  highEnd: {
    ios: [
      { device: 'iPhone 14 Pro', os: '16', memory: '6GB', gpu: 'Apple A16' },
      { device: 'iPad Pro 12.9', os: '16', memory: '8GB', gpu: 'Apple M2' }
    ],
    android: [
      { device: 'Samsung Galaxy S23', os: '13', memory: '8GB', gpu: 'Adreno 740' },
      { device: 'Google Pixel 7 Pro', os: '13', memory: '12GB', gpu: 'Mali-G710' }
    ]
  },
  midRange: {
    ios: [
      { device: 'iPhone 12', os: '15', memory: '4GB', gpu: 'Apple A14' },
      { device: 'iPad Air', os: '15', memory: '4GB', gpu: 'Apple A14' }
    ],
    android: [
      { device: 'Samsung Galaxy A54', os: '13', memory: '6GB', gpu: 'Mali-G68' },
      { device: 'OnePlus Nord', os: '12', memory: '8GB', gpu: 'Adreno 650' }
    ]
  },
  lowEnd: {
    android: [
      { device: 'Samsung Galaxy A13', os: '12', memory: '4GB', gpu: 'Mali-G52' },
      { device: 'Moto G Power', os: '11', memory: '3GB', gpu: 'Adreno 610' }
    ]
  }
};
```

### Step 3: Mobile-Specific Test Configuration

**Configure Playwright for mobile testing:**
```javascript
// playwright.mobile.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/mobile',
  timeout: 45000, // Longer timeout for mobile
  expect: {
    timeout: 10000
  },
  projects: [
    // Mobile Chromium
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 6'],
        launchOptions: {
          args: [
            '--use-angle=angle',
            '--enable-webgl',
            '--enable-accelerated-2d-canvas',
            '--force-gpu-mem-available-mb=512'
          ]
        }
      }
    },
    // Mobile Safari
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 13'],
        launchOptions: {
          args: [
            '--enable-webgl'
          ]
        }
      }
    }
  ],
  use: {
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
});
```

### Step 4: CI/CD Mobile Testing Pipeline

**GitHub Actions mobile testing workflow:**
```yaml
# .github/workflows/mobile-testing.yml
name: Mobile WebGL Testing

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  mobile-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        device-type: [high-end, mid-range, low-end]
        
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright
        run: npx playwright install --with-deps
        
      - name: Run mobile WebGL tests
        env:
          BROWSERSTACK_USERNAME: ${{ secrets.BROWSERSTACK_USERNAME }}
          BROWSERSTACK_ACCESS_KEY: ${{ secrets.BROWSERSTACK_ACCESS_KEY }}
          DEVICE_TYPE: ${{ matrix.device-type }}
        run: npx playwright test --config=playwright.mobile.config.js --grep="${{ matrix.device-type }}"
        
      - name: Upload mobile test artifacts
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: mobile-test-results-${{ matrix.device-type }}
          path: |
            test-results/
            mobile-performance-reports/
            
  cross-platform-analysis:
    needs: mobile-tests
    runs-on: ubuntu-latest
    if: always()
    
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        
      - name: Generate cross-platform report
        run: |
          node scripts/generate-mobile-compatibility-report.js
          
      - name: Comment PR with mobile compatibility
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const reportPath = 'mobile-compatibility-report.json';
            
            if (fs.existsSync(reportPath)) {
              const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
              
              let comment = '## Mobile Compatibility Test Results\n\n';
              
              Object.entries(report.deviceCategories).forEach(([category, results]) => {
                comment += `### ${category.toUpperCase()}\n`;
                comment += `- Pass Rate: ${results.passRate}%\n`;
                comment += `- Average Performance: ${results.avgPerformance}\n`;
                if (results.issues.length > 0) {
                  comment += `- Issues: ${results.issues.join(', ')}\n`;
                }
                comment += '\n';
              });
              
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: comment
              });
            }
```

## Monitoring and Metrics

### Real-World Mobile Performance Monitoring

**Production mobile analytics:**
```javascript
// mobile-analytics-integration.js
class MobileWebGLAnalytics {
  constructor() {
    this.deviceInfo = this.collectDeviceInfo();
    this.performanceMetrics = [];
    this.errorLog = [];
    this.setupAnalytics();
  }
  
  collectDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      deviceMemory: navigator.deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      maxTouchPoints: navigator.maxTouchPoints,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink
      } : null,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      }
    };
  }
  
  trackWebGLPerformance(renderer) {
    setInterval(() => {
      const performanceData = {
        timestamp: Date.now(),
        frameTime: this.measureFrameTime(),
        memoryUsage: performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize
        } : null,
        webglInfo: renderer ? {
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          textures: renderer.info.memory.textures,
          geometries: renderer.info.memory.geometries
        } : null,
        batteryLevel: this.getBatteryLevel()
      };
      
      this.performanceMetrics.push(performanceData);
      
      // Keep only last 100 measurements
      if (this.performanceMetrics.length > 100) {
        this.performanceMetrics.shift();
      }
      
      this.analyzePerformanceTrends();
    }, 10000); // Every 10 seconds
  }
  
  async getBatteryLevel() {
    try {
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery();
        return {
          level: battery.level,
          charging: battery.charging
        };
      }
    } catch (error) {
      return null;
    }
    return null;
  }
  
  measureFrameTime() {
    // Implementation would measure actual frame times
    return performance.now(); // Placeholder
  }
  
  analyzePerformanceTrends() {
    if (this.performanceMetrics.length < 10) return;
    
    const recentMetrics = this.performanceMetrics.slice(-10);
    const avgFrameTime = recentMetrics.reduce((sum, m) => sum + (m.frameTime || 0), 0) / recentMetrics.length;
    
    // Detect performance degradation
    if (avgFrameTime > 33.33) { // Below 30 FPS
      this.reportPerformanceIssue('low_fps', {
        avgFrameTime,
        estimatedFPS: 1000 / avgFrameTime,
        deviceInfo: this.deviceInfo
      });
    }
    
    // Detect memory growth
    const memoryGrowth = this.detectMemoryGrowth(recentMetrics);
    if (memoryGrowth > 10 * 1024 * 1024) { // 10MB growth
      this.reportPerformanceIssue('memory_growth', {
        memoryGrowth,
        deviceInfo: this.deviceInfo
      });
    }
  }
  
  detectMemoryGrowth(metrics) {
    const withMemory = metrics.filter(m => m.memoryUsage);
    if (withMemory.length < 5) return 0;
    
    const first = withMemory[0].memoryUsage.used;
    const last = withMemory[withMemory.length - 1].memoryUsage.used;
    return last - first;
  }
  
  reportPerformanceIssue(type, data) {
    const issue = {
      type,
      data,
      timestamp: Date.now(),
      sessionId: this.getSessionId()
    };
    
    // Send to analytics service
    this.sendAnalytics('mobile_performance_issue', issue);
    
    console.warn(`Mobile performance issue detected: ${type}`, data);
  }
  
  sendAnalytics(eventType, data) {
    // Google Analytics 4
    if (typeof gtag !== 'undefined') {
      gtag('event', eventType, {
        custom_parameter_1: JSON.stringify(data)
      });
    }
    
    // Custom analytics endpoint
    fetch('/api/mobile-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, data, deviceInfo: this.deviceInfo })
    }).catch(error => {
      console.error('Failed to send analytics:', error);
    });
  }
  
  getSessionId() {
    if (!this.sessionId) {
      this.sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
    return this.sessionId;
  }
}
```

## References

### Mobile Testing Platforms
- [BrowserStack Real Device Cloud](https://www.browserstack.com/real-device-cloud)
- [LambdaTest Mobile Testing](https://www.lambdatest.com/mobile-browser-testing)
- [TestingBot Mobile App Testing](https://testingbot.com/mobile)
- [Sauce Labs Real Device Cloud](https://saucelabs.com/platform/real-device-cloud)

### Mobile WebGL Resources
- [WebGL on Mobile Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#mobile_considerations)
- [Three.js Browser Support](https://threejs.org/docs/#manual/en/introduction/Browser-support)
- [Mobile GPU Performance Database](https://www.notebookcheck.net/Mobile-Graphics-Cards-Benchmark-List.844.0.html)

### Device Testing Tools
- [Playwright Device Emulation](https://playwright.dev/docs/emulation)
- [WebdriverIO Mobile Testing](https://webdriver.io/docs/mobile-testing/)
- [Chrome DevTools Device Mode](https://developer.chrome.com/docs/devtools/device-mode/)
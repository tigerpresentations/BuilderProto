# Three.js Testing Research: Visual Regression Testing for WebGL Applications

## Testing Challenge Analysis

Visual regression testing for Three.js WebGL applications presents unique challenges not found in traditional web UI testing:

- **3D Rendering Inconsistencies**: WebGL rendering can vary between browsers due to different graphics drivers and hardware acceleration
- **Non-Deterministic Rendering**: Anti-aliasing, floating-point precision, and GPU timing can cause pixel-level differences
- **Complex Visual States**: 3D scenes have camera angles, lighting conditions, and animation states that must be controlled
- **Hardware Dependencies**: Different GPUs may render identical scenes with subtle visual differences
- **Texture Loading Timing**: Asynchronous texture loading can cause visual state variations during testing

### WebGL-Specific Testing Complexities

1. **GPU Driver Variations**: Different graphics drivers render WebGL content with subtle differences
2. **Floating-Point Precision**: GPU calculations may vary slightly between hardware configurations  
3. **Context-Dependent Rendering**: WebGL context settings affect final visual output
4. **Anti-aliasing Differences**: Browser anti-aliasing implementations vary significantly
5. **Texture Compression**: Different browsers may compress textures differently, affecting visual quality

## Established Testing Approaches

### 1. Three.js Community Visual Testing Methods

**Current Three.js Project Status:**
The Three.js project acknowledges the need for automated visual regression testing but currently relies primarily on manual testing of examples. The community has identified several approaches:

- **ImageMagick with SSIM Metrics**: Structural Similarity Index (SSIM) identified as optimal for image comparison
- **Reference implementations**: Projects like model-viewer and vtk-js-datasets provide visual testing examples
- **Example-based testing**: Testing against the extensive Three.js examples library

**SSIM (Structural Similarity Index) Implementation:**
```javascript
// ssim-comparison.js
class SSIMVisualTester {
  static async compareImages(page, referenceImagePath, threshold = 0.95) {
    // Capture current rendered frame
    const screenshot = await page.locator('#mainCanvas').screenshot();
    
    // Use ImageMagick compare with SSIM metric
    const comparison = await page.evaluate(async (screenshot, reference, threshold) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Load both images
      const [currentImg, refImg] = await Promise.all([
        this.loadImageData(screenshot),
        this.loadImageData(reference)
      ]);
      
      // Calculate SSIM using established algorithm
      const ssimScore = this.calculateSSIM(currentImg, refImg);
      
      return {
        ssimScore,
        passed: ssimScore >= threshold,
        difference: 1 - ssimScore
      };
    }, screenshot, referenceImagePath, threshold);
    
    return comparison;
  }
  
  static calculateSSIM(img1Data, img2Data) {
    // SSIM algorithm implementation for WebGL content
    // This handles the specific challenges of 3D rendering comparison
    const { width, height } = img1Data;
    const data1 = img1Data.data;
    const data2 = img2Data.data;
    
    let totalSSIM = 0;
    const windowSize = 8; // Optimal for 3D content
    
    for (let y = 0; y < height - windowSize; y += windowSize) {
      for (let x = 0; x < width - windowSize; x += windowSize) {
        const windowSSIM = this.calculateWindowSSIM(
          data1, data2, x, y, windowSize, width
        );
        totalSSIM += windowSSIM;
      }
    }
    
    return totalSSIM / ((width / windowSize) * (height / windowSize));
  }
}
```

### 2. Playwright Visual Testing for WebGL

**WebGL-Optimized Visual Testing Setup:**
```javascript
// webgl-visual-tests.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Three.js Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/integrated-scene.html');
    
    // Ensure deterministic rendering
    await page.evaluate(() => {
      // Disable animations for consistent testing
      window.controls.autoRotate = false;
      window.controls.enableDamping = false;
      
      // Set fixed camera position
      window.camera.position.set(0, 0, 5);
      window.controls.target.set(0, 0, 0);
      window.controls.update();
      
      // Disable random elements
      Math.random = () => 0.5; // Deterministic random for reproducible results
    });
    
    // Wait for WebGL initialization
    await page.waitForFunction(() => 
      window.renderer && window.renderer.info.render.calls > 0
    );
  });
  
  test('Scene renders consistently with default model', async ({ page }) => {
    // Load test model
    await page.locator('#glbUpload').setInputFiles('./test-assets/test-model.glb');
    await page.waitForTimeout(2000); // Allow model to fully load
    
    // Force render and capture
    await page.evaluate(() => {
      window.renderer.render(window.scene, window.camera);
    });
    
    // Compare against reference image with WebGL-appropriate threshold
    await expect(page.locator('#mainCanvas')).toHaveScreenshot('default-scene.png', {
      threshold: 0.3, // Higher threshold for WebGL content
      maxDiffPixels: 1000 // Allow for minor GPU differences
    });
  });
  
  test('Canvas texture updates show correct visual changes', async ({ page }) => {
    // Load model and wait for initialization
    await page.locator('#glbUpload').setInputFiles('./test-assets/test-model.glb');
    await page.waitForTimeout(2000);
    
    // Clear canvas to white
    await page.click('button:has-text("Clear")');
    await page.waitForTimeout(500);
    
    // Capture before state
    await expect(page.locator('#mainCanvas')).toHaveScreenshot('canvas-white.png', {
      threshold: 0.2
    });
    
    // Draw red square on canvas
    await page.evaluate(() => {
      const canvas = document.getElementById('drawCanvas');
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(100, 100, 50, 50);
      window.needsTextureUpdate = true;
    });
    
    await page.waitForTimeout(500); // Allow texture update
    
    // Capture after state
    await expect(page.locator('#mainCanvas')).toHaveScreenshot('canvas-red-square.png', {
      threshold: 0.2
    });
  });
});
```

### 3. Percy for WebGL Visual Testing

**Percy Integration for Three.js:**
```javascript
// percy-webgl-config.js
const { percySnapshot } = require('@percy/playwright');

async function captureWebGLSnapshot(page, name, options = {}) {
  // Ensure WebGL scene is ready
  await page.waitForFunction(() => 
    window.renderer && 
    window.renderer.info.render.calls > 0 &&
    !window.needsRender
  );
  
  // Force final render to ensure consistency
  await page.evaluate(() => {
    window.renderer.render(window.scene, window.camera);
  });
  
  // Take Percy snapshot with WebGL-specific options
  await percySnapshot(page, name, {
    widths: [1280], // Fixed width for 3D content
    minHeight: 720,
    percyCSS: `
      #mainCanvas { 
        image-rendering: pixelated; /* Prevent browser scaling artifacts */
      }
    `,
    ...options
  });
}

// Usage in tests
test('Three.js scene visual regression', async ({ page }) => {
  await setupDeterministicScene(page);
  await captureWebGLSnapshot(page, 'three-js-default-scene');
});
```

### 4. Automated Screenshot Comparison Framework

**Custom WebGL-Aware Visual Testing:**
```javascript
// webgl-visual-framework.js
class WebGLVisualTestFramework {
  constructor(browser, options = {}) {
    this.browser = browser;
    this.options = {
      threshold: 0.3,
      pixelDiffLimit: 1000,
      waitForRender: 2000,
      ...options
    };
  }
  
  async setupTestScene(page, modelPath = null) {
    // Navigate to application
    await page.goto(this.options.baseURL);
    
    // Load model if specified
    if (modelPath) {
      await page.locator('#glbUpload').setInputFiles(modelPath);
      await page.waitForTimeout(this.options.waitForRender);
    }
    
    // Set deterministic state
    await page.evaluate(() => {
      // Fixed camera position
      window.camera.position.set(2, 2, 5);
      window.camera.lookAt(0, 0, 0);
      
      // Disable auto-rotation and damping
      if (window.controls) {
        window.controls.autoRotate = false;
        window.controls.enableDamping = false;
        window.controls.update();
      }
      
      // Set fixed lighting
      window.scene.traverse((child) => {
        if (child.isLight) {
          child.intensity = 1.0;
          child.position.set(5, 5, 5);
        }
      });
      
      // Force render
      window.renderer.render(window.scene, window.camera);
    });
    
    // Wait for any final updates
    await page.waitForTimeout(500);
  }
  
  async captureAndCompare(page, testName, referenceDir) {
    const screenshot = await page.locator('#mainCanvas').screenshot();
    const referencePath = `${referenceDir}/${testName}.png`;
    
    try {
      const existingReference = await fs.readFile(referencePath);
      const comparison = await this.compareImages(screenshot, existingReference);
      
      if (!comparison.passed) {
        // Save diff image for debugging
        await fs.writeFile(
          `${referenceDir}/${testName}-diff.png`, 
          comparison.diffImage
        );
        
        throw new Error(
          `Visual regression detected: ${testName}\n` +
          `SSIM Score: ${comparison.ssimScore}\n` +
          `Pixel Differences: ${comparison.pixelDifferences}`
        );
      }
      
      return comparison;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // No reference image exists, save current as reference
        await fs.writeFile(referencePath, screenshot);
        console.log(`Created reference image: ${testName}`);
      } else {
        throw error;
      }
    }
  }
  
  async runTestSuite(testCases) {
    const results = [];
    
    for (const testCase of testCases) {
      const page = await this.browser.newPage();
      
      try {
        await this.setupTestScene(page, testCase.modelPath);
        
        // Execute test-specific setup
        if (testCase.setup) {
          await testCase.setup(page);
        }
        
        const result = await this.captureAndCompare(
          page, 
          testCase.name, 
          testCase.referenceDir || './visual-references'
        );
        
        results.push({
          name: testCase.name,
          status: 'passed',
          metrics: result
        });
      } catch (error) {
        results.push({
          name: testCase.name,
          status: 'failed',
          error: error.message
        });
      } finally {
        await page.close();
      }
    }
    
    return results;
  }
}
```

## Cross-Platform Validation

### Browser-Specific Visual Differences

**Expected Variations by Browser:**
- **Chrome**: Generally most consistent WebGL rendering, ANGLE implementation
- **Firefox**: May have slight shader differences, different texture handling
- **Safari**: WebKit renderer differences, especially on macOS/iOS
- **Edge**: Chromium-based but may have Windows-specific graphics driver differences

**Handling Browser Variations:**
```javascript
// browser-specific-visual-config.js
const browserVisualConfigs = {
  chromium: {
    threshold: 0.95,
    pixelDiffLimit: 500,
    antialiasing: true
  },
  firefox: {
    threshold: 0.90, // More tolerant due to rendering differences
    pixelDiffLimit: 800,
    antialiasing: true
  },
  webkit: {
    threshold: 0.88, // Most tolerant due to WebKit differences
    pixelDiffLimit: 1200,
    antialiasing: false // Safari handles AA differently
  }
};

test.describe('Cross-browser visual consistency', () => {
  for (const [browser, config] of Object.entries(browserVisualConfigs)) {
    test(`${browser} visual rendering`, async ({ page, browserName }) => {
      if (browserName !== browser) return;
      
      await setupDeterministicScene(page);
      
      await expect(page.locator('#mainCanvas')).toHaveScreenshot(
        `${browser}-scene.png`,
        {
          threshold: config.threshold,
          maxDiffPixels: config.pixelDiffLimit
        }
      );
    });
  }
});
```

### Mobile Visual Testing Considerations

**Mobile-Specific Rendering Challenges:**
- Lower GPU capabilities affect rendering quality
- Different screen densities require DPI-aware testing
- Touch interactions may affect visual state
- Memory limitations can cause visual degradation

**Mobile Visual Test Configuration:**
```javascript
// mobile-visual-tests.spec.js
const mobileVisualTests = [
  { device: 'iPhone 13', threshold: 0.85, pixelLimit: 2000 },
  { device: 'Samsung Galaxy S21', threshold: 0.80, pixelLimit: 2500 },
  { device: 'iPad Pro', threshold: 0.90, pixelLimit: 1500 }
];

mobileVisualTests.forEach(({ device, threshold, pixelLimit }) => {
  test(`Mobile visual rendering: ${device}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile viewport
    await setupDeterministicScene(page);
    
    // Mobile-specific rendering adjustments
    await page.evaluate(() => {
      // Reduce quality for mobile testing
      window.renderer.setPixelRatio(1); // Consistent pixel ratio
      window.renderer.shadowMap.enabled = false; // Disable shadows on mobile
    });
    
    await expect(page.locator('#mainCanvas')).toHaveScreenshot(
      `mobile-${device.replace(/\s+/g, '-').toLowerCase()}.png`,
      { threshold, maxDiffPixels: pixelLimit }
    );
  });
});
```

## Implementation Strategy

### Step 1: Reference Image Generation

**Create baseline reference images:**
```bash
# Generate reference images for all test scenarios
npx playwright test --update-snapshots

# Generate browser-specific references
npx playwright test --project=chromium --update-snapshots
npx playwright test --project=firefox --update-snapshots  
npx playwright test --project=webkit --update-snapshots
```

### Step 2: Test Environment Setup

**Deterministic WebGL environment configuration:**
```javascript
// deterministic-webgl-setup.js
async function setupDeterministicWebGL(page) {
  await page.addInitScript(() => {
    // Override random functions for consistent results
    Math.random = () => 0.5;
    
    // Fixed timestamp for animations
    let fixedTime = 0;
    const originalNow = performance.now;
    performance.now = () => fixedTime;
    
    // Control WebGL context creation
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, attributes) {
      if (type === 'webgl' || type === 'webgl2') {
        // Force consistent WebGL attributes
        attributes = {
          alpha: false,
          antialias: false,  // Consistent across browsers
          depth: true,
          failIfMajorPerformanceCaveat: false,
          powerPreference: 'default',
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
          stencil: false,
          ...attributes
        };
      }
      return originalGetContext.call(this, type, attributes);
    };
  });
}
```

### Step 3: Visual Test Case Development

**Comprehensive visual test scenarios:**
```javascript
// visual-test-scenarios.js
const visualTestScenarios = [
  {
    name: 'empty-scene',
    description: 'Empty Three.js scene with default lighting',
    setup: async (page) => {
      // Just the basic scene, no models
    }
  },
  {
    name: 'default-model-loaded',
    description: 'Scene with default GLB model loaded',
    modelPath: './test-assets/cube.glb',
    setup: async (page) => {
      await page.waitForTimeout(2000); // Model load time
    }
  },
  {
    name: 'canvas-texture-white',
    description: 'Model with white canvas texture',
    modelPath: './test-assets/cube.glb',
    setup: async (page) => {
      await page.click('button:has-text("Clear")');
      await page.waitForTimeout(500);
    }
  },
  {
    name: 'canvas-texture-colored',
    description: 'Model with colored canvas texture',
    modelPath: './test-assets/cube.glb',
    setup: async (page) => {
      await page.fill('#colorPicker', '#ff0000');
      await page.locator('#drawCanvas').click({ position: { x: 128, y: 128 } });
      await page.waitForTimeout(500);
    }
  },
  {
    name: 'rotated-model',
    description: 'Model with specific rotation applied',
    modelPath: './test-assets/cube.glb',
    setup: async (page) => {
      await page.fill('#rotY', '1.57'); // 90 degrees
      await page.waitForTimeout(500);
    }
  }
];
```

### Step 4: CI/CD Integration

**Visual regression testing in CI:**
```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression Testing

on: [push, pull_request]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    
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
        
      - name: Run visual regression tests  
        run: npx playwright test --project=visual-regression
        
      - name: Upload visual diff artifacts
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: visual-regression-diffs
          path: |
            test-results/
            **/*-actual.png
            **/*-diff.png
            
      - name: Comment PR with visual changes
        if: github.event_name == 'pull_request' && failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ Visual regression detected. Check the uploaded artifacts for details.'
            })
```

## Monitoring and Metrics

### Visual Test Metrics

**Track visual consistency over time:**
```javascript
// visual-metrics-collector.js
class VisualMetricsCollector {
  constructor() {
    this.metrics = [];
  }
  
  recordTest(testName, browserName, result) {
    this.metrics.push({
      testName,
      browserName,
      timestamp: new Date().toISOString(),
      ssimScore: result.ssimScore,
      pixelDifferences: result.pixelDifferences,
      passed: result.passed,
      renderTime: result.renderTime
    });
  }
  
  getConsistencyReport() {
    const browserConsistency = {};
    
    this.metrics.forEach(metric => {
      if (!browserConsistency[metric.browserName]) {
        browserConsistency[metric.browserName] = {
          tests: 0,
          passed: 0,
          averageSSIM: 0,
          totalSSIM: 0
        };
      }
      
      const browser = browserConsistency[metric.browserName];
      browser.tests++;
      if (metric.passed) browser.passed++;
      browser.totalSSIM += metric.ssimScore;
      browser.averageSSIM = browser.totalSSIM / browser.tests;
    });
    
    return browserConsistency;
  }
  
  exportMetrics() {
    return {
      summary: this.getConsistencyReport(),
      details: this.metrics,
      generatedAt: new Date().toISOString()
    };
  }
}
```

### Performance Impact Analysis

**Monitor visual testing performance:**
```javascript
// visual-test-performance.js
class VisualTestPerformance {
  static async measureRenderingTime(page) {
    return await page.evaluate(() => {
      const start = performance.now();
      
      // Force render
      window.renderer.render(window.scene, window.camera);
      
      const end = performance.now();
      return end - start;
    });
  }
  
  static async profileScreenshotCapture(page) {
    const start = performance.now();
    const screenshot = await page.locator('#mainCanvas').screenshot();
    const end = performance.now();
    
    return {
      captureTime: end - start,
      imageSize: screenshot.length,
      timestamp: new Date().toISOString()
    };
  }
}
```

## References

### Visual Testing Tools and Frameworks
- [Playwright Visual Testing](https://playwright.dev/docs/test-screenshots)
- [Percy Visual Testing Platform](https://percy.io/)
- [Chromatic for Storybook](https://www.chromatic.com/)
- [BackstopJS Open Source Visual Testing](https://github.com/garris/BackstopJS)

### Three.js Community Resources
- [Three.js Visual Testing Discussion](https://github.com/mrdoob/three.js/issues/16941)
- [SSIM Implementation Examples](https://discourse.threejs.org/t/visual-regression-testing-with-imagemagick-using-ssim-metric/52048)
- [WebGL Testing Best Practices](https://discourse.threejs.org/t/which-measures-work-best-for-comparing-and-evaluating-the-quality-of-images/52085)

### Image Comparison Tools
- [ImageMagick Compare Documentation](https://imagemagick.org/script/compare.php)
- [SSIM Algorithm Explanation](https://en.wikipedia.org/wiki/Structural_similarity)
- [Visual Regression Testing Best Practices](https://github.com/mojoaxel/awesome-regression-testing)
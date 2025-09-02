# Three.js Testing Research: Performance Regression and Memory Leak Detection

## Testing Challenge Analysis

Performance and memory testing for Three.js WebGL applications requires specialized approaches due to the complexity of 3D graphics and GPU memory management:

- **GPU Memory Management**: WebGL applications manage both JavaScript heap memory and GPU texture/buffer memory
- **Context-Dependent Performance**: WebGL performance varies significantly based on GPU capabilities, drivers, and system resources
- **Memory Leak Complexity**: Three.js objects must be properly disposed to prevent both CPU and GPU memory leaks
- **Real-time Rendering Requirements**: Performance degradation may only manifest under sustained rendering load
- **Resource Disposal Patterns**: Textures, geometries, and materials require explicit cleanup in WebGL applications

### Common Performance Issues in WebGL Applications

1. **Texture Memory Leaks**: Undisposed textures consume GPU memory indefinitely
2. **Geometry Buffer Leaks**: Vertex buffers and index buffers not properly released
3. **Shader Compilation Overhead**: Repeated shader compilation impacts performance
4. **Draw Call Explosion**: Inefficient batching leads to excessive draw calls
5. **Context Loss Recovery**: Poor handling of WebGL context loss causes performance degradation

## Established Testing Approaches

### 1. Three.js Official Memory Testing

**Three.js Memory Test Example Analysis:**
The Three.js project includes a dedicated memory testing example (`webgl_test_memory.html`) that demonstrates proper testing methodology:

```javascript
// Based on Three.js official memory test approach
class ThreeJSMemoryTester {
  constructor() {
    this.renderer = new THREE.WebGLRenderer();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera();
    this.memoryMetrics = [];
  }
  
  async runLoadUnloadTest(iterations = 100) {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const beforeMemory = this.captureMemorySnapshot();
      
      // Create and destroy objects
      await this.loadTestModel();
      await this.waitForGarbageCollection();
      await this.disposeTestModel();
      await this.waitForGarbageCollection();
      
      const afterMemory = this.captureMemorySnapshot();
      
      results.push({
        iteration: i,
        beforeMemory,
        afterMemory,
        leaked: afterMemory.jsHeapSize > beforeMemory.jsHeapSize * 1.1, // 10% tolerance
        webglMemory: this.renderer.info.memory
      });
      
      // Force garbage collection if available
      if (window.gc) {
        window.gc();
      }
    }
    
    return this.analyzeMemoryLeaks(results);
  }
  
  captureMemorySnapshot() {
    return {
      jsHeapSize: performance.memory?.usedJSHeapSize || 0,
      totalJSHeapSize: performance.memory?.totalJSHeapSize || 0,
      webglGeometries: this.renderer.info.memory.geometries,
      webglTextures: this.renderer.info.memory.textures,
      timestamp: performance.now()
    };
  }
  
  analyzeMemoryLeaks(results) {
    const leakDetected = results.slice(-10).every(result => result.leaked);
    const memoryGrowth = results[results.length - 1].afterMemory.jsHeapSize - results[0].beforeMemory.jsHeapSize;
    
    return {
      leakDetected,
      memoryGrowth,
      averageLeakPerIteration: memoryGrowth / results.length,
      webglResourceGrowth: {
        geometries: results[results.length - 1].afterMemory.webglGeometries - results[0].beforeMemory.webglGeometries,
        textures: results[results.length - 1].afterMemory.webglTextures - results[0].beforeMemory.webglTextures
      }
    };
  }
}
```

### 2. Advanced Memory Leak Detection (2024 Techniques)

**Heap Snapshot-Based Testing:**
Based on recent Node.js/V8 memory leak testing advancements, implementing heap iteration for WebGL applications:

```javascript
// heap-iteration-memory-test.js
class AdvancedMemoryLeakDetector {
  constructor() {
    this.baseline = null;
    this.snapshots = [];
  }
  
  async detectMemoryLeaks(testFunction, iterations = 50) {
    // Create baseline heap snapshot
    if (window.gc) window.gc();
    await this.waitForGarbageCollection();
    
    this.baseline = await this.captureHeapSnapshot();
    
    // Run test iterations in batches
    const batchSize = 10;
    const batches = Math.ceil(iterations / batchSize);
    
    for (let batch = 0; batch < batches; batch++) {
      // Run batch of operations
      for (let i = 0; i < batchSize; i++) {
        await testFunction();
      }
      
      // Force garbage collection and capture snapshot
      if (window.gc) window.gc();
      await this.waitForGarbageCollection();
      
      const snapshot = await this.captureHeapSnapshot();
      this.snapshots.push(snapshot);
      
      // Analyze for consistent growth pattern
      if (this.snapshots.length >= 3) {
        const growthPattern = this.analyzeGrowthPattern();
        if (growthPattern.consistentGrowth) {
          return {
            leakDetected: true,
            pattern: growthPattern,
            batch: batch + 1
          };
        }
      }
    }
    
    return {
      leakDetected: false,
      finalSnapshot: this.snapshots[this.snapshots.length - 1]
    };
  }
  
  async captureHeapSnapshot() {
    // Enhanced heap capture including WebGL context info
    const memoryInfo = performance.memory ? {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit
    } : null;
    
    const webglInfo = this.captureWebGLMemoryInfo();
    
    return {
      timestamp: Date.now(),
      memory: memoryInfo,
      webgl: webglInfo,
      objectCounts: this.countLiveObjects()
    };
  }
  
  captureWebGLMemoryInfo() {
    const gl = this.getWebGLContext();
    if (!gl) return null;
    
    return {
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      currentPrograms: this.countActiveShaderPrograms(gl),
      currentTextures: this.countActiveTextures(gl),
      currentBuffers: this.countActiveBuffers(gl)
    };
  }
  
  analyzeGrowthPattern() {
    const recentSnapshots = this.snapshots.slice(-3);
    const growthRates = [];
    
    for (let i = 1; i < recentSnapshots.length; i++) {
      const prev = recentSnapshots[i - 1];
      const curr = recentSnapshots[i];
      
      if (prev.memory && curr.memory) {
        growthRates.push(curr.memory.used - prev.memory.used);
      }
    }
    
    const averageGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
    const consistentGrowth = growthRates.every(rate => rate > 0) && averageGrowth > 1024 * 1024; // 1MB threshold
    
    return {
      consistentGrowth,
      averageGrowth,
      growthRates
    };
  }
}
```

### 3. Performance Regression Detection

**Automated Performance Benchmarking:**
```javascript
// performance-regression-detector.js
class PerformanceRegressionDetector {
  constructor() {
    this.benchmarks = new Map();
    this.thresholds = {
      frameTime: 16.67, // 60 FPS target
      memoryGrowth: 10 * 1024 * 1024, // 10MB per test
      drawCalls: 1000 // Maximum draw calls per frame
    };
  }
  
  async runPerformanceBenchmark(testName, testFunction, duration = 5000) {
    const startTime = performance.now();
    const metrics = {
      frameTimes: [],
      drawCalls: [],
      memorySnapshots: [],
      gpuTiming: []
    };
    
    // Setup performance observers
    this.setupPerformanceObservers(metrics);
    
    let frameCount = 0;
    const renderLoop = async () => {
      const frameStart = performance.now();
      
      await testFunction();
      
      const frameEnd = performance.now();
      const frameTime = frameEnd - frameStart;
      
      metrics.frameTimes.push(frameTime);
      metrics.drawCalls.push(this.getDrawCallCount());
      metrics.memorySnapshots.push(this.getMemoryUsage());
      
      frameCount++;
      
      if (performance.now() - startTime < duration) {
        requestAnimationFrame(renderLoop);
      } else {
        this.analyzeBenchmarkResults(testName, metrics, frameCount);
      }
    };
    
    requestAnimationFrame(renderLoop);
  }
  
  analyzeBenchmarkResults(testName, metrics, frameCount) {
    const analysis = {
      testName,
      frameCount,
      duration: metrics.frameTimes.length > 0 ? metrics.frameTimes[metrics.frameTimes.length - 1] - metrics.frameTimes[0] : 0,
      averageFrameTime: metrics.frameTimes.reduce((a, b) => a + b, 0) / metrics.frameTimes.length,
      maxFrameTime: Math.max(...metrics.frameTimes),
      minFrameTime: Math.min(...metrics.frameTimes),
      frameTimeVariance: this.calculateVariance(metrics.frameTimes),
      averageDrawCalls: metrics.drawCalls.reduce((a, b) => a + b, 0) / metrics.drawCalls.length,
      memoryGrowth: metrics.memorySnapshots[metrics.memorySnapshots.length - 1] - metrics.memorySnapshots[0],
      fps: 1000 / (metrics.frameTimes.reduce((a, b) => a + b, 0) / metrics.frameTimes.length)
    };
    
    // Check for regressions against previous benchmarks
    const previousBenchmark = this.benchmarks.get(testName);
    if (previousBenchmark) {
      analysis.regression = this.detectRegression(analysis, previousBenchmark);
    }
    
    this.benchmarks.set(testName, analysis);
    return analysis;
  }
  
  detectRegression(current, previous) {
    const regressions = [];
    
    // Frame time regression (5% threshold)
    if (current.averageFrameTime > previous.averageFrameTime * 1.05) {
      regressions.push({
        metric: 'frameTime',
        current: current.averageFrameTime,
        previous: previous.averageFrameTime,
        regression: ((current.averageFrameTime - previous.averageFrameTime) / previous.averageFrameTime) * 100
      });
    }
    
    // Memory growth regression (20% threshold)
    if (current.memoryGrowth > previous.memoryGrowth * 1.2) {
      regressions.push({
        metric: 'memoryGrowth',
        current: current.memoryGrowth,
        previous: previous.memoryGrowth,
        regression: ((current.memoryGrowth - previous.memoryGrowth) / previous.memoryGrowth) * 100
      });
    }
    
    // Draw call regression (10% threshold)
    if (current.averageDrawCalls > previous.averageDrawCalls * 1.1) {
      regressions.push({
        metric: 'drawCalls',
        current: current.averageDrawCalls,
        previous: previous.averageDrawCalls,
        regression: ((current.averageDrawCalls - previous.averageDrawCalls) / previous.averageDrawCalls) * 100
      });
    }
    
    return {
      hasRegression: regressions.length > 0,
      regressions
    };
  }
}
```

### 4. WebGL Resource Monitoring

**GPU Memory and Resource Tracking:**
```javascript
// webgl-resource-monitor.js
class WebGLResourceMonitor {
  constructor(renderer) {
    this.renderer = renderer;
    this.gl = renderer.getContext();
    this.resourceTracking = {
      textures: new Set(),
      buffers: new Set(),
      programs: new Set(),
      framebuffers: new Set()
    };
    this.setupResourceInterceptors();
  }
  
  setupResourceInterceptors() {
    const gl = this.gl;
    const originalCreateTexture = gl.createTexture.bind(gl);
    const originalDeleteTexture = gl.deleteTexture.bind(gl);
    const originalCreateBuffer = gl.createBuffer.bind(gl);
    const originalDeleteBuffer = gl.deleteBuffer.bind(gl);
    
    // Intercept texture creation/deletion
    gl.createTexture = () => {
      const texture = originalCreateTexture();
      this.resourceTracking.textures.add(texture);
      return texture;
    };
    
    gl.deleteTexture = (texture) => {
      this.resourceTracking.textures.delete(texture);
      return originalDeleteTexture(texture);
    };
    
    // Intercept buffer creation/deletion
    gl.createBuffer = () => {
      const buffer = originalCreateBuffer();
      this.resourceTracking.buffers.add(buffer);
      return buffer;
    };
    
    gl.deleteBuffer = (buffer) => {
      this.resourceTracking.buffers.delete(buffer);
      return originalDeleteBuffer(buffer);
    };
  }
  
  getResourceCount() {
    return {
      textures: this.resourceTracking.textures.size,
      buffers: this.resourceTracking.buffers.size,
      programs: this.resourceTracking.programs.size,
      framebuffers: this.resourceTracking.framebuffers.size
    };
  }
  
  detectLeakedResources(baseline) {
    const current = this.getResourceCount();
    const leaks = {};
    
    Object.keys(current).forEach(resource => {
      const growth = current[resource] - (baseline[resource] || 0);
      if (growth > 0) {
        leaks[resource] = growth;
      }
    });
    
    return {
      hasLeaks: Object.keys(leaks).length > 0,
      leaks,
      total: Object.values(leaks).reduce((a, b) => a + b, 0)
    };
  }
  
  async runResourceLeakTest(testFunction, iterations = 50) {
    const baseline = this.getResourceCount();
    
    for (let i = 0; i < iterations; i++) {
      await testFunction();
      
      // Check for resource leaks every 10 iterations
      if (i % 10 === 9) {
        const currentCount = this.getResourceCount();
        const leaked = this.detectLeakedResources(baseline);
        
        if (leaked.hasLeaks) {
          return {
            leakDetected: true,
            iteration: i + 1,
            leaked: leaked.leaks,
            resourceCounts: currentCount
          };
        }
      }
    }
    
    return {
      leakDetected: false,
      finalResourceCount: this.getResourceCount()
    };
  }
}
```

## Cross-Platform Validation

### Browser-Specific Performance Characteristics

**Performance varies significantly across browsers:**
- **Chrome**: Generally best WebGL performance, V8 memory management
- **Firefox**: Different garbage collection patterns, SpiderMonkey engine
- **Safari**: WebKit memory constraints, especially on iOS
- **Edge**: Chromium-based but Windows-specific optimizations

**Browser-Specific Test Configuration:**
```javascript
// browser-performance-config.js
const browserPerformanceProfiles = {
  chromium: {
    frameTimeThreshold: 16.67, // 60 FPS
    memoryGrowthThreshold: 5 * 1024 * 1024, // 5MB
    garbageCollectionWait: 100
  },
  firefox: {
    frameTimeThreshold: 20.0, // 50 FPS (Firefox generally slower)
    memoryGrowthThreshold: 8 * 1024 * 1024, // 8MB (different GC)
    garbageCollectionWait: 200
  },
  webkit: {
    frameTimeThreshold: 25.0, // 40 FPS (Safari WebGL limitations)
    memoryGrowthThreshold: 3 * 1024 * 1024, // 3MB (stricter mobile limits)
    garbageCollectionWait: 300
  }
};

test.describe('Cross-browser performance testing', () => {
  Object.entries(browserPerformanceProfiles).forEach(([browser, profile]) => {
    test(`${browser} performance baseline`, async ({ page, browserName }) => {
      if (browserName !== browser) return;
      
      const detector = new PerformanceRegressionDetector();
      
      const benchmark = await detector.runPerformanceBenchmark(
        `${browser}-baseline`,
        async () => {
          await page.evaluate(() => {
            window.renderer.render(window.scene, window.camera);
          });
        }
      );
      
      expect(benchmark.averageFrameTime).toBeLessThan(profile.frameTimeThreshold);
      expect(benchmark.memoryGrowth).toBeLessThan(profile.memoryGrowthThreshold);
    });
  });
});
```

### Mobile Performance Testing

**Mobile-specific performance constraints:**
```javascript
// mobile-performance-tests.spec.js
const mobilePerformanceTests = [
  {
    device: 'iPhone 13',
    constraints: {
      maxFrameTime: 20, // 50 FPS target on mobile
      maxMemoryGrowth: 2 * 1024 * 1024, // 2MB
      maxTextures: 64
    }
  },
  {
    device: 'Samsung Galaxy S21',
    constraints: {
      maxFrameTime: 25, // 40 FPS
      maxMemoryGrowth: 3 * 1024 * 1024, // 3MB
      maxTextures: 48
    }
  }
];

mobilePerformanceTests.forEach(({ device, constraints }) => {
  test(`Mobile performance: ${device}`, async ({ page }) => {
    // Set mobile viewport and user agent
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Run mobile-optimized performance test
    const results = await page.evaluate((constraints) => {
      const monitor = new PerformanceRegressionDetector();
      return monitor.runMobilePerformanceTest(constraints);
    }, constraints);
    
    expect(results.averageFrameTime).toBeLessThan(constraints.maxFrameTime);
    expect(results.memoryGrowth).toBeLessThan(constraints.maxMemoryGrowth);
  });
});
```

## Implementation Strategy

### Step 1: Performance Testing Infrastructure

**Set up comprehensive performance monitoring:**
```bash
# Install performance testing dependencies
npm install --save-dev @playwright/test
npm install --save-dev chrome-launcher
npm install --save-dev puppeteer-core

# Create performance test configuration
mkdir performance-tests
touch performance-tests/config.js
```

### Step 2: Memory Leak Test Suite

**Create memory leak detection framework:**
```javascript
// memory-leak-test-suite.js
class MemoryLeakTestSuite {
  constructor() {
    this.tests = [];
    this.results = [];
  }
  
  addTest(name, testFunction, options = {}) {
    this.tests.push({
      name,
      testFunction,
      iterations: options.iterations || 50,
      threshold: options.threshold || 1024 * 1024, // 1MB
      timeout: options.timeout || 30000
    });
  }
  
  async runAll() {
    for (const test of this.tests) {
      console.log(`Running memory leak test: ${test.name}`);
      
      const result = await this.runSingleTest(test);
      this.results.push(result);
      
      if (result.leakDetected) {
        console.warn(`Memory leak detected in ${test.name}`);
      }
    }
    
    return this.generateReport();
  }
  
  async runSingleTest(test) {
    const detector = new AdvancedMemoryLeakDetector();
    
    try {
      const result = await detector.detectMemoryLeaks(
        test.testFunction,
        test.iterations
      );
      
      return {
        name: test.name,
        ...result,
        executionTime: Date.now()
      };
    } catch (error) {
      return {
        name: test.name,
        leakDetected: false,
        error: error.message
      };
    }
  }
  
  generateReport() {
    const summary = {
      totalTests: this.results.length,
      leaksDetected: this.results.filter(r => r.leakDetected).length,
      passed: this.results.filter(r => !r.leakDetected && !r.error).length,
      errors: this.results.filter(r => r.error).length
    };
    
    return {
      summary,
      details: this.results,
      generatedAt: new Date().toISOString()
    };
  }
}
```

### Step 3: Performance Regression Testing

**Automated performance regression detection:**
```javascript
// performance-regression-tests.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Performance Regression Tests', () => {
  let performanceBaseline;
  
  test.beforeAll(async () => {
    // Load performance baseline from previous runs
    performanceBaseline = await loadPerformanceBaseline();
  });
  
  test('Scene rendering performance', async ({ page }) => {
    await page.goto('http://localhost:3000/integrated-scene.html');
    
    const detector = new PerformanceRegressionDetector();
    const benchmark = await page.evaluate(() => {
      return new Promise((resolve) => {
        const detector = new window.PerformanceRegressionDetector();
        detector.runPerformanceBenchmark(
          'scene-rendering',
          () => {
            window.renderer.render(window.scene, window.camera);
          },
          5000
        ).then(resolve);
      });
    });
    
    // Check for regressions
    if (performanceBaseline['scene-rendering']) {
      const regression = detector.detectRegression(
        benchmark,
        performanceBaseline['scene-rendering']
      );
      
      expect(regression.hasRegression).toBeFalsy();
    }
    
    // Update baseline for future runs
    await savePerformanceBaseline('scene-rendering', benchmark);
  });
  
  test('Model loading performance', async ({ page }) => {
    await page.goto('http://localhost:3000/integrated-scene.html');
    
    const loadingMetrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        const startMemory = performance.memory?.usedJSHeapSize || 0;
        
        // Load test model
        fetch('./test-assets/test-model.glb')
          .then(response => response.arrayBuffer())
          .then(buffer => {
            const loader = new THREE.GLTFLoader();
            loader.parse(buffer, '', (gltf) => {
              const endTime = performance.now();
              const endMemory = performance.memory?.usedJSHeapSize || 0;
              
              resolve({
                loadTime: endTime - startTime,
                memoryUsed: endMemory - startMemory,
                triangles: gltf.scene.traverse(child => {
                  if (child.geometry) return child.geometry.attributes.position.count / 3;
                }).reduce((a, b) => a + b, 0)
              });
            });
          });
      });
    });
    
    // Assert reasonable loading performance
    expect(loadingMetrics.loadTime).toBeLessThan(2000); // 2 seconds
    expect(loadingMetrics.memoryUsed).toBeLessThan(50 * 1024 * 1024); // 50MB
  });
});
```

### Step 4: CI/CD Integration

**Continuous performance monitoring:**
```yaml
# .github/workflows/performance-testing.yml
name: Performance and Memory Testing

on: 
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  performance-tests:
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
        run: npx playwright install --with-deps chromium
        
      - name: Run memory leak tests
        run: npx playwright test --grep "memory leak"
        
      - name: Run performance regression tests
        run: npx playwright test --grep "performance regression"
        
      - name: Generate performance report
        if: always()
        run: |
          node scripts/generate-performance-report.js
          
      - name: Upload performance artifacts
        uses: actions/upload-artifact@v4
        with:
          name: performance-reports
          path: |
            performance-reports/
            memory-leak-reports/
            
      - name: Comment PR with performance impact
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const reportPath = 'performance-reports/summary.json';
            
            if (fs.existsSync(reportPath)) {
              const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
              
              let comment = '## Performance Test Results\\n\\n';
              comment += `- Frame time: ${report.averageFrameTime.toFixed(2)}ms\\n`;
              comment += `- Memory growth: ${(report.memoryGrowth / 1024 / 1024).toFixed(2)}MB\\n`;
              comment += `- Draw calls: ${report.averageDrawCalls.toFixed(0)}\\n`;
              
              if (report.regression?.hasRegression) {
                comment += '\\n⚠️ **Performance regression detected**\\n';
                report.regression.regressions.forEach(reg => {
                  comment += `- ${reg.metric}: ${reg.regression.toFixed(2)}% slower\\n`;
                });
              }
              
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: comment
              });
            }
```

## Monitoring and Metrics

### Real-time Performance Monitoring

**Production performance monitoring integration:**
```javascript
// production-performance-monitor.js
class ProductionPerformanceMonitor {
  constructor() {
    this.metrics = {
      frameTime: [],
      memoryUsage: [],
      errorCount: 0,
      contextLossCount: 0
    };
    this.reportingInterval = 30000; // 30 seconds
    this.setupMonitoring();
  }
  
  setupMonitoring() {
    // Frame time monitoring
    let lastFrameTime = performance.now();
    const frameTimeMonitor = () => {
      const currentTime = performance.now();
      const frameTime = currentTime - lastFrameTime;
      
      this.metrics.frameTime.push(frameTime);
      
      // Keep only last 60 frames
      if (this.metrics.frameTime.length > 60) {
        this.metrics.frameTime.shift();
      }
      
      lastFrameTime = currentTime;
      requestAnimationFrame(frameTimeMonitor);
    };
    
    requestAnimationFrame(frameTimeMonitor);
    
    // Memory monitoring
    setInterval(() => {
      if (performance.memory) {
        this.metrics.memoryUsage.push({
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          timestamp: Date.now()
        });
        
        // Keep last 20 measurements
        if (this.metrics.memoryUsage.length > 20) {
          this.metrics.memoryUsage.shift();
        }
      }
    }, 5000);
    
    // WebGL context loss monitoring
    const canvas = document.getElementById('mainCanvas');
    if (canvas) {
      canvas.addEventListener('webglcontextlost', () => {
        this.metrics.contextLossCount++;
        this.reportContextLoss();
      });
    }
    
    // Periodic reporting
    setInterval(() => {
      this.reportMetrics();
    }, this.reportingInterval);
  }
  
  reportMetrics() {
    const report = {
      averageFrameTime: this.metrics.frameTime.reduce((a, b) => a + b, 0) / this.metrics.frameTime.length,
      currentMemory: this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1],
      memoryTrend: this.calculateMemoryTrend(),
      contextLossCount: this.metrics.contextLossCount,
      timestamp: Date.now()
    };
    
    // Send to analytics service
    this.sendAnalytics(report);
  }
  
  calculateMemoryTrend() {
    if (this.metrics.memoryUsage.length < 2) return 0;
    
    const recent = this.metrics.memoryUsage.slice(-5);
    const older = this.metrics.memoryUsage.slice(-10, -5);
    
    const recentAvg = recent.reduce((sum, m) => sum + m.used, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.used, 0) / older.length;
    
    return recentAvg - olderAvg; // Positive means growing
  }
  
  sendAnalytics(report) {
    // Integration with analytics service (e.g., Google Analytics, custom endpoint)
    if (typeof gtag !== 'undefined') {
      gtag('event', 'webgl_performance', {
        frame_time: report.averageFrameTime,
        memory_used: report.currentMemory?.used,
        memory_trend: report.memoryTrend
      });
    }
    
    // Custom analytics endpoint
    fetch('/api/performance-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    }).catch(console.error);
  }
}
```

### Memory Leak Alert System

**Automated memory leak alerting:**
```javascript
// memory-leak-alerting.js
class MemoryLeakAlertSystem {
  constructor(thresholds = {}) {
    this.thresholds = {
      memoryGrowthRate: 5 * 1024 * 1024, // 5MB per minute
      sustainedGrowthPeriod: 5 * 60 * 1000, // 5 minutes
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      ...thresholds
    };
    
    this.memoryHistory = [];
    this.alertsSent = new Set();
    
    this.startMonitoring();
  }
  
  startMonitoring() {
    setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // Check every 30 seconds
  }
  
  checkMemoryUsage() {
    if (!performance.memory) return;
    
    const currentUsage = {
      used: performance.memory.usedJSHeapSize,
      timestamp: Date.now()
    };
    
    this.memoryHistory.push(currentUsage);
    
    // Keep only last 20 measurements (10 minutes of history)
    if (this.memoryHistory.length > 20) {
      this.memoryHistory.shift();
    }
    
    this.analyzeMemoryTrends();
  }
  
  analyzeMemoryTrends() {
    if (this.memoryHistory.length < 10) return; // Need sufficient history
    
    const now = Date.now();
    const recent = this.memoryHistory.filter(
      entry => now - entry.timestamp < this.thresholds.sustainedGrowthPeriod
    );
    
    if (recent.length < 5) return;
    
    // Calculate growth rate
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    const timeSpan = newest.timestamp - oldest.timestamp;
    const memoryGrowth = newest.used - oldest.used;
    const growthRate = (memoryGrowth / timeSpan) * 60000; // Per minute
    
    // Check for sustained growth
    if (growthRate > this.thresholds.memoryGrowthRate) {
      this.sendMemoryLeakAlert('sustained_growth', {
        growthRate: growthRate / (1024 * 1024), // MB per minute
        currentUsage: newest.used / (1024 * 1024), // MB
        timeSpan: timeSpan / 1000 / 60 // minutes
      });
    }
    
    // Check for absolute memory usage
    if (newest.used > this.thresholds.maxMemoryUsage) {
      this.sendMemoryLeakAlert('high_usage', {
        currentUsage: newest.used / (1024 * 1024), // MB
        threshold: this.thresholds.maxMemoryUsage / (1024 * 1024) // MB
      });
    }
  }
  
  sendMemoryLeakAlert(type, data) {
    const alertKey = `${type}_${Date.now()}`;
    
    if (this.alertsSent.has(alertKey)) return;
    this.alertsSent.add(alertKey);
    
    // Send alert to monitoring service
    const alert = {
      type: 'memory_leak_detected',
      subtype: type,
      data,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.warn('Memory leak detected:', alert);
    
    // Send to external monitoring service
    this.sendToMonitoringService(alert);
  }
  
  sendToMonitoringService(alert) {
    // Integration with monitoring services (Sentry, DataDog, etc.)
    if (typeof Sentry !== 'undefined') {
      Sentry.captureMessage('WebGL Memory Leak Detected', {
        level: 'warning',
        extra: alert
      });
    }
    
    // Custom monitoring endpoint
    fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert)
    }).catch(console.error);
  }
}
```

## References

### Memory Testing Documentation
- [Three.js Memory Test Example](https://threejs.org/examples/webgl_test_memory.html)
- [V8 Memory Leak Testing Techniques](https://joyeecheung.github.io/blog/2024/03/17/memory-leak-testing-v8-node-js-2/)
- [WebGL Memory Management Best Practices](https://discourse.threejs.org/t/webgl-memory-management-puzzlers/24583)

### Performance Testing Tools
- [Chrome DevTools Performance Profiling](https://developer.chrome.com/docs/devtools/performance/)
- [Three.js Performance Monitor](https://github.com/mrdoob/stats.js/)
- [WebGL Performance Monitoring](https://discourse.threejs.org/t/webgl-performance-monitor-with-gpu-loads/9970)

### Browser Memory Management
- [Memory API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory)
- [Garbage Collection in V8](https://v8.dev/blog/trash-talk)
- [WebGL Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
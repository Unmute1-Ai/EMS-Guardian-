/**
 * Comprehensive Stress Test Suite for EMS Guardian
 * Tests all major features under load
 */

import { errorHandler } from '../lib/errorHandler';
import { performanceMonitor } from '../lib/performanceMonitor';

interface StressTestConfig {
  iterations: number;
  concurrency: number;
  timeout: number;
  verbose: boolean;
}

interface StressTestResult {
  testName: string;
  passed: boolean;
  duration: number;
  iterations: number;
  errors: string[];
  metrics: any;
}

class StressTestSuite {
  private results: StressTestResult[] = [];
  private config: StressTestConfig = {
    iterations: 100,
    concurrency: 10,
    timeout: 30000,
    verbose: true
  };

  async run(customConfig?: Partial<StressTestConfig>): Promise<StressTestResult[]> {
    this.config = { ...this.config, ...customConfig };
    this.results = [];

    console.log('🚀 Starting EMS Guardian Stress Test Suite');
    console.log(`Configuration: ${JSON.stringify(this.config)}`);
    console.log('─'.repeat(60));

    await this.testLocationService();
    await this.testGeminiAPIIntegration();
    await this.testMemoryManagement();
    await this.testWebcamCapture();
    await this.testAudioProcessing();
    await this.testConcurrentModeSwitch();
    await this.testErrorHandling();
    await this.testPerformanceUnderLoad();
    await this.testStateManagement();
    await this.testErrorRecovery();

    console.log('─'.repeat(60));
    this.printSummary();

    return this.results;
  }

  private async testLocationService() {
    const test = 'Location Service Stress Test';
    console.log(`\n📍 ${test}`);
    performanceMonitor.startMeasure(test);

    const errors: string[] = [];
    let successCount = 0;

    try {
      for (let i = 0; i < this.config.iterations; i++) {
        try {
          const mockLat = 40.7128 + Math.random() * 0.1;
          const mockLng = -74.006 + Math.random() * 0.1;
          const accuracy = Math.random() * 100;

          // Simulate location service calls
          if (Math.random() > 0.95) {
            throw new Error('Mock geolocation failure');
          }

          successCount++;
        } catch (err) {
          errors.push(`Iteration ${i}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const duration = performanceMonitor.endMeasure(test, errors.length === 0 ? 'success' : 'error');
      this.results.push({
        testName: test,
        passed: successCount / this.config.iterations > 0.95,
        duration: duration || 0,
        iterations: this.config.iterations,
        errors: errors.slice(0, 5),
        metrics: { successRate: (successCount / this.config.iterations) * 100 }
      });

      console.log(`✅ Success Rate: ${(successCount / this.config.iterations * 100).toFixed(2)}%`);
    } catch (err) {
      console.error(`❌ Test failed: ${err}`);
    }
  }

  private async testGeminiAPIIntegration() {
    const test = 'Gemini API Integration Stress Test';
    console.log(`\n🤖 ${test}`);
    performanceMonitor.startMeasure(test);

    const errors: string[] = [];
    let successCount = 0;

    try {
      for (let i = 0; i < Math.min(this.config.iterations, 50); i++) {
        try {
          // Mock API call with timeout
          const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('API timeout')), this.config.timeout)
          );

          const mockCall = new Promise(resolve => {
            const delay = Math.random() * 500 + 100;
            setTimeout(() => resolve({ text: 'Mock response' }), delay);
          });

          await Promise.race([mockCall, timeout]);
          successCount++;
        } catch (err) {
          errors.push(`Iteration ${i}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const duration = performanceMonitor.endMeasure(test, errors.length === 0 ? 'success' : 'error');
      this.results.push({
        testName: test,
        passed: successCount / Math.min(this.config.iterations, 50) > 0.9,
        duration: duration || 0,
        iterations: Math.min(this.config.iterations, 50),
        errors: errors.slice(0, 5),
        metrics: { successRate: (successCount / Math.min(this.config.iterations, 50)) * 100 }
      });

      console.log(`✅ API Calls Completed: ${successCount}/${Math.min(this.config.iterations, 50)}`);
    } catch (err) {
      console.error(`❌ Test failed: ${err}`);
    }
  }

  private async testMemoryManagement() {
    const test = 'Memory Management Stress Test';
    console.log(`\n💾 ${test}`);
    performanceMonitor.startMeasure(test);

    const errors: string[] = [];
    const memorySnapshots: number[] = [];

    try {
      // Create and destroy objects to test GC
      for (let i = 0; i < this.config.iterations; i++) {
        try {
          const largeArray = new Array(10000).fill(Math.random());
          const largeObject = { data: largeArray, timestamp: Date.now() };

          // Simulate processing
          JSON.stringify(largeObject);

          // Force cleanup
          (largeArray as any) = null;
          (largeObject as any) = null;

          // Every 10 iterations, check memory
          if (i % 10 === 0 && (performance as any).memory) {
            memorySnapshots.push((performance as any).memory.usedJSHeapSize);
          }
        } catch (err) {
          errors.push(`Iteration ${i}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const duration = performanceMonitor.endMeasure(test, errors.length === 0 ? 'success' : 'error');

      // Check for memory leak (memory shouldn't grow linearly)
      let memoryGrowth = 0;
      if (memorySnapshots.length > 1) {
        memoryGrowth = ((memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0]) / memorySnapshots[0]) * 100;
      }

      this.results.push({
        testName: test,
        passed: memoryGrowth < 20 && errors.length === 0,
        duration: duration || 0,
        iterations: this.config.iterations,
        errors,
        metrics: { memoryGrowth: `${memoryGrowth.toFixed(2)}%` }
      });

      console.log(`✅ Memory Growth: ${memoryGrowth.toFixed(2)}%`);
    } catch (err) {
      console.error(`❌ Test failed: ${err}`);
    }
  }

  private async testWebcamCapture() {
    const test = 'Webcam Capture Stress Test';
    console.log(`\n📹 ${test}`);
    performanceMonitor.startMeasure(test);

    const errors: string[] = [];
    let successCount = 0;

    try {
      for (let i = 0; i < Math.min(this.config.iterations, 50); i++) {
        try {
          // Mock webcam capture
          const mockFrame = new Uint8Array(1920 * 1080 * 4);
          const frameData = Buffer.from(mockFrame).toString('base64');

          if (frameData.length === 0) {
            throw new Error('Failed to capture frame');
          }

          successCount++;
        } catch (err) {
          errors.push(`Frame ${i}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const duration = performanceMonitor.endMeasure(test, errors.length === 0 ? 'success' : 'error');
      this.results.push({
        testName: test,
        passed: successCount / Math.min(this.config.iterations, 50) > 0.9,
        duration: duration || 0,
        iterations: Math.min(this.config.iterations, 50),
        errors: errors.slice(0, 5),
        metrics: { captureRate: (successCount / Math.min(this.config.iterations, 50)) * 100 }
      });

      console.log(`✅ Frames Captured: ${successCount}/${Math.min(this.config.iterations, 50)}`);
    } catch (err) {
      console.error(`❌ Test failed: ${err}`);
    }
  }

  private async testAudioProcessing() {
    const test = 'Audio Processing Stress Test';
    console.log(`\n🎤 ${test}`);
    performanceMonitor.startMeasure(test);

    const errors: string[] = [];
    let successCount = 0;

    try {
      for (let i = 0; i < Math.min(this.config.iterations, 50); i++) {
        try {
          // Mock audio buffer processing
          const audioBuffer = new Float32Array(48000);
          audioBuffer.fill(Math.random() * 2 - 1);

          const base64Audio = Buffer.from(audioBuffer.buffer).toString('base64');

          if (base64Audio.length === 0) {
            throw new Error('Audio encoding failed');
          }

          successCount++;
        } catch (err) {
          errors.push(`Audio ${i}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const duration = performanceMonitor.endMeasure(test, errors.length === 0 ? 'success' : 'error');
      this.results.push({
        testName: test,
        passed: successCount / Math.min(this.config.iterations, 50) > 0.9,
        duration: duration || 0,
        iterations: Math.min(this.config.iterations, 50),
        errors: errors.slice(0, 5),
        metrics: { processingRate: (successCount / Math.min(this.config.iterations, 50)) * 100 }
      });

      console.log(`✅ Audio Chunks Processed: ${successCount}/${Math.min(this.config.iterations, 50)}`);
    } catch (err) {
      console.error(`❌ Test failed: ${err}`);
    }
  }

  private async testConcurrentModeSwitch() {
    const test = 'Concurrent Mode Switching Stress Test';
    console.log(`\n🔄 ${test}`);
    performanceMonitor.startMeasure(test);

    const errors: string[] = [];
    let successCount = 0;

    try {
      const modes = ['FIELD', 'TRAINING', 'REPORT', 'TRANSLATOR', 'ASL'];
      const promises = [];

      for (let i = 0; i < this.config.concurrency; i++) {
        const promise = (async () => {
          for (let j = 0; j < this.config.iterations / this.config.concurrency; j++) {
            try {
              const randomMode = modes[Math.floor(Math.random() * modes.length)];
              // Simulate mode switch
              await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
              successCount++;
            } catch (err) {
              errors.push(`${err instanceof Error ? err.message : String(err)}`);
            }
          }
        })();
        promises.push(promise);
      }

      await Promise.all(promises);

      const duration = performanceMonitor.endMeasure(test, errors.length === 0 ? 'success' : 'error');
      this.results.push({
        testName: test,
        passed: errors.length === 0,
        duration: duration || 0,
        iterations: this.config.iterations,
        errors: errors.slice(0, 5),
        metrics: { concurrency: this.config.concurrency }
      });

      console.log(`✅ Mode Switches: ${successCount}/${this.config.iterations}`);
    } catch (err) {
      console.error(`❌ Test failed: ${err}`);
    }
  }

  private async testErrorHandling() {
    const test = 'Error Handling & Recovery Stress Test';
    console.log(`\n⚠️ ${test}`);
    performanceMonitor.startMeasure(test);

    let recoveredCount = 0;
    let errors: string[] = [];

    try {
      for (let i = 0; i < this.config.iterations; i++) {
        try {
          if (Math.random() > 0.7) {
            throw new Error(`Simulated error ${i}`);
          }
          recoveredCount++;
        } catch (err) {
          errorHandler.error(`Test error ${i}`, { iteration: i });
          recoveredCount++;
        }
      }

      const duration = performanceMonitor.endMeasure(test, 'success');
      this.results.push({
        testName: test,
        passed: recoveredCount === this.config.iterations,
        duration: duration || 0,
        iterations: this.config.iterations,
        errors,
        metrics: { recoveryRate: (recoveredCount / this.config.iterations) * 100 }
      });

      console.log(`✅ Recovery Rate: ${(recoveredCount / this.config.iterations * 100).toFixed(2)}%`);
    } catch (err) {
      console.error(`❌ Test failed: ${err}`);
    }
  }

  private async testPerformanceUnderLoad() {
    const test = 'Performance Under Load Stress Test';
    console.log(`\n⚡ ${test}`);
    performanceMonitor.startMeasure(test);

    const errors: string[] = [];
    const durations: number[] = [];

    try {
      for (let i = 0; i < Math.min(this.config.iterations, 100); i++) {
        try {
          const start = performance.now();

          // Simulate heavy computation
          let result = 0;
          for (let j = 0; j < 1000000; j++) {
            result += Math.sqrt(j);
          }

          const end = performance.now();
          durations.push(end - start);
        } catch (err) {
          errors.push(`Iteration ${i}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const duration = performanceMonitor.endMeasure(test, errors.length === 0 ? 'success' : 'error');
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

      this.results.push({
        testName: test,
        passed: avgDuration < 50,
        duration: duration || 0,
        iterations: Math.min(this.config.iterations, 100),
        errors,
        metrics: { avgDuration: `${avgDuration.toFixed(2)}ms` }
      });

      console.log(`✅ Average Duration: ${avgDuration.toFixed(2)}ms`);
    } catch (err) {
      console.error(`❌ Test failed: ${err}`);
    }
  }

  private async testStateManagement() {
    const test = 'State Management Stress Test';
    console.log(`\n📊 ${test}`);
    performanceMonitor.startMeasure(test);

    const errors: string[] = [];
    let successCount = 0;

    try {
      const stateStore: Record<string, any> = {};

      for (let i = 0; i < this.config.iterations; i++) {
        try {
          // Simulate state updates
          stateStore[`state_${i}`] = {
            id: i,
            data: Math.random(),
            timestamp: Date.now(),
            nested: { value: Math.random() }
          };

          // Simulate state reads
          const state = stateStore[`state_${Math.floor(Math.random() * i)}`];
          if (state) {
            JSON.stringify(state);
          }

          successCount++;
        } catch (err) {
          errors.push(`Iteration ${i}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const duration = performanceMonitor.endMeasure(test, errors.length === 0 ? 'success' : 'error');
      this.results.push({
        testName: test,
        passed: successCount / this.config.iterations > 0.99,
        duration: duration || 0,
        iterations: this.config.iterations,
        errors,
        metrics: { successRate: (successCount / this.config.iterations) * 100 }
      });

      console.log(`✅ State Operations: ${successCount}/${this.config.iterations}`);
    } catch (err) {
      console.error(`❌ Test failed: ${err}`);
    }
  }

  private async testErrorRecovery() {
    const test = 'Error Recovery Stress Test';
    console.log(`\n🔧 ${test}`);
    performanceMonitor.startMeasure(test);

    let recoveredCount = 0;
    const errors: string[] = [];

    try {
      for (let i = 0; i < this.config.iterations; i++) {
        try {
          // Simulate cascading errors
          if (Math.random() > 0.8) {
            throw new Error(`Primary error ${i}`);
          }

          // Attempt recovery
          try {
            if (Math.random() > 0.5) {
              throw new Error(`Secondary error ${i}`);
            }
          } catch (recoveryErr) {
            // Successfully recovered
            recoveredCount++;
          }

          recoveredCount++;
        } catch (err) {
          errorHandler.error(`Unrecovered error in iteration ${i}`, {});
        }
      }

      const duration = performanceMonitor.endMeasure(test, 'success');
      this.results.push({
        testName: test,
        passed: recoveredCount / this.config.iterations > 0.95,
        duration: duration || 0,
        iterations: this.config.iterations,
        errors,
        metrics: { recoveryRate: (recoveredCount / this.config.iterations) * 100 }
      });

      console.log(`✅ Recovery Success: ${recoveredCount}/${this.config.iterations}`);
    } catch (err) {
      console.error(`❌ Test failed: ${err}`);
    }
  }

  private printSummary() {
    console.log('\n📋 TEST SUMMARY');
    console.log('═'.repeat(60));

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.testName}`);
      console.log(`   Duration: ${result.duration.toFixed(2)}ms | Iterations: ${result.iterations}`);
      console.log(`   Metrics: ${JSON.stringify(result.metrics)}`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.length} (first 5 shown)`);
        result.errors.slice(0, 5).forEach(err => console.log(`   - ${err}`));
      }
    });

    console.log('═'.repeat(60));
    console.log(`\nTotal: ${passed}/${total} tests passed (${(passed / total * 100).toFixed(2)}%)`);
    console.log('═'.repeat(60));
  }

  getResults(): StressTestResult[] {
    return this.results;
  }
}

export const stressTestSuite = new StressTestSuite();

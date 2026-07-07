/**
 * Performance monitoring and analytics
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: Date;
  status: 'success' | 'error';
  context?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 10000;
  private marks = new Map<string, number>();

  startMeasure(name: string) {
    this.marks.set(name, performance.now());
  }

  endMeasure(name: string, status: 'success' | 'error' = 'success', context?: Record<string, any>) {
    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`Measure ${name} not started`);
      return;
    }

    const duration = performance.now() - startTime;
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: new Date(),
      status,
      context
    };

    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    this.marks.delete(name);
    return duration;
  }

  getMetrics(filter?: { name?: string; minDuration?: number }): PerformanceMetric[] {
    return this.metrics.filter(m => {
      if (filter?.name && !m.name.includes(filter.name)) return false;
      if (filter?.minDuration && m.duration < filter.minDuration) return false;
      return true;
    });
  }

  getStats(name?: string) {
    const metricsToAnalyze = name
      ? this.metrics.filter(m => m.name === name)
      : this.metrics;

    if (metricsToAnalyze.length === 0) return null;

    const durations = metricsToAnalyze.map(m => m.duration);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      count: metricsToAnalyze.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg,
      median,
      p95,
      p99,
      successRate: (metricsToAnalyze.filter(m => m.status === 'success').length / metricsToAnalyze.length) * 100
    };
  }

  clearMetrics() {
    this.metrics = [];
    this.marks.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for performance measurement
 */
export function measurePerformance(name: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const measureName = `${name}:${propertyKey}`;
      performanceMonitor.startMeasure(measureName);
      try {
        const result = await originalMethod.apply(this, args);
        performanceMonitor.endMeasure(measureName, 'success');
        return result;
      } catch (error) {
        performanceMonitor.endMeasure(measureName, 'error', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Memory leak detection
 */
export class MemoryLeakDetector {
  private observers: WeakMap<object, boolean> = new WeakMap();

  track(obj: object): void {
    this.observers.set(obj, true);
  }

  getReport(): { tracked: number; approximateSize: string } {
    const performance = (window as any).performance;
    const memory = performance?.memory;

    return {
      tracked: this.observers.size || 0,
      approximateSize: memory ? `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB` : 'N/A'
    };
  }
}

export const memoryLeakDetector = new MemoryLeakDetector();

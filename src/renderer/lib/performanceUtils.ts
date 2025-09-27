/**
 * Frontend Performance Utilities for SafeTube
 * Provides comprehensive timing and performance monitoring for React components
 */

export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  label: string;
  category: 'backend' | 'frontend' | 'render' | 'interaction';
}

class PerformanceMonitor {
  private markers = new Map<string, number>();
  private metrics: PerformanceMetrics[] = [];

  /**
   * Start timing a performance operation
   */
  start(label: string, category: PerformanceMetrics['category'] = 'frontend'): number {
    const startTime = performance.now();
    this.markers.set(label, startTime);

    // Browser dev tools markers (with error handling)
    try {
      performance.mark(`safetube-start-${label.toLowerCase().replace(/\s+/g, '-')}`);
    } catch (error) {
      // Ignore performance mark errors
    }


    return startTime;
  }

  /**
   * End timing and log results
   */
  end(label: string, category: PerformanceMetrics['category'] = 'frontend'): number {
    const endTime = performance.now();
    const startTime = this.markers.get(label);

    if (!startTime) {
      console.warn(`⚠️ [PERF] No start time found for: ${label}`);
      return 0;
    }

    const duration = endTime - startTime;

    // Store metrics
    this.metrics.push({
      startTime,
      endTime,
      duration,
      label,
      category
    });

    // Browser dev tools markers (with error handling)
    try {
      const markName = label.toLowerCase().replace(/\s+/g, '-');
      performance.mark(`safetube-end-${markName}`);
      performance.measure(`safetube-${markName}`, `safetube-start-${markName}`, `safetube-end-${markName}`);
    } catch (error) {
      // Ignore performance measurement errors in case marks don't exist
    }


    return duration;
  }

  /**
   * Quick timing utility
   */
  time<T>(label: string, fn: () => T, category: PerformanceMetrics['category'] = 'frontend'): T {
    this.start(label, category);
    const result = fn();
    this.end(label, category);
    return result;
  }

  /**
   * Async timing utility
   */
  async timeAsync<T>(label: string, fn: () => Promise<T>, category: PerformanceMetrics['category'] = 'frontend'): Promise<T> {
    this.start(label, category);
    const result = await fn();
    this.end(label, category);
    return result;
  }

  /**
   * Generate performance summary (simplified)
   */
  getSummary(): string {
    if (this.metrics.length === 0) {
      return 'No metrics collected';
    }

    const total = this.metrics.reduce((sum, m) => sum + (m.duration || 0), 0);
    const avg = total / this.metrics.length;
    return `Performance: ${this.metrics.length} operations, ${total.toFixed(2)}ms total, ${avg.toFixed(2)}ms avg`;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.markers.clear();
    this.metrics = [];
  }

  private getCategoryEmoji(category: PerformanceMetrics['category']): string {
    switch (category) {
      case 'backend': return '🔗';
      case 'frontend': return '🚀';
      case 'render': return '🎨';
      case 'interaction': return '👆';
      default: return '⏱️';
    }
  }
}

// Global performance monitor instance
export const perfMonitor = new PerformanceMonitor();

/**
 * React hook for component render timing
 */
export const useRenderTiming = (componentName: string) => {
  const renderStart = React.useMemo(() => {
    return perfMonitor.start(`${componentName} Render`, 'render');
  }, [componentName]);

  React.useEffect(() => {
    perfMonitor.end(`${componentName} Render`, 'render');
  });

  return renderStart;
};

/**
 * Performance decorator for functions
 */
export const withPerformanceTracking = <T extends (...args: any[]) => any>(
  fn: T,
  label: string,
  category: PerformanceMetrics['category'] = 'frontend'
): T => {
  return ((...args: Parameters<T>) => {
    return perfMonitor.time(label, () => fn(...args), category);
  }) as T;
};

/**
 * Async performance decorator
 */
export const withAsyncPerformanceTracking = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  label: string,
  category: PerformanceMetrics['category'] = 'frontend'
): T => {
  return ((...args: Parameters<T>) => {
    return perfMonitor.timeAsync(label, () => fn(...args), category);
  }) as T;
};

// Browser-specific optimizations (simplified)
export const optimizeForBrowser = () => {
  // Monitor long tasks without logging
  if ('PerformanceLongTaskTiming' in window) {
    const observer = new PerformanceObserver((list) => {
      // Silently monitor long tasks
    });
    observer.observe({ entryTypes: ['longtask'] });
  }
};

// React import for hook
import React from 'react';
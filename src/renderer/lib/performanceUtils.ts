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

    console.log(`⏱️ [${category.toUpperCase()}-PERF] Starting: ${label}`);

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

    // Console logging with category-specific emoji
    const emoji = this.getCategoryEmoji(category);
    console.log(`${emoji} [${category.toUpperCase()}-PERF] ${label}: ${duration.toFixed(2)}ms`);

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
   * Generate performance summary
   */
  getSummary(): string {
    if (this.metrics.length === 0) {
      return '📊 [PERF-SUMMARY] No metrics collected';
    }

    const categories = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.category]) acc[metric.category] = [];
      acc[metric.category].push(metric);
      return acc;
    }, {} as Record<string, PerformanceMetrics[]>);

    let summary = '\n🏆 [PERF-SUMMARY] Performance Report:\n';

    Object.entries(categories).forEach(([category, metrics]) => {
      const total = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);
      const avg = total / metrics.length;
      const emoji = this.getCategoryEmoji(category as PerformanceMetrics['category']);

      summary += `${emoji} ${category.toUpperCase()}: ${metrics.length} operations, ${total.toFixed(2)}ms total, ${avg.toFixed(2)}ms avg\n`;

      // Show top 3 slowest operations
      const slowest = metrics.sort((a, b) => (b.duration || 0) - (a.duration || 0)).slice(0, 3);
      slowest.forEach((metric, i) => {
        summary += `  ${i + 1}. ${metric.label}: ${metric.duration?.toFixed(2)}ms\n`;
      });
    });

    return summary;
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

// Browser-specific optimizations
export const optimizeForBrowser = () => {
  // Enable paint timing API if available
  if ('PerformancePaintTiming' in window) {
    window.addEventListener('load', () => {
      const paintTiming = performance.getEntriesByType('paint');
      paintTiming.forEach(entry => {
        console.log(`🎨 [BROWSER-PERF] ${entry.name}: ${entry.startTime.toFixed(2)}ms`);
      });
    });
  }

  // Monitor long tasks
  if ('PerformanceLongTaskTiming' in window) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        console.warn(`⚠️ [LONG-TASK] ${entry.duration.toFixed(2)}ms task detected`);
      });
    });
    observer.observe({ entryTypes: ['longtask'] });
  }
};

// React import for hook
import React from 'react';
import { PaginationConfig, PaginationState, CachedPage } from './types';
import fs from 'fs';
import path from 'path';

export class PaginationService {
  private static instance: PaginationService;
  private config: PaginationConfig;
  private pageCache: Map<string, CachedPage[]> = new Map();
  private cacheFile: string;

  private constructor() {
    this.cacheFile = '.cache/pageCache.json'; // Will be updated in init()
    this.config = this.loadConfig();
    this.initializeAsync();
  }

  private async initializeAsync() {
    await this.updateCacheFilePath();
    this.loadPageCache();
  }

  private async updateCacheFilePath() {
    try {
      // Get cache directory from main process using AppPaths
      if (typeof window !== 'undefined' && (window as any).electron?.getCachePath) {
        this.cacheFile = await (window as any).electron.getCachePath('pageCache.json');
      } else {
        // Fallback for environments where window.electron is not available
        this.cacheFile = '.cache/pageCache.json';
      }
    } catch (error) {
      console.warn('[PaginationService] Failed to get cache path from main process, using fallback:', error);
      this.cacheFile = '.cache/pageCache.json';
    }
  }

  public static getInstance(): PaginationService {
    if (!PaginationService.instance) {
      PaginationService.instance = new PaginationService();
    }
    return PaginationService.instance;
  }

  private loadConfig(): PaginationConfig {
    try {
      const configPath = 'config/pagination.json';
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return {
          pageSize: config.pageSize || 50,
          cacheDurationMinutes: config.cacheDurationMinutes || 30,
          maxCachedPages: config.maxCachedPages || 10
        };
      }
    } catch (error) {
      console.warn('Failed to load pagination config, using defaults:', error);
    }
    
    return {
      pageSize: 50,
      cacheDurationMinutes: 30,
      maxCachedPages: 10
    };
  }

  private loadPageCache(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
        this.pageCache = new Map(Object.entries(cacheData));
      }
    } catch (error) {
      console.warn('Failed to load page cache:', error);
      this.pageCache = new Map();
    }
  }

  private savePageCache(): void {
    try {
      const cacheData = Object.fromEntries(this.pageCache);
      fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.error('Failed to save page cache:', error);
    }
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    const cacheDurationMs = this.config.cacheDurationMinutes * 60 * 1000;
    
    for (const [sourceId, pages] of this.pageCache.entries()) {
      const validPages = pages.filter(page => 
        (now - page.timestamp) < cacheDurationMs
      );
      
      if (validPages.length === 0) {
        this.pageCache.delete(sourceId);
      } else {
        this.pageCache.set(sourceId, validPages);
      }
    }
  }

  public getPaginationState(sourceId: string, totalVideos: number, currentPage: number = 1): PaginationState {
    const totalPages = Math.ceil(totalVideos / this.config.pageSize);
    return {
      currentPage,
      totalPages,
      totalVideos,
      pageSize: this.config.pageSize
    };
  }

  public getPage(sourceId: string, pageNumber: number, allVideos: any[]): any[] {
    this.cleanupExpiredCache();
    
    // Check if page is cached
    const cachedPages = this.pageCache.get(sourceId) || [];
    const cachedPage = cachedPages.find(p => p.pageNumber === pageNumber);
    
    if (cachedPage) {
      const now = Date.now();
      const cacheDurationMs = this.config.cacheDurationMinutes * 60 * 1000;
      
      if ((now - cachedPage.timestamp) < cacheDurationMs) {
        return cachedPage.videos;
      }
    }

    // Calculate page data
    const startIndex = (pageNumber - 1) * this.config.pageSize;
    const endIndex = startIndex + this.config.pageSize;
    const pageVideos = allVideos.slice(startIndex, endIndex);

    // Cache the page
    const newCachedPage: CachedPage = {
      pageNumber,
      videos: pageVideos,
      timestamp: Date.now(),
      sourceId
    };

    // Add to cache, maintaining maxCachedPages limit
    const updatedPages = [...cachedPages.filter(p => p.pageNumber !== pageNumber), newCachedPage];
    if (updatedPages.length > this.config.maxCachedPages) {
      updatedPages.sort((a, b) => b.timestamp - a.timestamp);
      updatedPages.splice(this.config.maxCachedPages);
    }
    
    this.pageCache.set(sourceId, updatedPages);
    this.savePageCache();

    return pageVideos;
  }

  public getConfig(): PaginationConfig {
    return { ...this.config };
  }

  public clearCache(sourceId?: string): void {
    if (sourceId) {
      this.pageCache.delete(sourceId);
    } else {
      this.pageCache.clear();
    }
    this.savePageCache();
  }
}

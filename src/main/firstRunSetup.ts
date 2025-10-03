import { promises as fs } from 'fs';
import * as path from 'path';
import { AppPaths } from './appPaths';
import { logVerbose } from '../shared/logging';

interface SetupResult {
  success: boolean;
  createdDirs: string[];
  copiedFiles: string[];
  errors: string[];
}

/**
 * First-run setup helper that creates necessary directories and copies default config files
 */
export class FirstRunSetup {
  // Phase 2 migration: timeLimits, usageLog, youtubePlayer, timeExtra, pagination, mainSettings are now in database
  // Only videoSources.json is still needed for migration purposes
  private static readonly REQUIRED_CONFIG_FILES = [
    'videoSources.json'
  ];

  /**
   * Run first-time setup if needed
   */
  static async setupIfNeeded(): Promise<SetupResult> {
    const result: SetupResult = {
      success: true,
      createdDirs: [],
      copiedFiles: [],
      errors: []
    };

    try {
      // Run setup in both development and production modes
      // In development, it will create config files in the project root
      // In production, it will create config files in user data directory

      // Create necessary directories
      await this.createDirectories(result);

    // Copy default config files if they don't exist
    await this.copyDefaultConfigs(result);

    } catch (error) {
      logVerbose('[FirstRunSetup] Error during setup:', error);
      result.errors.push(`Setup failed: ${error}`);
      result.success = false;
    }

    return result;
  }

  /**
   * Create necessary directories
   */
  private static async createDirectories(result: SetupResult): Promise<void> {
    try {
      const configDir = AppPaths.getConfigDir();
      const logsDir = AppPaths.getLogsDir();

      // Create config directory
      if (!await this.ensureDirectoryExists(configDir)) {
        result.createdDirs.push(configDir);
      }

      // Create logs directory
      if (!await this.ensureDirectoryExists(logsDir)) {
        result.createdDirs.push(logsDir);
      }

    } catch (error) {
      logVerbose('[FirstRunSetup] Error creating directories:', error);
      result.errors.push(`Directory creation failed: ${error}`);
    }
  }

  /**
   * Ensure a directory exists, return true if it already existed
   */
  private static async ensureDirectoryExists(dirPath: string): Promise<boolean> {
    try {
      await fs.access(dirPath);
      return true; // Directory already exists
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      return false; // Directory was created
    }
  }

  /**
   * Copy default config files if they don't exist
   */
  private static async copyDefaultConfigs(result: SetupResult): Promise<void> {
    try {
      const configDir = AppPaths.getConfigDir();
      const exampleConfigDir = path.join(process.cwd(), 'config.example');

      for (const filename of this.REQUIRED_CONFIG_FILES) {
        const targetPath = path.join(configDir, filename);
        const examplePath = path.join(exampleConfigDir, filename);

        try {
          // Check if target file already exists
          await fs.access(targetPath);
          continue; // File already exists, skip
        } catch {
          // Special handling for videoSources.json - check database first and migrate if needed
          if (filename === 'videoSources.json') {
            try {
              // Check if database has sources
              const DatabaseService = await import('./services/DatabaseService');
              const dbService = DatabaseService.default.getInstance();
              const healthStatus = await dbService.getHealthStatus();

              if (healthStatus.initialized) {
                const sourceCount = await dbService.get<{ count: number }>('SELECT COUNT(*) as count FROM sources');
                if (sourceCount && sourceCount.count === 0) {
                  // Migrate sources from JSON to DB using INSERT OR REPLACE
                  const sourcesPath = path.join(configDir, filename);
                  const fsSync = require('fs');
                  if (fsSync.existsSync(sourcesPath)) {
                    const sources = JSON.parse(fsSync.readFileSync(sourcesPath, 'utf-8'));
                    for (const source of sources) {
                      await dbService.run(`
                        INSERT OR REPLACE INTO sources (id, type, title, sort_preference, position, url, channel_id, path, max_depth)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                      `, [
                        source.id,
                        source.type,
                        source.title,
                        source.sortPreference || 'newestFirst',
                        null, // position
                        source.url || null,
                        source.channelId || null,
                        source.path || null,
                        source.maxDepth || null
                      ]);
                    }
                    logVerbose(`[FirstRunSetup] Migrated ${sources.length} sources from videoSources.json to database`);
                    // Delete the JSON file after successful migration
                    try {
                      fsSync.unlinkSync(sourcesPath);
                      logVerbose(`[FirstRunSetup] Deleted videoSources.json after migration`);
                    } catch (deleteErr) {
                      logVerbose(`[FirstRunSetup] Failed to delete videoSources.json after migration:`, deleteErr);
                    }
                  }
                } else if (sourceCount && sourceCount.count > 0) {
                  logVerbose(`[FirstRunSetup] Skipping videoSources.json creation - found ${sourceCount.count} sources in database`);
                  continue; // Skip creating JSON file, database has sources
                }
              }
            } catch (dbError) {
              logVerbose('[FirstRunSetup] Database not available, proceeding with JSON file creation:', dbError);
            }
          }

          // Target file doesn't exist, try to copy from example
          try {
            await fs.access(examplePath);
            await fs.copyFile(examplePath, targetPath);
            result.copiedFiles.push(filename);
          } catch {
            // Example file doesn't exist either, create a minimal default
            await this.createDefaultConfigFile(targetPath, filename);
            result.copiedFiles.push(filename);
          }
        }
      }
    } catch (error) {
      logVerbose('[FirstRunSetup] Error copying config files:', error);
      result.errors.push(`Config file setup failed: ${error}`);
    }
  }

  /**
   * Create a minimal default config file
   * Phase 2 migration: Only videoSources.json is still created as a temporary migration file
   */
  private static async createDefaultConfigFile(filePath: string, filename: string): Promise<void> {
    let defaultContent: any = {};

    switch (filename) {
      case 'videoSources.json':
        defaultContent = [];
        break;
      default:
        // All other config files are now in the database
        logVerbose(`[FirstRunSetup] Skipping ${filename} - Phase 2 migration to database complete`);
        return;
    }

    await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2), 'utf-8');
  }

  /**
   * Get setup status
   */
  static async getSetupStatus(): Promise<{ isSetup: boolean; missingFiles: string[] }> {
    const configDir = AppPaths.getConfigDir();
    const missingFiles: string[] = [];

    for (const filename of this.REQUIRED_CONFIG_FILES) {
      const filePath = path.join(configDir, filename);
      try {
        await fs.access(filePath);
      } catch {
        missingFiles.push(filename);
      }
    }

    return {
      isSetup: missingFiles.length === 0,
      missingFiles
    };
  }
}
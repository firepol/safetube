/**
 * Injects the YouTube IFrame API script into the document if not already present.
 * Returns a Promise that resolves when the API is ready.
 */
export function loadYouTubeIframeAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if API is already loaded
    if ((window as any).YT && (window as any).YT.Player) {
      resolve();
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.getElementById('youtube-iframe-api');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        resolve();
      });
      return;
    }

    // Set up the callback before loading the script
    (window as any).onYouTubeIframeAPIReady = () => {
      resolve();
    };

    // Create and load the script
    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => {
      console.error('[YouTube] Failed to load script');
      reject(new Error('Failed to load YouTube IFrame API'));
    };
    
    document.body.appendChild(tag);
  });
}

/**
 * Manages a YouTube Player instance using the IFrame API.
 */
export class YouTubeIframePlayer {
  private player: any;
  private elementId: string;

  constructor(elementId: string) {
    this.elementId = elementId;
  }

  /**
   * Wait for an element to be available in the DOM
   */
  private async waitForElement(elementId: string, timeout: number = 3000): Promise<HTMLElement | null> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = document.getElementById(elementId);
      if (element) {
        return element;
      }
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return null;
  }

  /**
   * Initializes the YouTube player and loads the given videoId.
   */
  async mount(videoId: string, options: any = {}): Promise<void> {   
    try {
      // Try the YouTube IFrame API first
      try {
        await loadYouTubeIframeAPI();
        
        // Double-check that the API is available
        if (!(window as any).YT || !(window as any).YT.Player) {
          throw new Error('YouTube IFrame API not available after loading');
        }

        const el = await this.waitForElement(this.elementId);
        if (!el) {
          throw new Error('YouTube player container element not found');
        }
        
        // Merge internal and external event handlers
        const userEvents = (options && options.events) || {};
        this.player = new (window as any).YT.Player(this.elementId, {
          videoId,
          ...options,
          events: {
            onReady: (event: any) => {
              if (userEvents.onReady) userEvents.onReady(event);
              // Don't auto-play if we need to seek to a specific time
              if (!options.startSeconds) {
                event.target.playVideo();
              }
            },
            onStateChange: (event: any) => {
              if (userEvents.onStateChange) userEvents.onStateChange(event);
            },
            onError: (event: any) => {
              console.error('[YouTube] Player error:', event.data);
              if (userEvents.onError) userEvents.onError(event);
            }
          }
        });
      } catch (apiError) {
        console.warn('[YouTube] API approach failed, using direct iframe:', apiError);

        // Fallback to direct iframe
        const element = await this.waitForElement(this.elementId);
        if (!element) {
          throw new Error('Player element not found');
        }
        
        // Build iframe URL with start time if provided
        let iframeUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&controls=1&showinfo=1&fs=1`;
        if (options.startSeconds) {
          iframeUrl += `&start=${Math.floor(options.startSeconds)}`;
        }
        
        const iframe = document.createElement('iframe');
        iframe.width = '100%';
        iframe.height = '100%';
        iframe.src = iframeUrl;
        iframe.frameBorder = '0';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        
        element.appendChild(iframe);
        this.player = iframe;
      }
    } catch (error) {
      console.error('[YouTube] Error mounting player:', error);
      throw error;
    }
  }

  /**
   * Seeks to a specific time in the video
   */
  seekTo(seconds: number): void {
    if (this.player && typeof this.player.seekTo === 'function') {
      this.player.seekTo(seconds, true);
    } else if (this.player && this.player.tagName === 'IFRAME') {
      // For iframe fallback, we need to reload with the new start time
      const iframe = this.player as HTMLIFrameElement;
      const currentSrc = iframe.src;
      const baseUrl = currentSrc.split('&start=')[0];
      iframe.src = `${baseUrl}&start=${Math.floor(seconds)}`;
    }
  }

  /**
   * Destroys the YouTube player instance.
   */
  destroy() {
    if (this.player && typeof this.player.destroy === 'function') {
      this.player.destroy();
    }
  }
} 
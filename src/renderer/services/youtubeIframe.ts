/**
 * Injects the YouTube IFrame API script into the document if not already present.
 * Returns a Promise that resolves when the API is ready.
 */
export function loadYouTubeIframeAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if API is already loaded
    if ((window as any).YT && (window as any).YT.Player) {
      console.log('[YouTube] API already loaded');
      resolve();
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.getElementById('youtube-iframe-api');
    if (existingScript) {
      console.log('[YouTube] Script already loading, waiting...');
      existingScript.addEventListener('load', () => {
        console.log('[YouTube] Existing script loaded');
        resolve();
      });
      return;
    }

    console.log('[YouTube] Loading YouTube IFrame API...');
    
    // Set up the callback before loading the script
    (window as any).onYouTubeIframeAPIReady = () => {
      console.log('[YouTube] API ready callback fired');
      resolve();
    };

    // Create and load the script
    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onload = () => {
      console.log('[YouTube] Script loaded');
      // The script might not have fired the callback yet, so we wait
    };
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
   * Initializes the YouTube player and loads the given videoId.
   */
  async mount(videoId: string, options: any = {}): Promise<void> {
    console.log('[YouTube] Mounting player for video:', videoId);
    
    try {
      await loadYouTubeIframeAPI();
      
      // Double-check that the API is available
      if (!(window as any).YT || !(window as any).YT.Player) {
        throw new Error('YouTube IFrame API not available after loading');
      }
      
      console.log('[YouTube] Creating player instance...');
      console.log('[YouTube] Element ID:', this.elementId);
      console.log('[YouTube] Options:', { videoId, ...options });
      
      this.player = new (window as any).YT.Player(this.elementId, {
        videoId,
        ...options,
        events: {
          onReady: (event: any) => {
            console.log('[YouTube] Player ready');
            event.target.playVideo();
          },
          onStateChange: (event: any) => {
            console.log('[YouTube] Player state changed:', event.data);
          },
          onError: (event: any) => {
            console.error('[YouTube] Player error:', event.data);
          }
        }
      });
      
      console.log('[YouTube] Player instance created');
      
      // Check if the iframe was created
      setTimeout(() => {
        const element = document.getElementById(this.elementId);
        const iframe = element?.querySelector('iframe');
        console.log('[YouTube] Element found:', !!element);
        console.log('[YouTube] Iframe found:', !!iframe);
        if (iframe) {
          console.log('[YouTube] Iframe src:', iframe.src);
          console.log('[YouTube] Iframe dimensions:', iframe.width, 'x', iframe.height);
        } else {
          console.log('[YouTube] Iframe not found, checking again in 2 seconds...');
          setTimeout(() => {
            const element2 = document.getElementById(this.elementId);
            const iframe2 = element2?.querySelector('iframe');
            console.log('[YouTube] Second check - Element found:', !!element2);
            console.log('[YouTube] Second check - Iframe found:', !!iframe2);
            if (iframe2) {
              console.log('[YouTube] Iframe src:', iframe2.src);
              console.log('[YouTube] Iframe dimensions:', iframe2.width, 'x', iframe2.height);
            }
          }, 2000);
        }
      }, 1000);
    } catch (error) {
      console.error('[YouTube] Error mounting player:', error);
      throw error;
    }
  }

  /**
   * Destroys the YouTube player instance.
   */
  destroy() {
    console.log('[YouTube] Destroying player');
    if (this.player && typeof this.player.destroy === 'function') {
      this.player.destroy();
    }
  }
} 
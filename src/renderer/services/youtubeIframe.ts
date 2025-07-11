/**
 * Injects the YouTube IFrame API script into the document if not already present.
 * Returns a Promise that resolves when the API is ready.
 */
export function loadYouTubeIframeAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).YT && (window as any).YT.Player) {
      resolve();
      return;
    }
    const existingScript = document.getElementById('youtube-iframe-api');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }
    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onload = () => resolve();
    tag.onerror = () => reject(new Error('Failed to load YouTube IFrame API'));
    document.body.appendChild(tag);
    (window as any).onYouTubeIframeAPIReady = () => resolve();
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
    await loadYouTubeIframeAPI();
    this.player = new (window as any).YT.Player(this.elementId, {
      videoId,
      ...options,
    });
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
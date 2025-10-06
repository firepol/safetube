import DatabaseService from '../../services/DatabaseService';

/**
 * Type-safe query helpers for wishlist table
 * Consolidates wishlist-related database operations
 */

/**
 * Wishlist item interface for query results
 * Matches the WishlistItem interface from shared/types.ts
 */
export interface WishlistVideoResult {
  id: number;
  video_id: string;
  title: string;
  thumbnail: string | null;
  description: string | null;
  channel_id: string | null;
  channel_name: string | null;
  duration: number | null;
  url: string;
  status: 'pending' | 'approved' | 'denied';
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  denial_reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Find approved wishlist video by ID
 * Used in: index.ts for video playback
 */
export async function findApprovedWishlistVideo(
  db: DatabaseService, 
  videoId: string
): Promise<WishlistVideoResult | null> {
  return db.get<WishlistVideoResult>(
    `SELECT
      id, video_id, title, thumbnail, description, channel_id, channel_name,
      duration, url, status, requested_at, reviewed_at, reviewed_by,
      denial_reason, created_at, updated_at
    FROM wishlist
    WHERE video_id = ? AND status = 'approved'`,
    [videoId]
  );
}

/**
 * Find wishlist video by ID (any status)
 * Used for general wishlist operations
 */
export async function findWishlistVideo(
  db: DatabaseService, 
  videoId: string
): Promise<WishlistVideoResult | null> {
  return db.get<WishlistVideoResult>(
    `SELECT
      id, video_id, title, thumbnail, description, channel_id, channel_name,
      duration, url, status, requested_at, reviewed_at, reviewed_by,
      denial_reason, created_at, updated_at
    FROM wishlist
    WHERE video_id = ?`,
    [videoId]
  );
}

/**
 * Get wishlist videos by status
 * Used in: wishlistService.ts
 */
export async function getWishlistByStatus(
  db: DatabaseService, 
  status: 'pending' | 'approved' | 'denied'
): Promise<WishlistVideoResult[]> {
  return db.all<WishlistVideoResult>(
    `SELECT
      id, video_id, title, thumbnail, description, channel_id, channel_name,
      duration, url, status, requested_at, reviewed_at, reviewed_by,
      denial_reason, created_at, updated_at
    FROM wishlist
    WHERE status = ?
    ORDER BY requested_at DESC`,
    [status]
  );
}

/**
 * Check if video exists in wishlist
 * Used for duplicate checking
 */
export async function isVideoInWishlist(
  db: DatabaseService, 
  videoId: string
): Promise<boolean> {
  const result = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM wishlist WHERE video_id = ?',
    [videoId]
  );
  return (result?.count || 0) > 0;
}

/**
 * Add video to wishlist
 * Used in: wishlistService.ts
 */
export async function addToWishlist(
  db: DatabaseService,
  videoData: {
    video_id: string;
    title: string;
    thumbnail?: string;
    description?: string;
    channel_id?: string;
    channel_name?: string;
    duration?: number;
    url: string;
  }
): Promise<void> {
  await db.run(
    `INSERT INTO wishlist (
      video_id, title, thumbnail, description, channel_id, 
      channel_name, duration, url, status, requested_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
    [
      videoData.video_id,
      videoData.title,
      videoData.thumbnail || null,
      videoData.description || null,
      videoData.channel_id || null,
      videoData.channel_name || null,
      videoData.duration || null,
      videoData.url
    ]
  );
}

/**
 * Update wishlist video status
 * Used in: wishlistService.ts for approval/denial
 */
export async function updateWishlistStatus(
  db: DatabaseService,
  videoId: string,
  status: 'approved' | 'denied',
  reviewedBy?: string,
  denialReason?: string
): Promise<void> {
  await db.run(
    `UPDATE wishlist 
     SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, denial_reason = ?
     WHERE video_id = ?`,
    [status, reviewedBy || null, denialReason || null, videoId]
  );
}

/**
 * Remove video from wishlist
 * Used in: wishlistService.ts
 */
export async function removeFromWishlist(
  db: DatabaseService,
  videoId: string
): Promise<void> {
  await db.run(
    'DELETE FROM wishlist WHERE video_id = ?',
    [videoId]
  );
}

/**
 * Get wishlist counts by status
 * Used for UI badges and navigation
 */
export async function getWishlistCounts(db: DatabaseService): Promise<{
  pending: number;
  approved: number;
  denied: number;
  total: number;
}> {
  const result = await db.get<{
    pending: number;
    approved: number;
    denied: number;
    total: number;
  }>(
    `SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied,
      COUNT(*) as total
    FROM wishlist`
  );

  return {
    pending: result?.pending || 0,
    approved: result?.approved || 0,
    denied: result?.denied || 0,
    total: result?.total || 0
  };
}
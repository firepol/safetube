# YouTube API Costs and Quotas for SafeTube

This document details the YouTube Data API v3 costs, quotas, and SafeTube's usage patterns to help understand the daily API limitations and plan for future features.

## YouTube Data API v3 Overview

### Free Tier and Pricing
- **Cost**: Completely free - no monetary charges for API usage
- **Default Quota**: 10,000 units per day per project
- **Extended Quota**: Available through application approval process at no cost
- **Quota Reset**: Daily at midnight Pacific Time (PT)

### Official Documentation
- **Quota Calculator**: https://developers.google.com/youtube/v3/determine_quota_cost
- **API Overview**: https://developers.google.com/youtube/v3/getting-started
- **Search API**: https://developers.google.com/youtube/v3/docs/search/list

## API Operation Costs

### Basic Operations
| Operation | Quota Cost | Description |
|-----------|------------|-------------|
| `channels.list` | 1 unit | Get channel details |
| `playlists.list` | 1 unit | Get playlist details |
| `playlistItems.list` | 1 unit | Get videos from playlist |
| `videos.list` | 1 unit | Get video details |
| `search.list` | 100 units | Search for videos/channels/playlists |

### Advanced Operations
| Operation | Quota Cost | Description |
|-----------|------------|-------------|
| Write operations | 50 units | Create, update, delete resources |
| Video uploads | 1,600 units | Upload video content |

## SafeTube's Current API Usage

Based on the codebase analysis, SafeTube uses the following API calls:

### Channel Operations
1. **`getChannelDetails(channelId)`** - 1 unit
   - Called once per channel source during setup/refresh
   - Returns channel title, description, thumbnail

2. **`getChannelVideos(channelId, maxResults)`** - 2 units total
   - Calls `channels.list` (1 unit) to get uploads playlist ID
   - Calls `playlistItems.list` (1 unit) to get videos from uploads playlist
   - Called when loading/refreshing channel sources

### Playlist Operations
1. **`getPlaylistDetails(playlistId)`** - 1 unit
   - Called once per playlist source during setup/refresh
   - Returns playlist title, description, thumbnail

2. **`getPlaylistVideos(playlistId, maxResults)`** - 1 unit
   - Called when loading/refreshing playlist sources
   - Retrieves video IDs from playlist

### Video Operations
1. **`getVideoDetails(videoId)`** - 1 unit per video
   - Called for individual video metadata (title, thumbnail, duration)
   - Used during video history and resume functionality
   - Called when videos are not in cache

### Username Resolution
1. **`searchChannelByUsername(username)`** - 100 units
   - Called when channel URL uses @username format instead of channel ID
   - Converts @username to channel ID for further API calls

## Daily Quota Calculations

### Current SafeTube Operations

#### Initial Setup (One-time per source)
For a typical SafeTube configuration with multiple sources:

**Per Channel Source:**
- Channel details: 1 unit
- Channel videos (50 videos): 2 units
- **Total per channel: 3 units**

**Per Playlist Source:**
- Playlist details: 1 unit
- Playlist videos (50 videos): 1 unit
- **Total per playlist: 2 units**

**Username Resolution (if needed):**
- Channel search by username: 100 units
- **Only needed for @username URLs**

#### Daily Operations
**Video Detail Fetches:**
- Individual video metadata: 1 unit per video
- Typically needed for new videos not in cache

### Example Quota Usage Scenarios

#### Scenario 1: Small Family Setup
- 3 YouTube channels (3 × 3 = 9 units)
- 2 playlists (2 × 2 = 4 units)
- 20 new video details per day (20 × 1 = 20 units)
- **Daily total: 33 units (0.3% of quota)**

#### Scenario 2: Large Family Setup
- 10 YouTube channels (10 × 3 = 30 units)
- 5 playlists (5 × 2 = 10 units)
- 100 new video details per day (100 × 1 = 100 units)
- 2 username resolutions (2 × 100 = 200 units)
- **Daily total: 340 units (3.4% of quota)**

#### Maximum Operations with 10,000 Units
If using only one type of operation per day:
- **Channel video fetches**: 3,333 channels
- **Playlist video fetches**: 5,000 playlists
- **Video detail fetches**: 10,000 videos
- **Username searches**: 100 searches
- **Search operations**: 100 searches

## Search Feature Implementation

### Search Functionality Options

#### 1. Global YouTube Search
- **API Call**: `search.list`
- **Cost**: 100 units per search
- **Parameters**: Can search by title, description, tags
- **Daily Limit**: 100 searches with free quota

#### 2. Channel-Specific Search
- **Implementation**: Fetch all channel videos first, then search locally
- **API Cost**: 2 units for channel videos + local search (free)
- **Advantage**: Unlimited searches within cached data
- **Disadvantage**: Limited to already fetched videos

#### 3. Playlist-Specific Search
- **Implementation**: Fetch all playlist videos first, then search locally
- **API Cost**: 1 unit for playlist videos + local search (free)
- **Advantage**: Unlimited searches within cached data
- **Note**: No direct playlist search API available

### Search Parameters and Costs

#### Global Search Options
| Search Type | API Parameter | Cost | Description |
|------------|---------------|------|-------------|
| All content | `q=query` | 100 units | Search titles, descriptions, tags |
| Title only | Not available | 100 units | No title-only search option |
| Video only | `type=video` | 100 units | Filter results to videos only |
| Channel only | `type=channel` | 100 units | Filter results to channels only |

**Note**: YouTube API does not provide a "title-only" search option that costs less. All search operations cost 100 units regardless of search scope.

### Recommended Search Strategy for SafeTube

#### Hybrid Approach
1. **Cache Management**: Maintain local cache of all video metadata
2. **Local Search**: Search within cached video titles and descriptions (free)
3. **API Search**: Only use for discovering new content not in existing sources
4. **Cost**: Minimal API usage, maximum search flexibility

#### Implementation Benefits
- **Cost Effective**: Most searches use local cache (0 API cost)
- **Fast Response**: Local searches are instantaneous
- **Comprehensive**: Can search all video metadata fields
- **Scalable**: Works with large video collections

## Quota Management Best Practices

### Optimization Strategies
1. **Caching**: Store all video metadata locally to minimize repeated API calls
2. **Batch Processing**: Group API calls when possible
3. **Rate Limiting**: Spread API calls throughout the day
4. **Error Handling**: Implement backoff strategies for quota exceeded errors

### Monitoring and Alerts
1. **Quota Tracking**: Monitor daily API usage in Google Cloud Console
2. **Usage Patterns**: Track which operations consume most quota
3. **Alert System**: Set up notifications for high quota usage (80% threshold)

### Extended Quota
If 10,000 units becomes insufficient:
1. **Application Process**: Apply through Google Cloud Console
2. **Use Case Documentation**: Provide clear justification
3. **Approval Timeline**: Can take several days to weeks
4. **No Cost**: Extended quota remains free

## Future Feature Considerations

### Search Feature Impact
- **Local Search**: Recommended approach for most use cases
- **API Search**: Reserve for content discovery outside existing sources
- **Budget Planning**: 100 searches per day maximum with current quota

### Additional Features
- **Live Streaming**: Would require additional API calls
- **Comments/Ratings**: Not currently used, each would cost 1 unit per call
- **Subscription Management**: Would require write operations (50 units each)

## Conclusion

SafeTube's current API usage is very efficient, typically using less than 5% of the daily quota for most family setups. The recommended search implementation using local caching would add minimal API costs while providing comprehensive search functionality.

The YouTube API's generous free tier (10,000 units daily) provides ample room for SafeTube's growth and additional features without requiring extended quota approval for typical family usage scenarios.
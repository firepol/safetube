import { VideoCardBaseProps } from '../components/video/VideoCardBase';

export const sampleVideos: VideoCardBaseProps[] = [
  // YouTube videos
  {
    thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    title: 'Never Gonna Give You Up',
    duration: 212,
    resumeAt: null,
    watched: false,
    type: 'youtube',
    progress: 0,
  },
  {
    thumbnail: 'https://i.ytimg.com/vi/jNQXAC9IVRw/maxresdefault.jpg',
    title: 'Me at the zoo',
    duration: 19,
    resumeAt: 10,
    watched: true,
    type: 'youtube',
    progress: 95,
  },
  // DLNA videos
  {
    thumbnail: 'https://example.com/dlna-thumb1.jpg',
    title: 'Family Vacation 2023',
    duration: 3600,
    resumeAt: 1800,
    watched: false,
    type: 'dlna',
    progress: 50,
  },
  {
    thumbnail: 'https://example.com/dlna-thumb2.jpg',
    title: 'Birthday Party',
    duration: 1800,
    resumeAt: null,
    watched: true,
    type: 'dlna',
    progress: 100,
  },
  // Local videos
  {
    thumbnail: 'https://example.com/local-thumb1.jpg',
    title: 'School Project',
    duration: 300,
    resumeAt: null,
    watched: false,
    type: 'local',
    progress: 0,
  },
  {
    thumbnail: 'https://example.com/local-thumb2.jpg',
    title: 'Dance Recital',
    duration: 600,
    resumeAt: 300,
    watched: false,
    type: 'local',
    progress: 50,
  },
]; 
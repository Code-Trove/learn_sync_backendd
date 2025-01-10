import { ContentType } from '@prisma/client';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import ytdl from 'ytdl-core';
import SpotifyWebApi from 'spotify-web-api-node';
import { getAudioDurationInSeconds } from 'get-audio-duration';
import { load } from 'cheerio';
import { analyzeImage, extractTextFromImage } from './ai-processing';

interface ProcessedContent {
  extractedText: string;
  metadata: Record<string, any>;
  keywords: string[];
}

// Platform-specific processors
const platformProcessors = {
  // Video Platforms
  youtube: async (url: string) => {
    const info = await ytdl.getInfo(url);
    return {
      extractedText: info.videoDetails.description || '',
      metadata: {
        title: info.videoDetails.title || '',
        duration: Number(info.videoDetails.lengthSeconds) || 0,
        author: info.videoDetails.author?.name || '',
        views: Number(info.videoDetails.viewCount) || 0,
        thumbnailUrl: info.videoDetails.thumbnails[0]?.url || '',
        platform: 'youtube',
        categories: info.videoDetails.category || [],
        publishDate: info.videoDetails.publishDate,
        engagement: {
          likes: info.videoDetails.likes || 0,
          dislikes: info.videoDetails.dislikes || 0
        }
      },
      keywords: info.videoDetails.keywords || []
    };
  },

  vimeo: async (url: string) => {
    const videoId = url.split('/').pop();
    const response = await fetch(`https://api.vimeo.com/videos/${videoId}`, {
      headers: { 'Authorization': `Bearer ${process.env.VIMEO_ACCESS_TOKEN}` }
    });
    const data = await response.json();
    return {
      extractedText: data.description || '',
      metadata: {
        title: data.name,
        duration: data.duration,
        author: data.user.name,
        views: data.stats.plays,
        thumbnailUrl: data.pictures.sizes[0].link,
        platform: 'vimeo',
        categories: data.categories.map((c: any) => c.name)
      },
      keywords: data.tags.map((t: any) => t.name)
    };
  },

  // Audio Platforms
  spotify: async (url: string) => {
    const spotifyApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    });
    
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);

    const id = url.split('/').pop() || '';
    const track = await spotifyApi.getTrack(id);

    return {
      extractedText: '',
      metadata: {
        title: track.body.name,
        artist: track.body.artists[0].name,
        duration: track.body.duration_ms / 1000,
        album: track.body.album.name,
        platform: 'spotify',
        releaseDate: track.body.album.release_date,
        popularity: track.body.popularity,
        previewUrl: track.body.preview_url,
        externalUrls: track.body.external_urls
      },
      keywords: [track.body.artists[0].name, track.body.album.name]
    };
  },

  soundcloud: async (url: string) => {
    const response = await fetch(`https://api.soundcloud.com/resolve?url=${url}&client_id=${process.env.SOUNDCLOUD_CLIENT_ID}`);
    const data = await response.json();
    return {
      extractedText: data.description || '',
      metadata: {
        title: data.title,
        artist: data.user.username,
        duration: data.duration / 1000,
        platform: 'soundcloud',
        genre: data.genre,
        waveformUrl: data.waveform_url,
        streamable: data.streamable,
        downloadable: data.downloadable
      },
      keywords: data.tag_list.split(' ')
    };
  },

  // Podcast platforms
  anchor: async (url: string) => {
    const response = await fetch(url);
    const html = await response.text();
    const $ = load(html);
    
    return {
      extractedText: $('.episode-description').text(),
      metadata: {
        title: $('.episode-title').text(),
        author: $('.host-name').text(),
        platform: 'anchor',
        publishDate: $('.episode-date').text(),
        duration: $('.episode-duration').text()
      },
      keywords: []
    };
  }
};

// Main content processor
export async function processContent(link: string, type: ContentType): Promise<ProcessedContent> {
  try {
    // Image processing
    if (type === 'IMAGE') {
      // Extract text from image
      const extractedText = await extractTextFromImage(link);
      
      // Analyze image content
      const analysis = await analyzeImage(link);

      return {
        extractedText,
        metadata: {
          type: 'IMAGE',
          aiTags: analysis.topics,
          imageLabels: analysis.labels,
          platform: 'image'
        },
        keywords: [...analysis.topics, ...analysis.labels]
      };
    }

    // Rest of the platform processing
    const url = new URL(link);
    const hostname = url.hostname.toLowerCase();

    // Video processing
    if (type === 'VIDEO') {
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        return await platformProcessors.youtube(link);
      }
      if (hostname.includes('vimeo.com')) {
        return await platformProcessors.vimeo(link);
      }
    }

    // Audio processing
    if (type === 'AUDIO') {
      if (hostname.includes('spotify.com')) {
        return await platformProcessors.spotify(link);
      }
      if (hostname.includes('soundcloud.com')) {
        return await platformProcessors.soundcloud(link);
      }
      if (hostname.includes('anchor.fm')) {
        return await platformProcessors.anchor(link);
      }
    }

    // Article processing
    if (type === 'ARTICLE') {
      const response = await fetch(link);
      const html = await response.text();
      const $ = cheerio.load(html);

      // Enhanced article extraction
      const articleData = {
        title: $('title').text(),
        description: $('meta[name="description"]').attr('content') || '',
        author: $('meta[name="author"]').attr('content'),
        publishDate: $('meta[property="article:published_time"]').attr('content'),
        siteName: $('meta[property="og:site_name"]').attr('content'),
        readingTime: calculateReadingTime($('article').text()),
        mainImage: $('meta[property="og:image"]').attr('content'),
        topics: extractTopics($)
      };

      return {
        extractedText: $('article').text(),
        metadata: articleData,
        keywords: extractKeywords($)
      };
    }

    // Default fallback
    return {
      extractedText: '',
      metadata: {
        url: link,
        type: type
      },
      keywords: []
    };

  } catch (error) {
    console.error('Error processing content:', error);
    return {
      extractedText: '',
      metadata: {
        error: 'Failed to process content',
        url: link
      },
      keywords: []
    };
  }
}

// Helper functions
function calculateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

function extractTopics($: ReturnType<typeof cheerio.load>): string[] {
  const topics: string[] = [];
  $('meta[property="article:tag"]').each((_, elem) => {
    topics.push($(elem).attr('content') || '');
  });
  return topics.filter(Boolean);
}

function extractKeywords($: ReturnType<typeof cheerio.load>): string[] {
  const keywords = new Set<string>();
  
  // Meta keywords
  const metaKeywords = $('meta[name="keywords"]').attr('content');
  if (metaKeywords) {
    metaKeywords.split(',').forEach(k => keywords.add(k.trim()));
  }

  // Extract from headings
  $('h1, h2, h3').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text) keywords.add(text);
  });

  // Extract from strong/bold text
  $('strong, b').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text) keywords.add(text);
  });

  return Array.from(keywords);
} 
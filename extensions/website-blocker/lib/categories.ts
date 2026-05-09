export interface Category {
  name: string
  domains: string[]
}

export const CATEGORIES: Category[] = [
  {
    name: 'Social Media',
    domains: [
      'facebook.com',
      'twitter.com',
      'x.com',
      'instagram.com',
      'tiktok.com',
      'snapchat.com',
      'linkedin.com',
      'pinterest.com',
      'threads.net',
    ],
  },
  {
    name: 'Video Streaming',
    domains: [
      'youtube.com',
      'netflix.com',
      'twitch.tv',
      'hulu.com',
      'disneyplus.com',
      'vimeo.com',
      'dailymotion.com',
    ],
  },
  {
    name: 'News & Forums',
    domains: [
      'reddit.com',
      'news.ycombinator.com',
      'bbc.com',
      'cnn.com',
      'nytimes.com',
      'theguardian.com',
    ],
  },
  {
    name: 'Gaming',
    domains: [
      'store.steampowered.com',
      'discord.com',
      'roblox.com',
      'epicgames.com',
      'twitch.tv',
    ],
  },
  {
    name: 'Shopping',
    domains: [
      'amazon.com',
      'ebay.com',
      'etsy.com',
      'walmart.com',
      'aliexpress.com',
    ],
  },
]

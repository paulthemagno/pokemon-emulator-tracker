import type { MetadataRoute } from 'next'

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
)

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL('/', siteUrl).toString(),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}

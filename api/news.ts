// api/news.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  const key = process.env.GNEWS_API_KEY; 
  if (!key) return res.status(500).json({ error: "API key not configured" });

  const upstream = await fetch(
    `https://gnews.io/api/v4/top-headlines?category=business&lang=en&country=us&max=9&apikey=${key}`,
  );

  const data = await upstream.json();
  res.setHeader("Cache-Control", "s-maxage=3600"); // edge-cache for 1 hr
  res.status(upstream.status).json(data);
}

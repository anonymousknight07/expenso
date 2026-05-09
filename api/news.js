
export default async function handler(req, res) {
  const key = process.env.GNEWS_API_KEY;

  if (!key) {
    return res.status(500).json({ error: "GNEWS_API_KEY not set" });
  }

  try {
    const upstream = await fetch(
      `https://gnews.io/api/v4/top-headlines?category=business&lang=en&country=us&max=9&apikey=${key}`,
    );
    const data = await upstream.json();
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

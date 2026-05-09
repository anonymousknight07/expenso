import { useState, useEffect } from "react";
import {
  Search,
  Clock,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "react-hot-toast";

interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  urlToImage?: string;
}

// ─── GNews cache helpers ────────────────────────────────────────────────────
const GNEWS_CACHE_KEY = "gnews_cache";
const GNEWS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface GNewsCache {
  country: string;
  articles: NewsItem[];
  fetchedAt: number;
}

const getGNewsCache = (country: string): NewsItem[] | null => {
  try {
    const raw = localStorage.getItem(GNEWS_CACHE_KEY);
    if (!raw) return null;
    const cache: GNewsCache = JSON.parse(raw);
    const stale = Date.now() - cache.fetchedAt > GNEWS_CACHE_TTL_MS;
    if (cache.country !== country || stale) return null;
    return cache.articles;
  } catch {
    return null;
  }
};

const setGNewsCache = (country: string, articles: NewsItem[]) => {
  try {
    const cache: GNewsCache = { country, articles, fetchedAt: Date.now() };
    localStorage.setItem(GNEWS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage quota — silently ignore
  }
};
// ────────────────────────────────────────────────────────────────────────────

const MarketNews = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsSearchQuery, setNewsSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    if (!import.meta.env.VITE_GNEWS_API_KEY) {
      console.warn("GNews API key not configured");
      return;
    }

    // Serve from cache when available (avoids burning daily quota)
    const cached = getGNewsCache("us");
    if (cached) {
      setNews(cached);
      return;
    }

    setLoading(true);
    setError(null);

    try {
     const response = await fetch("/api/news");

      if (response.status === 429) {
        const staleRaw = localStorage.getItem(GNEWS_CACHE_KEY);
        if (staleRaw) {
          const stale: GNewsCache = JSON.parse(staleRaw);
          if (stale.country === "us" && stale.articles.length) {
            setNews(stale.articles);
            toast("Showing cached news — GNews daily quota reached", {
              icon: "ℹ️",
            });
            return;
          }
        }
        setError("GNews daily quota reached. News will load again later.");
        return;
      }

      if (!response.ok) {
        throw new Error(`GNews HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.errors?.length) {
        console.error("GNews error:", data.errors);
        setError("Failed to fetch news.");
        return;
      }

      const articles: NewsItem[] = (data.articles ?? []).map((a: any) => ({
        title: a.title || "No title",
        description: a.description || "",
        url: a.url || "#",
        source: a.source?.name || "Unknown source",
        publishedAt: a.publishedAt || new Date().toISOString(),
        urlToImage: a.image || undefined,
      }));

      setNews(articles);
      setGNewsCache("us", articles);
    } catch (err) {
      console.error("Error fetching news:", err);
      setError("Failed to fetch news. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const filteredNews = news.filter(
    (a) =>
      newsSearchQuery === "" ||
      a.title.toLowerCase().includes(newsSearchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(newsSearchQuery.toLowerCase()),
  );

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-full overflow-x-hidden">
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              Market News
            </h2>
            <button
              onClick={fetchNews}
              disabled={loading}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
              title="Refresh news"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
            <input
              type="text"
              placeholder="Search news..."
              value={newsSearchQuery}
              onChange={(e) => setNewsSearchQuery(e.target.value)}
              className="pl-8 sm:pl-9 pr-4 py-2 border rounded text-xs sm:text-sm w-full sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse border rounded-lg overflow-hidden"
              >
                <div className="h-32 sm:h-48 bg-gray-200" />
                <div className="p-3 sm:p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-200 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm sm:text-base">
              No market news available at the moment
            </p>
            <p className="text-xs sm:text-sm">
              Try refreshing or check back later
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredNews.map((article, i) => (
              <div
                key={i}
                className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {article.urlToImage && (
                  <img
                    src={article.urlToImage}
                    alt={article.title}
                    className="w-full h-32 sm:h-48 object-cover"
                  />
                )}
                <div className="p-3 sm:p-4">
                  <h3 className="font-semibold mb-2 line-clamp-2 text-sm sm:text-base">
                    {article.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3 line-clamp-3">
                    {article.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span className="truncate flex-1 mr-2">
                      {article.source}
                    </span>
                    <span className="flex-shrink-0">
                      {new Date(article.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-yellow hover:text-yellow-600 text-xs sm:text-sm"
                  >
                    Read more <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketNews;

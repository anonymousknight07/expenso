import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useCurrency } from "../contexts/CurrencyContext";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Search,
  Globe,
  AlertTriangle,
  Share2,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Calendar,
  DollarSign,
  BarChart3,
  PieChart,
  FileSpreadsheet,
  File as FilePdf,
  ExternalLink,
  Clock,
  MapPin,
  Zap,
  Menu,
  X,
} from "lucide-react";
import Button from "../components/common/Button";
import { toast } from "react-hot-toast";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  high52Week?: number;
  low52Week?: number;
}

interface PortfolioItem {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  user_id: string;
}

interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  urlToImage?: string;
}

interface AIAnalysis {
  symbol: string;
  trend: "bullish" | "bearish" | "neutral";
  confidence: number;
  analysis: string;
  riskScore: number;
  recommendation: string;
  keyPoints: string[];
}

const COUNTRIES = [
  { code: "US", name: "United States", exchange: "NASDAQ/NYSE" },
  // { code: "IN", name: "India", exchange: "NSE/BSE" },
];

const TIMEFRAMES = [
  { label: "1D", value: "1day" },
  { label: "1W", value: "1week" },
  { label: "1M", value: "1month" },
  { label: "3M", value: "3months" },
  { label: "1Y", value: "1year" },
];

const COUNTRY_SYMBOLS: Record<string, string[]> = {
  US: [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "TSLA",
    "META",
    "NVDA",
    "JPM",
    "V",
    "JNJ",
  ],
  IN: [
    "RELIANCE.NS",
    "TCS.NS",
    "HDFCBANK.NS",
    "INFY.NS",
    "HINDUNILVR.NS",
    "ICICIBANK.NS",
    "SBIN.NS",
    "KOTAKBANK.NS",
    "AXISBANK.NS",
    "LT.NS",
  ],
};

// Function to generate stable colors based on stock symbol
const getColorForSymbol = (symbol: string) => {
  const colors = [
    "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
    "#FF9F40", "#8AC926", "#1982C4", "#6A4C93", "#F15BB5"
  ];
  const index = symbol.charCodeAt(0) % colors.length;
  return colors[index];
};

// Function to format dates properly
const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return "Unknown date";
  }
};

const StockMarket = () => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("US");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1day");
  const [loading, setLoading] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [showPortfolioValues, setShowPortfolioValues] = useState(true);
  const [newsSearchQuery, setNewsSearchQuery] = useState("");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [historicalData, setHistoricalData] = useState<Record<string, number[]>>({});
  const { currency } = useCurrency();

  // Add new state for error handling
  const [error, setError] = useState<string | null>(null);

  const [newPortfolioItem, setNewPortfolioItem] = useState({
    symbol: "",
    name: "",
    quantity: "",
    purchasePrice: "",
    purchaseDate: new Date().toISOString().split("T")[0],
  });

  const chartRef = useRef<HTMLDivElement>(null);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // Close mobile menus when switching to desktop
      if (window.innerWidth >= 768) {
        setShowMobileMenu(false);
        setShowMobileFilters(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    checkDisclaimerStatus();
    fetchPortfolio();
    if (disclaimerAccepted) {
      fetchStockData();
      fetchNews();
    }
  }, [selectedCountry, disclaimerAccepted]);

  // Fetch historical data when portfolio changes
  useEffect(() => {
    portfolio.forEach(item => {
      if (!historicalData[item.symbol]) {
        fetchHistoricalData(item.symbol);
      }
    });
  }, [portfolio]);

  const fetchHistoricalData = async (symbol: string) => {
    try {
      const response = await fetch(
        `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?serietype=line&apikey=${import.meta.env.VITE_FMP_API_KEY}`
      );
      const data = await response.json();
      if (data.historical) {
        // Take last 30 days of data for the chart
        const prices = data.historical
          .slice(0, 30)
          .reverse()
          .map((item: any) => item.close);
        setHistoricalData(prev => ({ ...prev, [symbol]: prices }));
      }
    } catch (error) {
      console.error("Error fetching historical data:", error);
    }
  };

  const checkDisclaimerStatus = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("user_preferences")
      .select("stock_disclaimer_accepted")
      .eq("user_id", user.id)
      .single();

    if (data?.stock_disclaimer_accepted) {
      setDisclaimerAccepted(true);
      setShowDisclaimer(false);
    }
  };

  const acceptDisclaimer = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("user_preferences").upsert({
      user_id: user.id,
      stock_disclaimer_accepted: true,
    });

    setDisclaimerAccepted(true);
    setShowDisclaimer(false);
    fetchStockData();
    fetchNews();
  };

  // Get current price for a symbol
  const getCurrentPrice = (symbol: string): number => {
    const stock = stocks.find((s) => s.symbol === symbol);
    return stock ? stock.price : 0;
  };

  // Fetch stock data from appropriate API based on country
  const fetchStockData = async () => {
    setLoading(true);
    setError(null);
    try {
      const symbols = COUNTRY_SYMBOLS[selectedCountry] || COUNTRY_SYMBOLS.US;

      if (selectedCountry === "IN") {
        // Use Indian Stock API for India
        const apiKey = import.meta.env.VITE_INDIAN_API_KEY;
        const baseUrl = import.meta.env.VITE_INDIAN_API_BASE_URL;
        
        const promises = symbols.map(async (symbol) => {
          const baseSymbol = symbol.replace('.BSE', ''); // Remove exchange suffix
          const response = await fetch(
            `${baseUrl}/stock?name=${baseSymbol}&apikey=${apiKey}`
          );
          if (!response.ok) {
            throw new Error(`Failed to fetch data for ${baseSymbol}`);
          }
          return response.json();
        });

        const data = await Promise.all(promises);
        
        const stocksData: Stock[] = data.map((item, index) => {
          const symbol = symbols[index];
          const price = item.currentPrice?.BSE || 0;
          const changePercent = item.percentChange || 0;
          
          // Calculate absolute change from percentage change
          const previousClose = price / (1 + (changePercent / 100));
          const change = price - previousClose;

          return {
            symbol,
            name: item.companyName || "Unknown",
            price,
            change,
            changePercent,
            volume: item.stockTechnicalData?.volume || 0,
            marketCap: item.keyMetrics?.marketCap,
            pe: item.keyMetrics?.peRatio,
            high52Week: item.yearHigh,
            low52Week: item.yearLow
          };
        });
        
        setStocks(stocksData);
        await fetchAIAnalysis(stocksData.slice(0, 3));
      } else {
        // Existing FMP API for other countries
        const symbolsParam = symbols.join(",");
        const response = await fetch(
          `https://financialmodelingprep.com/api/v3/quote/${symbolsParam}?apikey=${
            import.meta.env.VITE_FMP_API_KEY
          }`
        );

        const data = await response.json();

        // Check if we got an error response
        if (data["Error Message"]) {
          throw new Error(data["Error Message"]);
        }

        // Create a map for quick lookup
        const stockMap = new Map<string, any>();
        data.forEach((stock: any) => {
          stockMap.set(stock.symbol, stock);
        });

        // Process each symbol in order
        const stocksData: Stock[] = [];
        for (const symbol of symbols) {
          const stockData = stockMap.get(symbol);

          if (!stockData) {
            console.warn(`No data for ${symbol}`);
            continue;
          }

          const price = stockData.price;
          const prevClose = stockData.previousClose;
          const change = price - prevClose;
          const changePercent = (change / prevClose) * 100;

          stocksData.push({
            symbol,
            name: stockData.name,
            price,
            change,
            changePercent,
            volume: stockData.volume,
            marketCap: stockData.marketCap,
            pe: stockData.pe,
            high52Week: stockData.yearHigh,
            low52Week: stockData.yearLow,
          });
        }

        setStocks(stocksData);
        await fetchAIAnalysis(stocksData.slice(0, 3));
      }
    } catch (error: any) {
      console.error("Error fetching stock data:", error);
      setError("Failed to fetch stock data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch AI analysis from OpenRouter
  const fetchAIAnalysis = async (stocksToAnalyze: Stock[]) => {
    if (!import.meta.env.VITE_OPENROUTER_API_KEY) {
      console.warn("OpenRouter API key not configured");
      return;
    }

    try {
      const analyses: AIAnalysis[] = [];

      for (const stock of stocksToAnalyze) {
        try {
          const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${
                  import.meta.env.VITE_OPENROUTER_API_KEY
                }`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "deepseek/deepseek-r1-0528-qwen3-8b:free",
                messages: [
                  {
                    role: "user",
                    content: `
                  You are a financial analyst. Provide a concise analysis for ${
                    stock.symbol
                  } (${stock.name}) using this data:
                  - Price: ${stock.price} ${currency.code}
                  - Change: ${
                    stock.change >= 0 ? "+" : ""
                  }${stock.change.toFixed(2)} (${stock.changePercent.toFixed(
                      2
                    )}%)
                  - Market Cap: ${
                    stock.marketCap
                      ? (stock.marketCap / 1000000000).toFixed(2) + "B"
                      : "N/A"
                  } 
                  - P/E: ${stock.pe || "N/A"}
                  - 52W Range: ${stock.low52Week || "?"}-${
                      stock.high52Week || "?"
                    }
                  
                  Respond in JSON format with these keys:
                  symbol, trend (bullish/bearish/neutral), confidence (0-100), 
                  analysis (2-3 sentences), riskScore (0-100), 
                  recommendation (BUY/HOLD/SELL), keyPoints (array of 3 bullet points)
                  `,
                  },
                ],
                response_format: { type: "json_object" },
              }),
            }
          );

          const data = await response.json();
          const content = data.choices[0]?.message?.content;

          if (content) {
            try {
              const analysis = JSON.parse(content);
              analyses.push({
                symbol: stock.symbol,
                trend: analysis.trend || "neutral",
                confidence: analysis.confidence || 50,
                analysis: analysis.analysis || "Analysis unavailable",
                riskScore: analysis.riskScore || 50,
                recommendation: analysis.recommendation || "HOLD",
                keyPoints: analysis.keyPoints || [
                  "Market volatility",
                  "No key points available",
                  "Consult a financial advisor",
                ],
              });
            } catch (e) {
              console.error("Error parsing AI response:", e);
            }
          }
        } catch (error) {
          console.error("Error fetching AI analysis:", error);
        }
      }

      setAiAnalysis(analyses);
    } catch (error) {
      console.error("Error in AI analysis process:", error);
    }
  };

  // Fetch news from NewsAPI
  const fetchNews = async () => {
    if (!import.meta.env.VITE_NEWS_API_KEY) {
      console.warn("NewsAPI key not configured");
      return;
    }

    try {
      // Get country code and convert to lowercase
      const countryCode = selectedCountry.toLowerCase();

      const response = await fetch(
        `https://newsapi.org/v2/top-headlines?country=${countryCode}&category=business&apiKey=${
          import.meta.env.VITE_NEWS_API_KEY
        }`
      );

      const data = await response.json();

      if (data.status === "ok") {
        const articles = data.articles.map(
          (article: any): NewsItem => ({
            title: article.title || "No title",
            description: article.description || "",
            url: article.url || "#",
            source: article.source.name || "Unknown source",
            publishedAt: article.publishedAt || new Date().toISOString(),
            urlToImage: article.urlToImage || undefined,
          })
        );
        setNews(articles);
      } else {
        console.error("NewsAPI error:", data.message);
        setError("Failed to fetch news. Using cached data.");
      }
    } catch (error) {
      console.error("Error fetching news:", error);
      setError("Failed to fetch news. Using cached data.");
    }
  };

  const fetchPortfolio = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("stock_portfolio")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching portfolio:", error);
      return;
    }

    setPortfolio(data || []);
  };

  const addToPortfolio = async (e: React.FormEvent) => {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("stock_portfolio").insert([
      {
        symbol: newPortfolioItem.symbol.toUpperCase(),
        name: newPortfolioItem.name,
        quantity: parseFloat(newPortfolioItem.quantity),
        purchase_price: parseFloat(newPortfolioItem.purchasePrice),
        purchase_date: new Date(newPortfolioItem.purchaseDate).toISOString(), // Fix date format
        user_id: user.id,
      },
    ]);

    if (error) {
      console.error("Error adding to portfolio:", error);
      toast.error("Failed to add stock to portfolio");
      return;
    }

    setNewPortfolioItem({
      symbol: "",
      name: "",
      quantity: "",
      purchasePrice: "",
      purchaseDate: new Date().toISOString().split("T")[0],
    });
    setIsAddingStock(false);
    fetchPortfolio();
    toast.success("Stock added to portfolio!");
  };

  const removeFromPortfolio = async (id: string) => {
    const { error } = await supabase
      .from("stock_portfolio")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error removing from portfolio:", error);
      toast.error("Failed to remove stock from portfolio");
      return;
    }

    fetchPortfolio();
    toast.success("Stock removed from portfolio");
  };

  const calculatePortfolioValue = () => {
    return portfolio.reduce((total, item) => {
      const currentPrice = getCurrentPrice(item.symbol) || 0;
      return total + currentPrice * item.quantity;
    }, 0);
  };

  const calculatePortfolioPnL = () => {
    return portfolio.reduce((total, item) => {
      const currentPrice = getCurrentPrice(item.symbol) || 0;
      const currentValue = currentPrice * item.quantity;
      const purchaseValue = item.purchasePrice * item.quantity;
      return total + (currentValue - purchaseValue);
    }, 0);
  };

  const getPortfolioChartData = () => {
    const portfolioData = portfolio.map((item) => {
      const currentPrice = getCurrentPrice(item.symbol) || 0;
      return {
        symbol: item.symbol,
        value: currentPrice * item.quantity,
        color: getColorForSymbol(item.symbol), // Stable colors
      };
    });

    return {
      labels: portfolioData.map((item) => item.symbol),
      datasets: [
        {
          data: portfolioData.map((item) => item.value),
          backgroundColor: portfolioData.map((item) => item.color),
        },
      ],
    };
  };

  const exportPortfolio = (format: "excel" | "pdf") => {
    if (format === "excel") {
      const workbook = XLSX.utils.book_new();
      const portfolioData = portfolio.map((item) => {
        const currentPrice = getCurrentPrice(item.symbol) || 0;
        const currentValue = currentPrice * item.quantity;
        const purchaseValue = item.purchasePrice * item.quantity;
        const pnl = currentValue - purchaseValue;
        const pnlPercent = (pnl / purchaseValue) * 100;

        return {
          Symbol: item.symbol,
          Name: item.name,
          Quantity: item.quantity,
          "Purchase Price": `${currency.symbol}${item.purchasePrice.toFixed(
            2
          )}`,
          "Current Price": `${currency.symbol}${currentPrice.toFixed(2)}`,
          "Purchase Value": `${currency.symbol}${purchaseValue.toFixed(2)}`,
          "Current Value": `${currency.symbol}${currentValue.toFixed(2)}`,
          "P&L": `${currency.symbol}${pnl.toFixed(2)}`,
          "P&L %": `${pnlPercent.toFixed(2)}%`,
          "Purchase Date": formatDate(item.purchaseDate),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(portfolioData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Portfolio");
      XLSX.writeFile(workbook, "Stock_Portfolio.xlsx");
    } else {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("Stock Portfolio Report", 20, 20);

      let yPos = 40;
      portfolio.forEach((item) => {
        const currentPrice = getCurrentPrice(item.symbol) || 0;
        const currentValue = currentPrice * item.quantity;
        const purchaseValue = item.purchasePrice * item.quantity;
        const pnl = currentValue - purchaseValue;

        doc.setFontSize(12);
        doc.text(`${item.symbol} - ${item.name}`, 20, yPos);
        doc.text(
          `Qty: ${item.quantity} | P&L: ${currency.symbol}${pnl.toFixed(2)}`,
          20,
          yPos + 10
        );
        yPos += 25;

        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
      });

      doc.save("Stock_Portfolio.pdf");
    }
    toast.success(`Portfolio exported as ${format.toUpperCase()}`);
  };

  const sharePortfolio = (platform: "twitter" | "linkedin" | "email") => {
    const portfolioValue = calculatePortfolioValue();
    const pnl = calculatePortfolioPnL();
    const pnlPercent = ((pnl / (portfolioValue - pnl)) * 100 || 0).toFixed(2);

    const message = `My stock portfolio is ${
      pnl >= 0 ? "up" : "down"
    } ${Math.abs(parseFloat(pnlPercent))}% with a total value of ${
      currency.symbol
    }${portfolioValue.toFixed(2)}! 📈 #StockMarket #Investing`;

    if (platform === "twitter") {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`
      );
    } else if (platform === "linkedin") {
      window.open(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
          window.location.href
        )}&summary=${encodeURIComponent(message)}`
      );
    } else {
      window.location.href = `mailto:?subject=My Stock Portfolio&body=${encodeURIComponent(
        message
      )}`;
    }
  };

  const filteredStocks = stocks.filter(
    (stock) =>
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredNews = news.filter(
    (article) =>
      newsSearchQuery === "" ||
      article.title.toLowerCase().includes(newsSearchQuery.toLowerCase()) ||
      article.description.toLowerCase().includes(newsSearchQuery.toLowerCase())
  );

  if (showDisclaimer) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="text-center mb-6">
            <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
              Investment Risk Disclaimer
            </h1>
          </div>

          <div className="space-y-4 text-gray-600 mb-6">
            <p className="font-semibold text-red-600 text-sm sm:text-base">
              ⚠️ IMPORTANT: Please read carefully before proceeding
            </p>

            <div className="bg-red-50 p-3 sm:p-4 rounded-lg border border-red-200">
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  • <strong>Not Financial Advice:</strong> All information
                  provided is for educational purposes only and should not be
                  considered as financial advice.
                </li>
                <li>
                  • <strong>Risk of Loss:</strong> Stock investments carry
                  significant risk of loss. You may lose some or all of your
                  invested capital.
                </li>
                <li>
                  • <strong>Past Performance:</strong> Historical performance
                  does not guarantee future results.
                </li>
                <li>
                  • <strong>AI Analysis:</strong> AI-generated insights are
                  experimental and should not be the sole basis for investment
                  decisions.
                </li>
                <li>
                  • <strong>Consult Professionals:</strong> Always consult with
                  qualified financial advisors before making investment
                  decisions.
                </li>
                <li>
                  • <strong>Your Responsibility:</strong> You are solely
                  responsible for your investment decisions and their outcomes.
                </li>
              </ul>
            </div>

            <p className="text-xs sm:text-sm">
              By proceeding, you acknowledge that you understand these risks and
              that Expenso is not liable for any investment losses you may
              incur.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={disclaimerAccepted}
                onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                className="w-4 h-4 sm:w-5 sm:h-5 text-yellow focus:ring-yellow border-gray-300 rounded mt-0.5 flex-shrink-0"
              />
              <span className="text-xs sm:text-sm text-gray-700">
                I understand and accept the risks associated with stock market
                investments
              </span>
            </label>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button
                onClick={acceptDisclaimer}
                disabled={!disclaimerAccepted}
                variant="primary"
                className="flex-1 text-sm sm:text-base"
              >
                Accept & Continue
              </Button>
              <Button
                onClick={() => window.history.back()}
                variant="outline"
                className="flex-1 text-sm sm:text-base"
              >
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-full overflow-x-hidden">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 flex-wrap">
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 flex-shrink-0" />
                <span className="break-words">Stock Market</span>
              </h1>
              <p className="text-gray-600 mt-2 text-sm sm:text-base">
                Track stocks, manage your portfolio, and get AI-powered insights
              </p>
            </div>

            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden bg-gray-100 p-2 rounded-lg"
            >
              {showMobileMenu ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

          <div
            className={`flex flex-col gap-3 ${
              showMobileMenu ? "flex" : "hidden md:flex"
            }`}
          >
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="flex-1 px-2 sm:px-3 py-2 border rounded text-xs sm:text-sm min-w-0"
                >
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {isMobile
                        ? country.code
                        : `${country.name} (${country.exchange})`}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={() => {
                  fetchStockData();
                  fetchNews();
                }}
                variant="outline"
                disabled={loading}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>

            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="md:hidden bg-gray-100 p-2 rounded-lg text-sm"
            >
              {showMobileFilters ? "Hide Filters" : "Show Filters"}
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div
          className={`grid grid-cols-1 gap-4 ${
            showMobileFilters || !isMobile ? "block" : "hidden"
          }`}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder="Search stocks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-4 py-2 border rounded-lg text-sm sm:text-base"
            />
          </div>

          <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-2">
            {TIMEFRAMES.map((timeframe) => (
              <button
                key={timeframe.value}
                onClick={() => setSelectedTimeframe(timeframe.value)}
                className={`px-2 sm:px-3 py-2 rounded text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                  selectedTimeframe === timeframe.value
                    ? "bg-yellow text-black"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {timeframe.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stock List and AI Analysis */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8">
        <div className="xl:col-span-2">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">
              Market Overview
            </h2>

            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-12 sm:h-16 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {filteredStocks.map((stock) => (
                  <div
                    key={stock.symbol}
                    className="flex items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm sm:text-base truncate">
                            {stock.symbol}
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-600 truncate">
                            {stock.name}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="font-semibold text-sm sm:text-base">
                        ${stock.price.toFixed(2)}
                      </p>
                      <div
                        className={`flex items-center gap-1 text-xs sm:text-sm ${
                          stock.change >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {stock.change >= 0 ? (
                          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                        ) : (
                          <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />
                        )}
                        <span className="whitespace-nowrap">
                          {stock.change >= 0 ? "+" : ""}
                          {stock.change.toFixed(2)} (
                          {stock.changePercent.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Analysis */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-yellow" />
            AI Analysis
          </h2>

          <div className="space-y-4">
            {aiAnalysis.map((analysis) => (
              <div
                key={analysis.symbol}
                className="border rounded-lg p-3 sm:p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm sm:text-base">
                    {analysis.symbol}
                  </h3>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      analysis.trend === "bullish"
                        ? "bg-green-100 text-green-800"
                        : analysis.trend === "bearish"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {analysis.trend.toUpperCase()}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-gray-600 mb-3">
                  {analysis.analysis}
                </p>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span>Confidence:</span>
                    <span className="font-medium">
                      {analysis.confidence.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span>Risk Score:</span>
                    <span
                      className={`font-medium ${
                        analysis.riskScore < 40
                          ? "text-green-600"
                          : analysis.riskScore < 70
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {analysis.riskScore.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span>Recommendation:</span>
                    <span className="font-medium">
                      {analysis.recommendation}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-2">Key Points:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {analysis.keyPoints.map((point, index) => (
                      <li key={index}>• {point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Portfolio Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8">
        <div className="xl:col-span-2">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                  <PieChart className="w-4 h-4 sm:w-5 sm:h-5" />
                  My Portfolio
                </h2>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPortfolioValues(!showPortfolioValues)}
                    className="p-2 text-gray-500 hover:text-gray-700"
                  >
                    {showPortfolioValues ? (
                      <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <div className="flex gap-2">
                  <Button
                    onClick={() => sharePortfolio("twitter")}
                    variant="outline"
                    className="text-xs sm:text-sm flex-1 sm:flex-none"
                  >
                    <Share2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Share
                  </Button>

                  <div className="relative group">
                    <Button variant="outline" className="text-xs sm:text-sm">
                      <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      Export
                    </Button>
                    <div className="absolute right-0 mt-2 w-28 sm:w-32 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <button
                        onClick={() => exportPortfolio("excel")}
                        className="w-full px-3 sm:px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-xs sm:text-sm"
                      >
                        <FileSpreadsheet className="w-3 h-3 sm:w-4 sm:h-4" />
                        Excel
                      </button>
                      <button
                        onClick={() => exportPortfolio("pdf")}
                        className="w-full px-3 sm:px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-xs sm:text-sm"
                      >
                        <FilePdf className="w-3 h-3 sm:w-4 sm:h-4" />
                        PDF
                      </button>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setIsAddingStock(true)}
                  variant="primary"
                  className="text-xs sm:text-sm flex-1 sm:flex-none"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  Add Stock
                </Button>
              </div>
            </div>

            {/* Portfolio Summary */}
            {portfolio.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                  <h3 className="text-xs sm:text-sm font-medium text-green-800 mb-1">
                    Total Value
                  </h3>
                  <p className="text-lg sm:text-2xl font-bold text-green-600 break-all">
                    {showPortfolioValues
                      ? `${currency.symbol}${calculatePortfolioValue().toFixed(
                          2
                        )}`
                      : "••••••"}
                  </p>
                </div>

                <div
                  className={`p-3 sm:p-4 rounded-lg ${
                    calculatePortfolioPnL() >= 0 ? "bg-green-50" : "bg-red-50"
                  }`}
                >
                  <h3
                    className={`text-xs sm:text-sm font-medium mb-1 ${
                      calculatePortfolioPnL() >= 0
                        ? "text-green-800"
                        : "text-red-800"
                    }`}
                  >
                    Total P&L
                  </h3>
                  <p
                    className={`text-lg sm:text-2xl font-bold break-all ${
                      calculatePortfolioPnL() >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {showPortfolioValues ? (
                      <>
                        {calculatePortfolioPnL() >= 0 ? "+" : ""}
                        {currency.symbol}
                        {calculatePortfolioPnL().toFixed(2)}
                      </>
                    ) : (
                      "••••••"
                    )}
                  </p>
                </div>

                <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                  <h3 className="text-xs sm:text-sm font-medium text-blue-800 mb-1">
                    Holdings
                  </h3>
                  <p className="text-lg sm:text-2xl font-bold text-blue-600">
                    {portfolio.length}
                  </p>
                </div>
              </div>
            )}

            {/* Portfolio Holdings */}
            <div className="space-y-3 sm:space-y-4">
              {portfolio.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-gray-500">
                  <PieChart className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">
                    No stocks in your portfolio yet
                  </p>
                  <p className="text-xs sm:text-sm">
                    Add your first stock to get started
                  </p>
                </div>
              ) : (
                portfolio.map((item) => {
                  const currentPrice = getCurrentPrice(item.symbol) || 0;
                  const quantity = Number(item.quantity);
                  const purchasePrice = Number(item.purchasePrice);
                  const currentValue = currentPrice * quantity;
                  const purchaseValue = purchasePrice * quantity;
                  const pnl = currentValue - purchaseValue;
                  const pnlPercent = purchaseValue > 0 ? (pnl / purchaseValue) * 100 : 0;

                  return (
                    <div
                      key={item.id}
                      className="border rounded-lg overflow-hidden"
                    >
                      <div className="flex items-center justify-between p-3 sm:p-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-sm sm:text-base truncate">
                                {item.symbol}
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-600 truncate">
                                {item.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {item.quantity} shares • Bought on{" "}
                                {formatDate(item.purchaseDate)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="text-right mr-2 sm:mr-4 flex-shrink-0">
                          {showPortfolioValues ? (
                            <>
                              <p className="font-semibold text-sm sm:text-base">
                                {currency.symbol}
                                {currentValue.toFixed(2)}
                              </p>
                              <div
                                className={`text-xs sm:text-sm ${
                                  pnl >= 0 ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {pnl >= 0 ? "+" : ""}
                                {currency.symbol}
                                {pnl.toFixed(2)} ({pnlPercent.toFixed(2)}%)
                              </div>
                              <p className="text-xs text-gray-500">
                                {currency.symbol}
                                {currentPrice.toFixed(2)} per share
                              </p>
                            </>
                          ) : (
                            <div className="space-y-1">
                              <p className="font-semibold text-sm sm:text-base">
                                ••••••
                              </p>
                              <p className="text-xs sm:text-sm text-gray-500">
                                ••••••
                              </p>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => removeFromPortfolio(item.id)}
                          className="text-red-500 hover:text-red-600 p-1 sm:p-2 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                      
                      {/* Stock performance chart */}
                      {historicalData[item.symbol] && (
                        <div className="h-20 p-2">
                          <Line
                            data={{
                              labels: historicalData[item.symbol].map((_, i) => i + 1),
                              datasets: [{
                                data: historicalData[item.symbol],
                                borderColor: getColorForSymbol(item.symbol),
                                tension: 0.3,
                                fill: false,
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: { 
                                legend: { display: false },
                                tooltip: { enabled: false }
                              },
                              scales: { 
                                x: { display: false },
                                y: { display: false }
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Portfolio Chart */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-4">
            Portfolio Allocation
          </h3>

          {portfolio.length > 0 ? (
            <div className="h-48 sm:h-64">
              <Pie
                data={getPortfolioChartData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: {
                        boxWidth: isMobile ? 8 : 12,
                        font: { size: isMobile ? 8 : 10 },
                      },
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const value = context.parsed;
                          return `${context.label}: ${
                            currency.symbol
                          }${value.toFixed(2)}`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <div className="h-48 sm:h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <PieChart className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
                <p className="text-xs sm:text-sm">
                  Add stocks to see allocation
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* News Section */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            Market News
          </h2>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
            <input
              type="text"
              placeholder="Search news..."
              value={newsSearchQuery}
              onChange={(e) => setNewsSearchQuery(e.target.value)}
              className="pl-8 sm:pl-9 pr-4 py-2 border rounded text-xs sm:text-sm w-full sm:w-64"
            />
          </div>
        </div>

        {news.length === 0 ? (
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
            {filteredNews.map((article, index) => (
              <div
                key={index}
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

      {/* Add Stock Modal */}
      {isAddingStock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-4 sm:p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold mb-4">
              Add Stock to Portfolio
            </h2>

            <form onSubmit={addToPortfolio} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Stock Symbol
                </label>
                <input
                  type="text"
                  value={newPortfolioItem.symbol}
                  onChange={(e) =>
                    setNewPortfolioItem({
                      ...newPortfolioItem,
                      symbol: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full px-3 py-2 border rounded text-sm sm:text-base"
                  placeholder="AAPL"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={newPortfolioItem.name}
                  onChange={(e) =>
                    setNewPortfolioItem({
                      ...newPortfolioItem,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded text-sm sm:text-base"
                  placeholder="Apple Inc."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newPortfolioItem.quantity}
                  onChange={(e) =>
                    setNewPortfolioItem({
                      ...newPortfolioItem,
                      quantity: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded text-sm sm:text-base"
                  placeholder="10"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Purchase Price ({currency.symbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newPortfolioItem.purchasePrice}
                  onChange={(e) =>
                    setNewPortfolioItem({
                      ...newPortfolioItem,
                      purchasePrice: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded text-sm sm:text-base"
                  placeholder="150.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={newPortfolioItem.purchaseDate}
                  onChange={(e) =>
                    setNewPortfolioItem({
                      ...newPortfolioItem,
                      purchaseDate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded text-sm sm:text-base"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4 pt-4">
                <Button
                  onClick={() => setIsAddingStock(false)}
                  variant="outline"
                  className="w-full sm:w-auto text-sm sm:text-base"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full sm:w-auto text-sm sm:text-base"
                >
                  Add to Portfolio
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockMarket;
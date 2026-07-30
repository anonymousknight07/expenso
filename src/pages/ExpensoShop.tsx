import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  ShoppingBag,
  Sparkles,
  Palette,
  Shield,
  Crown,
  CheckCircle2,
  Lock,
  Coins,
  Flame,
  Zap,
} from "lucide-react";
import { toast } from "react-hot-toast";

export interface ShopItem {
  id: string;
  name: string;
  category: "frame" | "theme" | "title";
  price: number;
  description: string;
  iconName?: string;
  previewClass?: string;
  themeValue?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  // ── Avatar Frames ───────────────────────────────────────────
  {
    id: "frame_default",
    name: "Default Border",
    category: "frame",
    price: 0,
    description: "Standard clean border for your profile avatar.",
    previewClass: "border-2 border-white/20",
  },
  {
    id: "frame_neon",
    name: "Neon Glow",
    category: "frame",
    price: 50,
    description: "Electric cyan and pink glowing aura ring.",
    previewClass: "border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]",
  },
  {
    id: "frame_gold",
    name: "Golden Vault",
    category: "frame",
    price: 100,
    description: "Radiant 24k metallic gold vault frame.",
    previewClass: "border-2 border-yellow shadow-[0_0_18px_rgba(234,179,8,0.7)]",
  },
  {
    id: "frame_crypto",
    name: "Crypto Crown",
    category: "frame",
    price: 200,
    description: "Royal purple and gold animated gradient halo.",
    previewClass: "border-2 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.8)]",
  },

  // ── Custom Themes ───────────────────────────────────────────
  {
    id: "theme_default",
    name: "Cyberpunk Dark",
    category: "theme",
    price: 0,
    description: "Original dark glassmorphism aesthetic with amber highlights.",
    themeValue: "dark",
    previewClass: "bg-slate-900 border-yellow/40",
  },
  {
    id: "theme_retro",
    name: "Retro Arcade",
    category: "theme",
    price: 150,
    description: "80s synthwave neon magenta and deep purple vibe.",
    themeValue: "retro",
    previewClass: "bg-fuchsia-950 border-fuchsia-500/50",
  },
  {
    id: "theme_emerald",
    name: "Emerald Gold",
    category: "theme",
    price: 250,
    description: "Luxurious deep emerald green and polished gold accents.",
    themeValue: "emerald",
    previewClass: "bg-emerald-950 border-emerald-400/50",
  },
  {
    id: "theme_purple",
    name: "Midnight Purple",
    category: "theme",
    price: 300,
    description: "Royal indigo and amethyst dark glassmorphic elegance.",
    themeValue: "purple",
    previewClass: "bg-indigo-950 border-purple-400/50",
  },

  // ── Custom Rank Titles ──────────────────────────────────────
  {
    id: "title_ninja",
    name: "Budget Ninja 🥷",
    category: "title",
    price: 75,
    description: "Silent, disciplined, and cuts expenses in the dark.",
  },
  {
    id: "title_slayer",
    name: "Impulse Slayer ⚔️",
    category: "title",
    price: 125,
    description: "Slays unnecessary purchases before they hit the ledger.",
  },
  {
    id: "title_alchemist",
    name: "Wealth Alchemist 🧪",
    category: "title",
    price: 250,
    description: "Transmutes monthly savings into compounding investments.",
  },
  {
    id: "title_diamond",
    name: "Diamond Saver 💎",
    category: "title",
    price: 500,
    description: "Unbreakable financial discipline under any market pressure.",
  },
];

export function applyAppTheme(themeValue: string) {
  if (themeValue === "dark" || !themeValue) {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", themeValue);
  }
}

const ExpensoShop = () => {
  const [loading, setLoading] = useState(true);
  const [userCoins, setUserCoins] = useState(0);
  const [userXp, setUserXp] = useState(0);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [unlockedItems, setUnlockedItems] = useState<string[]>([
    "frame_default",
    "theme_default",
  ]);
  const [equippedFrame, setEquippedFrame] = useState("frame_default");
  const [equippedTheme, setEquippedTheme] = useState("theme_default");
  const [equippedTitle, setEquippedTitle] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"frame" | "theme" | "title">("frame");
  const [userId, setUserId] = useState<string | null>(null);

  const loadShopData = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    // Fetch user profile for XP and avatar
    const { data: profile } = await supabase
      .from("profiles")
      .select("xp, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    const xp = profile?.xp || 0;
    setUserXp(xp);
    if (profile?.avatar_url) setUserAvatar(profile.avatar_url);

    // Load local shop storage
    const storageKey = `expenso_shop_${user.id}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setUnlockedItems(parsed.unlockedItems || ["frame_default", "theme_default"]);
        setEquippedFrame(parsed.equippedFrame || "frame_default");
        setEquippedTheme(parsed.equippedTheme || "theme_default");
        setEquippedTitle(parsed.equippedTitle || null);
        setUserCoins(parsed.coins !== undefined ? parsed.coins : xp + 100);

        if (parsed.equippedTheme) {
          const t = SHOP_ITEMS.find((i) => i.id === parsed.equippedTheme);
          if (t?.themeValue) applyAppTheme(t.themeValue);
        }
      } else {
        // Initial grant: XP + 100 bonus starting coins
        const initialCoins = xp + 100;
        setUserCoins(initialCoins);
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            unlockedItems: ["frame_default", "theme_default"],
            equippedFrame: "frame_default",
            equippedTheme: "theme_default",
            equippedTitle: null,
            coins: initialCoins,
          })
        );
      }
    } catch (e) {
      console.error("Shop storage error:", e);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadShopData();
  }, []);

  const saveShopState = (updated: any) => {
    if (!userId) return;
    const storageKey = `expenso_shop_${userId}`;
    const payload = {
      unlockedItems,
      equippedFrame,
      equippedTheme,
      equippedTitle,
      coins: userCoins,
      ...updated,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  };

  const handlePurchase = (item: ShopItem) => {
    if (userCoins < item.price) {
      toast.error(`Not enough coins! Need ${item.price - userCoins} more coins.`);
      return;
    }

    const newCoins = userCoins - item.price;
    const newUnlocked = [...unlockedItems, item.id];
    setUserCoins(newCoins);
    setUnlockedItems(newUnlocked);

    let newEquippedFrame = equippedFrame;
    let newEquippedTheme = equippedTheme;
    let newEquippedTitle = equippedTitle;

    if (item.category === "frame") newEquippedFrame = item.id;
    if (item.category === "theme") {
      newEquippedTheme = item.id;
      if (item.themeValue) applyAppTheme(item.themeValue);
    }
    if (item.category === "title") newEquippedTitle = item.name;

    if (item.category === "frame") setEquippedFrame(newEquippedFrame);
    if (item.category === "theme") setEquippedTheme(newEquippedTheme);
    if (item.category === "title") setEquippedTitle(newEquippedTitle);

    saveShopState({
      coins: newCoins,
      unlockedItems: newUnlocked,
      equippedFrame: newEquippedFrame,
      equippedTheme: newEquippedTheme,
      equippedTitle: newEquippedTitle,
    });

    toast.success(`Unlocked & Equipped: ${item.name}! 🎉`);
  };

  const handleEquip = (item: ShopItem) => {
    if (item.category === "frame") {
      setEquippedFrame(item.id);
      saveShopState({ equippedFrame: item.id });
    } else if (item.category === "theme") {
      setEquippedTheme(item.id);
      if (item.themeValue) applyAppTheme(item.themeValue);
      saveShopState({ equippedTheme: item.id });
    } else if (item.category === "title") {
      setEquippedTitle(item.name);
      saveShopState({ equippedTitle: item.name });
    }
    toast.success(`Equipped ${item.name}!`);
  };

  const filteredItems = SHOP_ITEMS.filter((i) => i.category === activeTab);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-yellow/20 bg-gradient-to-r from-amber-950/40 via-purple-950/40 to-slate-900/60 p-6 md:p-8 backdrop-blur-xl shadow-2xl mb-8">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-gradient-to-r from-yellow to-amber-500 text-black shadow-lg">
                Financial RPG Shop ⚔️
              </span>
              {equippedTitle && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-yellow border border-white/10">
                  Active Title: {equippedTitle}
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Expenso Gear & Cosmetics
            </h1>
            <p className="text-gray-300 text-sm max-w-xl mt-1">
              Convert your hard-earned XP into Expenso Coins! Unlock neon avatar frames, custom dark themes, and prestigious rank titles.
            </p>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            {/* Coins Balance Card */}
            <div className="glass-card p-4 border-yellow/30 bg-yellow/10 flex items-center gap-3 flex-1 md:flex-initial min-w-[200px]">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow to-amber-500 flex items-center justify-center text-black font-extrabold text-xl shadow-lg shadow-yellow/30">
                🪙
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400">Expenso Coins</p>
                <p className="text-2xl font-extrabold text-white">{userCoins}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Toolbar */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { id: "frame", label: "Avatar Frames", icon: Shield },
          { id: "theme", label: "Custom App Themes", icon: Palette },
          { id: "title", label: "Rank Titles", icon: Crown },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all border ${
                activeTab === tab.id
                  ? "bg-yellow/20 border-yellow text-white shadow-lg shadow-yellow/10"
                  : "bg-white/[0.04] border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Grid of Items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredItems.map((item) => {
          const isUnlocked = unlockedItems.includes(item.id);
          const isEquipped =
            (item.category === "frame" && equippedFrame === item.id) ||
            (item.category === "theme" && equippedTheme === item.id) ||
            (item.category === "title" && equippedTitle === item.name);

          return (
            <div
              key={item.id}
              className={`glass-card p-5 relative overflow-hidden flex flex-col justify-between border transition-all duration-300 ${
                isEquipped
                  ? "border-yellow bg-yellow/10 shadow-xl shadow-yellow/10"
                  : isUnlocked
                  ? "border-white/20 bg-white/[0.03]"
                  : "border-white/10 bg-white/[0.01]"
              }`}
            >
              <div>
                {/* Status Pill */}
                <div className="flex justify-between items-center mb-4">
                  {isEquipped ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Equipped
                    </span>
                  ) : isUnlocked ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Unlocked
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white/10 text-gray-400 border border-white/10 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}

                  <div className="flex items-center gap-1 text-xs font-bold text-yellow">
                    <span>{item.price === 0 ? "FREE" : `${item.price} 🪙`}</span>
                  </div>
                </div>

                {/* Visual Preview */}
                <div className="my-4 text-center">
                  {item.category === "frame" && (
                    <div className="relative inline-block">
                      <img
                        src={userAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face"}
                        alt="Avatar Preview"
                        className={`w-20 h-20 rounded-full object-cover mx-auto transition-all ${item.previewClass}`}
                      />
                    </div>
                  )}

                  {item.category === "theme" && (
                    <div
                      className={`w-full h-20 rounded-xl mx-auto flex items-center justify-center border ${item.previewClass}`}
                    >
                      <Palette className="w-8 h-8 text-yellow" />
                    </div>
                  )}

                  {item.category === "title" && (
                    <div className="py-4 glass-inset rounded-xl border border-white/10">
                      <p className="text-base font-extrabold text-yellow">{item.name}</p>
                    </div>
                  )}
                </div>

                <h3 className="font-bold text-white text-base text-center mt-2">
                  {item.name}
                </h3>
                <p className="text-xs text-gray-400 text-center mt-1">
                  {item.description}
                </p>
              </div>

              {/* Action Button */}
              <div className="mt-5">
                {isEquipped ? (
                  <button
                    disabled
                    className="w-full py-2 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30 cursor-default"
                  >
                    Active Gear
                  </button>
                ) : isUnlocked ? (
                  <button
                    onClick={() => handleEquip(item)}
                    className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors border border-white/10"
                  >
                    Equip Now
                  </button>
                ) : (
                  <button
                    onClick={() => handlePurchase(item)}
                    disabled={userCoins < item.price}
                    className={`w-full py-2 rounded-xl font-extrabold text-xs transition-all shadow-md ${
                      userCoins >= item.price
                        ? "bg-gradient-to-r from-yellow to-amber-500 text-black hover:brightness-110 shadow-yellow/20"
                        : "bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed"
                    }`}
                  >
                    Unlock for {item.price} 🪙
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExpensoShop;

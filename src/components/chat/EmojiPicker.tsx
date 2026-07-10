import { useState } from "react";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

const EMOJI_CATEGORIES = {
  Smileys: [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "😂",
    "🤣",
    "😊",
    "😇",
    "🙂",
    "🙃",
    "😉",
    "😌",
    "😍",
    "🥰",
    "😘",
    "😗",
    "😙",
    "😚",
    "😋",
    "😛",
    "😝",
    "😜",
    "🤪",
    "🤨",
    "🧐",
    "🤓",
    "😎",
    "🤩",
    "🥳",
  ],
  Gestures: [
    "👍",
    "👎",
    "👌",
    "🤌",
    "🤏",
    "✌️",
    "🤞",
    "🤟",
    "🤘",
    "🤙",
    "👈",
    "👉",
    "👆",
    "🖕",
    "👇",
    "☝️",
    "👏",
    "🙌",
    "👐",
    "🤲",
    "🤝",
    "🙏",
  ],
  Hearts: [
    "❤️",
    "🧡",
    "💛",
    "💚",
    "💙",
    "💜",
    "🖤",
    "🤍",
    "🤎",
    "💔",
    "❣️",
    "💕",
    "💞",
    "💓",
    "💗",
    "💖",
    "💘",
    "💝",
  ],
  Objects: [
    "💰",
    "💸",
    "💳",
    "💎",
    "⚖️",
    "🏆",
    "🎯",
    "📊",
    "📈",
    "📉",
    "💼",
    "📱",
    "💻",
    "🖥️",
    "⌨️",
    "🖱️",
    "🖨️",
    "📞",
    "☎️",
  ],
  Food: [
    "🍎",
    "🍊",
    "🍋",
    "🍌",
    "🍉",
    "🍇",
    "🍓",
    "🫐",
    "🍈",
    "🍒",
    "🍑",
    "🥭",
    "🍍",
    "🥥",
    "🥝",
    "🍅",
    "🍆",
    "🥑",
    "🥦",
    "🥬",
    "🥒",
    "🌶️",
    "🫑",
    "🌽",
    "🥕",
    "🫒",
    "🧄",
    "🧅",
    "🥔",
    "🍠",
  ],
};

const EmojiPicker = ({ onEmojiSelect }: EmojiPickerProps) => {
  const [activeCategory, setActiveCategory] = useState("Smileys");

  return (
    <div className="bg-[#16171d] border border-white/10 rounded-lg shadow-lg p-3 w-80">
      {/* Category Tabs */}
      <div className="flex gap-1 mb-3 border-b border-white/10 pb-2">
        {Object.keys(EMOJI_CATEGORIES).map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              activeCategory === category
                ? "bg-yellow text-white"
                : "text-gray-300 hover:bg-white/10"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
        {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map(
          (emoji) => (
            <button
              key={emoji}
              onClick={() => onEmojiSelect(emoji)}
              className="p-2 text-lg hover:bg-white/10 rounded transition-colors"
            >
              {emoji}
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default EmojiPicker;

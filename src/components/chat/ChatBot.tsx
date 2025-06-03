import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "How can I save more money?",
  "What's the 50/30/20 budget rule?",
  "How do I track my expenses better?",
  "Tips for reducing monthly expenses?",
  "How to set financial goals?",
];

const INITIAL_PROMPTS = [
  "💰 Ask about budgeting tips",
  "📊 Learn about expense tracking",
  "🎯 Get help with financial goals",
  "💡 Get saving strategies",
];

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] =
    useState<string[]>(SUGGESTED_QUESTIONS);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent, customQuestion?: string) => {
    e.preventDefault();
    const userMessage = customQuestion || input.trim();
    if (!userMessage) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: "openai/gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content:
                  "You are a friendly and knowledgeable financial advisor bot for Expenso.Your name is Penny , and you are developed by Akshat, to help users. Focus only on financial advice, budgeting, savings, and questions about using Expenso. Be concise but helpful. Do not engage in non-financial conversations.",
              },
              ...messages,
              { role: "user", content: userMessage },
            ],
          }),
        }
      );

      const data = await response.json();
      const botResponse = data.choices[0].message.content;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: botResponse },
      ]);

      const newSuggestions = [
        "Tell me more about budgeting",
        "How can I improve my savings?",
        "What are good financial habits?",
        "Tips for emergency funds",
      ];
      setSuggestedQuestions(newSuggestions);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 z-50">
      {isOpen ? (
        <div className="bg-white flex flex-col h-[100vh] w-full sm:h-[500px] sm:w-[380px] sm:rounded-lg sm:shadow-xl">
          <div className="p-3 sm:p-4 bg-yellow sm:rounded-t-lg flex items-center gap-2 sm:gap-3">
            <img
              src="https://cdn.sanity.io/images/rh8hx4sn/production/d825c54520f99ecb48bf87a896d4435543a56d84-1024x1024.png"
              alt="AI Assistant"
              className="w-8 h-8 rounded-full object-cover border-2 border-black"
            />
            <div className="flex-1">
              <h3 className="font-semibold text-black text-sm sm:text-base">
                Penny
              </h3>
              <p className="text-xs text-black opacity-75">
                Always here to help!
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-black hover:text-gray-700 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-6 sm:py-8">
                <img
                  src="https://cdn.sanity.io/images/rh8hx4sn/production/d825c54520f99ecb48bf87a896d4435543a56d84-1024x1024.png"
                  alt="Welcome"
                  className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full border-2 border-yellow"
                />
                <p className="font-medium text-sm sm:text-base">Hello! 👋</p>
                <p className="text-xs sm:text-sm mt-2">
                  I'm your financial assistant. Here's what I can help you with:
                </p>
                <div className="mt-3 sm:mt-4 space-y-2">
                  {INITIAL_PROMPTS.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={(e) => handleSubmit(e, prompt)}
                      className="w-full p-2 text-left hover:bg-gray-100 rounded-lg transition-colors text-xs sm:text-sm"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                } items-end gap-2`}
              >
                {message.role === "assistant" && (
                  <img
                    src="https://cdn.sanity.io/images/rh8hx4sn/production/d825c54520f99ecb48bf87a896d4435543a56d84-1024x1024.png"
                    alt="Assistant"
                    className="w-6 h-6 rounded-full object-cover"
                  />
                )}
                <div
                  className={`max-w-[85%] rounded-lg p-2.5 sm:p-3 text-sm ${
                    message.role === "user"
                      ? "bg-yellow text-black"
                      : "bg-gray-100 text-black"
                  }`}
                >
                  {message.content}
                </div>
                {message.role === "user" && (
                  <img
                    src="https://cdn.sanity.io/images/rh8hx4sn/production/66378e3886cbbfa29ae7eaea174bb98cf9fceaf7-1024x1024.png"
                    alt="User"
                    className="w-6 h-6 rounded-full object-cover"
                  />
                )}
              </div>
            ))}

            {messages.length > 0 && !isLoading && (
              <div className="mt-3 sm:mt-4">
                <p className="text-xs sm:text-sm text-gray-500 mb-2">
                  Suggested questions:
                </p>
                <div className="space-y-1.5 sm:space-y-2">
                  {suggestedQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={(e) => handleSubmit(e, question)}
                      className="w-full p-2 text-left hover:bg-gray-100 rounded-lg transition-colors text-xs sm:text-sm"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start items-end gap-2">
                <img
                  src="https://cdn.sanity.io/images/rh8hx4sn/production/d825c54520f99ecb48bf87a896d4435543a56d84-1024x1024.png"
                  alt="Assistant"
                  className="w-6 h-6 rounded-full object-cover"
                />
                <div className="bg-gray-100 rounded-lg p-2.5 sm:p-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-3 sm:p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about finances or Expenso..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="bg-yellow text-black px-3 sm:px-4 py-2 rounded-lg hover:bg-yellow-600 disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-yellow text-black p-3 sm:rounded-full shadow-lg hover:bg-yellow-600 relative"
        >
          <MessageSquare className="w-6 h-6" />
          <img
            src="https://cdn.sanity.io/images/rh8hx4sn/production/d825c54520f99ecb48bf87a896d4435543a56d84-1024x1024.png"
            alt="Assistant"
            className="w-4 h-4 rounded-full absolute -top-1 -right-1 border border-black"
          />
        </button>
      )}
    </div>
  );
};

export default ChatBot;

import { useState, useEffect, useRef } from "react";
import { useChatContext } from "../../contexts/ChatContext";
import {
  Send,
  Smile,
  Paperclip,
  MoreVertical,
  Reply,
  Edit,
  Trash2,
  Search,
  ArrowLeft,
  Users,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ChatMessage } from "../../lib/websocket";
import EmojiPicker from "./EmojiPicker";
import MessageItem from "./MessageItem";

const ChatRoom = () => {
  const {
    currentRoom,
    messages,
    typingUsers,
    sendMessage,
    sendTyping,
    editMessage,
    deleteMessage,
    searchMessages,
    setCurrentRoom,
  } = useChatContext();

  const [messageInput, setMessageInput] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const roomMessages = currentRoom ? messages.get(currentRoom.id) || [] : [];
  const roomTypingUsers = currentRoom
    ? typingUsers.get(currentRoom.id) || []
    : [];

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [roomMessages]);

  useEffect(() => {
    if (editingMessage) {
      setMessageInput(editingMessage.content);
      inputRef.current?.focus();
    }
  }, [editingMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;

    if (editingMessage) {
      await editMessage(editingMessage.id, messageInput.trim());
      setEditingMessage(null);
    } else {
      await sendMessage(messageInput.trim(), replyTo?.id);
      setReplyTo(null);
    }

    setMessageInput("");
    setShowEmojiPicker(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);

    // Auto-resize textarea
    const target = e.target;
    target.style.height = "auto";
    target.style.height = Math.min(target.scrollHeight, 120) + "px";

    // Send typing indicator
    sendTyping(true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 2000);
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentRoom) return;

    const results = await searchMessages(searchQuery, currentRoom.id);
    setSearchResults(results);
  };

  const formatMessageDate = (date: string) => {
    const messageDate = new Date(date);

    if (isToday(messageDate)) {
      return format(messageDate, "HH:mm");
    } else if (isYesterday(messageDate)) {
      return `Yesterday ${format(messageDate, "HH:mm")}`;
    } else {
      return format(messageDate, "MMM dd, HH:mm");
    }
  };

  const groupMessagesByDate = (messages: ChatMessage[]) => {
    const groups: { [key: string]: ChatMessage[] } = {};

    messages.forEach((message) => {
      const date = format(new Date(message.created_at), "yyyy-MM-dd");
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate(roomMessages);

  if (!currentRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500 p-6">
          <div className="text-4xl md:text-6xl mb-4">💬</div>
          <h3 className="text-lg md:text-xl font-semibold mb-2">
            Select a chat room
          </h3>
          <p className="text-sm md:text-base">
            Choose a room from the sidebar to start chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white h-full">
      {/* Header */}
      <div className="border-b border-gray-200 p-3 md:p-4 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile back button */}
            {isMobile && (
              <button
                onClick={() => setCurrentRoom(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold truncate">
                {currentRoom.name}
              </h2>
              {currentRoom.description && (
                <p className="text-sm text-gray-500 truncate">
                  {currentRoom.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Search className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreVertical className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search messages..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow text-sm"
            />
            <button
              onClick={handleSearch}
              className="px-3 md:px-4 py-2 bg-yellow text-black rounded-lg hover:bg-yellow-600 transition-colors text-sm"
            >
              Search
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
        {showSearch && searchResults.length > 0 ? (
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-700 text-sm md:text-base">
              Search Results
            </h3>
            {searchResults.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                onReply={setReplyTo}
                onEdit={setEditingMessage}
                onDelete={deleteMessage}
                formatDate={formatMessageDate}
              />
            ))}
          </div>
        ) : (
          Object.entries(messageGroups).map(([date, dayMessages]) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center justify-center">
                <div className="bg-gray-100 px-3 py-1 rounded-full text-xs text-gray-600">
                  {format(new Date(date), "MMMM dd, yyyy")}
                </div>
              </div>
              {dayMessages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  onReply={setReplyTo}
                  onEdit={setEditingMessage}
                  onDelete={deleteMessage}
                  formatDate={formatMessageDate}
                />
              ))}
            </div>
          ))
        )}

        {/* Typing Indicators */}
        {roomTypingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              />
              <div
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              />
            </div>
            <span>
              {roomTypingUsers.map((user) => user.user_name).join(", ")}
              {roomTypingUsers.length === 1 ? " is" : " are"} typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview */}
      {replyTo && (
        <div className="border-t border-gray-200 p-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Reply className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                Replying to {replyTo.user.first_name}
              </span>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-700 mt-1 truncate">
            {replyTo.content}
          </p>
        </div>
      )}

      {/* Edit Preview */}
      {editingMessage && (
        <div className="border-t border-gray-200 p-3 bg-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Edit className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-blue-600">Editing message</span>
            </div>
            <button
              onClick={() => {
                setEditingMessage(null);
                setMessageInput("");
              }}
              className="text-blue-500 hover:text-blue-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="border-t border-gray-200 p-3 md:p-4 bg-white">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={messageInput}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="w-full px-4 py-2 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow resize-none text-sm md:text-base"
              rows={1}
              style={{
                minHeight: "40px",
                maxHeight: "120px",
              }}
            />
            <div className="absolute right-2 top-2 flex items-center gap-1">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <Smile className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
              </button>
              <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                <Paperclip className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
              </button>
            </div>

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2 z-10">
                <EmojiPicker onEmojiSelect={handleEmojiSelect} />
              </div>
            )}
          </div>

          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            className="p-2 bg-yellow text-black rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;

import { useState } from "react";
import { ChatMessage } from "../../lib/websocket";
import {
  MoreVertical,
  Reply,
  Edit,
  Trash2,
  Heart,
  ThumbsUp,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

interface MessageItemProps {
  message: ChatMessage;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (messageId: string) => void;
  formatDate: (date: string) => string;
}

const MessageItem = ({
  message,
  onReply,
  onEdit,
  onDelete,
  formatDate,
}: MessageItemProps) => {
  const [showActions, setShowActions] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useState(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  });

  const isOwnMessage = currentUser?.id === message.user_id;

  const handleReaction = async (emoji: string) => {
    try {
      // Implementation for message reactions
      console.log("Adding reaction:", emoji, "to message:", message.id);
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  };

  return (
    <div
      className={`flex gap-2 md:gap-3 group hover:bg-gray-50 p-2 rounded-lg transition-colors ${
        isOwnMessage ? "flex-row-reverse" : ""
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {message.user.avatar_url ? (
          <img
            src={`${
              import.meta.env.VITE_SUPABASE_URL
            }/storage/v1/object/public/avatars/${message.user.avatar_url}`}
            alt={`${message.user.first_name} ${message.user.last_name}`}
            className="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-xs md:text-sm font-medium text-gray-600">
              {message.user.first_name[0]}
              {message.user.last_name[0]}
            </span>
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 min-w-0 ${isOwnMessage ? "text-right" : ""}`}>
        {/* Header */}
        <div
          className={`flex items-center gap-2 mb-1 text-xs md:text-sm ${
            isOwnMessage ? "justify-end" : ""
          }`}
        >
          <span className="font-medium text-gray-900">
            {message.user.first_name} {message.user.last_name}
          </span>
          <span className="text-gray-500">
            {formatDate(message.created_at)}
          </span>
          {message.is_edited && <span className="text-gray-400">(edited)</span>}
        </div>

        {/* Reply Context */}
        {message.reply_to && (
          <div className="mb-2 p-2 bg-gray-100 rounded border-l-2 border-gray-300">
            <div className="text-xs text-gray-600 flex items-center gap-1">
              <Reply className="w-3 h-3" />
              Replying to message
            </div>
          </div>
        )}

        {/* Message Text */}
        <div
          className={`inline-block px-3 py-2 rounded-lg max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl ${
            isOwnMessage ? "bg-yellow text-black" : "bg-gray-100 text-gray-900"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

        {/* Replies */}
        {message.replies && message.replies.length > 0 && (
          <div className="mt-2 ml-4 space-y-1">
            {message.replies.map((reply) => (
              <MessageItem
                key={reply.id}
                message={reply}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}

        {/* Quick Reactions */}
        <div className="flex items-center gap-1 mt-1">
          <button
            onClick={() => handleReaction("👍")}
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          >
            👍
          </button>
          <button
            onClick={() => handleReaction("❤️")}
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          >
            ❤️
          </button>
        </div>
      </div>

      {/* Actions */}
      {(showActions || window.innerWidth < 768) && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity">
          <button
            onClick={() => onReply(message)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Reply"
          >
            <Reply className="w-3 h-3 md:w-4 md:h-4 text-gray-500" />
          </button>

          {isOwnMessage && (
            <>
              <button
                onClick={() => onEdit(message)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Edit"
              >
                <Edit className="w-3 h-3 md:w-4 md:h-4 text-gray-500" />
              </button>
              <button
                onClick={() => onDelete(message.id)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3 h-3 md:w-4 md:h-4 text-red-500" />
              </button>
            </>
          )}

          <div className="relative">
            <button className="p-1 hover:bg-gray-200 rounded transition-colors">
              <MoreVertical className="w-3 h-3 md:w-4 md:h-4 text-gray-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageItem;

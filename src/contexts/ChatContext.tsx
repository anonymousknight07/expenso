import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "../lib/supabase";
import {
  wsManager,
  ChatMessage,
  ChatRoom,
  UserStatus,
  TypingIndicator,
} from "../lib/websocket";
import { toast } from "react-hot-toast";

interface ChatContextType {
  // Rooms
  rooms: ChatRoom[];
  currentRoom: ChatRoom | null;
  joinedRooms: string[];

  // Messages
  messages: Map<string, ChatMessage[]>;

  // Users
  onlineUsers: Map<string, UserStatus>;
  typingUsers: Map<string, TypingIndicator[]>;

  // Actions
  createRoom: (
    name: string,
    description?: string,
    isPrivate?: boolean
  ) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  sendMessage: (content: string, replyTo?: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  setCurrentRoom: (room: ChatRoom | null) => void;
  sendTyping: (isTyping: boolean) => void;
  searchRooms: (query: string) => Promise<ChatRoom[]>;
  searchMessages: (query: string, roomId?: string) => Promise<ChatMessage[]>;

  // State
  isConnected: boolean;
  isLoading: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
};

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const [joinedRooms, setJoinedRooms] = useState<string[]>([]);
  const [messages, setMessages] = useState<Map<string, ChatMessage[]>>(
    new Map()
  );
  const [onlineUsers, setOnlineUsers] = useState<Map<string, UserStatus>>(
    new Map()
  );
  const [typingUsers, setTypingUsers] = useState<
    Map<string, TypingIndicator[]>
  >(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Initialize user and fetch data
  useEffect(() => {
    const initializeChat = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user);
          await fetchRooms();
          await fetchJoinedRooms();
        }
      } catch (error) {
        console.error("Error initializing chat:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeChat();
  }, []);

  // WebSocket event handlers
  useEffect(() => {
    const handleConnection = (data: { status: string }) => {
      setIsConnected(data.status === "connected");
    };

    const handleNewMessage = (message: ChatMessage) => {
      setMessages((prev) => {
        const roomMessages = prev.get(message.room_id) || [];
        const newMessages = new Map(prev);
        newMessages.set(message.room_id, [...roomMessages, message]);
        return newMessages;
      });

      // Update room's last message
      setRooms((prev) =>
        prev.map((room) =>
          room.id === message.room_id
            ? { ...room, last_message: message }
            : room
        )
      );
    };

    const handleMessageUpdated = (message: ChatMessage) => {
      setMessages((prev) => {
        const roomMessages = prev.get(message.room_id) || [];
        const newMessages = new Map(prev);
        newMessages.set(
          message.room_id,
          roomMessages.map((m) => (m.id === message.id ? message : m))
        );
        return newMessages;
      });
    };

    const handleMessageDeleted = (data: {
      message_id: string;
      room_id: string;
    }) => {
      setMessages((prev) => {
        const roomMessages = prev.get(data.room_id) || [];
        const newMessages = new Map(prev);
        newMessages.set(
          data.room_id,
          roomMessages.filter((m) => m.id !== data.message_id)
        );
        return newMessages;
      });
    };

    const handleUserStatusUpdate = (status: UserStatus) => {
      setOnlineUsers((prev) => {
        const newMap = new Map(prev);
        newMap.set(status.user_id, status);
        return newMap;
      });
    };

    const handleTypingUpdate = (data: {
      room_id: string;
      typing_users: TypingIndicator[];
    }) => {
      setTypingUsers((prev) => {
        const newMap = new Map(prev);
        newMap.set(data.room_id, data.typing_users);
        return newMap;
      });
    };

    const handleRoomUpdate = (room: ChatRoom) => {
      setRooms((prev) => {
        const existingIndex = prev.findIndex((r) => r.id === room.id);
        if (existingIndex >= 0) {
          const newRooms = [...prev];
          newRooms[existingIndex] = room;
          return newRooms;
        } else {
          return [...prev, room];
        }
      });
    };

    // Register event handlers
    wsManager.on("connection", handleConnection);
    wsManager.on("new_message", handleNewMessage);
    wsManager.on("message_updated", handleMessageUpdated);
    wsManager.on("message_deleted", handleMessageDeleted);
    wsManager.on("user_status_update", handleUserStatusUpdate);
    wsManager.on("typing_update", handleTypingUpdate);
    wsManager.on("room_update", handleRoomUpdate);

    return () => {
      wsManager.off("connection", handleConnection);
      wsManager.off("new_message", handleNewMessage);
      wsManager.off("message_updated", handleMessageUpdated);
      wsManager.off("message_deleted", handleMessageDeleted);
      wsManager.off("user_status_update", handleUserStatusUpdate);
      wsManager.off("typing_update", handleTypingUpdate);
      wsManager.off("room_update", handleRoomUpdate);
    };
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("chat_rooms")
        .select(
          `
            *,
            chat_messages (
              id,
              content,
              created_at,
              user:profiles (
                id,
                first_name,
                last_name,
                avatar_url
              )
            )
          `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedRooms = data.map((room) => ({
        ...room,
        last_message: room.chat_messages[0] || null,
        member_count: 0, // Will be updated by WebSocket
      }));

      setRooms(formattedRooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Failed to load chat rooms");
    }
  };

  const fetchJoinedRooms = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("room_members")
        .select("room_id")
        .eq("user_id", user.id);

      if (error) throw error;

      const roomIds = data.map((member) => member.room_id);
      setJoinedRooms(roomIds);

      // Join WebSocket rooms
      roomIds.forEach((roomId) => wsManager.joinRoom(roomId));
    } catch (error) {
      console.error("Error fetching joined rooms:", error);
    }
  };

  const fetchMessages = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select(
          `
            *,
            user:profiles (
              id,
              first_name,
              last_name,
              avatar_url
            ),
            replies:chat_messages (
              *,
              user:profiles (
                id,
                first_name,
                last_name,
                avatar_url
              )
            )
          `
        )
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw error;

      setMessages((prev) => {
        const newMessages = new Map(prev);
        newMessages.set(roomId, data);
        return newMessages;
      });
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
    }
  };

  const createRoom = async (
    name: string,
    description?: string,
    isPrivate = false
  ) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("chat_rooms")
        .insert([
          {
            name,
            description,
            is_private: isPrivate,
            created_by: user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Join the room automatically
      await joinRoom(data.id);

      toast.success(`Room "${name}" created successfully!`);
    } catch (error) {
      console.error("Error creating room:", error);
      toast.error("Failed to create room");
    }
  };

  const joinRoom = async (roomId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Check if already a member
      const { data: existingMember } = await supabase
        .from("room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .single();

      if (!existingMember) {
        const { error } = await supabase.from("room_members").insert([
          {
            room_id: roomId,
            user_id: user.id,
          },
        ]);

        if (error) throw error;
      }

      setJoinedRooms((prev) => [...prev.filter((id) => id !== roomId), roomId]);
      wsManager.joinRoom(roomId);

      // Fetch messages for the room
      await fetchMessages(roomId);

      toast.success("Joined room successfully!");
    } catch (error) {
      console.error("Error joining room:", error);
      toast.error("Failed to join room");
    }
  };

  const leaveRoom = async (roomId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (error) throw error;

      setJoinedRooms((prev) => prev.filter((id) => id !== roomId));
      wsManager.leaveRoom(roomId);

      // Clear messages for the room
      setMessages((prev) => {
        const newMessages = new Map(prev);
        newMessages.delete(roomId);
        return newMessages;
      });

      if (currentRoom?.id === roomId) {
        setCurrentRoom(null);
      }

      toast.success("Left room successfully!");
    } catch (error) {
      console.error("Error leaving room:", error);
      toast.error("Failed to leave room");
    }
  };

  const sendMessage = async (content: string, replyTo?: string) => {
    if (!currentRoom || !content.trim()) return;

    try {
      wsManager.sendMessage(currentRoom.id, content.trim(), replyTo);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const editMessage = async (messageId: string, content: string) => {
    try {
      const { error } = await supabase
        .from("chat_messages")
        .update({
          content,
          is_edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", messageId);

      if (error) throw error;
    } catch (error) {
      console.error("Error editing message:", error);
      toast.error("Failed to edit message");
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("chat_messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    }
  };

  const sendTyping = (isTyping: boolean) => {
    if (currentRoom) {
      wsManager.sendTyping(currentRoom.id, isTyping);
    }
  };

  const searchRooms = async (query: string): Promise<ChatRoom[]> => {
    try {
      const { data, error } = await supabase
        .from("chat_rooms")
        .select("*")
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error searching rooms:", error);
      return [];
    }
  };

  const searchMessages = async (
    query: string,
    roomId?: string
  ): Promise<ChatMessage[]> => {
    try {
      let queryBuilder = supabase
        .from("chat_messages")
        .select(
          `
            *,
            user:profiles (
              id,
              first_name,
              last_name,
              avatar_url
            )
          `
        )
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (roomId) {
        queryBuilder = queryBuilder.eq("room_id", roomId);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error searching messages:", error);
      return [];
    }
  };

  const handleSetCurrentRoom = useCallback(
    (room: ChatRoom | null) => {
      setCurrentRoom(room);
      if (room && !messages.has(room.id)) {
        fetchMessages(room.id);
      }
    },
    [messages]
  );

  const value: ChatContextType = {
    rooms,
    currentRoom,
    joinedRooms,
    messages,
    onlineUsers,
    typingUsers,
    createRoom,
    joinRoom,
    leaveRoom,
    sendMessage,
    editMessage,
    deleteMessage,
    setCurrentRoom: handleSetCurrentRoom,
    sendTyping,
    searchRooms,
    searchMessages,
    isConnected,
    isLoading,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

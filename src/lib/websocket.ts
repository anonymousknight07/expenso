import { supabase } from "./supabase";

export interface ChatMessage {
  id: string;
  content: string;
  user_id: string;
  room_id: string;
  created_at: string;
  updated_at?: string;
  is_edited: boolean;
  reply_to?: string;
  message_type: "text" | "image" | "file";
  user: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  replies?: ChatMessage[];
}

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  is_private: boolean;
  created_by: string;
  created_at: string;
  member_count: number;
  last_message?: ChatMessage;
}

export interface UserStatus {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  status_message?: string;
}

export interface TypingIndicator {
  user_id: string;
  room_id: string;
  user_name: string;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, Function[]> = new Map();
  private isConnecting = false;

  constructor() {
    this.connect();
  }

  private async connect() {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        console.log("No session found, skipping WebSocket connection");
        this.isConnecting = false;
        return;
      }

      const wsUrl = `${
        import.meta.env.VITE_WS_URL || "ws://localhost:3001"
      }?token=${session.access_token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.emit("connection", { status: "connected" });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
        this.isConnecting = false;
        this.emit("connection", { status: "disconnected" });
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.isConnecting = false;
      };
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      this.isConnecting = false;
      this.handleReconnect();
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay =
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      setTimeout(() => {
        console.log(
          `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );
        this.connect();
      }, delay);
    }
  }

  private handleMessage(data: any) {
    const { type, payload } = data;
    this.emit(type, payload);
  }

  public on(event: string, handler: Function) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);
  }

  public off(event: string, handler: Function) {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  public send(type: string, payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn("WebSocket not connected, message not sent:", {
        type,
        payload,
      });
    }
  }

  public joinRoom(roomId: string) {
    this.send("join_room", { room_id: roomId });
  }

  public leaveRoom(roomId: string) {
    this.send("leave_room", { room_id: roomId });
  }

  public sendMessage(roomId: string, content: string, replyTo?: string) {
    this.send("send_message", {
      room_id: roomId,
      content,
      reply_to: replyTo,
      message_type: "text",
    });
  }

  public sendTyping(roomId: string, isTyping: boolean) {
    this.send("typing", {
      room_id: roomId,
      is_typing: isTyping,
    });
  }

  public updateStatus(isOnline: boolean, statusMessage?: string) {
    this.send("update_status", {
      is_online: isOnline,
      status_message: statusMessage,
    });
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsManager = new WebSocketManager();

import { useState, useEffect } from "react";
import { ChatProvider } from "../../contexts/ChatContext";
import RoomList from "./RoomList";
import ChatRoom from "./ChatRoom";
import { useChatContext } from "../../contexts/ChatContext";

const ChatInterfaceContent = () => {
  const { currentRoom } = useChatContext();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (isMobile) {
    // Mobile: Show either room list or chat room, not both
    return (
      <div className="flex h-[calc(100vh-4rem)] bg-white">
        {currentRoom ? <ChatRoom /> : <RoomList />}
      </div>
    );
  }

  // Desktop: Show both side by side
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white">
      <RoomList />
      <ChatRoom />
    </div>
  );
};

const ChatInterface = () => {
  return (
    <ChatProvider>
      <ChatInterfaceContent />
    </ChatProvider>
  );
};

export default ChatInterface;

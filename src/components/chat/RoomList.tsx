import { useState, useEffect } from "react";
import { useChatContext } from "../../contexts/ChatContext";
import {
  Plus,
  Search,
  Users,
  Lock,
  Hash,
  Settings,
  Eye,
  EyeOff,
} from "lucide-react";
import CreateRoomModal from "./CreateRoomModal";

const RoomList = () => {
  const {
    rooms,
    joinedRooms,
    currentRoom,
    setCurrentRoom,
    joinRoom,
    leaveRoom,
    searchRooms,
    isConnected,
  } = useChatContext();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showPrivateRooms, setShowPrivateRooms] = useState(true);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setIsSearching(true);
      const results = await searchRooms(query);
      setSearchResults(results);
      setIsSearching(false);
    } else {
      setSearchResults([]);
    }
  };

  // Filter rooms based on visibility settings
  const getFilteredRooms = () => {
    if (searchQuery) {
      return searchResults;
    }

    let filteredRooms = rooms;

    // Show private rooms only if user has joined them or if showPrivateRooms is enabled
    if (!showPrivateRooms) {
      filteredRooms = rooms.filter(
        (room) => !room.is_private || joinedRooms.includes(room.id)
      );
    }

    return filteredRooms;
  };

  const displayRooms = getFilteredRooms();
  const joinedRoomsList = displayRooms.filter((room) =>
    joinedRooms.includes(room.id)
  );
  const publicRoomsList = displayRooms.filter(
    (room) => !room.is_private && !joinedRooms.includes(room.id)
  );
  const privateRoomsList = displayRooms.filter(
    (room) => room.is_private && !joinedRooms.includes(room.id)
  );

  return (
    <div className="w-full md:w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Chat Rooms</h2>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
              title={isConnected ? "Connected" : "Disconnected"}
            />
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Create Room"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search rooms..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow text-sm"
          />
        </div>

        {/* Private Room Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Show Private Rooms</span>
          <button
            onClick={() => setShowPrivateRooms(!showPrivateRooms)}
            className={`p-1 rounded transition-colors ${
              showPrivateRooms ? "text-blue-600" : "text-gray-400"
            }`}
            title={
              showPrivateRooms ? "Hide private rooms" : "Show private rooms"
            }
          >
            {showPrivateRooms ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Room Lists */}
      <div className="flex-1 overflow-y-auto">
        {searchQuery ? (
          <div className="p-3 md:p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Search Results {isSearching && "(searching...)"}
            </h3>
            {searchResults.length === 0 && !isSearching ? (
              <p className="text-sm text-gray-500">No rooms found</p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((room) => (
                  <RoomItem
                    key={room.id}
                    room={room}
                    isJoined={joinedRooms.includes(room.id)}
                    isActive={currentRoom?.id === room.id}
                    onSelect={() => setCurrentRoom(room)}
                    onJoin={() => joinRoom(room.id)}
                    onLeave={() => leaveRoom(room.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Joined Rooms */}
            {joinedRoomsList.length > 0 && (
              <div className="p-3 md:p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Your Rooms ({joinedRoomsList.length})
                </h3>
                <div className="space-y-1">
                  {joinedRoomsList.map((room) => (
                    <RoomItem
                      key={room.id}
                      room={room}
                      isJoined={true}
                      isActive={currentRoom?.id === room.id}
                      onSelect={() => setCurrentRoom(room)}
                      onLeave={() => leaveRoom(room.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Public Rooms */}
            {publicRoomsList.length > 0 && (
              <div className="p-3 md:p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Public Rooms ({publicRoomsList.length})
                </h3>
                <div className="space-y-1">
                  {publicRoomsList.map((room) => (
                    <RoomItem
                      key={room.id}
                      room={room}
                      isJoined={false}
                      isActive={false}
                      onJoin={() => joinRoom(room.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Private Rooms */}
            {showPrivateRooms && privateRoomsList.length > 0 && (
              <div className="p-3 md:p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Private Rooms ({privateRoomsList.length})
                </h3>
                <div className="space-y-1">
                  {privateRoomsList.map((room) => (
                    <RoomItem
                      key={room.id}
                      room={room}
                      isJoined={false}
                      isActive={false}
                      onJoin={() => joinRoom(room.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {displayRooms.length === 0 && (
              <div className="p-6 text-center text-gray-500">
                <Hash className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No rooms available</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                >
                  Create the first room
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <CreateRoomModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
};

interface RoomItemProps {
  room: any;
  isJoined: boolean;
  isActive: boolean;
  onSelect?: () => void;
  onJoin?: () => void;
  onLeave?: () => void;
}

const RoomItem = ({
  room,
  isJoined,
  isActive,
  onSelect,
  onJoin,
  onLeave,
}: RoomItemProps) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`p-2 md:p-3 rounded-lg cursor-pointer transition-all duration-200 relative group ${
        isActive
          ? "bg-yellow text-black shadow-md"
          : "hover:bg-white hover:shadow-sm"
      }`}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-center gap-2 md:gap-3">
        <div className="flex-shrink-0">
          {room.is_private ? (
            <Lock className="w-3 h-3 md:w-4 md:h-4 text-gray-500" />
          ) : (
            <Hash className="w-3 h-3 md:w-4 md:h-4 text-gray-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm truncate pr-2">{room.name}</h4>
            {room.member_count > 0 && (
              <span className="text-xs text-gray-500 flex items-center gap-1 flex-shrink-0">
                <Users className="w-3 h-3" />
                {room.member_count}
              </span>
            )}
          </div>

          {room.description && (
            <p className="text-xs text-gray-600 truncate mt-1">
              {room.description}
            </p>
          )}

          {room.last_message && (
            <p className="text-xs text-gray-500 truncate mt-1">
              <span className="font-medium">
                {room.last_message.user.first_name}:
              </span>{" "}
              {room.last_message.content}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      {(showActions || window.innerWidth < 768) && (
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {isJoined ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLeave?.();
              }}
              className="p-1 hover:bg-red-100 rounded text-red-600 transition-colors"
              title="Leave Room"
            >
              <Settings className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onJoin?.();
              }}
              className="p-1 hover:bg-green-100 rounded text-green-600 transition-colors"
              title="Join Room"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default RoomList;

import { useState } from "react";
import { useChatContext } from "../../contexts/ChatContext";
import { X, Hash, Lock, Users } from "lucide-react";
import Button from "../common/Button";

interface CreateRoomModalProps {
  onClose: () => void;
}

const CreateRoomModal = ({ onClose }: CreateRoomModalProps) => {
  const { createRoom } = useChatContext();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isPrivate: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsLoading(true);
    try {
      await createRoom(
        formData.name.trim(),
        formData.description.trim(),
        formData.isPrivate
      );
      onClose();
    } catch (error) {
      console.error("Error creating room:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Create New Room</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter room name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow"
              required
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="What's this room about? (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow resize-none"
              rows={3}
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Room Type
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="roomType"
                  checked={!formData.isPrivate}
                  onChange={() =>
                    setFormData({ ...formData, isPrivate: false })
                  }
                  className="text-yellow focus:ring-yellow"
                />
                <div className="flex items-center gap-2">
                  <Hash className="w-5 h-5 text-gray-500" />
                  <div>
                    <div className="font-medium">Public Room</div>
                    <div className="text-sm text-gray-500">
                      Anyone can join and see messages
                    </div>
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="roomType"
                  checked={formData.isPrivate}
                  onChange={() => setFormData({ ...formData, isPrivate: true })}
                  className="text-yellow focus:ring-yellow"
                />
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-gray-500" />
                  <div>
                    <div className="font-medium">Private Room</div>
                    <div className="text-sm text-gray-500">
                      Invite-only access
                    </div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!formData.name.trim() || isLoading}
            >
              {isLoading ? "Creating..." : "Create Room"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoomModal;

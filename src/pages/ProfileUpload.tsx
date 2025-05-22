import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, Upload, Loader } from 'lucide-react';


interface ProfileUploadProps {
  profileId: string;
  avatarUrl: string | null;
  onUploadComplete: (url: string) => void;
}

const ProfileUpload = ({ profileId, avatarUrl, onUploadComplete }: ProfileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setError(null);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${profileId}-${Math.random()}.${fileExt}`;

      // Upload the image to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Update the user record with the new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: filePath })
        .eq('id', profileId);

      if (updateError) {
        throw updateError;
      }

      onUploadComplete(filePath);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error uploading avatar');
      console.error('Error uploading avatar:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <label 
        htmlFor="single-file-upload" 
        className="cursor-pointer group"
      >
        <div className="relative">
          {avatarUrl ? (
            <img
              src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${avatarUrl}`}
              alt="Avatar"
              className="w-24 h-24 rounded-full object-cover group-hover:opacity-75 transition-opacity"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center group-hover:bg-gray-300 transition-colors">
              <Camera className="w-8 h-8 text-gray-400" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? (
              <Loader className="w-8 h-8 text-white animate-spin" />
            ) : (
              <div className="bg-black bg-opacity-50 rounded-full p-2">
                <Upload className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
        </div>
      </label>
      <input
        type="file"
        id="single-file-upload"
        accept="image/*"
        onChange={handleFileUpload}
        disabled={uploading}
        style={{ display: 'none' }}
      />
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      <p className="text-sm text-gray-500 mt-2">Click to change avatar</p>
    </div>
  );
};

export default ProfileUpload;
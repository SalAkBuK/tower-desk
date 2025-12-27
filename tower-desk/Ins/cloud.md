// Cloudinary Configuration
// https://cloudinary.com/documentation/upload_images#unsigned_upload

export const CLOUDINARY_CONFIG = {
  // Your Cloudinary cloud name (find in Cloudinary Dashboard)
  // Example: 'my-cloud-name'
  cloudName: 'dzxeljant', // TODO: Replace with your Cloudinary cloud name

  // Unsigned upload preset name (create in Cloudinary Dashboard > Settings > Upload)
  // Make sure to enable "Unsigned uploading" for this preset
  uploadPreset: 'mobile_app_uploads', // TODO: Replace with your upload preset name

  // API endpoint (auto-generated, don't change unless using a custom CNAME)
  apiUrl: 'https://api.cloudinary.com/v1_1',
};

/**
 * How to set up Cloudinary unsigned upload:
 *
 * 1. Go to https://cloudinary.com/console
 * 2. Navigate to Settings > Upload
 * 3. Scroll to "Upload presets"
 * 4. Click "Add upload preset"
 * 5. Set:
 *    - Preset name: e.g., "mobile_app_uploads"
 *    - Signing mode: "Unsigned"
 *    - Folder: e.g., "maintenance_attachments" (optional)
 *    - Access mode: "public" (or "authenticated" if you need private files)
 * 6. Save the preset
 * 7. Copy your cloud name from the Dashboard
 * 8. Update CLOUDINARY_CONFIG above with your values
 */

export const getCloudinaryUploadUrl = (resourceType: 'image' | 'raw' = 'image') => {
  return `${CLOUDINARY_CONFIG.apiUrl}/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`;
};

export const isCloudinaryConfigured = () => {
  return (
    CLOUDINARY_CONFIG.cloudName !== 'YOUR_CLOUD_NAME' &&
    CLOUDINARY_CONFIG.uploadPreset !== 'YOUR_UPLOAD_PRESET'
  );
};

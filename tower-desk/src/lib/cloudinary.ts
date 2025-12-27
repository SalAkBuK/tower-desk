export const CLOUDINARY_CONFIG = {
    cloudName: 'dzxeljant',
    uploadPreset: 'mobile_app_uploads',
    apiUrl: 'https://api.cloudinary.com/v1_1',
};

export const getCloudinaryUploadUrl = (resourceType: 'image' | 'raw' = 'image') => {
    return `${CLOUDINARY_CONFIG.apiUrl}/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`;
};

export async function uploadToCloudinary(file: File, resourceType: 'image' | 'raw' = 'image') {
    const url = getCloudinaryUploadUrl(resourceType);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    const res = await fetch(url, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Upload failed');
    }

    const data = await res.json();
    return {
        url: data.secure_url ?? data.url,
        publicId: data.public_id,
    };
}

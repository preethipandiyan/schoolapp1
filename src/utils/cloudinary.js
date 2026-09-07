import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getDoc, doc } from 'firebase/firestore';
import { db, storage } from '../firebase/config';

/**
 * Uploads a file to Cloudinary if configured, otherwise falls back to Firebase Storage.
 * @param {File} file - The file to upload
 * @param {string} schoolId - The school's ID to fetch settings
 * @param {string} firebaseFallbackPath - The storage path for Firebase if Cloudinary is not used
 * @returns {Promise<string>} The secure URL of the uploaded file
 */
export const uploadFileToCloudinaryOrFirebase = async (file, schoolId, firebaseFallbackPath) => {
  if (!file) throw new Error("No file provided for upload");
  if (!schoolId) throw new Error("schoolId is required to fetch upload configuration");

  // Enforce 3MB limit (3 * 1024 * 1024 = 3145728 bytes)
  const isAudio = file.type && file.type.startsWith('audio/');
  if (file.size > 3145728 && !isAudio) {
    throw new Error(`File "${file.name}" exceeds the 3MB size limit. Please upload a smaller file.`);
  }

  try {
    // 1. Fetch School Configuration
    const schoolDoc = await getDoc(doc(db, 'schools', schoolId));
    
    if (schoolDoc.exists()) {
      const data = schoolDoc.data();
      const cloudinaryConfig = data.apiKeys?.cloudinary;
      
      // 2. Check if Cloudinary is configured
      if (cloudinaryConfig && typeof cloudinaryConfig === 'object' && cloudinaryConfig.cloudName && cloudinaryConfig.uploadPreset) {
        console.log("Uploading via Cloudinary...");
        
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", cloudinaryConfig.uploadPreset);
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`, {
          method: "POST",
          body: formData
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          console.error("Cloudinary upload failed:", result);
          throw new Error(result.error?.message || "Failed to upload to Cloudinary");
        }
        
        return result.secure_url;
      }
    }
    
    // 3. Fallback to Firebase Storage
    console.log("Uploading via Firebase Storage fallback...");
    if (!firebaseFallbackPath) {
       throw new Error("Firebase fallback path is required when Cloudinary is not configured");
    }
    const storageRef = ref(storage, firebaseFallbackPath);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
    
  } catch (error) {
    console.error("Error in uploadFileToCloudinaryOrFirebase:", error);
    throw error;
  }
};

export const uploadCustomDataFiles = async (customData, schoolId, moduleName) => {
  if (!customData || typeof customData !== 'object') return customData;
  const newData = { ...customData };
  const uploadPromises = Object.entries(newData).map(async ([key, value]) => {
    if (value instanceof File) {
      const safeSchoolName = moduleName.replace(/[^a-z0-9]/gi, '_').trim();
      const safeFileName = value.name.replace(/[^a-z0-9.]/gi, '_');
      const storagePath = `CustomModules/${safeSchoolName}/${safeFileName}`;
      const url = await uploadFileToCloudinaryOrFirebase(value, schoolId, storagePath);
      return { key, url };
    }
    return null;
  });

  const results = await Promise.all(uploadPromises);
  results.forEach(res => {
    if (res) {
      newData[res.key] = res.url;
    }
  });

  return newData;
};

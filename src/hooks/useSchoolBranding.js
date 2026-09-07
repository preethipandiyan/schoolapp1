import { useEffect } from 'react';

export default function useSchoolBranding(schoolData) {
  useEffect(() => {
    // Save original values
    const originalTitle = document.title;
    let link = document.querySelector("link[rel~='icon']");
    const originalFavicon = link ? link.href : '/vite.svg';

    // Apply new values if they exist
    if (schoolData?.name || schoolData?.schoolName) {
      document.title = schoolData.name || schoolData.schoolName;
    }
    
    if (schoolData?.branding?.logoUrl) {
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = schoolData.branding.logoUrl;
    }

    // Cleanup function to restore original values
    return () => {
      document.title = originalTitle;
      if (link) {
        link.href = originalFavicon;
      }
    };
  }, [schoolData]);
}

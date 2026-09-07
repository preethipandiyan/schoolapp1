// src/services/whatsappService.js

/**
 * Service to interact with the secure WhatsApp backend API.
 * Never stores or transmits the actual WhatsApp Access Token from the client.
 */

import { auth } from '../firebase/config';

const API_ENDPOINT = '/api/whatsapp-service';

const getAuthHeaders = async () => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const token = await auth.currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const whatsappService = {
  /**
   * Tests the Meta WhatsApp Cloud API connection using the provided credentials.
   * Only used in the API Integrations page.
   */
  async testConnection(schoolId, credentials) {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          action: 'test',
          schoolId,
          credentials // Sent securely to the backend for testing before saving.
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Connection failed');
      return data;
    } catch (error) {
      console.error('WhatsApp Test Connection Error:', error);
      throw error;
    }
  },

  /**
   * Sends a PTM notification to the parent of the specified student.
   * Failures here should be caught gracefully so as not to break the main application flow.
   */
  async sendPTMNotification(schoolId, ptmId, ptmData) {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          action: 'sendPTM',
          schoolId,
          ptmId,
          studentId: ptmData.studentId,
          ptmData
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send PTM notification');
      return data;
    } catch (error) {
      console.error('WhatsApp sendPTMNotification Error:', error);
      // Suppress error so caller doesn't fail
      return { success: false, error: error.message };
    }
  },

  /**
   * Sends a Noticeboard notification to the targeted audience.
   */
  async sendNoticeNotification(schoolId, noticeId, noticeData) {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          action: 'sendNotice',
          schoolId,
          noticeId,
          noticeData
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send Notice notification');
      return data;
    } catch (error) {
      console.error('WhatsApp sendNoticeNotification Error:', error);
      // Suppress error so caller doesn't fail
      return { success: false, error: error.message };
    }
  }
};

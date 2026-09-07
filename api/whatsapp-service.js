import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
let db;
try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      admin.initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'school-management-system-6a2c4'
      });
    }
  }
  db = admin.firestore();
} catch (error) {
  console.error("Firebase Admin initialization failed:", error);
}

// Phone number normalization
function normalizePhone(phone) {
  if (!phone) return null;
  // Remove spaces, brackets, hyphens
  let normalized = phone.replace(/[\s\(\)\-]/g, '');
  // If it doesn't start with '+', assume India and prefix '91' if it's 10 digits
  if (!normalized.startsWith('+')) {
    if (normalized.length === 10) {
      normalized = `91${normalized}`;
    }
  } else {
    // Remove '+' for Meta API
    normalized = normalized.substring(1);
  }
  return normalized;
}

// Meta API Call Helper
async function callMetaAPI(phoneNumberId, accessToken, payload) {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  return { ok: response.ok, data };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Authenticate user
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { action, schoolId } = req.body;
    if (!schoolId) {
      return res.status(400).json({ error: 'Missing schoolId' });
    }

    // 2. Verify user belongs to the school
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data().schoolId !== schoolId) {
      return res.status(403).json({ error: 'Forbidden: School ID mismatch' });
    }

    // 3. Handle Actions
    if (action === 'test') {
      const { credentials } = req.body;
      if (!credentials || !credentials.accessToken || !credentials.phoneNumberId) {
        return res.status(400).json({ error: 'Missing credentials for testing' });
      }

      // Simple test by sending a test message or just checking reachability.
      // Meta doesn't have a pure 'ping' for credentials, usually you send a message.
      // But we can check if the token can read the phone number info via GET /phoneNumberId.
      const testUrl = `https://graph.facebook.com/v19.0/${credentials.phoneNumberId}`;
      const testRes = await fetch(testUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${credentials.accessToken}` }
      });
      const testData = await testRes.json();
      
      if (!testRes.ok) {
        console.error("Meta API test failed:", testData);
        return res.status(400).json({ error: 'Unable to connect to WhatsApp Cloud API.' });
      }
      return res.status(200).json({ success: true, message: 'Connection successful' });
    }

    // For send actions, we need the stored config
    const schoolDoc = await db.collection('schools').doc(schoolId).get();
    const integrations = schoolDoc.data()?.integrations || {};
    const config = integrations.whatsapp;

    if (!config || !config.enabled || !config.accessToken || !config.phoneNumberId) {
      return res.status(400).json({ error: 'WhatsApp integration not configured or disabled' });
    }

    if (action === 'sendPTM') {
      const { ptmId, studentId, ptmData } = req.body;
      
      // Duplicate check
      const logId = `${schoolId}_PTM_${ptmId}_${studentId}`;
      const logRef = db.collection('whatsapp_logs').doc(logId);
      const logDoc = await logRef.get();
      if (logDoc.exists && logDoc.data().status === 'Sent') {
        return res.status(200).json({ success: true, message: 'Already sent' });
      }

      // Resolve parent phone
      const studentDoc = await db.collection(`schools/${schoolId}/students`).doc(studentId).get();
      if (!studentDoc.exists) {
        return res.status(404).json({ error: 'Student not found' });
      }
      
      const phone = studentDoc.data().parentPhone;
      const normalizedPhone = normalizePhone(phone);
      
      if (!normalizedPhone) {
        await logRef.set({
          schoolId, notificationType: 'PTM', referenceId: ptmId, studentId,
          recipientPhoneMasked: 'Missing/Invalid', status: 'Skipped',
          errorMessage: 'Invalid parent mobile number', createdAt: new Date().toISOString()
        });
        return res.status(200).json({ success: false, message: 'Skipped: Invalid phone' });
      }

      // Send to Meta
      const templateName = config.ptmTemplateName || 'school_ptm_scheduled';
      const payload = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en_US' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: ptmData.parentName || 'Parent' },
                { type: 'text', text: ptmData.studentName || 'Student' },
                { type: 'text', text: ptmData.date || 'TBD' },
                { type: 'text', text: ptmData.time || 'TBD' },
                { type: 'text', text: ptmData.type || 'Meeting' }
              ]
            }
          ]
        }
      };

      const result = await callMetaAPI(config.phoneNumberId, config.accessToken, payload);

      await logRef.set({
        schoolId, notificationType: 'PTM', referenceId: ptmId, studentId,
        recipientPhoneMasked: `****${normalizedPhone.slice(-4)}`,
        status: result.ok ? 'Sent' : 'Failed',
        messageId: result.ok ? result.data.messages?.[0]?.id : null,
        errorMessage: result.ok ? null : JSON.stringify(result.data),
        createdAt: new Date().toISOString()
      });

      if (!result.ok) {
        return res.status(400).json({ error: 'Failed to send to WhatsApp', details: result.data });
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'sendNotice') {
      const { noticeId, noticeData } = req.body;
      const audienceType = noticeData.audience;
      const targetClasses = noticeData.targetClasses || [];
      const targetSections = noticeData.targetSections || [];
      
      // Duplicate check
      const logId = `${schoolId}_NOTICE_${noticeId}`;
      const logRef = db.collection('whatsapp_logs').doc(logId);
      const logDoc = await logRef.get();
      if (logDoc.exists && logDoc.data().status === 'Sent') {
        return res.status(200).json({ success: true, message: 'Already sent' });
      }

      // Resolve audience
      let studentsQuery = db.collection(`schools/${schoolId}/students`).where('status', '==', 'Active');
      if (audienceType === 'Specific Class' && targetClasses.length > 0) {
        studentsQuery = studentsQuery.where('classId', 'in', targetClasses);
      }
      // Note: Firestore 'in' has a max of 10. If more, we'd need to fetch all and filter.
      // For simplicity, we just fetch all and filter in memory if needed.
      const snapshot = await db.collection(`schools/${schoolId}/students`).where('status', '==', 'Active').get();
      
      let studentsToNotify = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (audienceType === 'Specific Class') {
        studentsToNotify = studentsToNotify.filter(s => targetClasses.includes(s.classId));
      } else if (audienceType === 'Specific Section') {
        studentsToNotify = studentsToNotify.filter(s => targetClasses.includes(s.classId) && targetSections.includes(s.sectionId));
      }

      const templateName = config.noticeTemplateName || 'school_notice_notification';
      let sentCount = 0;
      let failedCount = 0;

      // Group by parent phone to avoid duplicate messages to same parent for siblings
      const uniqueParents = new Map();
      studentsToNotify.forEach(s => {
        const p = normalizePhone(s.parentPhone);
        if (p) uniqueParents.set(p, s);
      });

      // We should ideally queue these or use Promise.all with a rate limit
      const promises = Array.from(uniqueParents.entries()).map(async ([normalizedPhone, student]) => {
        const payload = {
          messaging_product: 'whatsapp',
          to: normalizedPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en_US' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: student.parentName || 'Parent' },
                  { type: 'text', text: noticeData.title || 'Notice' },
                  { type: 'text', text: noticeData.content?.replace(/<[^>]*>?/gm, '').substring(0, 200) || 'Please check noticeboard.' }, // Strip HTML, truncate
                ]
              }
            ]
          }
        };

        const result = await callMetaAPI(config.phoneNumberId, config.accessToken, payload);
        if (result.ok) sentCount++; else failedCount++;
      });

      await Promise.all(promises);

      await logRef.set({
        schoolId, notificationType: 'NOTICE', referenceId: noticeId,
        audienceCount: uniqueParents.size, sentCount, failedCount,
        status: 'Sent', createdAt: new Date().toISOString()
      });

      return res.status(200).json({ success: true, sentCount, failedCount });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error("WhatsApp Service Error:", err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

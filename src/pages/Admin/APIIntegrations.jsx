import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { updateSchoolAPIKeys } from '../../firebase/firestore';
import { updateDoc } from 'firebase/firestore';
import { whatsappService } from '../../services/whatsappService';
import { LuKey as Key, LuMap as Map, LuImage as ImageIcon, LuSave as Save, LuCircleCheck as CheckCircle2, LuMessageSquare as MessageCircle, LuUnlink as Unlink, LuRefreshCw as RefreshCw } from 'react-icons/lu';
import toast from 'react-hot-toast';

export default function APIIntegrations() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [permittedModules, setPermittedModules] = useState([]);
  const [apiKeys, setApiKeys] = useState({
    googleMaps: '',
    cloudinary: { cloudName: '', uploadPreset: '' }
  });
  
  const [whatsappConfig, setWhatsappConfig] = useState({
    accessToken: '',
    phoneNumberId: '',
    businessAccountId: '',
    senderNumber: '',
    ptmTemplateName: 'school_ptm_scheduled',
    noticeTemplateName: 'school_notice_notification',
    enabled: false,
    isConnected: false,
    isMasked: false
  });
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);
  const [changingToken, setChangingToken] = useState(false);

  useEffect(() => {
    if (schoolId) {
      fetchData();
    }
  }, [schoolId]);

  const fetchData = async () => {
    try {
      const schoolDoc = await getDoc(doc(db, 'schools', schoolId));
      if (schoolDoc.exists()) {
        const data = schoolDoc.data();
        setPermittedModules(data.permittedModules || []);
        if (data.apiKeys) {
          setApiKeys({
            googleMaps: data.apiKeys.googleMaps || '',
            cloudinary: (data.apiKeys.cloudinary && typeof data.apiKeys.cloudinary === 'object') 
              ? data.apiKeys.cloudinary 
              : { cloudName: '', uploadPreset: '' }
          });
        }
        if (data.integrations && data.integrations.whatsapp) {
          const wa = data.integrations.whatsapp;
          setWhatsappConfig({
            accessToken: wa.accessToken ? '' : '',
            isMasked: !!wa.accessToken,
            phoneNumberId: wa.phoneNumberId || '',
            businessAccountId: wa.businessAccountId || '',
            senderNumber: wa.senderNumber || '',
            ptmTemplateName: wa.ptmTemplateName || 'school_ptm_scheduled',
            noticeTemplateName: wa.noticeTemplateName || 'school_notice_notification',
            enabled: wa.enabled || false,
            isConnected: wa.isConnected || false
          });
        }
      }
    } catch (error) {
      console.error("Error fetching school API data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await updateSchoolAPIKeys(schoolId, apiKeys);
      
      const updateData = {
        'integrations.whatsapp.phoneNumberId': whatsappConfig.phoneNumberId,
        'integrations.whatsapp.businessAccountId': whatsappConfig.businessAccountId,
        'integrations.whatsapp.senderNumber': whatsappConfig.senderNumber,
        'integrations.whatsapp.ptmTemplateName': whatsappConfig.ptmTemplateName,
        'integrations.whatsapp.noticeTemplateName': whatsappConfig.noticeTemplateName,
        'integrations.whatsapp.enabled': whatsappConfig.enabled,
        'integrations.whatsapp.isConnected': whatsappConfig.isConnected,
        'integrations.whatsapp.provider': 'meta_whatsapp_cloud_api',
        'integrations.whatsapp.updatedAt': new Date().toISOString()
      };
      
      if (!whatsappConfig.isMasked && whatsappConfig.accessToken) {
        updateData['integrations.whatsapp.accessToken'] = whatsappConfig.accessToken;
        setWhatsappConfig(prev => ({ ...prev, isMasked: true, accessToken: '' }));
      }
      
      await updateDoc(doc(db, 'schools', schoolId), updateData);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      toast.success("Settings saved successfully!");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestWhatsapp = async () => {
    setTestingWhatsapp(true);
    try {
      let tokenToTest = whatsappConfig.accessToken;
      if (whatsappConfig.isMasked && !changingToken) {
        // If it's masked and not changing, we don't send the token, the backend will fetch it
        tokenToTest = null;
      }
      
      const res = await whatsappService.testConnection(schoolId, {
        accessToken: tokenToTest,
        phoneNumberId: whatsappConfig.phoneNumberId
      });
      
      if (res.success) {
        setWhatsappConfig(prev => ({ ...prev, isConnected: true, enabled: true }));
        await updateDoc(doc(db, 'schools', schoolId), {
          'integrations.whatsapp.isConnected': true,
          'integrations.whatsapp.enabled': true
        });
        toast.success("WhatsApp Connection successful!");
      }
    } catch (error) {
      setWhatsappConfig(prev => ({ ...prev, isConnected: false }));
      await updateDoc(doc(db, 'schools', schoolId), {
        'integrations.whatsapp.isConnected': false
      });
      toast.error(error.message || "Unable to connect to WhatsApp Cloud API.");
    } finally {
      setTestingWhatsapp(false);
    }
  };

  const handleDisconnectWhatsapp = async () => {
    if (window.confirm("Are you sure you want to disconnect WhatsApp? Notifications will stop immediately.")) {
      try {
        await updateDoc(doc(db, 'schools', schoolId), {
          'integrations.whatsapp.enabled': false,
          'integrations.whatsapp.isConnected': false,
          'integrations.whatsapp.accessToken': ''
        });
        setWhatsappConfig({
          accessToken: '',
          phoneNumberId: '',
          businessAccountId: '',
          senderNumber: '',
          ptmTemplateName: 'school_ptm_scheduled',
          noticeTemplateName: 'school_notice_notification',
          enabled: false,
          isConnected: false,
          isMasked: false
        });
        setChangingToken(false);
        toast.success("WhatsApp disconnected successfully.");
      } catch (err) {
        toast.error("Failed to disconnect WhatsApp.");
      }
    }
  };

  const hasTransport = permittedModules.includes('transport');
  const hasMedia = permittedModules.includes('media');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto pb-24">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Key className="text-primary-600" />
          API Integrations
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Configure third-party API keys required for specific modules.</p>
      </div>

      {!hasTransport && !hasMedia && !userProfile?.role === 'superadmin' && (
        <div className="bg-amber-50 text-amber-700 p-6 rounded-2xl border border-amber-200 mb-8">
          <p className="font-bold mb-1">No API Configuration Required</p>
          <p className="text-sm">Your currently permitted modules do not require any third-party API configurations.</p>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-8">
        <div className="p-6 md:p-8 space-y-8">
          
          {/* WhatsApp Cloud API Card */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="text-green-500" size={24} />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">WhatsApp Cloud API</h2>
              {whatsappConfig.isConnected ? (
                <span className="ml-2 px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                  <CheckCircle2 size={14}/> Connected
                </span>
              ) : (
                <span className="ml-2 px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full">
                  Not Connected
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Connect your school's WhatsApp Business account to send notifications to parents. 
              Powered by Meta WhatsApp Cloud API.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Access Token</label>
                {whatsappConfig.isMasked && !changingToken ? (
                  <div className="flex items-center gap-3">
                    <input 
                      type="text" 
                      disabled 
                      value="••••••••••••••••••••••••" 
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500" 
                    />
                    <button 
                      type="button" 
                      onClick={() => setChangingToken(true)}
                      className="px-4 py-2.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100"
                    >
                      Change Token
                    </button>
                  </div>
                ) : (
                  <input 
                    type="password"
                    value={whatsappConfig.accessToken}
                    onChange={(e) => setWhatsappConfig({...whatsappConfig, accessToken: e.target.value})}
                    placeholder="EAAI..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-mono"
                  />
                )}
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Phone Number ID</label>
                <input 
                  type="text"
                  value={whatsappConfig.phoneNumberId}
                  onChange={(e) => setWhatsappConfig({...whatsappConfig, phoneNumberId: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">WhatsApp Business Account ID</label>
                <input 
                  type="text"
                  value={whatsappConfig.businessAccountId}
                  onChange={(e) => setWhatsappConfig({...whatsappConfig, businessAccountId: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Sender/Business Phone Number</label>
                <input 
                  type="text"
                  value={whatsappConfig.senderNumber}
                  onChange={(e) => setWhatsappConfig({...whatsappConfig, senderNumber: e.target.value})}
                  placeholder="+91..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">PTM Template Name</label>
                <input 
                  type="text"
                  value={whatsappConfig.ptmTemplateName}
                  onChange={(e) => setWhatsappConfig({...whatsappConfig, ptmTemplateName: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Notice Template Name</label>
                <input 
                  type="text"
                  value={whatsappConfig.noticeTemplateName}
                  onChange={(e) => setWhatsappConfig({...whatsappConfig, noticeTemplateName: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleTestWhatsapp}
                disabled={testingWhatsapp || (!whatsappConfig.phoneNumberId && !whatsappConfig.accessToken)}
                className="px-6 py-2 bg-slate-800 dark:bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {testingWhatsapp ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                Test Connection
              </button>
              
              {whatsappConfig.isMasked && (
                <button
                  type="button"
                  onClick={handleDisconnectWhatsapp}
                  className="px-6 py-2 bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2"
                >
                  <Unlink size={16} />
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {hasTransport && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Map className="text-blue-500" size={24} />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Google Maps API (Transport Module)</h2>
                </div>
                <div className="space-y-4 max-w-2xl">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">API Key</label>
                    <input 
                      type="text"
                      value={apiKeys.googleMaps}
                      onChange={(e) => setApiKeys({...apiKeys, googleMaps: e.target.value})}
                      placeholder="AIzaSy..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-mono"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      Required for live GPS tracking and route optimization. Must have Maps JavaScript API and Directions API enabled.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {hasTransport && hasMedia && <div className="border-t border-slate-100 dark:border-slate-800"></div>}

            {hasMedia && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="text-purple-500" size={24} />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Cloudinary (Media Module)</h2>
                </div>
                <div className="space-y-4 max-w-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Cloud Name</label>
                      <input 
                        type="text"
                        value={apiKeys.cloudinary.cloudName}
                        onChange={(e) => setApiKeys({...apiKeys, cloudinary: { ...apiKeys.cloudinary, cloudName: e.target.value }})}
                        placeholder="e.g. dxyz123"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Unsigned Upload Preset</label>
                      <input 
                        type="text"
                        value={apiKeys.cloudinary.uploadPreset}
                        onChange={(e) => setApiKeys({...apiKeys, cloudinary: { ...apiKeys.cloudinary, uploadPreset: e.target.value }})}
                        placeholder="e.g. preset_name"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Required for uploading student profile photos, library book covers, and noticeboard attachments. Ensure the preset is set to "Unsigned" in your Cloudinary settings.
                  </p>
                </div>
              </div>
            )}

          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end items-center gap-4">
            {success && (
              <span className="flex items-center gap-2 text-green-600 font-bold text-sm animate-fade-in">
                <CheckCircle2 size={18} /> Settings Saved
              </span>
            )}
            <button 
              type="submit" 
              disabled={saving}
              className="px-8 py-3 bg-primary-600 text-white font-bold hover:bg-primary-700 rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Save Configurations'}
            </button>
          </div>
        </form>
    </div>
  );
}

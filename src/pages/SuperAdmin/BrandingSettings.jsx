import React, { useState } from 'react';
import { LuPalette, LuImagePlus, LuSave, LuRefreshCw } from 'react-icons/lu';
import toast from 'react-hot-toast';

export default function BrandingSettings() {
  const [settings, setSettings] = useState({
    platformName: 'School',
    primaryColor: '#7b40a3',
    logoUrl: '/logo.png',
    faviconUrl: '/logo.png',
    loginBackgroundImage: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=2070'
  });
  const [saving, setSaving] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Global branding settings saved successfully!");
    }, 1200);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto h-full flex flex-col">
      <div className="mb-8 shrink-0 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <LuPalette className="text-primary-600" /> White-Labeling & Branding
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Configure default colors, logos, and platform names for all tenants.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <LuRefreshCw size={18} className="animate-spin" /> : <LuSave size={18} />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <form className="max-w-3xl space-y-10">
            
            {/* Identity */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 border-b border-slate-100 dark:border-slate-800 pb-2">Platform Identity</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Platform Name</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">This is the default text shown if a school hasn't uploaded their own logo.</p>
                  <input 
                    type="text" 
                    value={settings.platformName}
                    onChange={e => setSettings({...settings, platformName: e.target.value})}
                    className="w-full max-w-md px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Global Primary Color</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Used for buttons, links, and highlights across the entire platform.</p>
                  <div className="flex items-center gap-4">
                    <input 
                      type="color" 
                      value={settings.primaryColor}
                      onChange={e => setSettings({...settings, primaryColor: e.target.value})}
                      className="w-14 h-14 rounded-xl cursor-pointer border-0 p-0"
                    />
                    <input 
                      type="text" 
                      value={settings.primaryColor}
                      onChange={e => setSettings({...settings, primaryColor: e.target.value})}
                      className="w-32 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-mono uppercase text-sm"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Assets */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 border-b border-slate-100 dark:border-slate-800 pb-2">Digital Assets</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Global Default Logo</label>
                  <div className="w-full aspect-video rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center hover:border-primary-400 dark:hover:border-slate-700 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors cursor-pointer relative overflow-hidden group">
                    <img src={settings.logoUrl} alt="Logo" className="w-24 h-24 object-contain mb-2" />
                    <div className="absolute inset-0 bg-slate-900/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <LuImagePlus className="text-white mb-2" size={32} />
                      <span className="text-white font-bold text-sm">Change Logo</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Favicon</label>
                  <div className="w-full aspect-video rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center hover:border-primary-400 dark:hover:border-slate-700 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors cursor-pointer relative overflow-hidden group">
                    <img src={settings.faviconUrl} alt="Favicon" className="w-16 h-16 object-contain mb-2" />
                    <div className="absolute inset-0 bg-slate-900/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <LuImagePlus className="text-white mb-2" size={32} />
                      <span className="text-white font-bold text-sm">Change Favicon</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Login Screen */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 border-b border-slate-100 dark:border-slate-800 pb-2">Login Portal Design</h2>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Background Image</label>
                <div className="w-full h-48 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center hover:border-primary-400 dark:hover:border-slate-700 transition-colors cursor-pointer relative overflow-hidden group">
                  <img src={settings.loginBackgroundImage} alt="Login Background" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-slate-900/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <LuImagePlus className="text-white mb-2" size={32} />
                    <span className="text-white font-bold text-sm">Upload New Image</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Recommended size: 1920x1080px. Kept under 1MB for fast loading.</p>
              </div>
            </section>

          </form>
        </div>
      </div>
    </div>
  );
}

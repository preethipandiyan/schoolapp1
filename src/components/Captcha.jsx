import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { LuRefreshCw } from 'react-icons/lu';

const Captcha = forwardRef(({ onChange }, ref) => {
  const canvasRef = useRef(null);
  const [captchaText, setCaptchaText] = useState('');
  const [userInput, setUserInput] = useState('');
  const captchaTextRef = useRef('');

  const generateCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // Excluded confusing chars like O, 0, I, 1, l
    let text = '';
    for (let i = 0; i < 6; i++) {
      text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    captchaTextRef.current = text;
    setCaptchaText(text);
    setUserInput('');
    if (onChange) onChange(false); // Reset validation state

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Background
      ctx.fillStyle = '#f8fafc'; // slate-50
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Noise lines
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = `rgba(${Math.random()*100},${Math.random()*100},${Math.random()*100}, 0.2)`;
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.stroke();
      }

      // Draw text
      ctx.font = 'bold 30px "Courier New", monospace';
      ctx.fillStyle = '#334155'; // slate-700
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw characters with slight random rotation/position
      for(let i = 0; i < text.length; i++) {
        ctx.save();
        const x = 30 + (i * 25);
        const y = canvas.height / 2 + (Math.random() * 10 - 5);
        ctx.translate(x, y);
        ctx.rotate((Math.random() * 0.4) - 0.2); // Random rotation between -0.2 and 0.2 rad
        ctx.fillText(text[i], 0, 0);
        ctx.restore();
      }

      // Noise dots
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(${Math.random()*255},${Math.random()*255},${Math.random()*255}, 0.5)`;
        ctx.beginPath();
        ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setUserInput(val);
    const isValid = val.trim().toLowerCase() === captchaTextRef.current.trim().toLowerCase();
    if (onChange) onChange(isValid);
  };

  // Expose a method to force regenerate if submission fails
  useImperativeHandle(ref, () => ({
    regenerate: generateCaptcha
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <canvas 
          ref={canvasRef} 
          width="200" 
          height="60" 
          className="rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
        />
        <button
          type="button"
          onClick={generateCaptcha}
          className="p-3 text-slate-400 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-primary-100 dark:hover:border-slate-700"
          title="Refresh Captcha"
        >
          <LuRefreshCw size={20} />
        </button>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 ml-1">Verification Code</label>
        <input
          type="text"
          value={userInput}
          onChange={handleInputChange}
          placeholder="Enter the 6-character code"
          required
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 shadow-inner transition-all"
        />
      </div>
    </div>
  );
});

export default Captcha;

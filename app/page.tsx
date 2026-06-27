// suno-tube-app\app\page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Music, Image as ImageIcon, Download, Settings, Languages, CheckCircle2, PlayCircle, Type } from 'lucide-react';
import '../i18n';
import { useTranslation } from 'react-i18next';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export default function SunoTubeApp() {
  const { t, i18n } = useTranslation();
  const [ratio, setRatio] = useState('16:9');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // File states
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [filename, setFilename] = useState('');
  
  // Preview states
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [progress, setProgress] = useState(0);
  const [isFfmpegLoaded, setIsFfmpegLoaded] = useState(false);

  // FFmpeg reference - מתחילים אותו כריק (null) כדי למנוע קריסה בשרת
  const ffmpegRef = useRef<any>(null);

  // אתחול המנוע ועיצוב השפה בטעינה הראשונית (רץ רק בדפדפן)
  useEffect(() => {
    const loadFFmpeg = async () => {
      // מאתחלים את המנוע רק עכשיו כשאנחנו בטוחים שאנחנו בדפדפן ולא בשרת
      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg();
      }

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      const ffmpeg = ffmpegRef.current;
      
      // האזנה להתקדמות האחוזים
      ffmpeg.on('progress', ({ progress }: any) => {
        setProgress(Math.round(progress * 100));
      });

      try {
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        setIsFfmpegLoaded(true);
      } catch (error) {
        console.error('Error loading FFmpeg:', error);
      }
    };

    loadFFmpeg();
    setMounted(true);
    document.body.dir = i18n.language === 'he' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  // יצירת קישורים זמניים לתצוגה מקדימה
  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [audioFile]);

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImageUrl(null);
    }
  }, [imageFile]);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'he' ? 'ru' : 'he';
    i18n.changeLanguage(nextLang);
    document.body.dir = nextLang === 'he' ? 'rtl' : 'ltr';
  };

  const handleProcessVideo = async () => {
    if (!audioFile || !imageFile) return;
    if (!isFfmpegLoaded || !ffmpegRef.current) {
      alert('המערכת עדיין נטענת, אנא המתן מספר שניות...');
      return;
    }

    setIsLoading(true);
    setProgress(0);

    try {
      const ffmpeg = ffmpegRef.current;
      
      // 1. כתיבת הקבצים לזכרון הוירטואלי של הדפדפן
      await ffmpeg.writeFile('audio', await fetchFile(audioFile));
      await ffmpeg.writeFile('image', await fetchFile(imageFile));

      // 2. הגדרת פילטר לשינוי יחס גובה-רוחב כולל רקע שחור והתאמה מושלמת
      const scaleFilter = ratio === '16:9' 
        ? 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2' 
        : 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2';

      // 3. הפעלת פקודת העיבוד (שמירה על 320k בסאונד בשביל האיכות מסונו)
      await ffmpeg.exec([
        '-loop', '1',
        '-i', 'image',
        '-i', 'audio',
        '-vf', scaleFilter,
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-c:a', 'aac',
        '-b:a', '320k', 
        '-pix_fmt', 'yuv420p',
        '-shortest',
        'output.mp4'
      ]);

      // 4. קריאת הקובץ המוכן והפיכתו לקישור הורדה לנייד/מחשב
      const data = await ffmpeg.readFile('output.mp4');
      
      // עוקפים את הבדיקה המחמירה של TypeScript עבור SharedArrayBuffer
      const videoBlob = new Blob([data as any], { type: 'video/mp4' });
      const url = URL.createObjectURL(videoBlob);
      
      const finalFilename = filename.trim() ? `${filename.trim()}.mp4` : `SunoTube_${Date.now()}.mp4`;

      const a = document.createElement('a');
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating video:', error);
      alert('אירעה שגיאה בעיבוד הוידאו. ודא שהקבצים תקינים.');
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  if (!mounted) return null;

  const isReadyToProcess = audioFile && imageFile && !isLoading;

  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 md:p-8 font-sans transition-all duration-300">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-[#DEFF9A]">{t('title', { defaultValue: 'SunoTube Studio' })}</h1>
        <button 
          onClick={toggleLanguage}
          className="flex items-center gap-2 bg-[#1e1e1e] px-4 py-2 rounded-full border border-[#333] hover:border-[#DEFF9A] transition"
        >
          <Languages size={18} />
          <span>{i18n.language === 'he' ? 'Русский' : 'עברית'}</span>
        </button>
      </header>

      <main className="max-w-xl mx-auto space-y-6">
        {/* Step 1: Files */}
        <section className="bg-[#1e1e1e] p-6 rounded-2xl border border-[#333]">
          <div className="space-y-4">
            <div className={`relative group transition ${audioFile ? 'border-[#DEFF9A]' : 'border-[#333]'}`}>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-inherit rounded-xl hover:border-[#DEFF9A] cursor-pointer bg-black/20">
                {audioFile ? <CheckCircle2 className="text-[#DEFF9A] mb-2" /> : <Music className="text-[#DEFF9A] mb-2" />}
                <span className="text-sm font-medium text-center px-4">{audioFile ? audioFile.name : t('uploadAudio', { defaultValue: 'העלאת שיר (Suno)' })}</span>
                <input type="file" className="hidden" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            
            <div className={`relative group transition ${imageFile ? 'border-[#DEFF9A]' : 'border-[#333]'}`}>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-inherit rounded-xl hover:border-[#DEFF9A] cursor-pointer bg-black/20">
                {imageFile ? <CheckCircle2 className="text-[#DEFF9A] mb-2" /> : <ImageIcon className="text-[#DEFF9A] mb-2" />}
                <span className="text-sm font-medium text-center px-4">{imageFile ? imageFile.name : t('uploadImage', { defaultValue: 'תמונת רקע' })}</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>
        </section>

        {/* Step 1.5: Preview (Show only when both files are uploaded) */}
        {imageUrl && audioUrl && (
          <section className="bg-[#1e1e1e] p-6 rounded-2xl border border-[#333] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="flex items-center gap-2 mb-4 font-bold text-lg">
              <PlayCircle size={20} className="text-[#DEFF9A]" />
              {t('previewTitle', { defaultValue: 'תצוגה מקדימה' })}
            </h3>
            <div className="flex flex-col items-center gap-4">
              {/* Image Preview Container */}
              <div 
                className={`relative w-full bg-black rounded-xl overflow-hidden flex items-center justify-center transition-all duration-300 border border-[#333] shadow-inner ${
                  ratio === '16:9' ? 'aspect-video max-w-sm' : 'aspect-[9/16] max-w-[220px]'
                }`}
              >
                {/* Using object-contain simulates how FFmpeg pad works 
                  It keeps the whole image visible, padding with black bars if needed 
                */}
                <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" />
              </div>
              
              {/* Audio Player */}
              <audio controls src={audioUrl} className="w-full max-w-sm h-10 outline-none" />
            </div>
          </section>
        )}

        {/* Step 2: Settings */}
        <section className="bg-[#1e1e1e] p-6 rounded-2xl border border-[#333]">
          <h3 className="flex items-center gap-2 mb-4 font-bold text-lg">
            <Settings size={20} className="text-[#DEFF9A]" />
            {t('aspectRatio', { defaultValue: 'פורמט מסך' })}
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button 
              onClick={() => setRatio('16:9')}
              className={`p-4 rounded-xl border-2 transition ${ratio === '16:9' ? 'border-[#DEFF9A] bg-[#DEFF9A]/10' : 'border-[#333] hover:border-gray-500'}`}
            >
              <div className="aspect-video bg-gray-700 rounded mb-2 mx-auto w-2/3"></div>
              <span className="text-sm">{t('youtubeStandard', { defaultValue: 'יוטיוב רגיל (16:9)' })}</span>
            </button>
            <button 
              onClick={() => setRatio('9:16')}
              className={`p-4 rounded-xl border-2 transition ${ratio === '9:16' ? 'border-[#DEFF9A] bg-[#DEFF9A]/10' : 'border-[#333] hover:border-gray-500'}`}
            >
              <div className="aspect-[9/16] bg-gray-700 rounded mb-2 mx-auto w-8"></div>
              <span className="text-sm">{t('youtubeShorts', { defaultValue: 'שורטס (9:16)' })}</span>
            </button>
          </div>

          <hr className="border-[#333] mb-6" />

          {/* Custom Filename */}
          <div>
            <h3 className="flex items-center gap-2 mb-4 font-bold text-lg">
              <Type size={20} className="text-[#DEFF9A]" />
              {t('filenameLabel', { defaultValue: 'שם הקובץ (אופציונלי)' })}
            </h3>
            <div className="relative">
              <input 
                type="text" 
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder={t('filenamePlaceholder', { defaultValue: 'הכנס שם לקובץ...' })}
                className="w-full bg-[#121212] border border-[#333] rounded-xl p-4 text-white focus:outline-none focus:border-[#DEFF9A] transition"
                dir="auto"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm pointer-events-none" style={{ left: i18n.language === 'he' ? '1rem' : 'auto', right: i18n.language === 'he' ? 'auto' : '1rem' }}>
                .mp4
              </span>
            </div>
          </div>
        </section>

        {/* Action Button & Progress */}
        <div className="space-y-3">
          <button 
            onClick={handleProcessVideo}
            disabled={!isReadyToProcess}
            className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition ${
              isReadyToProcess 
                ? 'bg-[#DEFF9A] text-[#121212] hover:bg-[#c9e880] shadow-lg shadow-[#DEFF9A]/10' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Download size={22} />
            {isLoading ? `${t('processing', { defaultValue: 'מעבד וידאו...' })} ${progress}%` : t('download', { defaultValue: 'הורדת קליפ' })}
          </button>
          
          {isLoading && (
            <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
              <div className="bg-[#DEFF9A] h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-12 text-center text-gray-500 text-sm">
        v1.2 | Added Live Preview & Custom Filename
      </footer>
    </div>
  );
}
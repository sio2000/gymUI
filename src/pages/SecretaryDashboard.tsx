import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  QrCode, 
  Camera, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  User,
  Calendar,
  Shield,
  CreditCard,
  Clock,
  Euro,
  Check,
  X
} from 'lucide-react';
import { supabase } from '@/config/supabase';
import toast from 'react-hot-toast';
import { 
  getMembershipRequests,
  approveMembershipRequest,
  rejectMembershipRequest,
  formatPrice,
  getDurationLabel
} from '@/utils/membershipApi';
import { MembershipRequest } from '@/types';
import Webcam from 'react-webcam';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { BrowserQRCodeReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import type { Result, Exception } from '@zxing/library';

interface ScanResult {
  success: boolean;
  message: string;
  userData?: {
    id: string;
    email: string;
    name: string;
    category: string;
  };
  reason?: string;
}

const SecretaryDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [membershipRequests, setMembershipRequests] = useState<MembershipRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'scanner' | 'membership-requests'>('scanner');
  const [loading, setLoading] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Check if user is secretary
  useEffect(() => {
    console.log('🔍 [SecretaryDashboard] User role check:', user?.role);
    if (user && (user.role as string) !== 'secretary') {
      console.log('❌ [SecretaryDashboard] User is not secretary, showing error');
      toast.error('Δεν έχετε δικαίωμα πρόσβασης σε αυτή τη σελίδα');
      return;
    }
    console.log('✅ [SecretaryDashboard] User is secretary, proceeding');
  }, [user]);

  // Load recent scans
  useEffect(() => {
    loadRecentScans();
  }, []);

  // Load membership requests when tab is active
  useEffect(() => {
    if (activeTab === 'membership-requests') {
      loadMembershipRequests();
    }
  }, [activeTab]);

  // Debug video container rendering
  useEffect(() => {
    if (isScanning) {
      console.log('🎬 [UI] Video container rendering - isScanning:', isScanning, 'isVideoReady:', isVideoReady, 'cameraError:', cameraError);
      console.log('🎬 [UI] webcamRef.current:', webcamRef.current);
    }
  }, [isScanning, isVideoReady, cameraError]);

  const loadRecentScans = async () => {
    try {
      // First get the scan logs
      const { data: scanLogs, error: scanError } = await supabase
        .from('scan_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (scanError) throw scanError;

      // Then get user profiles for each scan
      const userIds = scanLogs?.map(scan => scan.user_id) || [];
      const { data: userProfiles, error: userError } = await supabase
        .from('user_profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);

      if (userError) throw userError;

      // Combine the data
      const combinedData = scanLogs?.map(scan => ({
        ...scan,
        user_profiles: userProfiles?.find(user => user.user_id === scan.user_id)
      })) || [];

      setRecentScans(combinedData);
    } catch (error) {
      console.error('Error loading recent scans:', error);
    }
  };

  // ===== MEMBERSHIP REQUESTS FUNCTIONS =====

  const loadMembershipRequests = async () => {
    try {
      setLoading(true);
      const requests = await getMembershipRequests();
      setMembershipRequests(requests);
    } catch (error) {
      console.error('Error loading membership requests:', error);
      toast.error('Σφάλμα κατά τη φόρτωση των αιτημάτων');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      setLoading(true);
      const success = await approveMembershipRequest(requestId);
      if (success) {
        toast.success('Το αίτημα εγκρίθηκε επιτυχώς!');
        loadMembershipRequests();
      }
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Σφάλμα κατά την έγκριση του αιτήματος');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const reason = prompt('Παρακαλώ εισάγετε τον λόγο απόρριψης:');
    if (!reason) return;

    try {
      setLoading(true);
      const success = await rejectMembershipRequest(requestId, reason);
      if (success) {
        toast.success('Το αίτημα απορρίφθηκε επιτυχώς!');
        loadMembershipRequests();
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Σφάλμα κατά την απόρριψη του αιτήματος');
    } finally {
      setLoading(false);
    }
  };

  const startScanning = () => {
    try {
      console.log('🎥 [Camera] Starting camera initialization...');
      console.log('🎥 [Camera] Current states - isScanning:', isScanning, 'isVideoReady:', isVideoReady, 'cameraError:', cameraError);
      
      setCameraError(null);
      setIsVideoReady(false);
      setIsScanning(true);
      setScanResult(null);
      setShowResult(false);
      
      console.log('🎥 [Camera] Initializing ZXing continuous reader...');
      
      // Start continuous decode via @zxing/browser
      setTimeout(() => {
        startContinuousZXing();
      }, 500);
      
    } catch (error) {
      console.error('❌ [Camera] Error starting scanning:', error);
      const errorMessage = error instanceof Error ? error.message : 'Άγνωστο σφάλμα';
      setCameraError(`Δεν ήταν δυνατή η έναρξη της σάρωσης: ${errorMessage}`);
      toast.error('Δεν ήταν δυνατή η έναρξη της σάρωσης');
    }
  };

  const stopScanning = () => {
    console.log('🛑 [Camera] Stopping scanning...');
    
    // Clear scan interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    setIsScanning(false);
    setIsVideoReady(false);
    setCameraError(null);

    try {
      // Stop ZXing controls if active
      try {
        scannerControlsRef.current?.stop();
      } catch {}
      const v = videoRef.current;
      const stream = v?.srcObject as MediaStream | undefined;
      stream?.getTracks().forEach(t => t.stop());
      if (v) {
        v.srcObject = null;
      }
    } catch (e) {
      console.log('🧹 [Camera] Cleanup error:', e);
    }
  };

  const startContinuousZXing = async () => {
    try {
      console.log('🔍 [QR Scanner] Starting continuous ZXing via BrowserQRCodeReader...');
      if (!videoRef.current) {
        console.log('❌ [QR Scanner] videoRef not available');
        return;
      }
      const reader = new BrowserQRCodeReader();
      qrReaderRef.current = reader;
      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      console.log('🎥 [Camera] Found devices:', devices.map(d => ({ id: d.deviceId?.slice(-6), label: d.label })));
      const backCamera = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
      const deviceId = backCamera?.deviceId || undefined;
      if (!deviceId) {
        console.warn('⚠️ [Camera] No camera deviceId resolved, falling back to default.');
      }

      await reader.decodeFromVideoDevice(deviceId, videoRef.current, async (result: Result | undefined, err: Exception | undefined, controls: IScannerControls) => {
        scannerControlsRef.current = controls;
        if (result) {
          const text = result.getText();
          console.log('✅ [QR Scanner] ZXing stream detected:', text);
          try {
            const pts = (result as any)?.getResultPoints?.() || [];
            if (pts && pts.length >= 3) {
              drawOverlayPolygon(pts.map((p: any) => ({ x: p.getX ? p.getX() : p.x, y: p.getY ? p.getY() : p.y })), 'rgba(16,185,129,0.9)');
            } else {
              drawOverlayBorder('rgba(16,185,129,0.9)');
            }
          } catch {}
          await processQRCode(text);
          controls.stop();
          stopScanning();
        } else if (err) {
          // Σιωπηλό αναμενόμενο error όταν δεν υπάρχει κώδικας στο καρέ, αλλά κρατάμε trace κάθε ~2s
          if ((Date.now() % 2000) < 50) {
            console.log('ℹ️ [QR Scanner] No code in frame yet. err:', err?.name || err);
          }
        }
      });
      setIsVideoReady(true);
      // Παράλληλο fallback loop με jsQR (αν δεν έχει ήδη ξεκινήσει)
      if (!scanIntervalRef.current) {
        startScanLoop();
      }
    } catch (e) {
      console.error('❌ [QR Scanner] Error starting continuous ZXing:', e);
      setCameraError('Αποτυχία εκκίνησης ZXing reader');
    }
  };

  const startScanLoop = () => {
    console.log('🔍 [QR Scanner] Starting scan loop with ZXing...');
    
    if (!videoRef.current) {
      console.log('❌ [QR Scanner] Video element not available');
      return;
    }

    // Clear any existing interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    // Create ZXing reader with hints to focus only on QR codes
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    const codeReader = new BrowserMultiFormatReader(hints, 100);
    
    // Configure ZXing for better QR code detection
    codeReader.timeBetweenDecodingAttempts = 80; // Faster scanning
    
    // Start scanning every 1000ms (slower for better performance)
    scanIntervalRef.current = setInterval(async () => {
      // Check if webcam is still available
      if (!videoRef.current) {
        console.log('🔍 [QR Scanner] Video element not available, stopping scan');
        return;
      }

      try {
        // Prefer grabbing the native video frame for maximum resolution
        const videoEl = videoRef.current as HTMLVideoElement | undefined;
        if (!videoEl || videoEl.readyState < 2) {
          console.log('🔍 [QR Scanner] Video element not ready');
          return;
        }
        const vW = videoEl.videoWidth;
        const vH = videoEl.videoHeight;
        if (!vW || !vH) {
          console.log('🔍 [QR Scanner] Invalid video dimensions');
          return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true } as unknown as CanvasRenderingContext2D);
        canvas.width = vW;
        canvas.height = vH;
        if (!ctx) {
          console.log('🔍 [QR Scanner] Canvas 2D context not available');
          return;
        }
        (ctx as CanvasRenderingContext2D).drawImage(videoEl, 0, 0, vW, vH);

        // Πλήρες καρέ + αντίγραφο για preprocessing
        const imageData = (ctx as CanvasRenderingContext2D).getImageData(0, 0, vW, vH);
        const imageDataOriginal = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
        console.log('🔍 [QR Scanner] Captured frame from video:', vW, 'x', vH);

        // Προεπεξεργασία: grayscale + threshold για αύξηση αντίθεσης πάνω σε αντίγραφο
        try {
          const pixels = imageData.data;
          let sum = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const gray = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
            pixels[i] = gray;
            pixels[i + 1] = gray;
            pixels[i + 2] = gray;
            sum += gray;
          }
          const avg = sum / (pixels.length / 4);
          const threshold = avg * 0.9; // ελαφρώς κάτω από τον μέσο όρο
          for (let i = 0; i < pixels.length; i += 4) {
            const v = pixels[i] > threshold ? 255 : 0;
            pixels[i] = v;
            pixels[i + 1] = v;
            pixels[i + 2] = v;
          }
          (ctx as CanvasRenderingContext2D).putImageData(imageData, 0, 0);
          console.log('🔍 [QR Scanner] Applied grayscale+threshold. Avg:', Math.round(avg), 'Threshold:', Math.round(threshold));
        } catch (prepErr) {
          console.log('🔍 [QR Scanner] Preprocess error (grayscale/threshold):', prepErr);
        }

        // 1) jsQR στο ORIGINAL ImageData (χωρίς αλλοίωση)
        try {
          const jsqrModule = await import('jsqr');
          const jsQR = jsqrModule.default;
          console.log('🔍 [QR Scanner] jsQR analyzing ORIGINAL (dontInvert/attemptBoth)...');
          const modes1 = ['dontInvert', 'attemptBoth'] as const;
          for (const mode of modes1) {
            const res = jsQR(imageDataOriginal.data, vW, vH, { inversionAttempts: mode });
            if (res && res.data) {
              try {
                drawOverlayPolygon([
                  res.location.topLeftCorner,
                  res.location.topRightCorner,
                  res.location.bottomRightCorner,
                  res.location.bottomLeftCorner,
                ], 'rgba(16,185,129,0.9)', vW, vH);
              } catch {}
              console.log(`✅ [QR Scanner] jsQR ORIGINAL detected (${mode}):`, res.data);
              await processQRCode(res.data);
              return;
            }
          }
        } catch (jsErr) {
          console.log('🔍 [QR Scanner] jsQR ORIGINAL error:', jsErr);
        }

        // 2) jsQR στο PREPROCESSED ImageData
        try {
          const jsqrModule = await import('jsqr');
          const jsQR = jsqrModule.default;
          console.log('🔍 [QR Scanner] jsQR analyzing PREPROCESSED (dontInvert/attemptBoth)...');
          const modes = ['dontInvert', 'attemptBoth'] as const;
          for (const mode of modes) {
            const res = jsQR(imageData.data, vW, vH, { inversionAttempts: mode });
            if (res && res.data) {
              try {
                drawOverlayPolygon([
                  res.location.topLeftCorner,
                  res.location.topRightCorner,
                  res.location.bottomRightCorner,
                  res.location.bottomLeftCorner,
                ], 'rgba(16,185,129,0.9)', vW, vH);
              } catch {}
              console.log(`✅ [QR Scanner] jsQR PREPROCESSED detected (${mode}):`, res.data);
              await processQRCode(res.data);
              return;
            }
          }
          console.log('🔍 [QR Scanner] jsQR did not detect, falling back to ZXing...');
        } catch (jsErr) {
          console.log('🔍 [QR Scanner] jsQR PREPROCESSED error:', jsErr);
        }

        // 3) ZXing: προσπάθεια σε κεντρικό crop 60% (συχνά ο κωδικός είναι στο κέντρο)
        try {
          const cropCanvas = document.createElement('canvas');
          const cropCtx = cropCanvas.getContext('2d');
          const cropW = Math.floor(vW * 0.6);
          const cropH = Math.floor(vH * 0.6);
          const sx = Math.floor((vW - cropW) / 2);
          const sy = Math.floor((vH - cropH) / 2);
          cropCanvas.width = cropW;
          cropCanvas.height = cropH;
          cropCtx?.drawImage(canvas, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

          const image = new Image();
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = reject;
            image.src = cropCanvas.toDataURL('image/png');
          });
          const result = await codeReader.decodeFromImage(image);
          if (result && result.getText) {
            const text = result.getText();
            try {
              const pts = (result as any)?.getResultPoints?.() || [];
              if (pts && pts.length >= 3) {
                drawOverlayPolygon(pts.map((p: any) => ({ x: p.getX ? p.getX() : p.x, y: p.getY ? p.getY() : p.y })), 'rgba(16,185,129,0.9)');
              } else {
                drawOverlayBorder('rgba(16,185,129,0.9)');
              }
            } catch {}
            console.log('✅ [QR Scanner] ZXing detected from CENTER CROP image:', text);
            await processQRCode(text);
            return;
          }
          console.log('🔍 [QR Scanner] ZXing returned empty result from center crop');
        } catch (zerr) {
          console.log('🔍 [QR Scanner] ZXing image decode error:', zerr);
          console.log('🔍 [QR Scanner] No QR code found in this frame');
          // Log central crop sample to aid debugging (downscale to 512 for readability)
          try {
            const dbg = document.createElement('canvas');
            const dctx = dbg.getContext('2d');
            const cropW = Math.floor(vW * 0.6);
            const cropH = Math.floor(vH * 0.6);
            const sx = Math.floor((vW - cropW) / 2);
            const sy = Math.floor((vH - cropH) / 2);
            if (dctx) {
              dbg.width = 512;
              dbg.height = Math.floor(512 * (cropH / cropW));
              dctx.drawImage(canvas, sx, sy, cropW, cropH, 0, 0, dbg.width, dbg.height);
              console.log('🔍 [QR Scanner] Debug crop data URL:', dbg.toDataURL('image/png').slice(0, 100) + '...');
            }
          } catch (cropErr) {
            console.log('🔍 [QR Scanner] Debug crop error:', cropErr);
          }
        }

        // 4) Multi-scale προσπάθειες (ορισμένοι decoders λειτουργούν καλύτερα σε χαμηλότερη ανάλυση)
        try {
          const scales = [0.8, 0.6, 0.5, 0.4];
          for (const s of scales) {
            const sw = Math.max(160, Math.floor(vW * s));
            const sh = Math.max(120, Math.floor(vH * s));
            const sc = document.createElement('canvas');
            const sctx = sc.getContext('2d');
            sc.width = sw; sc.height = sh;
            sctx?.drawImage(canvas, 0, 0, vW, vH, 0, 0, sw, sh);
            const scaledImg = new Image();
            await new Promise<void>((resolve, reject) => {
              scaledImg.onload = () => resolve();
              scaledImg.onerror = reject;
              scaledImg.src = sc.toDataURL('image/png');
            });
            try {
              const zr = await codeReader.decodeFromImage(scaledImg);
              if (zr && zr.getText) {
                console.log(`✅ [QR Scanner] ZXing detected at scale ${s}:`, zr.getText());
                await processQRCode(zr.getText());
                return;
              }
            } catch (_) { /* continue */ }

            try {
              const jsqrModule = await import('jsqr');
              const jsQR = jsqrModule.default;
              const sImageData = sctx?.getImageData(0, 0, sw, sh);
              if (sImageData) {
                const res = jsQR(sImageData.data, sw, sh, { inversionAttempts: 'attemptBoth' });
                if (res && res.data) {
                  console.log(`✅ [QR Scanner] jsQR detected at scale ${s}:`, res.data);
                  await processQRCode(res.data);
                  return;
                }
              }
            } catch (_) { /* continue */ }
          }
          console.log('🔍 [QR Scanner] Multi-scale attempts completed without detection');
        } catch (msErr) {
          console.log('🔍 [QR Scanner] Multi-scale error:', msErr);
        }
      } catch (error) {
        console.error('❌ [QR Scanner] Error capturing image:', error);
      }
    }, 1000); // Check every 1000ms
  };

  // Process ULTRA SIMPLE QR format: userId__category__timestamp (or older formats for backwards compatibility)
  const processUltraSimpleQR = async (qrData: string) => {
    console.log('🔍 [Ultra Simple QR] Processing ultra simple QR format');
    console.log('🔍 [Ultra Simple QR] QR Data:', qrData);
    
     // Find QR code by qr_token with user profile join
    const { data: qrCode, error: qrError } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('qr_token', qrData)
      .eq('status', 'active')
      .maybeSingle();

    console.log('🔍 [Ultra Simple QR] Database query result:', qrCode ? 'Found' : 'Not found', qrError ? 'Error' : 'No error');
    console.log('🔍 [Ultra Simple QR] QR Code data:', qrCode);
    console.log('🔍 [Ultra Simple QR] QR Error:', qrError);

    if (qrError || !qrCode) {
      console.log('❌ [Ultra Simple QR] QR code validation failed');
      setScanResult({
        success: false,
        message: 'Μη έγκυρο QR Code',
        reason: 'QR Code δεν βρέθηκε ή είναι ανενεργό'
      });
      setShowResult(true);
      stopScanning();
      return;
    }

    // Get user profile data manually
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name')
      .eq('user_id', qrCode.user_id)
      .maybeSingle();

    console.log('🔍 [Ultra Simple QR] User profile query result:', userProfile ? 'Found' : 'Not found', userError ? 'Error' : 'No error');
    console.log('🔍 [Ultra Simple QR] User profile data:', userProfile);
    console.log('🔍 [Ultra Simple QR] User profile error:', userError);

    // Check if QR code is expired
    if (qrCode.expires_at && new Date(qrCode.expires_at) < new Date()) {
      console.log('❌ [Ultra Simple QR] QR code is expired');
      setScanResult({
        success: false,
        message: 'QR Code έχει λήξει',
        reason: 'Το QR Code έχει λήξει και δεν είναι πλέον έγκυρο'
      });
      setShowResult(true);
      stopScanning();
      return;
    }

    // Success! Use the manually fetched user profile data
    console.log('✅ [Ultra Simple QR] QR code validated successfully for user:', userProfile?.first_name, userProfile?.last_name);
    console.log('✅ [Ultra Simple QR] Full user profile data:', userProfile);
    console.log('✅ [Ultra Simple QR] QR code data:', qrCode);
    
    setScanResult({
      success: true,
      message: 'Επιτυχής είσοδος!',
      userData: {
        id: userProfile?.id || 'unknown',
        email: userProfile?.email || 'unknown@email.com',
        name: `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || 'Άγνωστος',
        category: qrCode.category
      }
    });
    setShowResult(true);
    stopScanning();
    loadRecentScans();
  };

  // Process simple QR format: QR_USER_CATEGORY (OLD FORMAT - KEEP FOR BACKWARDS COMPATIBILITY)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const processSimpleQR = async (userId: string, category: string) => {
    console.log('🔍 [Simple QR] Processing simple QR format');
    console.log('🔍 [Simple QR] User ID:', userId, 'Category:', category);
    
    // Find QR code in database by user and category
    const { data: qrCode, error: qrError } = await supabase
      .from('qr_codes')
      .select('*, user_profiles!inner(id, email, first_name, last_name)')
      .eq('user_id', userId)
      .eq('category', category.toLowerCase())
      .eq('status', 'active')
      .single();

    console.log('🔍 [Simple QR] Database query result:', qrCode ? 'Found' : 'Not found', qrError ? 'Error' : 'No error');

    if (qrError || !qrCode) {
      console.log('❌ [Simple QR] QR code validation failed');
      setScanResult({
        success: false,
        message: 'Μη έγκυρο QR Code',
        reason: 'QR Code δεν βρέθηκε ή είναι ανενεργό'
      });
      setShowResult(true);
      stopScanning();
      return;
    }

    // Check if QR code is expired
    if (qrCode.expires_at && new Date(qrCode.expires_at) < new Date()) {
      console.log('❌ [Simple QR] QR code is expired');
      setScanResult({
        success: false,
        message: 'QR Code έχει λήξει',
        reason: 'Το QR Code έχει λήξει και δεν είναι πλέον έγκυρο'
      });
      setShowResult(true);
      stopScanning();
      return;
    }

    // Success! Get user data from the joined query
    const userProfile = qrCode.user_profiles;
    console.log('✅ [Simple QR] QR code validated successfully for user:', userProfile.first_name, userProfile.last_name);
    
    setScanResult({
      success: true,
      message: 'Επιτυχής είσοδος!',
      userData: {
        id: userProfile.id,
        email: userProfile.email,
        name: `${userProfile.first_name} ${userProfile.last_name}`.trim() || 'Άγνωστος',
        category: qrCode.category
      }
    });
    setShowResult(true);
    stopScanning();
    loadRecentScans();
  };

  // Process standard QR format: qrId:userId:category:timestamp:signature (OLD FORMAT - KEEP FOR BACKWARDS COMPATIBILITY)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const processStandardQR = async (qrId: string, userId: string, category: string) => {
    console.log('🔍 [Standard QR] Processing standard QR format');
    console.log('🔍 [Standard QR] QR ID:', qrId, 'User ID:', userId, 'Category:', category);
    
    // Validate QR code in database with user profile
    const { data: qrCode, error: qrError } = await supabase
      .from('qr_codes')
      .select('*, user_profiles!inner(id, email, first_name, last_name)')
      .eq('id', qrId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    console.log('🔍 [Standard QR] Database query result:', qrCode ? 'Found' : 'Not found', qrError ? 'Error' : 'No error');

    if (qrError || !qrCode) {
      console.log('❌ [Standard QR] QR code validation failed');
      setScanResult({
        success: false,
        message: 'Μη έγκυρο QR Code',
        reason: 'QR Code δεν βρέθηκε ή είναι ανενεργό'
      });
      setShowResult(true);
      stopScanning();
      return;
    }

    // Check if QR code is expired
    if (qrCode.expires_at && new Date(qrCode.expires_at) < new Date()) {
      console.log('❌ [Standard QR] QR code is expired');
      setScanResult({
        success: false,
        message: 'QR Code έχει λήξει',
        reason: 'Το QR Code έχει λήξει και δεν είναι πλέον έγκυρο'
      });
      setShowResult(true);
      stopScanning();
      return;
    }

    // Success! Get user data from the joined query
    const userProfile = qrCode.user_profiles;
    console.log('✅ [Standard QR] QR code validated successfully for user:', userProfile.first_name, userProfile.last_name);
    
    setScanResult({
      success: true,
      message: 'Επιτυχής είσοδος!',
      userData: {
        id: userProfile.id,
        email: userProfile.email,
        name: `${userProfile.first_name} ${userProfile.last_name}`.trim() || 'Άγνωστος',
        category: qrCode.category
      }
    });
    setShowResult(true);
    stopScanning();
    loadRecentScans();
  };

  // Process URL QR format: https://qr.codes/xxxxx
  const processURLQR = async (qrData: string) => {
    console.log('🔍 [URL QR] Processing URL QR format:', qrData);
    
    // First, try to find this QR code in our database
    console.log('🔍 [URL QR] Checking if QR code exists in database...');
    const { data: qrCode, error: qrError } = await supabase
      .from('qr_codes')
      .select('*, user_profiles!inner(id, email, first_name, last_name)')
      .eq('qr_token', qrData)
      .eq('status', 'active')
      .single();

    if (qrError || !qrCode) {
      console.log('🔍 [URL QR] QR code not found in database, treating as external');
      // External QR code - show generic success message
      setScanResult({
        success: true,
        message: 'Εξωτερικό QR Code σαρώθηκε!',
        userData: {
          id: 'external',
          email: 'External QR Code',
          name: 'Εξωτερικό QR Code',
          category: 'external'
        }
      });
    } else {
      console.log('🔍 [URL QR] QR code found in database, processing as valid user QR');
      // Found in database - process as valid user QR
      const userProfile = qrCode.user_profiles;
      setScanResult({
        success: true,
        message: 'Επιτυχής είσοδος!',
        userData: {
          id: userProfile.id,
          email: userProfile.email,
          name: `${userProfile.first_name} ${userProfile.last_name}`.trim() || 'Άγνωστος',
          category: qrCode.category
        }
      });
    }
    
    setShowResult(true);
    stopScanning();
    loadRecentScans();
  };

  // Test QR function removed - no longer needed

  const processQRCode = async (qrData: string) => {
    try {
      console.log('🔍 [QR Process] Processing QR data:', qrData);
      console.log('🔍 [QR Process] QR data length:', qrData.length);
      console.log('🔍 [QR Process] QR data type:', typeof qrData);
      
      // Handle different QR code formats
      // 0) Opaque short token (current format): letters/digits, 6-64 chars
      if (/^[A-Za-z0-9]{6,64}$/.test(qrData)) {
        console.log('🔍 [QR Process] Opaque short token detected');
        await processUltraSimpleQR(qrData);
      } else if (qrData.includes('__') && qrData.length > 36) {
        // ULTRA SIMPLE format: userId__category__timestamp
        console.log('🔍 [QR Process] Ultra simple QR format detected (userId__category__timestamp)');
        console.log('🔍 [QR Process] QR Data:', qrData);
        await processUltraSimpleQR(qrData);
      } else if (qrData.includes('_') && qrData.length > 36) {
        // OLD FORMAT: userId_category_timestamp (backwards compatibility)
        console.log('🔍 [QR Process] Old QR format detected (userId_category_timestamp)');
        console.log('🔍 [QR Process] QR Data:', qrData);
        await processUltraSimpleQR(qrData);
      } else if (qrData.includes('-') && qrData.length > 36) {
        // OLD FORMAT: userId-category-timestamp (backwards compatibility)
        console.log('🔍 [QR Process] Old QR format detected (userId-category-timestamp)');
        console.log('🔍 [QR Process] QR Data:', qrData);
        await processUltraSimpleQR(qrData);
      } else if (qrData.includes(':') && qrData.length > 50) {
        // COMPLEX format: id:userId:category:timestamp:hash
        console.log('🔍 [QR Process] Complex QR format detected (id:userId:category:timestamp:hash)');
        console.log('🔍 [QR Process] QR Data:', qrData);
        await processUltraSimpleQR(qrData);
      } else if (qrData.startsWith('https://')) {
        // URL format: https://qr.codes/xxxxx
        console.log('🔍 [QR Process] URL format detected');
        await processURLQR(qrData);
      } else {
        console.log('❌ [QR Process] Unknown QR code format');
        throw new Error('Unknown QR code format');
      }

    } catch (error) {
      console.error('Error processing QR code:', error);
      setScanResult({
        success: false,
        message: 'Σφάλμα επεξεργασίας QR Code',
        reason: 'Μη έγκυρο ή απροσδιόριστο QR Code format'
      });
      setShowResult(true);
      stopScanning();
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'free_gym': return 'Ελεύθερο Gym';
      case 'pilates': return 'Pilates';
      case 'personal': return 'Personal Training';
      default: return category;
    }
  };

  // Overlay helpers
  const clearOverlay = () => {
    const c = overlayCanvasRef.current;
    const v = videoRef.current;
    if (!c || !v) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    c.width = v.clientWidth;
    c.height = v.clientHeight;
    ctx.clearRect(0, 0, c.width, c.height);
  };

  const drawOverlayBorder = (color: string) => {
    const c = overlayCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
  };

  const drawOverlayPolygon = (points: Array<{ x: number; y: number }>, color: string, srcW?: number, srcH?: number) => {
    const c = overlayCanvasRef.current;
    const v = videoRef.current;
    if (!c || !v || !points?.length) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    // scale points from source dimensions to canvas dimensions if needed
    const scaleX = srcW ? c.width / srcW : 1;
    const scaleY = srcH ? c.height / srcH : 1;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    points.forEach((p, i) => {
      const x = p.x * scaleX;
      const y = p.y * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  };

  const closeResult = () => {
    setShowResult(false);
    setScanResult(null);
  };

  if (!user || (user.role as string) !== 'secretary') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Δεν έχετε δικαίωμα πρόσβασης</h1>
          <p className="text-gray-600">Αυτή η σελίδα είναι διαθέσιμη μόνο για γραμματεία</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Secretary Dashboard</h1>
              <p className="text-gray-600">
                {activeTab === 'scanner' ? 'Σαρώστε QR codes για είσοδο/έξοδο' : 'Διαχείριση αιτημάτων συνδρομών'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={activeTab === 'scanner' ? loadRecentScans : loadMembershipRequests}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Ανανέωση</span>
              </button>
              <button
                onClick={logout}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Αποσύνδεση</span>
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="border-t border-gray-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('scanner')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'scanner'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <QrCode className="h-5 w-5" />
                  <span>QR Scanner</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('membership-requests')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'membership-requests'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Αιτήματα Συνδρομών</span>
                </div>
              </button>
            </nav>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'scanner' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
            {/* QR Scanner */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">QR Code Scanner</h2>
            
            <div className="space-y-4">
              {!isScanning ? (
                <div className="text-center py-12">
                  <Camera className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Ξεκινήστε τη σάρωση</h3>
                  <p className="text-gray-600 mb-6">Πατήστε το κουμπί για να ανοίξετε την κάμερα</p>
                  <button
                    onClick={() => {
                      console.log('🎯 [UI] Start scanning button clicked');
                      startScanning();
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Camera className="h-5 w-5 inline mr-2" />
                    Ξεκινήστε σάρωση
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div 
                    className="relative bg-black rounded-lg overflow-hidden" 
                    style={{ aspectRatio: '16/9', minHeight: '200px' }}
                    data-scanning={isScanning ? 'true' : 'false'}
                  >
                    {/* Overlay for detected QR bounds */}
                    <canvas
                      ref={overlayCanvasRef}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    />
                    {/* Continuous ZXing video */}
                    <video
                      ref={videoRef}
                      className="w-full h-full object-contain bg-black"
                      playsInline
                      muted
                      autoPlay
                    />
                    
                    {/* Loading State */}
                    {!isVideoReady && !cameraError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                        <div className="text-center text-white">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                          <p className="text-sm">Φόρτωση κάμερας...</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Error State */}
                    {cameraError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-90">
                        <div className="text-center text-white p-4">
                          <XCircle className="h-12 w-12 mx-auto mb-4 text-red-300" />
                          <p className="text-sm font-medium mb-2">Σφάλμα κάμερας</p>
                          <p className="text-xs text-red-200">{cameraError}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Scan Overlay */}
                    {isVideoReady && !cameraError && (
                      <>
                        <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none">
                          <div className="absolute top-2 left-2 right-2 bg-blue-500 text-white text-center py-1 rounded text-sm">
                            Σαρώστε QR Code εδώ
                          </div>
                        </div>
                        
                        {/* Debug info */}
                        <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
                          Camera Status: {isVideoReady ? 'Ready' : 'Loading'}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => stopScanning()}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <XCircle className="h-4 w-4 inline mr-2" />
                      Σταματήστε σάρωση
                    </button>
                    
                    {cameraError && (
                      <button
                        onClick={startScanning}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Camera className="h-4 w-4 inline mr-2" />
                        Δοκιμάστε ξανά
                      </button>
                    )}
                  </div>
            </div>
          )}
          {/* Canvas removed - using direct video scanning */}
        </div>
          </div>

          {/* Recent Scans */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Πρόσφατες σαρώσεις</h2>
            
            {recentScans.length === 0 ? (
              <div className="text-center py-8">
                <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Δεν υπάρχουν πρόσφατες σαρώσεις</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentScans.map((scan, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${scan.status === 'approved' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {scan.status === 'approved' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {scan.user_profiles ? `${scan.user_profiles.first_name} ${scan.user_profiles.last_name}` : 'Άγνωστος'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {getCategoryLabel(scan.category)} • {scan.scan_type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {new Date(scan.created_at).toLocaleTimeString('el-GR')}
                      </p>
                      <p className={`text-xs font-medium ${scan.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                        {scan.status === 'approved' ? 'Εγκεκριμένο' : 'Απορριφθέν'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        ) : (
          /* Membership Requests */
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Αιτήματα Συνδρομών</h2>
              <button
                onClick={loadMembershipRequests}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4 inline mr-2" />
                Ανανέωση
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Φόρτωση αιτημάτων...</p>
              </div>
            ) : membershipRequests.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Δεν υπάρχουν αιτήματα</h3>
                <p className="text-gray-600">Δεν υπάρχουν εκκρεμή αιτήματα συνδρομών</p>
              </div>
            ) : (
              <div className="space-y-4">
                {membershipRequests.filter(request => request.status === 'pending').map((request) => (
                  <div key={request.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{request.user?.name || 'Άγνωστος χρήστης'}</h3>
                            <p className="text-sm text-gray-600">{request.user?.email || 'Δεν υπάρχει email'}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                          <div className="flex items-center space-x-2">
                            <CreditCard className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              <span className="font-medium">Πακέτο:</span> {request.package?.name || 'Άγνωστο πακέτο'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              <span className="font-medium">Διάρκεια:</span> {getDurationLabel(request.duration_type)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Euro className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              <span className="font-medium">Τιμή:</span> {formatPrice(request.requested_price)}
                            </span>
                          </div>
                        </div>
                        
                        {/* Show classes count for Pilates requests */}
                        {request.classes_count && request.classes_count > 0 && (
                          <div className="mt-3 p-3 bg-pink-50 border border-pink-200 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <span className="text-2xl">🧘</span>
                              <span className="text-sm font-medium text-pink-800">
                                Μαθήματα Pilates: {request.classes_count}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        <div className="mt-3 text-sm text-gray-500">
                          <span className="font-medium">Ημερομηνία αίτησης:</span> {new Date(request.created_at).toLocaleDateString('el-GR')}
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleApproveRequest(request.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                        >
                          <Check className="h-4 w-4 inline mr-1" />
                          Έγκριση
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Λόγος απόρριψης:');
                            if (reason) {
                              handleRejectRequest(request.id, reason);
                            }
                          }}
                          className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                        >
                          <X className="h-4 w-4 inline mr-1" />
                          Απόρριψη
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scan Result Modal */}
      {showResult && scanResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 ${
                scanResult.success ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {scanResult.success ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-600" />
                )}
              </div>
              
              <h3 className={`text-lg font-semibold mb-2 ${
                scanResult.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {scanResult.message}
              </h3>
              
              {scanResult.userData && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <User className="h-4 w-4 text-gray-600" />
                    <span className="font-medium">{scanResult.userData.name}</span>
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-600">{scanResult.userData.email}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <QrCode className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-600">{getCategoryLabel(scanResult.userData.category)}</span>
                  </div>
                </div>
              )}
              
              {scanResult.reason && (
                <p className="text-sm text-gray-600 mb-4">{scanResult.reason}</p>
              )}
              
              <button
                onClick={closeResult}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Κλείσιμο
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecretaryDashboard;
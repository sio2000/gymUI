// QR System Utilities
// Feature Flag: FEATURE_QR_SYSTEM
// Handles QR code generation, validation, and security

import { supabase } from '@/config/supabase';

// Types
export interface QRCode {
  id: string;
  user_id: string;
  category: 'free_gym' | 'pilates' | 'personal';
  status: 'active' | 'inactive' | 'expired' | 'revoked';
  qr_token: string;
  issued_at: string;
  expires_at?: string;
  last_scanned_at?: string;
  scan_count: number;
  created_at: string;
  updated_at: string;
}

export interface ScanResult {
  result: 'approved' | 'rejected';
  reason?: string;
  user_id?: string;
  category?: string;
  qr_id?: string;
}

export interface ScanAuditLog {
  id: string;
  qr_id: string;
  user_id: string;
  secretary_id?: string;
  scan_type: 'entrance' | 'exit';
  result: 'approved' | 'rejected';
  reason?: string;
  ip_address?: string;
  user_agent?: string;
  scanned_at: string;
  created_at: string;
}

// Configuration
const QR_CONFIG = {
  TOKEN_EXPIRY_HOURS: 24,
  MAX_SCANS_PER_DAY: 10,
  SECRET_KEY: import.meta.env.VITE_QR_SECRET_KEY || 'default_secret_key_change_in_production',
};

// ULTRA SIMPLE QR token generation for easy scanning (very short opaque token)
export function generateQRToken(_qrId: string, _userId: string, _category?: string): string {
  // Compact opaque token: 10-12 base36 chars for very low QR density
  const rand = Math.random().toString(36).slice(2, 8); // 6 chars
  const t = Date.now().toString(36).slice(-6); // 6 chars
  return `${rand}${t}`; // ~12 chars
}

// Simple HMAC implementation for browser (unused but kept for future use)
// function generateHMAC(message: string, key: string): string {
//   // Simple hash function for demo purposes
//   // In production, use a proper HMAC library
//   const combined = key + message;
//   let hash = 0;
//   for (let i = 0; i < combined.length; i++) {
//     const char = combined.charCodeAt(i);
//     hash = ((hash << 5) - hash) + char;
//     hash = hash & hash; // Convert to 32-bit integer
//   }
//   return Math.abs(hash).toString(16);
// }

// Generate UUID for browser compatibility (unused but kept for future use)
// function generateUUID(): string {
//   if (typeof crypto !== 'undefined' && crypto.randomUUID) {
//     return crypto.randomUUID();
//   }
//   // Fallback for older browsers
//   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
//     const r = Math.random() * 16 | 0;
//     const v = c === 'x' ? r : (r & 0x3 | 0x8);
//     return v.toString(16);
//   });
// }

// ULTRA SIMPLE QR token validation
export function validateQRToken(token: string, _qrId: string, userId: string, _category?: string): boolean {
  try {
    // Ultra simple format: check if token starts with userId
    return token.startsWith(userId);
  } catch (error) {
    console.error('QR token validation error:', error);
    return false;
  }
}

// Generate QR code for user
export async function generateQRCode(
  userId: string, 
  category: 'free_gym' | 'pilates' | 'personal',
  expiresAt?: Date
): Promise<{ qrCode: QRCode; qrData: string }> {
  try {
    // Feature flag check removed - QR system is always enabled
    
    // Ensure user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }
    
    // Verify the userId matches the authenticated user
    if (user.id !== userId) {
      throw new Error('User ID mismatch');
    }

    // IMPORTANT: Eligibility rules per category
    console.log(`[QR-Generator] Checking user permissions for category: ${category}`);

    if (category === 'personal') {
      // For Personal Training: eligibility comes from accepted personal_training_schedules
      const { data: schedule, error: scheduleError } = await supabase
        .from('personal_training_schedules')
        .select('id,status')
        .eq('user_id', userId)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(1);

      if (scheduleError || !schedule || schedule.length === 0) {
        console.log('[QR-Generator] No accepted personal schedule found.');
        throw new Error("Δεν έχετε εγκεκριμένο πρόγραμμα Personal.");
      }
      console.log('[QR-Generator] Found accepted personal schedule.');
    } else {
      // For Free Gym & Pilates: require active membership record
      const categoryToPackageTypes: Record<string, string[]> = {
        'free_gym': ['free_gym', 'standard'],
        'pilates': ['pilates'],
        'personal': ['personal_training', 'personal']
      };
      const packageTypes = categoryToPackageTypes[category];
      if (!packageTypes) {
        throw new Error(`Invalid QR category: ${category}`);
      }

      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select(`
          id,
          is_active,
          end_date,
          membership_packages!inner(package_type)
        `)
        .eq('user_id', userId)
        .in('membership_packages.package_type', packageTypes)
        .eq('is_active', true)
        .gte('end_date', new Date().toISOString().split('T')[0])
        .single();

      if (membershipError || !membership) {
        console.log(`[QR-Generator] No active membership found for category: ${category}, packageTypes: ${packageTypes.join(', ')}`);
        throw new Error(`Δεν έχετε ενεργή συνδρομή για την κατηγορία ${category}.`);
      }
      console.log(`[QR-Generator] User has active membership for ${category}:`, membership);
    }

    // Check if user already has active QR code for this specific category
    const { data: existingQR, error: existingError } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('category', category)
      .eq('status', 'active')
      .maybeSingle();

    if (existingQR && !existingError) {
      // Return existing QR code for this category
      const qrData = generateQRToken(existingQR.id, userId, existingQR.category);
      return { qrCode: existingQR, qrData };
    }
    
    // If there's an error checking existing QR, log it but continue
    if (existingError) {
      console.log('No existing QR code found, creating new one:', existingError.message);
    }

    // Create new QR code with ultra-simple approach
    const qrToken = generateQRToken('', userId, category);
    
    // First, try to deactivate any existing QR codes for this category
    await supabase
      .from('qr_codes')
      .update({ status: 'inactive' })
      .eq('user_id', userId)
      .eq('category', category)
      .eq('status', 'active');
    
    // Insert new QR code with RLS bypass for INSERT
    const { data: qrCode, error } = await supabase
      .from('qr_codes')
      .insert({
        user_id: userId,
        category,
        status: 'active',
        qr_token: qrToken,
        issued_at: new Date().toISOString(),
        expires_at: expiresAt?.toISOString() || null,
      })
      .select()
      .single();

    if (error) {
      console.error('QR code insert error:', error);
      console.error('QR code data being inserted:', {
        user_id: userId,
        category,
        status: 'active',
        qr_token: qrToken,
        expires_at: expiresAt?.toISOString() || null,
      });
      throw error;
    }

    // Return the qrToken as qrData for QR code generation
    return { qrCode, qrData: qrToken };
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

// Validate QR code scan
export async function validateQRCode(
  qrData: string,
  scanType: 'entrance' | 'exit',
  secretaryId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<ScanResult> {
  try {
    // Check if feature is enabled
    const { data: featureFlag } = await supabase
      .from('feature_flags')
      .select('is_enabled')
      .eq('name', 'FEATURE_QR_SYSTEM')
      .single();

    if (!featureFlag?.is_enabled) {
      return { result: 'rejected', reason: 'system_disabled' };
    }

    // Opaque short token: validate solely against DB by qr_token
    const { data: qrCode, error } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('qr_token', qrData)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !qrCode) {
      return { result: 'rejected', reason: 'not_found' };
    }

    // Check if QR code is active
    if (qrCode.status !== 'active') {
      return { result: 'rejected', reason: qrCode.status };
    }

    // Check if QR code is expired
    if (qrCode.expires_at && new Date(qrCode.expires_at) < new Date()) {
      // Update status to expired
      await supabase
        .from('qr_codes')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', qrCode.id);
      
      return { result: 'rejected', reason: 'expired' };
    }

    // Check scan limits (prevent abuse)
    if (qrCode.scan_count >= QR_CONFIG.MAX_SCANS_PER_DAY) {
      return { result: 'rejected', reason: 'scan_limit_exceeded' };
    }

    // Update scan info
    await supabase
      .from('qr_codes')
      .update({
        last_scanned_at: new Date().toISOString(),
        scan_count: qrCode.scan_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', qrCode.id);

    // Log scan attempt
    await logScanAttempt({
      qr_id: qrCode.id,
      user_id: qrCode.user_id,
      secretary_id: secretaryId,
      scan_type: scanType,
      result: 'approved',
      reason: 'active',
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return {
      result: 'approved',
      reason: 'active',
      user_id: qrCode.user_id,
      category: qrCode.category,
      qr_id: qrCode.id,
    };
  } catch (error) {
    console.error('Error validating QR code:', error);
    return { result: 'rejected', reason: 'system_error' };
  }
}

// Log scan attempt
async function logScanAttempt(logData: Omit<ScanAuditLog, 'id' | 'scanned_at' | 'created_at'>): Promise<void> {
  try {
    await supabase
      .from('scan_audit_logs')
      .insert({
        ...logData,
        scanned_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Error logging scan attempt:', error);
    // Don't throw - logging failure shouldn't break the scan
  }
}

// Get user's QR codes
export async function getUserQRCodes(userId: string): Promise<QRCode[]> {
  try {
    const { data, error } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error getting user QR codes:', error);
      throw error;
    }
    
    console.log('QR codes from database:', data);
    return data || [];
  } catch (error) {
    console.error('Error getting user QR codes:', error);
    // Return empty array instead of throwing to prevent UI errors
    return [];
  }
}

// Get scan audit logs
export async function getScanAuditLogs(
  secretaryId?: string,
  limit: number = 50,
  offset: number = 0
): Promise<ScanAuditLog[]> {
  try {
    let query = supabase
      .from('scan_audit_logs')
      .select(`
        *,
        qr_codes!inner(user_id, category),
        user_profiles!inner(first_name, last_name)
      `)
      .order('scanned_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (secretaryId) {
      query = query.eq('secretary_id', secretaryId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting scan audit logs:', error);
    throw error;
  }
}

// Revoke QR code
export async function revokeQRCode(qrId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('qr_codes')
      .update({ 
        status: 'revoked',
        updated_at: new Date().toISOString(),
      })
      .eq('id', qrId);

    if (error) throw error;
  } catch (error) {
    console.error('Error revoking QR code:', error);
    throw error;
  }
}

// Check if QR system is enabled
export async function isQRSystemEnabled(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('is_enabled')
      .eq('name', 'FEATURE_QR_SYSTEM')
      .single();

    if (error) return false;
    return data?.is_enabled || false;
  } catch (error) {
    console.error('Error checking QR system status:', error);
    return false;
  }
}

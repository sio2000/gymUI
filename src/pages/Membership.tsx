import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  CreditCard, 
  CheckCircle, 
  TrendingUp,
  Award,
  Zap,
  Clock,
  Calendar,
  Lock,
  ChevronDown,
  Play,
  ExternalLink
} from 'lucide-react';
import { 
  mockMemberships, 
  mockMembershipPackages, 
  mockPayments
} from '@/data/mockData';
import { formatDate, formatCurrency, getPaymentStatusName } from '@/utils';
import { 
  getMembershipPackages, 
  getMembershipPackageDurations, 
  createMembershipRequest,
  getUserMembershipRequests,
  getUserActiveMemberships,
  checkUserHasActiveMembership,
  getDurationLabel,
  formatPrice,
  getPilatesPackageDurations,
  createPilatesMembershipRequest
} from '@/utils/membershipApi';
import { MembershipPackage, MembershipPackageDuration, MembershipRequest, Membership as MembershipType } from '@/types';
import { supabase } from '@/config/supabase';
import toast from 'react-hot-toast';
import SuccessPopup from '@/components/SuccessPopup';

const MembershipPage: React.FC = () => {
  const { user } = useAuth();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<MembershipPackage | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<MembershipPackageDuration | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successPackageName, setSuccessPackageName] = useState('');
  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [packageDurations, setPackageDurations] = useState<MembershipPackageDuration[]>([]);
  const [pilatesDurations, setPilatesDurations] = useState<MembershipPackageDuration[]>([]);
  const [userRequests, setUserRequests] = useState<MembershipRequest[]>([]);
  const [userMemberships, setUserMemberships] = useState<MembershipType[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);

  // Get user's active membership from mock data (for backward compatibility)
  const userMembership = mockMemberships.find(m => m.userId === user?.id);
  
  // Get user's payments
  const userPayments = mockPayments.filter(p => p.userId === user?.id);

  // Workout program data
  const workoutPrograms = {
    'upper-body': {
      title: 'Άνω Μέρος Σώματος',
      icon: '💪',
      exercises: [
        {
          name: 'Push-ups',
          description: 'Κλασικές push-ups για ενδυνάμωση στήθους και τρικεφάλων',
          youtubeUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4',
          sets: '3 x 10-15'
        },
        {
          name: 'Pull-ups',
          description: 'Pull-ups για ενδυνάμωση ράχης και δικεφάλων',
          youtubeUrl: 'https://www.youtube.com/watch?v=eGo4IYlbE5g',
          sets: '3 x 5-10'
        },
        {
          name: 'Dumbbell Press',
          description: 'Κάθισμα με dumbells για στήθος',
          youtubeUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4',
          sets: '3 x 8-12'
        },
        {
          name: 'Lateral Raises',
          description: 'Πλαγίες ανυψώσεις για ώμους',
          youtubeUrl: 'https://www.youtube.com/watch?v=eGo4IYlbE5g',
          sets: '3 x 10-15'
        }
      ]
    },
    'lower-body': {
      title: 'Κάτω Μέρος Σώματος',
      icon: '🦵',
      exercises: [
        {
          name: 'Squats',
          description: 'Κλασικές squats για ενδυνάμωση μηρών και γλουτών',
          youtubeUrl: 'https://www.youtube.com/watch?v=YaXPRqUwItQ',
          sets: '3 x 15-20'
        },
        {
          name: 'Lunges',
          description: 'Lunges για ενδυνάμωση μηρών και ισορροπία',
          youtubeUrl: 'https://www.youtube.com/watch?v=QOVaHwm-Q6U',
          sets: '3 x 10-12 κάθε πόδι'
        },
        {
          name: 'Deadlifts',
          description: 'Deadlifts για ενδυνάμωση ράχης και μηρών',
          youtubeUrl: 'https://www.youtube.com/watch?v=op9kVnSso6Q',
          sets: '3 x 8-10'
        },
        {
          name: 'Calf Raises',
          description: 'Ανυψώσεις αστραγάλων για ενδυνάμωση μοσχών',
          youtubeUrl: 'https://www.youtube.com/watch?v=YaXPRqUwItQ',
          sets: '3 x 15-20'
        }
      ]
    },
    'full-body': {
      title: 'Πλήρες Σώμα',
      icon: '🔥',
      exercises: [
        {
          name: 'Burpees',
          description: 'Burpees για πλήρη ενδυνάμωση και καρδιαγγειακό',
          youtubeUrl: 'https://www.youtube.com/watch?v=TU8QYVW0gDU',
          sets: '3 x 8-12'
        },
        {
          name: 'Mountain Climbers',
          description: 'Mountain climbers για καρδιαγγειακό και πυρήνα',
          youtubeUrl: 'https://www.youtube.com/watch?v=nmwgirgXLYM',
          sets: '3 x 20-30 δευτερόλεπτα'
        },
        {
          name: 'Plank',
          description: 'Plank για ενδυνάμωση πυρήνα',
          youtubeUrl: 'https://www.youtube.com/watch?v=pSHjTRCQxIw',
          sets: '3 x 30-60 δευτερόλεπτα'
        },
        {
          name: 'Jumping Jacks',
          description: 'Jumping jacks για καρδιαγγειακό',
          youtubeUrl: 'https://www.youtube.com/watch?v=1b98WrRrmUs',
          sets: '3 x 30-60 δευτερόλεπτα'
        }
      ]
    },
    'cardio': {
      title: 'Καρδιαγγειακή Προπόνηση',
      icon: '❤️',
      exercises: [
        {
          name: 'High Knees',
          description: 'Υψηλά γόνατα για καρδιαγγειακό και ενδυνάμωση μηρών',
          youtubeUrl: 'https://www.youtube.com/watch?v=TU8QYVW0gDU',
          sets: '3 x 30-45 δευτερόλεπτα'
        },
        {
          name: 'Jump Rope',
          description: 'Σκοινάκι για καρδιαγγειακό και συντονισμό',
          youtubeUrl: 'https://www.youtube.com/watch?v=1b98WrRrmUs',
          sets: '3 x 1-2 λεπτά'
        },
        {
          name: 'Box Jumps',
          description: 'Πηδήματα σε κουτί για δύναμη και καρδιαγγειακό',
          youtubeUrl: 'https://www.youtube.com/watch?v=nmwgirgXLYM',
          sets: '3 x 8-12'
        },
        {
          name: 'Battle Ropes',
          description: 'Σχοινιά μάχης για καρδιαγγειακό και αντοχή',
          youtubeUrl: 'https://www.youtube.com/watch?v=pSHjTRCQxIw',
          sets: '3 x 20-30 δευτερόλεπτα'
        }
      ]
    },
    'flexibility': {
      title: 'Ευλυγισία & Χάλαση',
      icon: '🧘',
      exercises: [
        {
          name: 'Yoga Flow',
          description: 'Βασική ακολουθία yoga για ευλυγισία και χαλάρωση',
          youtubeUrl: 'https://www.youtube.com/watch?v=v7AYKMP6rOE',
          sets: '1 x 15-20 λεπτά'
        },
        {
          name: 'Hip Flexor Stretch',
          description: 'Τέντωμα μυών ισχίου για ευλυγισία',
          youtubeUrl: 'https://www.youtube.com/watch?v=QOVaHwm-Q6U',
          sets: '2 x 30 δευτερόλεπτα κάθε πόδι'
        },
        {
          name: 'Shoulder Stretch',
          description: 'Τέντωμα ώμων για ευλυγισία και χαλάρωση',
          youtubeUrl: 'https://www.youtube.com/watch?v=op9kVnSso6Q',
          sets: '2 x 20 δευτερόλεπτα κάθε χέρι'
        },
        {
          name: 'Spinal Twist',
          description: 'Στριφογυρισμός σπονδυλικής στήλης για ευλυγισία',
          youtubeUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4',
          sets: '2 x 30 δευτερόλεπτα κάθε πλευρά'
        }
      ]
    }
  };

  useEffect(() => {
    loadPackages();
    loadUserRequests();
    loadUserMemberships();
    loadPilatesDurations();
  }, []);

  const loadPackages = async () => {
    console.log('[Membership] ===== LOADING PACKAGES =====');
    setLoading(true);
    try {
      const packagesData = await getMembershipPackages();
      console.log('[Membership] Packages loaded:', packagesData);
      console.log('[Membership] Pilates package found:', packagesData.find(p => p.name === 'Pilates'));
      setPackages(packagesData);
    } catch (error) {
      console.error('[Membership] Error loading packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserRequests = async () => {
    if (!user?.id) return;
    try {
      const requests = await getUserMembershipRequests(user.id);
      setUserRequests(requests);
    } catch (error) {
      console.error('Error loading user requests:', error);
    }
  };

  const loadUserMemberships = async () => {
    if (!user?.id) return;
    try {
      const memberships = await getUserActiveMemberships(user.id);
      setUserMemberships(memberships);
    } catch (error) {
      console.error('Error loading user memberships:', error);
    }
  };

  const loadPackageDurations = async (packageId: string) => {
    try {
      const durations = await getMembershipPackageDurations(packageId);
      setPackageDurations(durations);
    } catch (error) {
      console.error('Error loading package durations:', error);
    }
  };

  const loadPilatesDurations = async () => {
    try {
      const durations = await getPilatesPackageDurations();
      setPilatesDurations(durations);
    } catch (error) {
      console.error('Error loading Pilates durations:', error);
      toast.error('Σφάλμα κατά τη φόρτωση των επιλογών Pilates');
    }
  };

  const handlePackageSelect = async (pkg: MembershipPackage) => {
    // Check if user already has an active membership for this package
    if (user?.id) {
      const hasActiveMembership = await checkUserHasActiveMembership(user.id, pkg.id);
      if (hasActiveMembership) {
        toast.error('Έχετε ήδη ενεργή συνδρομή για αυτό το πακέτο');
        return;
      }
    }

    setSelectedPackage(pkg);
    
    // Load appropriate durations based on package type
    if (pkg.name === 'Pilates') {
      setPackageDurations(pilatesDurations);
    } else {
      loadPackageDurations(pkg.id);
    }
    
    setShowPurchaseModal(true);
  };

  const handleDurationSelect = (duration: MembershipPackageDuration) => {
    setSelectedDuration(duration);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedPackage || !selectedDuration || !user?.id) return;

    console.log('[Membership] Starting purchase process:', {
      selectedPackage: selectedPackage?.name,
      selectedDuration: selectedDuration?.duration_type,
      userId: user?.id,
      userEmail: user?.email,
      userRole: user?.role
    });

    try {
      // Add a small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if this is a Pilates package
      if (selectedPackage.name === 'Pilates') {
        await createPilatesMembershipRequest(
          selectedPackage.id,
          selectedDuration.duration_type,
          selectedDuration.classes_count || 0,
          selectedDuration.price,
          user.id
        );
      } else {
        await createMembershipRequest(
          selectedPackage.id,
          selectedDuration.duration_type,
          selectedDuration.price
        );
      }
      
      // Show success popup instead of toast
      setSuccessPackageName(selectedPackage.name);
      setShowSuccessPopup(true);
      setShowPurchaseModal(false);
      setSelectedPackage(null);
      setSelectedDuration(null);
      loadUserRequests();
    } catch (error) {
      console.error('Error creating membership request:', error);
      if (selectedPackage.name === 'Pilates') {
        toast.error('Σφάλμα κατά τη δημιουργία του αιτήματος Pilates');
      } else {
        toast.error('Σφάλμα κατά τη δημιουργία του αιτήματος');
      }
    }
  };

  const handleSpecialPackageAccess = () => {
    setShowCodeModal(true);
  };

  const handleVerifyCode = async () => {
    const code = accessCode.trim();
    if (!code) {
      setCodeError('Παρακαλώ εισάγετε έναν έγκυρο κωδικό.');
      return;
    }

    try {
      setCodeError('');
      // Check if code exists and is active
      const { data, error } = await supabase
        .from('personal_training_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        setCodeError('Λάθος κωδικός πρόσβασης. Παρακαλώ δοκιμάστε ξανά.');
        return;
      }

      // If code is not used and user is logged in, assign it
      if (!data.used_by && user?.id) {
        const { error: updateError } = await supabase
          .from('personal_training_codes')
          .update({ 
            used_by: user.id, 
            used_at: new Date().toISOString() 
          })
          .eq('id', data.id);

        if (updateError) {
          setCodeError('Αποτυχία δέσμευσης κωδικού. Δοκιμάστε ξανά.');
          return;
        }
      }

      // Store in localStorage for quick access
      try {
        localStorage.setItem('has_personal_training', 'true');
      } catch (e) {
        // localStorage might not be available
      }

      setShowCodeModal(false);
      // Open personal training page in new tab
      window.open('/personal-training', '_blank');
    } catch (error) {
      setCodeError('Παρουσιάστηκε σφάλμα. Δοκιμάστε ξανά.');
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getMembershipProgress = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    const totalTime = end.getTime() - start.getTime();
    const elapsedTime = today.getTime() - start.getTime();
    return Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100));
  };

  const getRequestStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Σε Αναμονή' },
      approved: { color: 'bg-green-100 text-green-800', text: 'Εγκεκριμένο' },
      rejected: { color: 'bg-red-100 text-red-800', text: 'Απορριφθέν' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  // Pilates package will be loaded from database

  // Filter to only keep the three desired packages: Free Gym, Pilates, Personal Training
  const filteredMockPackages = mockMembershipPackages.filter(pkg => 
    ['Personal Training / Kick Boxing'].includes(pkg.name)
  );

  // Filter database packages to include Free Gym and Pilates
  const filteredDatabasePackages = packages.filter(pkg => 
    pkg.name === 'Free Gym' || pkg.name === 'Pilates'
  );

  // Combine filtered packages
  const allPackages = [
    ...filteredMockPackages, 
    ...filteredDatabasePackages
  ];

  // Debug logging
  console.log('[Membership] All packages:', allPackages);
  console.log('[Membership] Filtered database packages:', filteredDatabasePackages);
  console.log('[Membership] Pilates in allPackages:', allPackages.find(p => p.name === 'Pilates'));

  return (
    <>
      {/* CSS Animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      
      <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* Header */}
        <div className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-0">Διαχείριση Συνδρομής</h1>
          <p className="text-sm sm:text-base text-gray-600">Διαχειριστείτε τη συνδρομή και τις πιστώσεις σας</p>
        </div>

      {/* Active Memberships */}
      {userMemberships.length > 0 && (
        <div className="card bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
          <h2 className="text-xl font-bold text-primary-900 mb-4">Ενεργές Συνδρομές</h2>
          <div className="space-y-4">
            {userMemberships.map((membership) => (
              <div key={membership.id} className="bg-white rounded-lg p-4 border border-primary-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-primary-600 rounded-lg">
                      <CreditCard className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-primary-900">
                        {membership.package?.name}
                      </h3>
                      <p className="text-primary-700">
                        {getDurationLabel(membership.duration_type)} - {formatPrice(membership.duration?.price || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-primary-700">
                      {getDaysRemaining(membership.end_date)} ημέρες ακόμα
                    </div>
                    <div className="text-xs text-primary-600">
                      Λήγει: {formatDate(membership.end_date)}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-primary-700 mb-2">
                    <span>Πρόοδος συνδρομής</span>
                    <span>{getDaysRemaining(membership.end_date)} ημέρες ακόμα</span>
                  </div>
                  <div className="w-full bg-primary-200 rounded-full h-2">
                    <div 
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getMembershipProgress(membership.start_date, membership.end_date)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legacy Active Membership (for backward compatibility) */}
      {userMembership && userMemberships.length === 0 && (
        <div className="card bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary-600 rounded-lg">
                <CreditCard className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary-900">Ενεργή Συνδρομή</h2>
                <p className="text-primary-700">
                  {allPackages.find(p => p.id === userMembership.packageId)?.name || 'Unknown Package'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary-900">
                {userMembership.credits} πιστώσεις
              </div>
              <p className="text-primary-700">διαθέσιμες</p>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between text-sm text-primary-700 mb-2">
              <span>Πρόοδος συνδρομής</span>
              <span>{getDaysRemaining(userMembership.endDate)} ημέρες ακόμα</span>
            </div>
            <div className="w-full bg-primary-200 rounded-full h-2">
              <div 
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getMembershipProgress(userMembership.startDate, userMembership.endDate)}%` }}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-primary-200">
            <div className="text-center">
              <div className="text-lg font-semibold text-primary-900">
                {formatDate(userMembership.startDate)}
              </div>
              <p className="text-sm text-primary-700">Ημερομηνία έναρξης</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-primary-900">
                {formatDate(userMembership.endDate)}
              </div>
              <p className="text-sm text-primary-700">Ημερομηνία λήξης</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-primary-900">
                {userMembership.autoRenew ? 'Ναι' : 'Όχι'}
              </div>
              <p className="text-sm text-primary-700">Αυτόματη ανανέωση</p>
            </div>
          </div>
        </div>
      )}

      {/* Available Packages */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Διαθέσιμα Πακέτα</h2>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-2 text-gray-600">Φόρτωση...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {allPackages.map((pkg) => {
              const isSpecial = pkg.id === "3"; // Personal Training package
              const isFreeGym = pkg.name === 'Free Gym'; // Free Gym package
              const isPilates = pkg.name === 'Pilates'; // Pilates package
              const hasPersonalTraining = typeof window !== 'undefined' && localStorage.getItem('has_personal_training') === 'true';
              const isLocked = userMemberships.some(m => m.package_id === pkg.id);
              
              return (
                <div 
                  key={pkg.id} 
                  className={`relative bg-white border-2 rounded-xl p-4 sm:p-6 shadow-lg transition-all duration-300 ${
                    isLocked
                      ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-75'
                      : isSpecial 
                        ? 'border-purple-300 hover:border-purple-400 cursor-pointer hover:shadow-xl' 
                        : isFreeGym
                          ? 'border-green-300 hover:border-green-400 cursor-pointer hover:shadow-xl'
                          : isPilates
                            ? 'border-pink-300 hover:border-pink-400 cursor-pointer hover:shadow-xl'
                            : 'border-gray-200 hover:border-primary-300 cursor-pointer hover:shadow-xl'
                  }`}
                  onClick={() => isLocked ? null : (isSpecial ? handleSpecialPackageAccess() : handlePackageSelect(pkg))}
                >
                  {isLocked && (
                    <div className="absolute -top-2 -right-2 bg-gray-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                      <Lock className="h-3 w-3" />
                      <span>Κλειδωμένο</span>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-2xl flex items-center justify-center ${
                      isSpecial 
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                        : isFreeGym
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                          : isPilates
                            ? 'bg-gradient-to-br from-pink-500 to-rose-500'
                            : 'bg-gradient-to-br from-primary-500 to-primary-600'
                    }`}>
                      {isSpecial ? (
                        <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                      ) : isFreeGym ? (
                        <Award className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                      ) : isPilates ? (
                        <span className="text-xl sm:text-2xl">🧘</span>
                      ) : (
                        <Award className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                      )}
                    </div>
                    
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
                    <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">{pkg.description}</p>
                    
                    {isLocked ? (
                      <div className="space-y-2">
                        <div className="text-lg font-bold text-gray-500">
                          Έχετε ήδη συνδρομή
                        </div>
                        <div className="text-sm text-gray-400">
                          Αυτό το πακέτο είναι κλειδωμένο
                        </div>
                      </div>
                    ) : isSpecial ? (
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-purple-600">
                          {hasPersonalTraining ? 'Έχεις Πρόσβαση' : 'Κωδικός Απαιτείται'}
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpecialPackageAccess();
                          }}
                          className="w-full bg-purple-600 text-white py-2 px-3 sm:px-4 rounded-lg hover:bg-purple-700 transition-colors text-sm sm:text-base"
                        >
                          {hasPersonalTraining ? 'Ανοίγει σε νέα καρτέλα' : 'Εισάγετε Κωδικό'}
                        </button>
                      </div>
                    ) : isFreeGym ? (
                      <div className="space-y-3">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePackageSelect(pkg);
                          }}
                          className="w-full bg-green-600 text-white py-2 px-3 sm:px-4 rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm sm:text-base"
                        >
                          Επιλέξτε Πακέτο
                        </button>
                      </div>
                    ) : isPilates ? (
                      <div className="space-y-3">
                        <div className="text-center">
                          <div className="text-sm text-gray-600 mb-2">Από</div>
                          <div className="text-2xl font-bold text-pink-600">
                            {formatPrice(6.00)}
                          </div>
                          <div className="text-xs text-gray-500">για 1 μάθημα</div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePackageSelect(pkg);
                          }}
                          className="w-full bg-pink-600 text-white py-2 px-3 sm:px-4 rounded-lg hover:bg-pink-700 transition-colors font-semibold text-sm sm:text-base"
                        >
                          Επιλέξτε Πακέτο
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-primary-600">
                          {formatCurrency(pkg.price)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {pkg.duration_days || 30} ημέρες
                        </div>
                        <button className="w-full bg-primary-600 text-white py-2 px-3 sm:px-4 rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base">
                          Επιλέξτε Πακέτο
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Workout Programs - Enhanced UI/UX */}
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-blue-100 overflow-hidden"
        style={{
          animation: 'fadeInUp 0.6s ease-out forwards',
          opacity: 0
        }}
      >
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="p-2 sm:p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">Προγράμματα Προπόνησης</h2>
              <p className="text-blue-100 text-sm sm:text-base lg:text-lg">Επιλέξτε την κατηγορία που σας ενδιαφέρει</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {Object.entries(workoutPrograms).map(([key, program], index) => (
              <div
                key={key}
                className="group relative bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 overflow-hidden hover:scale-105 hover:-translate-y-2"
                style={{
                  animationDelay: `${index * 100}ms`,
                  animation: 'fadeInUp 0.6s ease-out forwards',
                  opacity: 0
                }}
              >
                {/* Card Header */}
                <button
                  onClick={() => setExpandedWorkout(expandedWorkout === key ? null : key)}
                  className="w-full p-4 sm:p-6 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-2xl hover:bg-blue-50/50 transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                      <div 
                        className="p-3 sm:p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 flex-shrink-0"
                      >
                        <span className="text-2xl sm:text-3xl">{program.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors duration-300 truncate">
                          {program.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">
                          {program.exercises.length} ασκήσεις διαθέσιμες
                        </p>
                      </div>
                    </div>
                    <div
                      className={`transition-transform duration-300 flex-shrink-0 ${expandedWorkout === key ? 'rotate-180' : 'rotate-0'}`}
                    >
                      <ChevronDown className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" />
                    </div>
                  </div>
                </button>
                
                {/* Expanded Content */}
                {expandedWorkout === key && (
                  <div
                    className="overflow-hidden transition-all duration-400 ease-in-out"
                    style={{
                      animation: 'slideDown 0.4s ease-out forwards',
                      opacity: 0
                    }}
                  >
                    <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-100 bg-gradient-to-br from-gray-50 to-white">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 sm:pt-6">
                        {program.exercises.map((exercise, exerciseIndex) => (
                          <div
                            key={exerciseIndex}
                            className="group/exercise bg-white rounded-xl p-4 sm:p-5 shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-blue-200 hover:scale-105 hover:-translate-y-1"
                            style={{
                              animationDelay: `${exerciseIndex * 100}ms`,
                              animation: 'fadeInScale 0.4s ease-out forwards',
                              opacity: 0
                            }}
                          >
                            <div className="flex items-start justify-between mb-3 sm:mb-4">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-gray-900 mb-2 text-base sm:text-lg group-hover/exercise:text-blue-700 transition-colors duration-300 truncate">
                                  {exercise.name}
                                </h4>
                                <p className="text-xs sm:text-sm text-gray-600 mb-3 leading-relaxed">
                                  {exercise.description}
                                </p>
                                <div className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {exercise.sets}
                                </div>
                              </div>
                            </div>
                            
                            <a
                              href={exercise.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-2 text-red-600 hover:text-red-700 transition-all duration-300 text-xs sm:text-sm font-semibold group-hover/exercise:bg-red-50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:scale-105 w-full sm:w-auto justify-center sm:justify-start"
                            >
                              <div className="p-1 sm:p-1.5 bg-red-100 rounded-lg group-hover/exercise:bg-red-200 transition-colors duration-300 group-hover/exercise:rotate-360">
                                <Play className="h-3 w-3 sm:h-4 sm:w-4" />
                              </div>
                              <span>Δες το βίντεο</span>
                              <ExternalLink className="h-3 w-3 group-hover/exercise:translate-x-1 transition-transform duration-300" />
                            </a>
                          </div>
                        ))}
                      </div>
                      
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      {userPayments.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Πρόσφατες Πληρωμές</h2>
          <div className="space-y-3">
            {userPayments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {allPackages.find(p => p.id === payment.membershipId)?.name || 'Unknown Package'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {formatCurrency(payment.amount)} • {formatDate(payment.createdAt)}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  payment.status === 'completed' as any 
                    ? 'bg-green-100 text-green-800' 
                    : payment.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {getPaymentStatusName(payment.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Membership Requests */}
      {userRequests.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Αιτήματα Συνδρομής</h2>
          <div className="space-y-3">
            {userRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {request.package?.name} - {getDurationLabel(request.duration_type)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {formatPrice(request.requested_price)} • {formatDate(request.created_at)}
                    </p>
                  </div>
                </div>
                {getRequestStatusBadge(request.status)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {showPurchaseModal && selectedPackage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Επιλογή Πακέτου: {selectedPackage.name}
            </h3>
            
            {packageDurations.length > 0 ? (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700">Επιλέξτε Διάρκεια:</h4>
                {packageDurations.map((duration) => (
                  <div 
                    key={duration.id}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedDuration?.id === duration.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300'
                    }`}
                    onClick={() => handleDurationSelect(duration)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h5 className="font-semibold text-gray-900">
                          {getDurationLabel(duration.duration_type)}
                        </h5>
                        <p className="text-sm text-gray-600">
                          {duration.classes_count ? `${duration.classes_count} μαθήματα` : `${duration.duration_days} ημέρες`}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary-600">
                          {formatPrice(duration.price)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowPurchaseModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Ακύρωση
                  </button>
                  <button
                    onClick={handleConfirmPurchase}
                    disabled={!selectedDuration}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Επιβεβαίωση
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">Δεν υπάρχουν διαθέσιμες επιλογές διάρκειας.</p>
                <button
                  onClick={() => setShowPurchaseModal(false)}
                  className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Κλείσιμο
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Code Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Πρόσβαση σε Ειδικό Πακέτο</h3>
            <p className="text-gray-600 mb-4">
              Εισάγετε τον κωδικό πρόσβασης για το Personal Training πακέτο.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Κωδικός Πρόσβασης
                </label>
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Εισάγετε τον κωδικό..."
                />
                {codeError && (
                  <p className="mt-1 text-sm text-red-600">{codeError}</p>
                )}
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCodeModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Ακύρωση
                </button>
                <button
                  onClick={handleVerifyCode}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Επιβεβαίωση
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      <SuccessPopup
        isOpen={showSuccessPopup}
        onClose={() => setShowSuccessPopup(false)}
        packageName={successPackageName}
      />
      </div>
    </>
  );
};

export default MembershipPage;
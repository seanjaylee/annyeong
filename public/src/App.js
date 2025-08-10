import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signOut,
    signInAnonymously,
    signInWithCustomToken
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc,
    serverTimestamp,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    limit,
    orderBy,
    addDoc,
    writeBatch,
    increment
} from 'firebase/firestore';

// --- Constants & Helper Functions ---

const AVAILABLE_TIMES_KO = [
    "새벽 (12AM-9AM)", "오전 (9AM-12PM)", "오후 (12PM-6PM)", "저녁 (6PM-12AM)"
];
const AVAILABLE_TIMES_EN = [
    "Early Morning (12AM-9AM)", "Morning (9AM-12PM)", "Afternoon (12PM-6PM)", "Evening (6PM-12AM)"
];
const KOREAN_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const DAYS_OF_WEEK_KO = ["월", "화", "수", "목", "금", "토", "일"];
const DAYS_OF_WEEK_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];


const LogoIcon = () => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C24.8366 0 32 7.16344 32 16C32 24.8366 24.8366 32 16 32C7.16344 32 0 24.8366 0 16C0 7.16344 7.16344 0 16 0Z" fill="url(#paint0_linear_1_2)"/>
        <path d="M10 10L14.5 22L16.5 16L22 14.5L10 10Z" fill="white"/>
        <defs><linearGradient id="paint0_linear_1_2" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop stopColor="#4F46E5"/><stop offset="1" stopColor="#A855F7"/></linearGradient></defs>
    </svg>
);

const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.089,5.571l6.19,5.238C42.021,35.596,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
);

// --- Firebase Initialization ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : { apiKey: "YOUR_API_KEY", authDomain: "YOUR_AUTH_DOMAIN", projectId: "YOUR_PROJECT_ID" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'annyeong';

// --- Main App Component ---

export default function App() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState('landing');

    const navigateTo = (view) => setCurrentView(view);

    const checkUserStatus = useCallback(async (firebaseUser) => {
        if (!firebaseUser) {
            setLoading(false);
            navigateTo('landing');
            return;
        }
        
        const userProfileRef = doc(db, `artifacts/${appId}/users/${firebaseUser.uid}/data`, 'profile');
        try {
            const docSnap = await getDoc(userProfileRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);
                if (!data.isProfileComplete) {
                    navigateTo('initialProfileSetup');
                } else if (data.role === 'learner') {
                    navigateTo('buddyList');
                } else {
                    navigateTo('dashboard');
                }
            } else {
                navigateTo('roleSelection');
            }
        } catch (error) {
            console.error("Error checking user status:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setLoading(true);
            if (firebaseUser) {
                setUser(firebaseUser);
                checkUserStatus(firebaseUser);
            } else {
                setUser(null);
                setUserData(null);
                navigateTo('landing');
                setLoading(false);
            }
        });
        
        return () => unsubscribe();
    }, [checkUserStatus]);

    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Google login failed:", error);
            alert("Login failed. If you are the developer, please check the Firebase authorized domains setting.");
        }
    };

    const handleRoleSelect = async (role) => {
        if (!user) return;
        setLoading(true);
        const userProfileRef = doc(db, `artifacts/${appId}/users/${user.uid}/data`, 'profile');
        try {
            const userProfileDoc = {
                uid: user.uid, email: user.email, displayName: user.displayName,
                photoURL: user.photoURL, role: role, createdAt: serverTimestamp(),
                isProfileComplete: false, nickname: user.displayName, interests: [],
                ...(role === 'learner' && { koreanLevel: 'Beginner', preferredTime: {}, credits: 2 }),
                ...(role === 'buddy' && { introduction: '', availableTime: {}, credits: 0, totalSessions: 0, averageRating: 0, reviewsCount: 0 })
            };
            await setDoc(userProfileRef, userProfileDoc);
            setUserData(userProfileDoc);
            navigateTo('initialProfileSetup');
        } catch (error) {
            console.error("Error setting user role:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleProfileUpdate = (updatedData) => {
        setUserData(updatedData);
        if (updatedData.role === 'learner') {
            navigateTo('buddyList');
        } else {
            navigateTo('dashboard');
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    const renderView = () => {
        if (loading) return <LoadingScreen />;
        switch (currentView) {
            case 'roleSelection': return <RoleSelectionScreen onSelect={handleRoleSelect} onLogout={handleLogout} />;
            case 'initialProfileSetup': return <ProfileSettingsPage isInitialSetup={true} user={user} userData={userData} onProfileUpdate={handleProfileUpdate} onLogout={handleLogout} />;
            case 'dashboard': return <DashboardScreen user={user} userData={userData} onLogout={handleLogout} onNavigate={navigateTo} />;
            case 'profileSettings': return <ProfileSettingsPage isInitialSetup={false} user={user} userData={userData} onProfileUpdate={handleProfileUpdate} onBack={() => navigateTo(userData.role === 'learner' ? 'dashboard' : 'dashboard')} />;
            case 'buddyList': return <BuddyListPage user={user} userData={userData} onLogout={handleLogout} onNavigate={navigateTo} />;
            default: return <LandingPage onLogin={handleGoogleLogin} />;
        }
    };

    return <div className="min-h-screen bg-gray-100 font-sans">{renderView()}</div>;
}

// --- Components ---
const AppHeader = ({ user, userData, onLogout, onNavigate }) => (
    <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => onNavigate(userData.role === 'learner' ? 'buddyList' : 'dashboard')}>
            <LogoIcon />
            <span className="font-bold text-xl text-gray-800">Annyeong</span>
        </div>
        <div className="flex items-center space-x-4">
            {userData.role === 'learner' && (
                <>
                    <button onClick={() => onNavigate('buddyList')} className="text-sm font-semibold text-gray-600 hover:text-indigo-600">Find a Buddy</button>
                    <button onClick={() => onNavigate('dashboard')} className="text-sm font-semibold text-gray-600 hover:text-indigo-600">My Page</button>
                </>
            )}
             <span className="text-sm text-gray-600 hidden sm:block">
                {userData.role === 'buddy' ? '환영합니다,' : 'Welcome,'} <span className="font-semibold">{userData.nickname}</span>!
            </span>
            <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/100x100/EFEFEF/333333?text=U'; }}/>
            <button onClick={onLogout} className="text-sm font-medium text-gray-500 hover:text-indigo-600">
                {userData.role === 'buddy' ? '로그아웃' : 'Logout'}
            </button>
        </div>
    </header>
);

const LoadingScreen = () => <div className="flex items-center justify-center min-h-screen"><span className="text-lg font-medium text-gray-700">Loading...</span></div>;

const LandingPage = ({ onLogin }) => {
    return (
        <div className="bg-white relative">
            <header className="p-4 md:p-6 flex justify-between items-center">
                <div className="flex items-center space-x-2"><LogoIcon /><span className="font-bold text-xl text-gray-800">Annyeong</span></div>
                <button onClick={onLogin} className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"><GoogleIcon />Sign in with Google</button>
            </header>
            <main className="container mx-auto px-6 py-16 md:py-24 text-center">
                <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 leading-tight">Speak Korean with your <br className="hidden md:block" /><span className="text-indigo-600">SeoulMate</span></h1>
                <p className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-gray-600">Connect with native Korean speakers for fun, 20-minute conversations about K-Pop, dramas, and more.</p>
                <button onClick={onLogin} className="mt-10 flex items-center justify-center w-full md:w-auto mx-auto px-8 py-4 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-700 transform hover:scale-105 transition-all"><GoogleIcon />Get Started for Free</button>
            </main>
        </div>
    );
};

const RoleSelectionScreen = ({ onSelect, onLogout }) => (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
        <button onClick={onLogout} className="absolute top-6 left-6 flex items-center text-gray-600 hover:text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            Back
        </button>
        <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
            <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col items-center justify-center text-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white"><h2 className="text-3xl font-bold mb-4">I want to learn Korean</h2><p className="mb-8">Connect with native speakers and improve your fluency.</p><button onClick={() => onSelect('learner')} className="w-full px-6 py-3 bg-white text-indigo-600 font-bold rounded-lg shadow-md hover:bg-indigo-50 transform hover:scale-105 transition-all">I'm a Learner</button></div>
            <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col items-center justify-center text-center"><h2 className="text-3xl font-bold mb-4 text-gray-800">한국어 버디가 되어주세요</h2><p className="mb-8 text-gray-600">전 세계 친구들에게 한국어와 문화를 알려주세요.</p><button onClick={() => onSelect('buddy')} className="w-full px-6 py-3 bg-gray-800 text-white font-bold rounded-lg shadow-md hover:bg-gray-900 transform hover:scale-105 transition-all">저는 버디입니다</button></div>
        </div>
    </div>
);

// --- DASHBOARD ---
const DashboardScreen = ({ user, userData, onLogout, onNavigate }) => {
    const [dashboardData, setDashboardData] = useState({ upcoming: [], requests: [], reviews: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || userData.role !== 'buddy') {
            setLoading(false);
            return;
        }
        
        const sessionsQuery = query(collection(db, `artifacts/${appId}/public/data/sessions`), where('buddyId', '==', user.uid));
        
        const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
            const allSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const requests = allSessions.filter(s => s.status === 'requested');
            const upcoming = allSessions.filter(s => s.status === 'confirmed' && s.sessionTime.toDate() > new Date());
            
            setDashboardData(prev => ({ ...prev, requests, upcoming }));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching sessions:", error);
            setLoading(false);
        });

        const reviewsRef = collection(db, `artifacts/${appId}/public/data/profiles/${user.uid}/reviews`);
        const reviewsQuery = query(reviewsRef, orderBy('createdAt', 'desc'), limit(3));
        const unsubscribeReviews = onSnapshot(reviewsQuery, (snapshot) => {
            const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDashboardData(prev => ({ ...prev, reviews }));
        });

        return () => {
             unsubscribeSessions();
             unsubscribeReviews();
        };
    }, [user, userData.role, appId]);
    
    if (userData.role === 'learner') {
        return <LearnerMyPage user={user} userData={userData} onLogout={onLogout} onNavigate={onNavigate} />;
    }

    return (
        <div>
            <AppHeader user={user} userData={userData} onLogout={onLogout} onNavigate={onNavigate} />
            <main className="p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold text-gray-800">나의 대시보드</h1>
                        <button onClick={() => onNavigate('profileSettings')} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">프로필 수정</button>
                    </div>
                    {loading ? <LoadingScreen /> : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-6">
                                <UpcomingSessionCard session={dashboardData.upcoming[0]} />
                                <NewRequestsCard requests={dashboardData.requests} />
                                <RecentReviewsCard reviews={dashboardData.reviews} />
                            </div>
                            <div className="lg:col-span-1 space-y-6">
                                <StatsCard userData={userData} />
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

const LearnerMyPage = ({ user, userData, onLogout, onNavigate }) => {
    return (
        <div>
            <AppHeader user={user} userData={userData} onLogout={onLogout} onNavigate={onNavigate} />
            <main className="p-4 md:p-8">
                <div className="max-w-5xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold text-gray-800">My Page</h1>
                        <button onClick={() => onNavigate('profileSettings')} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">Edit Profile</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">My Credits</h2>
                            <p className="text-4xl font-bold text-indigo-600">{userData.credits || 0}</p>
                            <p className="text-sm text-gray-500">credits available</p>
                            <button className="mt-4 w-full px-4 py-2 bg-amber-400 text-amber-900 font-bold rounded-lg hover:bg-amber-500">Buy More Credits</button>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">Today's Korean</h2>
                            <p className="text-2xl font-bold">"최애"</p>
                            <p className="text-sm text-gray-600">(choi-ae)</p>
                            <p className="mt-2 text-gray-700">Your most favorite thing, your ultimate bias.</p>
                        </div>
                         <div className="md:col-span-2 bg-white p-6 rounded-lg shadow">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">Upcoming Sessions</h2>
                            <p className="text-sm text-gray-500">No upcoming sessions. Time to find a buddy!</p>
                            <button onClick={() => onNavigate('buddyList')} className="mt-4 px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Find a Buddy</button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

// Buddy Dashboard Sub-components
const UpcomingSessionCard = ({ session }) => {
    if (!session) return (
        <div className="bg-white p-6 rounded-lg shadow"><h2 className="text-xl font-bold text-gray-800 mb-4">다가오는 세션</h2><p className="text-sm text-gray-500">예정된 세션이 없습니다.</p></div>
    );
    return (
        <div className="bg-white p-6 rounded-lg shadow"><h2 className="text-xl font-bold text-gray-800 mb-4">다가오는 세션</h2><div className="bg-indigo-50 p-4 rounded-lg flex items-center justify-between"><div className="flex items-center space-x-4"><img src={session.learnerPhoto} alt={session.learnerName} className="w-12 h-12 rounded-full" /><div className="text-sm"><p className="font-bold text-gray-900">{session.learnerName}님과의 대화</p><p className="text-gray-600">{session.sessionTime.toDate().toLocaleString('ko-KR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}</p></div></div><button className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 text-sm">Meet 입장</button></div></div>
    );
};

const NewRequestsCard = ({ requests }) => {
    const handleRequest = async (sessionId, newStatus) => {
        const sessionRef = doc(db, `artifacts/${appId}/public/data/sessions`, sessionId);
        try {
            await updateDoc(sessionRef, { status: newStatus });
        } catch (error) {
            console.error("Error updating session status:", error);
        }
    };
    return (
        <div className="bg-white p-6 rounded-lg shadow"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-gray-800">새로운 요청 ({requests.length})</h2>{requests.length > 3 && <a href="#" className="text-sm font-medium text-indigo-600 hover:underline">모두 보기</a>}</div>
        {requests.length === 0 ? <p className="text-sm text-gray-500">새로운 요청이 없습니다.</p> : <div className="space-y-3">{requests.slice(0, 3).map(req => (<div key={req.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div className="flex items-center space-x-3"><img src={req.learnerPhoto} alt={req.learnerName} className="w-10 h-10 rounded-full" /><p className="font-semibold text-gray-800 text-sm">{req.learnerName}님의 세션 요청</p></div><div className="space-x-2"><button onClick={() => handleRequest(req.id, 'declined')} className="px-3 py-1 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-md hover:bg-gray-100">거절</button><button onClick={() => handleRequest(req.id, 'confirmed')} className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-md hover:bg-green-600">수락</button></div></div>))}</div>}</div>
    );
};

const StatsCard = ({ userData }) => {
    const isOfficialBuddy = (userData.reviewsCount || 0) >= 2 && (userData.averageRating || 0) >= 4.0;
    return (
        <div className="bg-white p-6 rounded-lg shadow"><h2 className="text-xl font-bold text-gray-800 mb-4">나의 성과</h2><div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><p className="text-sm font-semibold text-gray-700">평균 별점</p><p className="text-sm font-bold text-amber-500">⭐️ {userData.averageRating || 0} / 5.0</p></div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><p className="text-sm font-semibold text-gray-700">총 세션</p><p className="text-sm font-bold text-gray-900">{userData.totalSessions || 0}회</p></div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><p className="text-sm font-semibold text-gray-700">보유 크레딧</p><p className="text-sm font-bold text-indigo-600">{isOfficialBuddy ? `${userData.credits || 0} C` : '정식 버디 필요'}</p></div>
            {!isOfficialBuddy && (<div className="text-center p-3 bg-purple-50 border border-purple-200 rounded-lg"><p className="text-sm font-bold text-purple-800">정식 버디가 되어보세요!</p><p className="text-xs text-purple-600 mt-1">리뷰 2개, 평점 4.0 이상을 받으면 크레딧을 적립할 수 있습니다.</p><div className="w-full bg-gray-200 rounded-full h-2.5 mt-2"><div className="bg-purple-600 h-2.5 rounded-full" style={{width: `${((userData.reviewsCount || 0) / 2) * 100}%`}}></div></div></div>)}
        </div></div>
    );
};

const RecentReviewsCard = ({ reviews }) => (
    <div className="bg-white p-6 rounded-lg shadow"><h2 className="text-xl font-bold text-gray-800 mb-4">최근 리뷰</h2>
    {reviews.length === 0 ? <p className="text-sm text-gray-500">아직 받은 리뷰가 없습니다.</p> : <div className="space-y-4">{reviews.map(review => (<div key={review.id} className="flex space-x-4"><img src={review.learnerPhoto} alt={review.learnerName} className="w-10 h-10 rounded-full mt-1" /><div className="flex-1"><div className="flex justify-between items-baseline"><p className="font-bold text-gray-800">{review.learnerName}</p><p className="text-xs text-amber-500">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p></div><p className="text-sm text-gray-600 bg-gray-50 p-2 rounded-md mt-1">{review.comment}</p></div></div>))}</div>}</div>
);

// --- Buddy List Page ---
const BuddyListPage = ({ user, userData, onLogout, onNavigate }) => {
    const [buddies, setBuddies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bookingBuddy, setBookingBuddy] = useState(null);

    useEffect(() => {
        const profilesRef = collection(db, `artifacts/${appId}/public/data/profiles`);
        const q = query(profilesRef, where("role", "==", "buddy"));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const buddyList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBuddies(buddyList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching buddies:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [appId]);

    return (
        <div className="relative">
            <AppHeader user={user} userData={userData} onLogout={onLogout} onNavigate={onNavigate} />
            <main className="p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">Find Your Buddy</h1>
                    {loading ? <LoadingScreen /> : (
                        buddies.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {buddies.map(buddy => (
                                    <div key={buddy.id} className="bg-white p-6 rounded-lg shadow flex flex-col">
                                        <div className="flex-grow">
                                            <div className="flex items-center space-x-4 mb-4">
                                                <img src={buddy.photoURL} alt={buddy.nickname} className="w-16 h-16 rounded-full" />
                                                <div><h2 className="text-xl font-bold text-gray-900">{buddy.nickname}</h2></div>
                                            </div>
                                            <p className="text-sm text-gray-600 mb-4 h-16">{buddy.introduction}</p>
                                            <div className="flex flex-wrap gap-2">
                                                {buddy.interests.slice(0, 3).map(interest => (
                                                    <span key={interest} className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{interest}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <button onClick={() => setBookingBuddy(buddy)} className="mt-6 w-full px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Book Session</button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <p className="text-gray-500">아직 활동중인 버디가 없습니다.</p>
                            </div>
                        )
                    )}
                </div>
            </main>
            {bookingBuddy && <BookingModal buddy={bookingBuddy} user={user} userData={userData} onClose={() => setBookingBuddy(null)} />}
        </div>
    );
};

// --- Booking Modal ---
const BookingModal = ({ buddy, user, userData, onClose }) => {
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [isBooking, setIsBooking] = useState(false);

    const getNext7Days = () => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            days.push(date);
        }
        return days;
    };

    const handleConfirmBooking = async () => {
        if (!selectedSlot || (userData.credits || 0) < 1) {
            alert("Please select a time slot or check your credits.");
            return;
        }
        setIsBooking(true);

        const batch = writeBatch(db);

        const sessionsRef = collection(db, `artifacts/${appId}/public/data/sessions`);
        batch.set(doc(sessionsRef), {
            buddyId: buddy.id,
            buddyName: buddy.nickname,
            buddyPhoto: buddy.photoURL,
            learnerId: user.uid,
            learnerName: userData.nickname,
            learnerPhoto: userData.photoURL,
            sessionTime: selectedSlot,
            status: 'requested',
            createdAt: serverTimestamp(),
        });

        const learnerProfileRef = doc(db, `artifacts/${appId}/users/${user.uid}/data`, 'profile');
        batch.update(learnerProfileRef, { credits: (userData.credits || 0) - 1 });

        try {
            await batch.commit();
            alert("Booking request sent successfully!");
            onClose();
        } catch (error) {
            console.error("Booking failed:", error);
            alert("Sorry, something went wrong. Please try again.");
        } finally {
            setIsBooking(false);
        }
    };

    const days = getNext7Days();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">Book a session with {buddy.nickname}</h2>
                            <p className="text-sm text-gray-500">Select an available time slot below.</p>
                        </div>
                        <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-800">&times;</button>
                    </div>
                </div>
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                        {days.map(day => {
                            const dayOfWeek = day.getDay();
                            const dayKey = DAYS_OF_WEEK_KO[(dayOfWeek + 6) % 7];
                            const buddyAvailableTimes = buddy.availableTime[dayKey] || [];
                            return (
                                <div key={day.toISOString()} className="text-center">
                                    <p className="font-bold text-sm">{DAYS_OF_WEEK_EN[(dayOfWeek + 6) % 7]}</p>
                                    <p className="text-xs text-gray-500">{day.getDate()}</p>
                                    <div className="space-y-2 mt-2">
                                        {AVAILABLE_TIMES_EN.map((timeLabel, index) => {
                                            const correspondingKoTime = AVAILABLE_TIMES_KO[index];
                                            const isAvailable = buddyAvailableTimes.includes(correspondingKoTime);
                                            const slotDate = new Date(day);
                                            slotDate.setHours(9 + index * 3, 0, 0, 0);

                                            const isSelected = selectedSlot?.getTime() === slotDate.getTime();
                                            
                                            if (!isAvailable) return <div key={timeLabel} className="h-8 bg-gray-100 rounded"></div>;
                                            
                                            return (
                                                <button 
                                                    key={timeLabel}
                                                    onClick={() => setSelectedSlot(slotDate)}
                                                    className={`w-full h-8 rounded text-xs transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-green-200 text-green-800 hover:bg-green-300'}`}
                                                >
                                                    {timeLabel.split(' ')[0]}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="p-6 border-t mt-auto">
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-gray-600">This session will cost <span className="font-bold">1 credit</span>. You have <span className="font-bold">{userData.credits || 0}</span> credits.</p>
                        <button onClick={handleConfirmBooking} disabled={!selectedSlot || isBooking || (userData.credits || 0) < 1} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed">
                            {isBooking ? "Booking..." : "Confirm Booking"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- Profile Settings Page ---
const ProfileSettingsPage = ({ isInitialSetup, user, userData, onProfileUpdate, onBack, onLogout }) => {
    const [nickname, setNickname] = useState(userData.nickname || '');
    const [nicknameStatus, setNicknameStatus] = useState('idle');
    const [initialNickname] = useState(userData.nickname || '');
    const [introduction, setIntroduction] = useState(userData.introduction || '');
    const [interests, setInterests] = useState(userData.interests || []);
    const [interestInput, setInterestInput] = useState('');
    const [availableTime, setAvailableTime] = useState(userData.availableTime || {});
    const [preferredTime, setPreferredTime] = useState(userData.preferredTime || {});
    const [koreanLevel, setKoreanLevel] = useState(userData.koreanLevel || 'Beginner');
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    
    const isBuddy = userData.role === 'buddy';

    useEffect(() => {
        const handler = setTimeout(async () => {
            if (nickname.trim() === '' || nickname.toLowerCase() === initialNickname.toLowerCase()) {
                setNicknameStatus('idle');
                return;
            }
            setNicknameStatus('checking');
            const profilesRef = collection(db, `artifacts/${appId}/public/data/profiles`);
            const q = query(profilesRef, where("nickname", "==", nickname));
            const querySnapshot = await getDocs(q);
            setNicknameStatus(querySnapshot.empty ? 'available' : 'taken');
        }, 500);
        return () => clearTimeout(handler);
    }, [nickname, initialNickname, appId]);

    const handleAddInterest = (e) => {
        if (e.key === 'Enter' && interestInput.trim() !== '') {
            e.preventDefault();
            if (!interests.includes(interestInput.trim())) {
                setInterests([...interests, interestInput.trim()]);
            }
            setInterestInput('');
        }
    };
    const handleRemoveInterest = (interestToRemove) => setInterests(interests.filter(interest => interest !== interestToRemove));

    const handleTimeSelect = (day, time) => {
        const setFunction = isBuddy ? setAvailableTime : setPreferredTime;
        const timeKey = day;
        const timeValue = time;

        setFunction(prev => {
            const dayTimes = prev[timeKey] || [];
            const newDayTimes = dayTimes.includes(timeValue) ? dayTimes.filter(t => t !== timeValue) : [...dayTimes, timeValue];
            return { ...prev, [timeKey]: newDayTimes };
        });
    };

    const handleSave = async () => {
        if (nicknameStatus === 'taken' || nickname.trim() === '') return;
        setIsSaving(true);
        
        const updatedPrivateData = {
            nickname, interests,
            ...(isBuddy ? { introduction, availableTime } : { koreanLevel, preferredTime }),
            isProfileComplete: true,
            updatedAt: serverTimestamp()
        };

        if (user.isMock) {
            console.log("SIMULATION: Skipping Firestore write for profile save.");
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                onProfileUpdate({ ...userData, ...updatedPrivateData });
            }, 1500);
            setIsSaving(false);
            return;
        }

        const userProfileRef = doc(db, `artifacts/${appId}/users/${user.uid}/data`, 'profile');
        try {
            await updateDoc(userProfileRef, updatedPrivateData);
            
            const publicProfileRef = doc(db, `artifacts/${appId}/public/data/profiles`, user.uid);
            const publicProfileData = {
                uid: user.uid,
                nickname,
                role: userData.role,
                photoURL: userData.photoURL,
                updatedAt: serverTimestamp(),
                isProfileComplete: true,
                ...(isBuddy && { introduction, interests, availableTime }),
            };
            await setDoc(publicProfileRef, publicProfileData, { merge: true });

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                onProfileUpdate({ ...userData, ...updatedPrivateData });
            }, 1500);
        } catch (error) {
            console.error("Error updating profile:", error);
        } finally {
            setIsSaving(false);
        }
    };
    
    const NicknameStatusMessage = () => {
        if (nicknameStatus === 'checking') return <p className="text-sm text-gray-500 mt-1">Checking...</p>;
        if (nicknameStatus === 'available') return <p className="text-sm text-green-600 mt-1">Nickname is available!</p>;
        if (nicknameStatus === 'taken') return <p className="text-sm text-red-600 mt-1">This nickname is already taken.</p>;
        return null;
    };

    return (
        <div className="relative">
            {isInitialSetup && (
                 <button onClick={onLogout} className="absolute top-6 left-6 flex items-center text-gray-600 hover:text-gray-900 z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    Back
                </button>
            )}
            {!isInitialSetup && <AppHeader user={user} userData={userData} onLogout={() => {}} onNavigate={onBack} />}
            <main className={`p-8 ${isInitialSetup ? 'min-h-screen flex items-center' : ''}`}>
                <div className="max-w-2xl mx-auto w-full bg-white p-8 rounded-lg shadow">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">{isInitialSetup ? (isBuddy ? "버디 프로필 설정" : "Learner Profile Setup") : (isBuddy ? "프로필 수정" : "Edit Profile")}</h1>
                    <p className="text-gray-600 mb-6">{isInitialSetup && (isBuddy ? "러너들이 당신을 잘 알 수 있도록 프로필을 완성해주세요!" : "Complete your profile to find the perfect buddy!")}</p>
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">{isBuddy ? "닉네임" : "Nickname"}</label>
                            <input type="text" id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                            <NicknameStatusMessage />
                        </div>
                        
                        {isBuddy ? (
                            <>
                                <div><label htmlFor="introduction" className="block text-sm font-medium text-gray-700">자기소개</label><textarea id="introduction" value={introduction} onChange={(e) => setIntroduction(e.target.value)} rows="3" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" placeholder="당신에 대해 알려주세요!"></textarea></div>
                                <div><label className="block text-sm font-medium text-gray-700">대화 가능 시간</label><p className="text-xs text-gray-500 mb-2">대화하고 싶은 시간대를 모두 선택해주세요.</p><TimeSelectionGrid selectedTimes={availableTime} onTimeSelect={handleTimeSelect} days={DAYS_OF_WEEK_KO} times={AVAILABLE_TIMES_KO} /></div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label htmlFor="koreanLevel" className="block text-sm font-medium text-gray-700">My Korean Level</label>
                                    <select id="koreanLevel" value={koreanLevel} onChange={(e) => setKoreanLevel(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                                        {KOREAN_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                                    </select>
                                </div>
                                <div><label className="block text-sm font-medium text-gray-700">Preferred Session Time</label><p className="text-xs text-gray-500 mb-2">Select all times you are generally available to talk.</p><TimeSelectionGrid selectedTimes={preferredTime} onTimeSelect={handleTimeSelect} days={DAYS_OF_WEEK_EN} times={AVAILABLE_TIMES_EN} /></div>
                            </>
                        )}

                        <div>
                            <label htmlFor="interests" className="block text-sm font-medium text-gray-700">{isBuddy ? "관심사 (태그)" : "Interests (Tags)"}</label>
                            <p className="text-xs text-gray-500 mb-2">{isBuddy ? "관심사를 입력하고 Enter를 누르세요." : "Type an interest and press Enter."}</p>
                            <div className="flex flex-wrap gap-2 mb-2 p-2 border rounded-md min-h-[40px]">
                                {interests.map(interest => (
                                    <span key={interest} className="flex items-center bg-indigo-100 text-indigo-800 text-sm font-medium px-3 py-1 rounded-full">
                                        {interest}
                                        <button onClick={() => handleRemoveInterest(interest)} className="ml-2 text-indigo-500 hover:text-indigo-700">&times;</button>
                                    </span>
                                ))}
                                <input type="text" id="interests" value={interestInput} onChange={(e) => setInterestInput(e.target.value)} onKeyDown={handleAddInterest} className="flex-grow p-1 focus:outline-none bg-transparent" placeholder={interests.length === 0 ? (isBuddy ? "예: K-Pop, BTS, 서울 맛집..." : "e.g., K-Pop, BTS, Seoul Food...") : ""}/>
                            </div>
                        </div>
                        <div className="flex justify-end items-center pt-4">
                            {showSuccess && <span className="text-green-600 mr-4">{isBuddy ? "성공적으로 저장되었습니다!" : "Saved successfully!"}</span>}
                            <button onClick={handleSave} disabled={isSaving || nicknameStatus === 'taken' || nickname.trim() === ''} className="w-full md:w-auto px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors">
                                {isSaving ? (isBuddy ? "저장 중..." : "Saving...") : (isInitialSetup ? (isBuddy ? "Annyeong 시작하기" : "Get Started") : (isBuddy ? "변경사항 저장" : "Save Changes"))}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

const TimeSelectionGrid = ({ selectedTimes, onTimeSelect, days, times }) => (
    <div className="border rounded-lg p-2">
        <table className="w-full text-center text-sm table-fixed">
            <thead>
                <tr>
                    <th className="p-1 w-[40%] sm:w-[30%]"></th>
                    {days.map(day => <th key={day} className="font-semibold p-1">{day}</th>)}
                </tr>
            </thead>
            <tbody>
                {times.map(time => (
                    <tr key={time} className="border-t">
                        <td className="font-semibold p-1 text-left text-xs break-words">{time}</td>
                        {days.map((day) => (
                            <td key={day} className="p-1">
                                <button onClick={() => onTimeSelect(day, time)} className={`w-full h-8 rounded transition-colors ${selectedTimes[day]?.includes(time) ? 'bg-indigo-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}></button>
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

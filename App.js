import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert as RNAlert,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

// === CONDITIONELE IMPORTS: alleen native ===
let Notifications: any = null;
let TaskManager: any = null;

if (Platform.OS !== 'web') {
  // Dynamisch importeren voor native only
  import('expo-notifications').then(mod => {
    Notifications = mod.default;
  });
  import('expo-task-manager').then(mod => {
    TaskManager = mod.default;
  });
} else {
  // Web: lege stubs
  Notifications = {
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    scheduleNotificationAsync: async () => {},
    setNotificationHandler: () => {},
    registerTaskAsync: async () => {},
  };
  TaskManager = {
    defineTask: () => {},
    isTaskRegisteredAsync: async () => false,
  };
}

// ==== SUPABASE ====
const SUPABASE_URL = 'https://itgwuhvchxcskwelelrm.supabase.co';
const SUPABASE_API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0Z3d1aHZjaHhjc2t3ZWxlbHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyMzY0NTAsImV4cCI6MjA2MjgxMjQ1MH0.ZGrXZcNGoFiFX1KzWi_5zAT15OL2fHhENzWJg7k6vEg';
const supabaseHeaders = {
  apikey: SUPABASE_API_KEY,
  Authorization: `Bearer ${SUPABASE_API_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const isWeb = Platform.OS === 'web';

// --- Web-safe Alert wrapper ---
const Alert = {
  alert: (title: string, message = '', buttons?: any[]) => {
    if (!isWeb) return RNAlert.alert(title, message, buttons);
    if (Array.isArray(buttons) && buttons.length) {
      const yes = buttons.find(b => b.text?.toLowerCase() === 'ja' || b.onPress);
      const cancel = buttons.find(b => b.style === 'cancel' || b.text?.toLowerCase() === 'annuleren');
      const ok = window.confirm(`${title}\n\n${message}`);
      if (ok && yes?.onPress) yes.onPress();
      if (!ok && cancel?.onPress) cancel.onPress();
      return;
    }
    window.alert(`${title}\n\n${message}`);
  }
};

// ---- Melding sturen (web + native) ----
async function sendNotification(title: string, body: string) {
  try {
    if (isWeb) {
      // Web: gebruik Notification API of fallback
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      } else if (Notification.permission === 'default') {
        await Notification.requestPermission();
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
        } else {
          Alert.alert(title, body);
        }
      } else {
        Alert.alert(title, body);
      }
    } else if (Notifications) {
      await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: null,
      });
    }
  } catch (e) {
    Alert.alert(title, body);
  }
}

// Native: notificatie handler
if (!isWeb && Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// ---- Netwerk tests ----
const testNetworkRequest = async () => {
  try {
    const res = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    return res.ok;
  } catch {
    return false;
  }
};
const testSupabaseConnection = async () => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/claims?select=*`, {
      method: 'GET',
      headers: supabaseHeaders,
    });
    return res.ok;
  } catch {
    return false;
  }
};

// ---- Toegangscodes ----
const accessCodes: { [key: string]: string } = {
  '1610': 'Daniel',
  '2207': 'Taylor',
  '1806': 'Roland',
  '2412': 'Lavi',
  '1111': 'Nunzia',
  '1812': 'Charel',
  '15057': 'Debora',
  '5991': 'Vincent',
  '8888': 'Jentai',
  '2404': 'Welan',
  '1951': 'Alysia',
  '2010': 'Aelita',
  '1301': 'Daan',
  '1604': 'Isis',
  '1505': 'Anouk',
};

// ---- Lokale storage keys ----
const LS_KEYS = {
  USERS: 'jp_known_users',
  COUNTS: 'jp_claim_counts',
  SCHEDULES: 'jp_release_schedules',
};

// ---- AsyncStorage helpers ----
const loadJSON = async (key: string, fallback: any) => {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const saveJSON = async (key: string, obj: any) => {
  try { await AsyncStorage.setItem(key, JSON.stringify(obj)); } catch {}
};

// ---- Tijd helpers ----
const TEN_HOURS_MS = 10 * 60 * 60 * 1000;
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const fmtDuration = (ms: number) => {
  if (ms < 0) ms = 0;
  const hh = Math.floor(ms / 3600000);
  const mm = Math.floor((ms % 3600000) / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
};

// ====== AUTO RELEASE TASK (alleen native) ======
const AUTO_RELEASE_TASK = 'auto-release-parking-cards';

if (TaskManager && !isWeb) {
  TaskManager.defineTask(AUTO_RELEASE_TASK, async () => {
    try {
      const sched = await loadJSON(LS_KEYS.SCHEDULES, {});
      const now = Date.now();
      const currentUser = await AsyncStorage.getItem('currentUserForAutoRelease');
      if (!currentUser) return;

      for (const [cardKey, releaseAt] of Object.entries(sched)) {
        if (now >= (releaseAt as number)) {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/claims?card_key=eq.${encodeURIComponent(cardKey)}&select=claimed_by`, { headers: supabaseHeaders });
          if (!res.ok) continue;
          const data = await res.json();
          if (data[0]?.claimed_by !== currentUser) continue;

          await fetch(`${SUPABASE_URL}/rest/v1/claims?card_key=eq.${encodeURIComponent(cardKey)}`, {
            method: 'PATCH',
            headers: supabaseHeaders,
            body: JSON.stringify({ status: 'beschikbaar', claimed_by: null, claimed_at: null }),
          });

          await sendNotification('Automatisch vrijgegeven', `${cardKey} is vrijgegeven (10 uur bereikt).`);

          delete sched[cardKey];
          await saveJSON(LS_KEYS.SCHEDULES, sched);
        }
      }
    } catch (error) {
      console.error('Auto-release task error:', error);
    }
  });

  // Registreer task bij opstarten
  (async () => {
    if (TaskManager && Notifications) {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(AUTO_RELEASE_TASK);
      if (!isRegistered) {
        await Notifications.registerTaskAsync(AUTO_RELEASE_TASK);
      }
    }
  })();
}

// ====== Card Component ======
const Card = ({
  cardName,
  cardKey,
  cardImage,
  claimedStatus,
  claimedBy,
  claimedAt,
  userName,
  onPress,
  onZoom,
  now,
}: any) => {
  const fadeInValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeInValue, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    if (claimedStatus === 'geclaimd') {
      Animated.sequence([
        Animated.timing(pulseValue, { toValue: 1.05, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseValue, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [claimedStatus]);

  const claimedMs = claimedAt ? (now - new Date(claimedAt).getTime()) : 0;
  const remainingMs = claimedStatus === 'geclaimd' ? (TEN_HOURS_MS - claimedMs) : 0;
  const isImageClickable = claimedStatus !== 'geclaimd' || claimedBy === userName;

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        { opacity: fadeInValue, transform: [{ scale: claimedStatus === 'geclaimd' ? pulseValue : 1 }] },
      ]}
    >
      <Text style={styles.cardName}>{cardName}</Text>
      <TouchableOpacity
        onPress={isImageClickable ? () => onZoom(cardImage) : null}
        style={[
          styles.cardImageContainer,
          claimedStatus === 'geclaimd' ? styles.claimed : styles.available,
          isWeb && { cursor: isImageClickable ? 'zoom-in' : 'not-allowed' },
        ]}
        disabled={!isImageClickable}
      >
        <Image source={{ uri: cardImage }} style={styles.cardImage} />
        {claimedStatus === 'geclaimd' ? (
          <View style={styles.overlayContainer} pointerEvents="none">
            <Text style={styles.inUseText}>In gebruik door {claimedBy}</Text>
          </View>
        ) : (
          <Text style={styles.availableText}>Beschikbaar</Text>
        )}
      </TouchableOpacity>
      {claimedStatus === 'geclaimd' && (
        <View style={{ alignItems: 'center', marginTop: 6 }}>
          <Text style={styles.timerText}>
            Sinds: {fmtDuration(claimedMs)} • Rest: {fmtDuration(remainingMs)}
          </Text>
        </View>
      )}
      <View style={styles.cardButtons}>
        <TouchableOpacity
          onPress={() => onPress('claim')}
          style={[styles.claimButton, isWeb && { cursor: 'pointer' }]}
        >
          <Text style={styles.buttonText}>Claim</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onPress('release')}
          style={[styles.releaseButton, isWeb && { cursor: 'pointer' }]}
        >
          <Text style={styles.buttonText}>Vrijgeven</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const ParkingApp = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [code, setCode] = useState('');
  const [userName, setUserName] = useState('');
  const [loginTime, setLoginTime] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null);
  const [networkStatus, setNetworkStatus] = useState<boolean | null>(null);
  const [hasSavedCode, setHasSavedCode] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const fadeInUpValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const initializeApp = async () => {
      if (!isWeb) {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricSupported(compatible && enrolled);
      }

      const savedCode = await AsyncStorage.getItem('userCode');
      if (savedCode && accessCodes[savedCode]) {
        const name = accessCodes[savedCode];
        await addKnownUser(name);
        setUserName(name);
        await ensureUserExists(name);
        const currentTime = new Date();
        setLoginTime(currentTime);
        await updateUserLastLogin(name, currentTime);
        setLoggedIn(true);
        setHasSavedCode(true);
        await AsyncStorage.setItem('currentUserForAutoRelease', name);
        await checkExpiredClaimsOnStartup();
      } else {
        setHasSavedCode(!!savedCode);
      }

      Animated.timing(fadeInUpValue, { toValue: 1, duration: 1200, useNativeDriver: true }).start();

      const checkConnections = async () => {
        const networkOk = await testNetworkRequest();
        setNetworkStatus(networkOk);
        const supabaseOk = await testSupabaseConnection();
        setConnectionStatus(supabaseOk);
        if (!networkOk) Alert.alert('Netwerkfout', 'Geen internetverbinding.');
        if (!supabaseOk) Alert.alert('Supabase Fout', 'Geen verbinding met database.');
      };
      checkConnections();
    };
    initializeApp();
  }, []);

  const checkExpiredClaimsOnStartup = async () => {
    const sched = await loadJSON(LS_KEYS.SCHEDULES, {});
    const now = Date.now();
    const currentUser = await AsyncStorage.getItem('currentUserForAutoRelease');
    if (!currentUser) return;

    for (const [cardKey, releaseAt] of Object.entries(sched)) {
      if (now >= (releaseAt as number)) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/claims?card_key=eq.${encodeURIComponent(cardKey)}&select=claimed_by`, { headers: supabaseHeaders });
        if (!res.ok) continue;
        const data = await res.json();
        if (data[0]?.claimed_by === currentUser) {
          await saveClaim(cardKey, null);
          await sendNotification('Automatisch vrijgegeven', `${cardKey} is vrijgegeven (10 uur bereikt).`);
          delete sched[cardKey];
          await saveJSON(LS_KEYS.SCHEDULES, sched);
        }
      }
    }
  };

  const handleFaceIDLogin = async () => {
    if (isWeb) return Alert.alert('Web', 'Face ID werkt alleen op mobiel.');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Log in met Face ID',
        fallbackLabel: 'Gebruik toegangscode',
      });
      if (result.success) {
        const savedCode = await AsyncStorage.getItem('userCode');
        if (savedCode && accessCodes[savedCode]) {
          const name = accessCodes[savedCode];
          await addKnownUser(name);
          setUserName(name);
          await ensureUserExists(name);
          const currentTime = new Date();
          setLoginTime(currentTime);
          await updateUserLastLogin(name, currentTime);
          setLoggedIn(true);
          await AsyncStorage.setItem('currentUserForAutoRelease', name);
        }
      }
    } catch {
      Alert.alert('Fout', 'Face ID mislukt.');
    }
  };

  const handleLogin = async () => {
    if (accessCodes[code]) {
      const name = accessCodes[code];
      await addKnownUser(name);
      setUserName(name);
      await ensureUserExists(name);
      const currentTime = new Date();
      setLoginTime(currentTime);
      await updateUserLastLogin(name, currentTime);
      await AsyncStorage.setItem('userCode', code);
      await AsyncStorage.setItem('currentUserForAutoRelease', name);
      setHasSavedCode(true);
      setLoggedIn(true);
    } else {
      Alert.alert('Oeps', 'Onjuiste code.');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userCode');
    await AsyncStorage.removeItem('currentUserForAutoRelease');
    setHasSavedCode(false);
    setLoggedIn(false);
    setCode('');
    setUserName('');
    setLoginTime(null);
  };

  if (!loggedIn) {
    return (
      <View style={[styles.container, { backgroundColor: '#b22222' }]}>
        <Animated.View style={[styles.formContainer, { opacity: fadeInUpValue, transform: [{ translateY: fadeInUpValue.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }]}>
          <Image source={{ uri: 'https://media.glassdoor.com/sqll/1075020/jvh-gaming-en-entertainment-squarelogo-1533909494473.png' }} style={styles.logo} />
          <Text style={styles.header}>Welkom bij Jack's Parking!</Text>
          <Text style={styles.label}>Toegangscode:</Text>
          <TextInput value={code} onChangeText={setCode} placeholder="code" placeholderTextColor="#888" style={styles.input} keyboardType="numeric" />
          <TouchableOpacity onPress={handleLogin} style={styles.loginButton}>
            <Text style={styles.loginButtonText}>Inloggen</Text>
          </TouchableOpacity>
          {biometricSupported && hasSavedCode && (
            <TouchableOpacity onPress={handleFaceIDLogin} style={styles.faceIDButton}>
              <Text style={styles.faceIDButtonText}>Face ID</Text>
            </TouchableOpacity>
          )}
          {networkStatus === false && <Text style={styles.errorText}>Geen netwerk!</Text>}
          {connectionStatus === false && <Text style={styles.errorText}>Geen Supabase!</Text>}
        </Animated.View>
      </View>
    );
  }

  return <Dashboard onLogout={handleLogout} userName={userName} loginTime={loginTime} />;
};

// === DB Helpers ===
const ensureUserExists = async (username: string) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`, { headers: supabaseHeaders });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.length === 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: supabaseHeaders,
        body: JSON.stringify({ username }),
      });
    }
    return true;
  } catch { return false; }
};

const updateUserLastLogin = async (username: string, loginTime: Date) => {
  try {
    const timeString = loginTime.toTimeString().split(' ')[0];
    await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`, {
      method: 'PATCH',
      headers: supabaseHeaders,
      body: JSON.stringify({ last_login: timeString }),
    });
  } catch {}
};

// === Leaderboard ===
const addKnownUser = async (name: string) => {
  const users = await loadJSON(LS_KEYS.USERS, []);
  if (!users.includes(name)) {
    users.push(name);
    await saveJSON(LS_KEYS.USERS, users);
  }
};

const incrementClaimCount = async (name: string) => {
  const counts = await loadJSON(LS_KEYS.COUNTS, {});
  counts[name] = (counts[name] || 0) + 1;
  await saveJSON(LS_KEYS.COUNTS, counts);
  return counts[name];
};

const getLeaderboard = async () => {
  const users = await loadJSON(LS_KEYS.USERS, []);
  const counts = await loadJSON(LS_KEYS.COUNTS, {});
  return users
    .map(u => ({ user: u, count: counts[u] || 0 }))
    .sort((a, b) => b.count - a.count || a.user.localeCompare(b.user));
};

const setReleaseSchedule = async (cardKey: string, ts: number) => {
  const sched = await loadJSON(LS_KEYS.SCHEDULES, {});
  sched[cardKey] = ts;
  await saveJSON(LS_KEYS.SCHEDULES, sched);
};

// ====== Dashboard ======
const Dashboard = ({ onLogout, userName, loginTime }: any) => {
  const [claimedCards, setClaimedCards] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState('#f0f0f0');
  const [showBoard, setShowBoard] = useState(false);
  const [boardRows, setBoardRows] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const fadeInDownValue = useRef(new Animated.Value(0)).current;
  const backgroundAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchClaims = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/claims?select=*`, { headers: supabaseHeaders });
      if (!res.ok) throw new Error(`Status: ${res.status}`);
      const data = await res.json();
      const claims: any = {};
      data.forEach((item: any) => {
        claims[item.card_key] = {
          status: item.status,
          claimedBy: item.claimed_by,
          claimedAt: item.claimed_at,
        };
      });
      setClaimedCards(claims);
      setFetchError(null);
    } catch (error: any) {
      setFetchError(error.message);
    }
  };

  useEffect(() => {
    Animated.timing(fadeInDownValue, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    fetchClaims();
    const interval = setInterval(fetchClaims, 2000);
    return () => clearInterval(interval);
  }, []);

  const animateBackground = (color: string) => {
    setBackgroundColor(color);
    Animated.timing(backgroundAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start(() => {
      Animated.timing(backgroundAnim, { toValue: 0, duration: 400, useNativeDriver: false }).start(() => setBackgroundColor('#f0f0f0'));
    });
  };

  const backgroundColorInterpolate = backgroundAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#f0f0f0', backgroundColor],
  });

  const saveClaim = async (cardKey: string, claimedBy: string | null) => {
    setLoading(true);
    try {
      const newStatus = claimedBy ? 'geclaimd' : 'beschikbaar';
      const currentTime = new Date().toISOString();
      const resSelect = await fetch(`${SUPABASE_URL}/rest/v1/claims?card_key=eq.${encodeURIComponent(cardKey)}`, { headers: supabaseHeaders });
      const data = await resSelect.json();

      if (data.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/claims?card_key=eq.${encodeURIComponent(cardKey)}`, {
          method: 'PATCH',
          headers: supabaseHeaders,
          body: JSON.stringify({ status: newStatus, claimed_by: claimedBy, claimed_at: claimedBy ? currentTime : null }),
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/claims`, {
          method: 'POST',
          headers: supabaseHeaders,
          body: JSON.stringify({ card_key: cardKey, status: newStatus, claimed_by: claimedBy, claimed_at: claimedBy ? currentTime : null }),
        });
      }

      const cardName = { card1: 'parkeerkaart 1', card2: 'parkeerkaart 2', card3: 'parkeerkaart 3', card4: 'parkeerkaart 4' }[cardKey];

      if (claimedBy) {
        await incrementClaimCount(claimedBy);
        await refreshLeaderboard();
        await sendNotification(`${cardName} geclaimd!`, `${claimedBy} heeft ${cardName} geclaimd.`);
        animateBackground('#ff6666');
        await setReleaseSchedule(cardKey, Date.now() + TEN_HOURS_MS);
      } else {
        await sendNotification(`${cardName} beschikbaar!`, `${cardName} is nu vrij.`);
        animateBackground('#66ff66');
        const sched = await loadJSON(LS_KEYS.SCHEDULES, {});
        delete sched[cardKey];
        await saveJSON(LS_KEYS.SCHEDULES, sched);
      }
      await fetchClaims();
    } catch (error: any) {
      Alert.alert('Fout', error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleClaim = (cardKey: string) => {
    const userClaimed = Object.entries(claimedCards).find(([k, v]: any) => v.claimedBy === userName && k !== cardKey && v.status === 'geclaimd');
    if (userClaimed) return Alert.alert('Fout', 'Je hebt al een kaart.');
    if (claimedCards[cardKey]?.status === 'geclaimd') {
      Alert.alert('Bezet', `In gebruik door ${claimedCards[cardKey].claimedBy}.`);
    } else {
      Alert.alert('Bevestigen', 'Claimen?', [
        { text: 'Nee', style: 'cancel' },
        { text: 'Ja', onPress: () => saveClaim(cardKey, userName) },
      ]);
    }
  };

  const toggleRelease = (cardKey: string) => {
    if (claimedCards[cardKey]?.claimedBy === userName) {
      Alert.alert('Bevestigen', 'Vrijgeven?', [
        { text: 'Nee', style: 'cancel' },
        { text: 'Ja', onPress: () => saveClaim(cardKey, null) },
      ]);
    } else {
      Alert.alert('Niet toegestaan', 'Alleen eigen kaart vrijgeven.');
    }
  };

  const cardImages = useMemo(() => ({
    card1: 'https://i.ibb.co/LSYLK4N/pakeerkaart-STFEFQDW.jpg',
    card2: 'https://i.imgur.com/6fzUY8r.jpeg',
    card3: 'https://i.imgur.com/BdvVdH0.jpeg',
    card4: 'https://i.imgur.com/v2NekZk.jpeg',
  }), []);

  const availableCards = Object.values(claimedCards).filter((c: any) => c.status !== 'geclaimd').length;

  const openLeaderboard = async () => {
    setBoardRows(await getLeaderboard());
    setShowBoard(true);
  };

  const refreshLeaderboard = async () => {
    setBoardRows(await getLeaderboard());
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: '#f0f0f0' }]}>
        <Text style={styles.loadingText}>Laden...</Text>
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={[styles.container, { backgroundColor: '#b22222' }]}>
        <Text style={styles.errorText}>{fetchError}</Text>
        <TouchableOpacity onPress={fetchClaims} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Opnieuw</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Uitloggen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.dashboardContainer, { backgroundColor: backgroundColorInterpolate }]}>
      <Modal visible={!!zoomedImage} transparent animationType="slide" onRequestClose={() => setZoomedImage(null)}>
        <View style={styles.modalBackground}>
          <ScrollView maximumZoomScale={3} contentContainerStyle={styles.scrollZoomContainer}>
            <TouchableWithoutFeedback onPress={() => setZoomedImage(null)}>
              <Image source={{ uri: zoomedImage! }} style={styles.zoomedImage} resizeMode="contain" />
            </TouchableWithoutFeedback>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showBoard} transparent animationType="fade" onRequestClose={() => setShowBoard(false)}>
        <View style={styles.lbBackdrop}>
          <View style={styles.lbCard}>
            <Text style={styles.lbTitle}>Leaderboard</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {boardRows.length === 0 ? (
                <Text style={{ textAlign: 'center', color: '#555' }}>Geen data</Text>
              ) : (
                boardRows.map((row, idx) => (
                  <View key={idx} style={styles.lbRow}>
                    <Text style={styles.lbUser}>{idx + 1}. {row.user}</Text>
                    <Text style={styles.lbCount}>{row.count}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity onPress={refreshLeaderboard} style={[styles.lbBtn, { backgroundColor: '#b22222' }]}>
                <Text style={styles.lbBtnText}>Vernieuwen</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowBoard(false)} style={[styles.lbBtn, { backgroundColor: '#555' }]}>
                <Text style={styles.lbBtnText}>Sluiten</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.contentContainer}>
        <Text style={styles.welcomeText}>Goedendag, {userName}!</Text>
        {loginTime && <Text style={styles.loginTime}>Ingelogd: {loginTime.toLocaleTimeString()}</Text>}
        <Text style={styles.availableTextCount}>Beschikbaar: {availableCards}/4</Text>
        <View style={styles.cardsContainer}>
          <View style={styles.cardsRowCentered}>
            <Card cardName="parkeerkaart 1" cardKey="card1" cardImage={cardImages.card1} claimedStatus={claimedCards.card1?.status} claimedBy={claimedCards.card1?.claimedBy} claimedAt={claimedCards.card1?.claimedAt} userName={userName} onPress={(a: string) => a === 'claim' ? toggleClaim('card1') : toggleRelease('card1')} onZoom={setZoomedImage} now={now} />
            <Card cardName="parkeerkaart 2" cardKey="card2" cardImage={cardImages.card2} claimedStatus={claimedCards.card2?.status} claimedBy={claimedCards.card2?.claimedBy} claimedAt={claimedCards.card2?.claimedAt} userName={userName} onPress={(a: string) => a === 'claim' ? toggleClaim('card2') : toggleRelease('card2')} onZoom={setZoomedImage} now={now} />
          </View>
          <View style={styles.cardsRowCentered}>
            <Card cardName="parkeerkaart 3" cardKey="card3" cardImage={cardImages.card3} claimedStatus={claimedCards.card3?.status} claimedBy={claimedCards.card3?.claimedBy} claimedAt={claimedCards.card3?.claimedAt} userName={userName} onPress={(a: string) => a === 'claim' ? toggleClaim('card3') : toggleRelease('card3')} onZoom={setZoomedImage} now={now} />
            <Card cardName="parkeerkaart 4" cardKey="card4" cardImage={cardImages.card4} claimedStatus={claimedCards.card4?.status} claimedBy={claimedCards.card4?.claimedBy} claimedAt={claimedCards.card4?.claimedAt} userName={userName} onPress={(a: string) => a === 'claim' ? toggleClaim('card4') : toggleRelease('card4')} onZoom={setZoomedImage} now={now} />
          </View>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Uitloggen</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={openLeaderboard} style={styles.fab}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Trophy</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ====== Styles ======
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  formContainer: { width: '90%', maxWidth: 400, padding: 25, borderRadius: 15, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.7, shadowRadius: 18, elevation: 20, alignItems: 'center' },
  logo: { width: 120, height: 120, marginBottom: 15, borderRadius: 60, borderWidth: 2, borderColor: '#b22222' },
  header: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 10, textAlign: 'center' },
  label: { fontSize: 16, marginBottom: 10, color: '#555' },
  input: { width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20, backgroundColor: '#fefefe' },
  loginButton: { width: '100%', paddingVertical: 15, borderRadius: 8, backgroundColor: '#b22222', alignItems: 'center' },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  faceIDButton: { width: '100%', paddingVertical: 15, borderRadius: 8, backgroundColor: '#555', alignItems: 'center', marginTop: 10 },
  faceIDButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  errorText: { color: 'yellow', marginTop: 10, fontSize: 14, textAlign: 'center' },
  retryButton: { marginTop: 20, padding: 10, borderRadius: 5, backgroundColor: '#008000', alignItems: 'center' },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  dashboardContainer: { flex: 1 },
  contentContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  welcomeText: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  loginTime: { fontSize: 14, color: '#666', marginBottom: 10 },
  availableTextCount: { fontSize: 16, color: '#555', marginBottom: 10, fontWeight: 'bold' },
  cardsContainer: { alignItems: 'center', marginVertical: 20 },
  cardsRowCentered: { flexDirection: 'row', justifyContent: 'center', width: '100%', marginVertical: 10, gap: 20 },
  cardContainer: { alignItems: 'center', marginHorizontal: 10, width: '40%' },
  cardName: { fontSize: 16, marginBottom: 10, color: '#333' },
  cardImageContainer: { width: 150, height: 150, borderRadius: 10, overflow: 'hidden', borderWidth: 4 },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  claimed: { borderColor: 'red' },
  available: { borderColor: 'green' },
  overlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  inUseText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  availableText: { position: 'absolute', bottom: 10, left: '50%', transform: [{ translateX: -50 }], color: 'white', backgroundColor: 'rgba(0,128,0,0.8)', paddingHorizontal: 5, borderRadius: 3 },
  timerText: { fontSize: 12, color: '#444', marginTop: 2 },
  cardButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 },
  claimButton: { backgroundColor: '#b22222', padding: 10, borderRadius: 5, flex: 1, marginRight: 6, alignItems: 'center' },
  releaseButton: { backgroundColor: '#008000', padding: 10, borderRadius: 5, flex: 1, marginLeft: 6, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 14, textAlign: 'center' },
  logoutButton: { marginTop: 20, padding: 10, borderRadius: 5, backgroundColor: '#b22222', alignItems: 'center' },
  logoutButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  scrollZoomContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  zoomedImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  loadingText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  lbBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 18 },
  lbCard: { width: '90%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 2, borderColor: '#b22222' },
  lbTitle: { fontSize: 20, fontWeight: 'bold', color: '#b22222', marginBottom: 10, textAlign: 'center' },
  lbRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  lbUser: { fontSize: 16, color: '#222', fontWeight: '600' },
  lbCount: { fontSize: 16, color: '#b22222', fontWeight: '700' },
  lbBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  lbBtnText: { color: '#fff', fontWeight: '700' },
  fab: { position: 'absolute', right: 18, bottom: 18, width: 56, height: 56, borderRadius: 28, backgroundColor: '#b22222', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 6 }, shadowRadius: 8, elevation: 10 },
});

export default ParkingApp;

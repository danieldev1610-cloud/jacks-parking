import React, { useState, useEffect, useRef } from 'react';
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
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

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
// =====================================

// ---------- CONSTS ----------
const isWeb = Platform.OS === 'web';
const MAX_HOURS = 10;
const MAX_MS = MAX_HOURS * 60 * 60 * 1000;
const NOTIFY_BEFORE_MS = 30 * 60 * 1000; // 30 min voor einde

// iOS-web detectie (PWA op iPhone)
let isIOSWeb = false;
try {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  isIOSWeb = isWeb && (/iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 2));
} catch { isIOSWeb = false; }

// Dynamische maten voor iPhone vs andere
const CARD_CONTAINER_WIDTH = isIOSWeb ? 150 : 180;
const CARD_IMG_SIZE = isIOSWeb ? 130 : 150;

// Web-safe Alert wrapper
const Alert = {
  alert: (title, message = '', buttons) => {
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

// Notificaties
async function setupNotifications() {
  try {
    if (isWeb) {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      return true;
    } else {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Fout', 'Geen toestemming voor notificaties.');
        return false;
      }
      return true;
    }
  } catch {
    return false;
  }
}

async function sendNotification(title, body) {
  try {
    if (isWeb) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      } else {
        Alert.alert(title, body);
      }
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch {}
}

// Alleen native handler
if (!isWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Toegangscodes
const accessCodes = {
  '1610': 'Daniel', '2207': 'Taylor', '1806': 'Roland', '2412': 'Lavi',
  '1111': 'Nunzia', '1812': 'Charel', '15057': 'Debora', '5991': 'Vincent',
  '8888': 'Jentai', '2404': 'Welan', '1951': 'Alysia', '2010': 'Aelita',
  '1301': 'Daan', '1604': 'Isis',
};

// Helpers voor tijd
const fmt2 = (n) => String(n).padStart(2, '0');
const formatHM = (ms) => {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${fmt2(h)}:${fmt2(m)}`;
};

// ====== Card ======
const Card = ({ cardName, cardKey, cardImage, claimedStatus, claimedBy, claimedAt, userName, onPress, onZoom, nowTs }) => {
  const fadeInValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeInValue, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
    if (claimedStatus === 'geclaimd') {
      Animated.sequence([
        Animated.timing(pulseValue, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseValue, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [claimedStatus]);

  const elapsedMs = claimedAt ? (nowTs - new Date(claimedAt).getTime()) : 0;
  const remainingMs = Math.max(0, MAX_MS - elapsedMs);
  const remainingStr = formatHM(remainingMs);

  const formatClaimedAt = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        { opacity: fadeInValue, transform: [{ scale: claimedStatus === 'geclaimd' ? pulseValue : 1 }] },
      ]}
    >
      <Text style={styles.cardName}>{cardName}</Text>

      <TouchableOpacity
        onPress={() => onZoom(cardImage)}
        style={[
          styles.cardImageContainer,
          claimedStatus === 'geclaimd' ? styles.claimed : styles.available,
          isWeb && { cursor: (claimedStatus !== 'geclaimd' || claimedBy === userName || userName === 'Daniel') ? 'zoom-in' : 'not-allowed' },
        ]}
        disabled={claimedStatus === 'geclaimd' && claimedBy !== userName && userName !== 'Daniel'}
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
          {claimedAt && (
            <Text style={styles.claimedAtText}>
              Geclaimd om {formatClaimedAt(claimedAt)} door {claimedBy}
            </Text>
          )}
          <Text style={[styles.timerText, remainingMs <= 0 && { color: '#b22222', fontWeight: 'bold' }]}>
            Reset over: {remainingStr}
          </Text>
        </View>
      )}

      <View style={styles.cardButtons}>
        <TouchableOpacity onPress={() => onPress('claim')} style={styles.claimButton}>
          <Text style={styles.buttonText}>Claim</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onPress('release')} style={styles.releaseButton}>
          <Text style={styles.buttonText}>Vrijgeven</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// === MAIN APP ===
const ParkingApp = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [code, setCode] = useState('');
  const [userName, setUserName] = useState('');
  const [loginTime, setLoginTime] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [networkStatus, setNetworkStatus] = useState(null);
  const [hasSavedCode, setHasSavedCode] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);

  const fadeInUpValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const initializeApp = async () => {
      if (!isWeb) {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricSupported(compatible && enrolled);
      } else {
        setBiometricSupported(false);
      }

      const savedCode = await AsyncStorage.getItem('userCode');
      if (savedCode) {
        setCode(savedCode);
        setHasSavedCode(true);
        if (accessCodes[savedCode]) {
          const name = accessCodes[savedCode];
          setUserName(name);
          const userAdded = await ensureUserExists(name);
          if (!userAdded) {
            Alert.alert('Fout', 'Kon gebruiker niet toevoegen aan de database. Check de logs.');
            return;
          }
          const currentTime = new Date();
          setLoginTime(currentTime);
          await updateUserLastLogin(name, currentTime);
          setLoggedIn(true);
        }
      }

      Animated.timing(fadeInUpValue, { toValue: 1, duration: 1500, useNativeDriver: true }).start();

      const checkConnections = async () => {
        const networkOk = await testNetworkRequest();
        setNetworkStatus(networkOk);
        const supabaseOk = await testSupabaseConnection();
        setConnectionStatus(supabaseOk);
        if (!networkOk) {
          Alert.alert('Netwerkfout', 'Kan geen verbinding maken met een eenvoudige API. Check je internetverbinding.');
        } else if (!supabaseOk) {
          Alert.alert('Supabase Fout', 'Kan geen verbinding maken met de Supabase-database. Check de logs.');
        }
        await setupNotifications();
      };
      checkConnections();
    };

    initializeApp();
  }, []);

  const handleFaceIDLogin = async () => {
    try {
      if (isWeb) {
        Alert.alert('Web', 'Biometrische login is niet beschikbaar op web.');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Log in met Face ID',
        fallbackLabel: 'Gebruik toegangscode',
      });
      if (result.success) {
        const savedCode = await AsyncStorage.getItem('userCode');
        if (savedCode && accessCodes[savedCode]) {
          const name = accessCodes[savedCode];
          setUserName(name);
          const userAdded = await ensureUserExists(name);
          if (!userAdded) {
            Alert.alert('Fout', 'Kon gebruiker niet toevoegen aan de database. Check de logs.');
            return;
          }
          const currentTime = new Date();
          setLoginTime(currentTime);
          await updateUserLastLogin(name, currentTime);
          setLoggedIn(true);
        } else {
          Alert.alert('Fout', 'Geen opgeslagen code gevonden. Log eerst handmatig in.');
        }
      } else {
        Alert.alert('Fout', 'Biometrische authenticatie mislukt. Gebruik je toegangscode.');
      }
    } catch (error) {
      console.error('Face ID login error:', error);
      Alert.alert('Fout', 'Er ging iets mis bij het inloggen met Face ID.');
    }
  };

  const handleLogin = async () => {
    if (accessCodes[code]) {
      const name = accessCodes[code];
      setUserName(name);
      const userAdded = await ensureUserExists(name);
      if (!userAdded) {
        Alert.alert('Fout', 'Kon gebruiker niet toevoegen aan de database. Check de logs.');
        return;
      }
      const currentTime = new Date();
      setLoginTime(currentTime);
      await updateUserLastLogin(name, currentTime);
      await AsyncStorage.setItem('userCode', code);
      setHasSavedCode(true);
      setLoggedIn(true);
    } else {
      Alert.alert('Oeps', 'De ingevoerde code is onjuist.');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userCode');
    setHasSavedCode(false);
    setLoggedIn(false);
    setCode('');
    setUserName('');
    setLoginTime(null);
  };

  if (!loggedIn) {
    return (
      <View style={[styles.container, { backgroundColor: '#b22222', paddingTop: isIOSWeb ? 16 : 0 }]}>
        <Animated.View
          style={[
            styles.formContainer,
            {
              opacity: fadeInUpValue,
              transform: [{ translateY: fadeInUpValue.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
            },
          ]}
        >
          <Image
            source={{ uri: 'https://media.glassdoor.com/sqll/1075020/jvh-gaming-en-entertainment-squarelogo-1533909494473.png' }}
            style={styles.logo}
          />
          <Animated.Text
            style={[
              styles.header,
              {
                opacity: fadeInUpValue,
                transform: [{ scale: fadeInUpValue.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
              },
            ]}
          >
            Welkom bij Jack's Parking!
          </Animated.Text>
          <Text style={styles.label}>Voer uw toegangscode in:</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="toegangscode"
            placeholderTextColor="#888"
            style={styles.input}
            keyboardType="numeric"
          />
          <TouchableOpacity onPress={handleLogin} style={styles.loginButton}>
            <Text style={styles.loginButtonText}>Inloggen</Text>
          </TouchableOpacity>
          {biometricSupported && hasSavedCode && (
            <TouchableOpacity
              onPress={handleFaceIDLogin}
              style={[styles.faceIDButton, isWeb && { cursor: 'not-allowed', opacity: 0.6 }]}
              disabled={isWeb}
            >
              <Text style={styles.faceIDButtonText}>Inloggen met Face ID</Text>
            </TouchableOpacity>
          )}
          {networkStatus === false && <Text style={styles.errorText}>Geen netwerkverbinding!</Text>}
          {connectionStatus === false && <Text style={styles.errorText}>Geen verbinding met Supabase!</Text>}
        </Animated.View>
      </View>
    );
  }

  return <Dashboard onLogout={handleLogout} userName={userName} loginTime={loginTime} />;
};

// === DB helpers ===
const ensureUserExists = async (username) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`, { headers: supabaseHeaders });
    if (!res.ok) return false;
    const data = await res.json();
    if (data && data.length === 0) {
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: supabaseHeaders,
        body: JSON.stringify({ username, claim_count: 0 }),
      });
      if (!insertRes.ok) return false;
      await insertRes.json();
    }
    return true;
  } catch (e) {
    console.error('Error in ensureUserExists:', e.message);
    return false;
  }
};

const updateUserLastLogin = async (username, loginTime) => {
  try {
    const timeString = loginTime.toTimeString().split(' ')[0];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`, {
      method: 'PATCH',
      headers: supabaseHeaders,
      body: JSON.stringify({ last_login: timeString }),
    });
    if (!res.ok) return false;
    await res.json();
    return true;
  } catch (e) {
    console.error('Error in updateUserLastLogin:', e.message);
    return false;
  }
};

// claim_count +1 bij claim
const incrementUserClaimCount = async (username) => {
  try {
    const get = await fetch(`${SUPABASE_URL}/rest/v1/users?select=claim_count&username=eq.${encodeURIComponent(username)}`, { headers: supabaseHeaders });
    if (!get.ok) return;
    const arr = await get.json();
    const current = (arr?.[0]?.claim_count ?? 0) + 1;
    await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`, {
      method: 'PATCH',
      headers: supabaseHeaders,
      body: JSON.stringify({ claim_count: current }),
    });
  } catch {}
};

// ====== Dashboard ======
const Dashboard = ({ onLogout, userName, loginTime }) => {
  const [claimedCards, setClaimedCards] = useState({});
  const [loading, setLoading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [backgroundColor, setBackgroundColor] = useState('#f0f0f0');
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [nowTs, setNowTs] = useState(Date.now());
  const [notified, setNotified] = useState({}); // {cardKey: true}

  const fadeInDownValue = useRef(new Animated.Value(0)).current;
  const backgroundAnim = useRef(new Animated.Value(0)).current;

const fetchClaims = async () => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/claims?select=*`, { method: 'GET', headers: supabaseHeaders });
    if (!res.ok) {
      const errorText = await res.text();
      setFetchError(`Error fetching claims: ${res.status} - ${errorText}`);
      return;
    }
    const data = await res.json();
    const claimsObject = {};

    if (Array.isArray(data)) {
      for (const item of data) {
        const elapsed = item.claimed_at ? (Date.now() - new Date(item.claimed_at).getTime()) : 0;
        const remaining = MAX_MS - elapsed;

        // AUTO-RESET na 10 uur
        if (item.status === 'geclaimd' && remaining <= 0) {
          await saveClaim(item.card_key, null);
          continue; // skip naar volgende
        }

        claimsObject[item.card_key] = {
          status: item.status,
          claimedBy: item.claimed_by,
          claimedAt: item.claimed_at,
        };
      }
    }
    setFetchError(null);
    setClaimedCards(claimsObject);
  } catch (error) {
    setFetchError(`Error fetching claims: ${error.message}`);
  }
};


  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=username,claim_count,last_login&order=claim_count.desc,nullsLast=true&limit=20`, { headers: supabaseHeaders });
      if (!res.ok) return;
      const data = await res.json();
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch {}
  };

  // Polling + animatie
  useEffect(() => {
    Animated.timing(fadeInDownValue, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
    fetchClaims();
    const interval = setInterval(fetchClaims, 2000);
    return () => clearInterval(interval);
  }, []);

  // tick voor timers/notify (elke 30s)
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // notify 30 min voor einde (alleen voor EIGEN claim, 1x)
  useEffect(() => {
    Object.entries(claimedCards).forEach(([cardKey, info]) => {
      if (!info?.claimedAt || info?.claimedBy !== userName) return;
      const elapsed = nowTs - new Date(info.claimedAt).getTime();
      const remaining = MAX_MS - elapsed;
      if (remaining <= NOTIFY_BEFORE_MS && remaining > 0 && !notified[cardKey]) {
        sendNotification('Bijna tijd!', `${cardKey} loopt over ~${formatHM(remaining)} af (limiet ${formatHM(MAX_MS)}).`);
        setNotified(prev => ({ ...prev, [cardKey]: true }));
      }
    });
  }, [nowTs, claimedCards, userName, notified]);

  const animateBackground = (color) => {
    setBackgroundColor(color);
    Animated.timing(backgroundAnim, { toValue: 1, duration: 500, useNativeDriver: false }).start(() => {
      Animated.timing(backgroundAnim, { toValue: 0, duration: 500, useNativeDriver: false }).start(() => setBackgroundColor('#f0f0f0'));
    });
  };

  const backgroundColorInterpolate = backgroundAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#f0f0f0', backgroundColor],
  });

  const saveClaim = async (cardKey, claimedBy) => {
    setLoading(true);
    try {
      const newStatus = claimedBy ? 'geclaimd' : 'beschikbaar';
      const currentTime = new Date().toISOString();

      const resSelect = await fetch(`${SUPABASE_URL}/rest/v1/claims?card_key=eq.${encodeURIComponent(cardKey)}`, { method: 'GET', headers: supabaseHeaders });
      if (!resSelect.ok) throw new Error(`Select failed: ${resSelect.statusText}`);
      const data = await resSelect.json();

      if (data && data.length > 0) {
        const resUpdate = await fetch(`${SUPABASE_URL}/rest/v1/claims?card_key=eq.${encodeURIComponent(cardKey)}`, {
          method: 'PATCH',
          headers: supabaseHeaders,
          body: JSON.stringify({ status: newStatus, claimed_by: claimedBy, claimed_at: claimedBy ? currentTime : null }),
        });
        if (!resUpdate.ok) throw new Error(`Update failed: ${resUpdate.statusText}`);
        await resUpdate.json();
      } else {
        const resInsert = await fetch(`${SUPABASE_URL}/rest/v1/claims`, {
          method: 'POST',
          headers: supabaseHeaders,
          body: JSON.stringify({ card_key: cardKey, status: newStatus, claimed_by: claimedBy, claimed_at: claimedBy ? currentTime : null }),
        });
        if (!resInsert.ok) throw new Error(`Insert failed: ${resInsert.statusText}`);
        await resInsert.json();
      }

      const cardName = { card1: 'parkeerkaart 1', card2: 'parkeerkaart 2', card3: 'parkeerkaart 3', card4: 'parkeerkaart 4' }[cardKey];

      if (claimedBy) {
        // leaderboard teller
        await incrementUserClaimCount(claimedBy);
        await sendNotification(`${cardName} geclaimd!`, `${claimedBy} heeft ${cardName} geclaimd.`);
        animateBackground('#ff6666');
      } else {
        await sendNotification(`${cardName} beschikbaar!`, `${cardName} is nu weer beschikbaar.`);
        animateBackground('#66ff66');
        setNotified(prev => {
          const cp = { ...prev };
          delete cp[cardKey];
          return cp;
        });
      }

      await fetchClaims();
    } catch (error) {
      console.error('Error in saveClaim:', error.message);
      Alert.alert('Fout', `Kon claim niet opslaan: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const elapsed = item.claimed_at ? (Date.now() - new Date(item.claimed_at).getTime()) : 0;
const remaining = MAX_MS - elapsed;



  const toggleClaim = (cardKey) => {
    const isSuperUser = userName === 'Daniel';

    if (!isSuperUser) {
      // normale beperking: 1 kaart per gebruiker
      const userClaimed = Object.entries(claimedCards).find(([key, value]) => value.claimedBy === userName && key !== cardKey);
      if (userClaimed) {
        Alert.alert('Fout', 'Je hebt al een kaart geclaimd.');
        return;
      }
      // druk bezet door iemand anders
      if (claimedCards[cardKey]?.status === 'geclaimd') {
        Alert.alert('Kaart bezet', `Deze kaart is al in gebruik door ${claimedCards[cardKey]?.claimedBy}.`);
        return;
      }
      // normale claim
      Alert.alert('Bevestiging', 'Weet je zeker dat je deze kaart wilt claimen?', [
        { text: 'Annuleren', style: 'cancel' },
        { text: 'Ja', onPress: () => saveClaim(cardKey, userName) },
      ]);
      return;
    }

    // Daniel: kan altijd claimen, ook overnemen
    const bezetter = claimedCards[cardKey]?.claimedBy;
    const msg = bezetter ? `Deze kaart is in gebruik door ${bezetter}. Wil je overnemen?` : 'Weet je zeker dat je deze kaart wilt claimen?';
    Alert.alert('Bevestiging', msg, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Ja', onPress: () => saveClaim(cardKey, userName) },
    ]);
  };

  const toggleRelease = (cardKey) => {
    const isSuperUser = userName === 'Daniel';
    if (claimedCards[cardKey]?.claimedBy === userName || isSuperUser) {
      Alert.alert('Bevestiging', 'Weet je zeker dat je deze kaart wilt vrijgeven?', [
        { text: 'Annuleren', style: 'cancel' },
        { text: 'Ja', onPress: () => saveClaim(cardKey, null) },
      ]);
    } else {
      Alert.alert('Niet toegestaan', 'Je kunt alleen kaarten vrijgeven die jij hebt geclaimd.');
    }
  };

  const cardImages = {
    card1: 'https://i.ibb.co/LSYLK4N/pakeerkaart-STFEFQDW.jpg',
    card2: 'https://i.imgur.com/6fzUY8r.jpeg',
    card3: 'https://i.imgur.com/BdvVdH0.jpeg',
    card4: 'https://i.imgur.com/v2NekZk.jpeg',
  };

  const allKeys = ['card1','card2','card3','card4'];
  const availableCards = allKeys.reduce((acc, ck) => acc + (claimedCards[ck]?.status === 'geclaimd' ? 0 : 1), 0);
  const myClaimsCount = allKeys.reduce((acc, ck) => acc + (claimedCards[ck]?.claimedBy === userName ? 1 : 0), 0);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: '#f0f0f0' }]}>
        <Animated.Text
          style={[
            styles.loadingText,
            { opacity: fadeInDownValue, transform: [{ translateY: fadeInDownValue.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
          ]}
        >
          Bezig met laden...
        </Animated.Text>
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={[styles.container, { backgroundColor: '#b22222' }]}>
        <Text style={styles.errorText}>{fetchError}</Text>
        <TouchableOpacity onPress={fetchClaims} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Opnieuw proberen</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Uitloggen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.dashboardContainer, { backgroundColor: backgroundColorInterpolate }]}>
      {/* Zoom modal */}
      <Modal visible={zoomedImage !== null} transparent animationType="slide" onRequestClose={() => setZoomedImage(null)}>
        <View style={styles.modalBackground}>
          <ScrollView maximumZoomScale={3} minimumZoomScale={1} contentContainerStyle={styles.scrollZoomContainer}>
            <TouchableWithoutFeedback onPress={() => setZoomedImage(null)}>
              <Image source={{ uri: zoomedImage || undefined }} style={styles.zoomedImage} resizeMode="contain" />
            </TouchableWithoutFeedback>
          </ScrollView>
        </View>
      </Modal>

      {/* Overzicht / Leaderboard */}
      <Modal visible={overviewOpen} transparent animationType="fade" onRequestClose={() => setOverviewOpen(false)}>
        <View style={styles.modalBackground}>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewTitle}>Overzicht & Leaderboard</Text>

            <Text style={styles.sectionTitle}>Huidig overzicht</Text>
            {allKeys.map((ck) => {
              const info = claimedCards[ck];
              const who = info?.claimedBy || '—';
              const elapsed = info?.claimedAt ? formatHM(nowTs - new Date(info.claimedAt).getTime()) : '00:00';
              const status = info?.status === 'geclaimd' ? 'geclaimd' : 'beschikbaar';
              return (
                <View key={ck} style={styles.overviewRow}>
                  <Text style={{ width: 90 }}>{ck}</Text>
                  <Text style={{ flex: 1 }}>{status === 'geclaimd' ? `door ${who}` : 'beschikbaar'}</Text>
                  <Text>{status === 'geclaimd' ? `sinds ${elapsed}` : ''}</Text>
                </View>
              );
            })}

            <View style={{ height: 12 }} />

            <Text style={styles.sectionTitle}>Leaderboard (totaal claims)</Text>
            <TouchableOpacity onPress={fetchLeaderboard} style={styles.refreshButton}>
              <Text style={styles.refreshButtonText}>Vernieuwen</Text>
            </TouchableOpacity>
            <View style={{ maxHeight: 220 }}>
              <ScrollView>
                {leaderboard.length === 0 ? (
                  <Text style={{ color: '#333', marginTop: 8 }}>Nog geen data. Druk op “Vernieuwen”.</Text>
                ) : leaderboard.map((u, idx) => (
                  <View key={u.username + idx} style={styles.overviewRow}>
                    <Text style={{ width: 28 }}>{idx + 1}.</Text>
                    <Text style={{ flex: 1 }}>{u.username}</Text>
                    <Text style={{ fontWeight: 'bold' }}>{u.claim_count ?? 0}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity onPress={() => setOverviewOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Sluiten</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={[styles.contentContainer, isIOSWeb && styles.contentContainerIOSWeb]}>
        {/* (VERPLAATST) Overzicht-knop stond eerst rechtsboven; nu onder de teller */}
        <Animated.Text
          style={[
            styles.welcomeText,
            { opacity: fadeInDownValue, transform: [{ translateY: fadeInDownValue.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
          ]}
        >
          Goedendag, {userName}!
        </Animated.Text>
        {loginTime && (
          <Animated.Text
            style={[
              styles.loginTime,
              { opacity: fadeInDownValue, transform: [{ translateY: fadeInDownValue.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
            ]}
          >
            Ingelogd op: {loginTime.toLocaleTimeString()}
          </Animated.Text>
        )}
        <Animated.Text
          style={[
            styles.availableTextCount,
            { opacity: fadeInDownValue, transform: [{ translateY: fadeInDownValue.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
          ]}
        >
          Beschikbare kaarten: {availableCards}/4
        </Animated.Text>
        <Text style={styles.myClaimsText}>Jij geclaimd: {myClaimsCount}/4</Text>

        <TouchableOpacity
          onPress={() => { fetchLeaderboard(); setOverviewOpen(true); }}
          style={styles.overviewBtn}
        >
          <Text style={styles.overviewBtnText}>📊 Overzicht</Text>
        </TouchableOpacity>

        <View style={styles.cardsContainer}>
          <View style={styles.cardsRowCentered}>
            <Card
              cardName="parkeerkaart 1"
              cardKey="card1"
              cardImage={cardImages.card1}
              claimedStatus={claimedCards.card1?.status}
              claimedBy={claimedCards.card1?.claimedBy}
              claimedAt={claimedCards.card1?.claimedAt}
              userName={userName}
              onPress={(action) => (action === 'claim' ? toggleClaim('card1') : toggleRelease('card1'))}
              onZoom={setZoomedImage}
              nowTs={nowTs}
            />
            <Card
              cardName="parkeerkaart 2"
              cardKey="card2"
              cardImage={cardImages.card2}
              claimedStatus={claimedCards.card2?.status}
              claimedBy={claimedCards.card2?.claimedBy}
              claimedAt={claimedCards.card2?.claimedAt}
              userName={userName}
              onPress={(action) => (action === 'claim' ? toggleClaim('card2') : toggleRelease('card2'))}
              onZoom={setZoomedImage}
              nowTs={nowTs}
            />
          </View>
          <View style={styles.cardsRowCentered}>
            <Card
              cardName="parkeerkaart 3"
              cardKey="card3"
              cardImage={cardImages.card3}
              claimedStatus={claimedCards.card3?.status}
              claimedBy={claimedCards.card3?.claimedBy}
              claimedAt={claimedCards.card3?.claimedAt}
              userName={userName}
              onPress={(action) => (action === 'claim' ? toggleClaim('card3') : toggleRelease('card3'))}
              onZoom={setZoomedImage}
              nowTs={nowTs}
            />
            <Card
              cardName="parkeerkaart 4"
              cardKey="card4"
              cardImage={cardImages.card4}
              claimedStatus={claimedCards.card4?.status}
              claimedBy={claimedCards.card4?.claimedBy}
              claimedAt={claimedCards.card4?.claimedAt}
              userName={userName}
              onPress={(action) => (action === 'claim' ? toggleClaim('card4') : toggleRelease('card4'))}
              onZoom={setZoomedImage}
              nowTs={nowTs}
            />
          </View>
        </View>

        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Uitloggen</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ====== STYLES ======
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  formContainer: {
    width: '90%',
    maxWidth: 400,
    padding: 25,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
    elevation: 20,
    alignItems: 'center',
  },
  logo: {
    width: 120, height: 120, marginBottom: 15, borderRadius: 60, borderWidth: 2, borderColor: '#b22222',
  },
  header: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 10, textAlign: 'center' },
  label: { fontSize: 16, marginBottom: 10, color: '#555' },
  input: {
    width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20, backgroundColor: '#fefefe',
  },
  loginButton: {
    width: '100%', paddingVertical: 15, borderRadius: 8, backgroundColor: '#b22222', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 15,
  },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  faceIDButton: {
    width: '100%', paddingVertical: 15, borderRadius: 8, backgroundColor: '#555', alignItems: 'center', marginTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 15,
  },
  faceIDButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  errorText: { color: 'yellow', marginTop: 10, fontSize: 14, textAlign: 'center' },
  retryButton: { marginTop: 20, padding: 10, borderRadius: 5, backgroundColor: '#008000', alignItems: 'center' },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  dashboardContainer: { flex: 1 },
  contentContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, width: '100%' },
  contentContainerIOSWeb: { justifyContent: 'flex-start' }, // iPhone PWA: niet centreren om “half zichtbaar” te voorkomen

  welcomeText: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  loginTime: { fontSize: 14, color: '#666', marginBottom: 10 },
  availableTextCount: { fontSize: 16, color: '#555', marginBottom: 4, fontWeight: 'bold' },
  myClaimsText: { fontSize: 14, color: '#666', marginBottom: 8 },

  cardsContainer: { alignItems: 'center', marginVertical: 14, width: '100%' },
  cardsRowCentered: { flexDirection: 'row', justifyContent: 'center', width: '100%', marginVertical: 8, gap: 16 },

  cardContainer: { alignItems: 'center', marginHorizontal: 10, width: CARD_CONTAINER_WIDTH, maxWidth: '44%' },
  cardName: { fontSize: 16, marginBottom: 10, color: '#333' },
  cardImageContainer: { width: CARD_IMG_SIZE, height: CARD_IMG_SIZE, borderRadius: 10, overflow: 'hidden', borderWidth: 4 },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  claimed: { borderColor: 'red' },
  available: { borderColor: 'green' },
  overlayContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center',
  },
  inUseText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  claimedAtText: { fontSize: 10, color: '#999', marginTop: 3, textAlign: 'center' },
  timerText: { fontSize: 12, color: '#555', marginTop: 2 },
  availableText: {
    position: 'absolute', bottom: 10, left: '50%', transform: [{ translateX: -50 }],
    color: 'white', backgroundColor: 'rgba(0, 128, 0, 0.8)', paddingHorizontal: 5, borderRadius: 3,
  },
  cardButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10, gap: 10 },
  claimButton: { backgroundColor: '#b22222', padding: 10, borderRadius: 5, marginTop: 10, flex: 1, alignItems: 'center' },
  releaseButton: { backgroundColor: '#008000', padding: 10, borderRadius: 5, marginTop: 10, flex: 1, alignItems: 'center' },
  disabledButton: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontSize: 14, textAlign: 'center' },

  overviewBtn: { backgroundColor: '#333', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, marginTop: 4 },
  overviewBtnText: { color: '#fff', fontWeight: '600' },

  logoutButton: { marginTop: 12, padding: 10, borderRadius: 5, backgroundColor: '#b22222', alignItems: 'center' },
  logoutButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  modalBackground: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  scrollZoomContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  zoomedImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  loadingText: { fontSize: 18, fontWeight: 'bold', color: '#333' },

  overviewCard: { width: '90%', maxWidth: 520, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  overviewTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#111' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginTop: 8, color: '#222' },
  overviewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  refreshButton: { alignSelf: 'flex-start', backgroundColor: '#b22222', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, marginTop: 6 },
  refreshButtonText: { color: '#fff', fontWeight: '600' },
  closeButton: { alignSelf: 'flex-end', backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginTop: 12 },
  closeButtonText: { color: '#fff', fontWeight: '600' },
});

export default ParkingApp;

klopt niet man, dit is de app nu ondernabij 1000 lines, die jij stuurt is verdomme 400

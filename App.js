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

// ---------- Helpers: web-safe alerts & confirms ----------
const isWeb = Platform.OS === 'web';

const Alert = {
  alert: (title, message = '', buttons) => {
    if (!isWeb) {
      return RNAlert.alert(title, message, buttons);
    }
    // Web fallback
    if (Array.isArray(buttons) && buttons.length) {
      // Als er Ja/Nee knoppen zijn, probeer confirm
      const yes = buttons.find((b) => b.text?.toLowerCase() === 'ja' || b.onPress);
      const cancel = buttons.find((b) => (b.style === 'cancel') || (b.text?.toLowerCase() === 'annuleren'));
      const ok = window.confirm(`${title}\n\n${message}`);
      if (ok && yes?.onPress) yes.onPress();
      if (!ok && cancel?.onPress) cancel.onPress();
      return;
    }
    window.alert(`${title}\n\n${message}`);
  },
};

// ---------- Notifications: native vs web ----------
async function setupNotifications() {
  try {
    if (isWeb) {
      // Probeer browser Notifications API; val terug op niets (we gebruiken Alert als fallback bij verzenden)
      if ('Notification' in window) {
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }
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
  } catch (e) {
    console.log('setupNotifications error', e);
    return false;
  }
}

async function sendNotification(title, body) {
  try {
    if (isWeb) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      } else {
        // Fallback naar alert op web
        Alert.alert(title, body);
      }
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null, // direct
    });
  } catch (e) {
    console.log('sendNotification error', e);
  }
}

// Configureer notificaties (native)
if (!isWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// ---------- Test network ----------
const testNetworkRequest = async () => {
  try {
    const res = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    if (!res.ok) return false;
    await res.json();
    return true;
  } catch {
    return false;
  }
};

// ---------- Test Supabase ----------
const testSupabaseConnection = async () => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/claims?select=*`, {
      method: 'GET',
      headers: supabaseHeaders,
    });
    if (!res.ok) return false;
    await res.json();
    return true;
  } catch {
    return false;
  }
};

// Toegangscodes gekoppeld aan gebruikersnamen
const accessCodes = {
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
  '1604': 'Isis',
};

// Nieuwe Card-component voor elke parkeerkaart
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
  claimedCards,
}) => {
  const fadeInValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeInValue, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    if (claimedStatus === 'geclaimd') {
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [claimedStatus, fadeInValue, pulseValue]);

  const formatClaimedAt = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Afbeelding alleen klikbaar als niet geclaimd of als het door jou geclaimd is
  const isImageClickable = claimedStatus !== 'geclaimd' || claimedBy === userName;

  const hasUserClaimedAnotherCard =
    claimedCards && typeof claimedCards === 'object'
      ? Object.values(claimedCards).some(
          (card) => card.claimedBy === userName && card.status === 'geclaimd'
        )
      : false;

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          opacity: fadeInValue,
          transform: [{ scale: claimedStatus === 'geclaimd' ? pulseValue : 1 }],
        },
      ]}
    >
      <Text style={styles.cardName}>{cardName}</Text>

      <TouchableOpacity
        onPress={isImageClickable ? () => onZoom(cardImage) : null}
        style={[
          styles.cardImageContainer,
          claimedStatus === 'geclaimd' ? styles.claimed : styles.available,
          isWeb && { cursor: isImageClickable ? 'zoom-in' : 'default' },
        ]}
        disabled={!isImageClickable}
        accessibilityRole="imagebutton"
        accessibilityLabel={`${cardName} afbeelding`}
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

      {claimedStatus === 'geclaimd' && claimedAt && (
        <Text style={styles.claimedAtText}>
          Geclaimd om {formatClaimedAt(claimedAt)} door {claimedBy}
        </Text>
      )}

      <View style={styles.cardButtons}>
        <TouchableOpacity
          onPress={() => onPress('claim')}
          style={[
            styles.claimButton,
            (claimedStatus === 'geclaimd' || hasUserClaimedAnotherCard) &&
              styles.disabledButton,
            isWeb && { cursor: (claimedStatus === 'geclaimd' || hasUserClaimedAnotherCard) ? 'not-allowed' : 'pointer' },
          ]}
          disabled={claimedStatus === 'geclaimd' || hasUserClaimedAnotherCard}
          accessibilityRole="button"
          accessibilityLabel={`Claim ${cardName}`}
        >
          <Text style={styles.buttonText}>Claim</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onPress('release')}
          style={[
            styles.releaseButton,
            claimedBy !== userName && styles.disabledButton,
            isWeb && { cursor: (claimedBy !== userName) ? 'not-allowed' : 'pointer' },
          ]}
          disabled={claimedBy !== userName}
          accessibilityRole="button"
          accessibilityLabel={`Vrijgeven ${cardName}`}
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
  const [loginTime, setLoginTime] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [networkStatus, setNetworkStatus] = useState(null);
  const [hasSavedCode, setHasSavedCode] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);

  const fadeInUpValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const initializeApp = async () => {
      // Biometrie alleen checken op native
      if (!isWeb) {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricSupported(compatible && enrolled);
      } else {
        setBiometricSupported(false);
      }

      // Opgeslagen code
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

      Animated.timing(fadeInUpValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }).start();

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
  }, [fadeInUpValue]);

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
      <View style={[styles.container, { backgroundColor: '#b22222' }]}>
        <Animated.View
          style={[
            styles.formContainer,
            {
              opacity: fadeInUpValue,
              transform: [
                {
                  translateY: fadeInUpValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Image
            source={{
              uri: 'https://media.glassdoor.com/sqll/1075020/jvh-gaming-en-entertainment-squarelogo-1533909494473.png',
            }}
            style={styles.logo}
          />
          <Animated.Text
            style={[
              styles.header,
              {
                opacity: fadeInUpValue,
                transform: [
                  {
                    scale: fadeInUpValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
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
          <TouchableOpacity
            onPress={handleLogin}
            style={[styles.loginButton, isWeb && { cursor: 'pointer' }]}
            accessibilityRole="button"
            accessibilityLabel="Inloggen"
          >
            <Text style={styles.loginButtonText}>Inloggen</Text>
          </TouchableOpacity>

          {biometricSupported && hasSavedCode && (
            <TouchableOpacity
              onPress={handleFaceIDLogin}
              style={[styles.faceIDButton, isWeb && { cursor: 'not-allowed', opacity: 0.6 }]}
              disabled={isWeb}
              accessibilityRole="button"
              accessibilityLabel="Inloggen met Face ID"
            >
              <Text style={styles.faceIDButtonText}>Inloggen met Face ID</Text>
            </TouchableOpacity>
          )}

          {networkStatus === false && (
            <Text style={styles.errorText}>Geen netwerkverbinding!</Text>
          )}
          {connectionStatus === false && (
            <Text style={styles.errorText}>Geen verbinding met Supabase!</Text>
          )}
        </Animated.View>
      </View>
    );
  }

  return <Dashboard onLogout={handleLogout} userName={userName} loginTime={loginTime} />;
};

// Controleer of de gebruiker al in de tabel 'users' staat en voeg deze toe indien nodig.
const ensureUserExists = async (username) => {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`,
      { headers: supabaseHeaders }
    );
    if (!res.ok) return false;
    const data = await res.json();
    if (data && data.length === 0) {
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: supabaseHeaders,
        body: JSON.stringify({ username }),
      });
      if (!insertRes.ok) return false;
      await insertRes.json();
    }
    return true;
  } catch (error) {
    console.error('Error in ensureUserExists:', error.message);
    return false;
  }
};

// Update de last_login kolom in de 'users'-tabel (alleen het tijdgedeelte).
const updateUserLastLogin = async (username, loginTime) => {
  try {
    const timeString = loginTime.toTimeString().split(' ')[0];
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`,
      {
        method: 'PATCH',
        headers: supabaseHeaders,
        body: JSON.stringify({ last_login: timeString }),
      }
    );
    if (!res.ok) return false;
    await res.json();
    return true;
  } catch (error) {
    console.error('Error in updateUserLastLogin:', error.message);
    return false;
  }
};

const Dashboard = ({ onLogout, userName, loginTime }) => {
  const [claimedCards, setClaimedCards] = useState({});
  const [loading, setLoading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [backgroundColor, setBackgroundColor] = useState('#f0f0f0');

  const fadeInDownValue = useRef(new Animated.Value(0)).current;
  const backgroundAnim = useRef(new Animated.Value(0)).current;

  const fetchClaims = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/claims?select=*`, {
        method: 'GET',
        headers: supabaseHeaders,
      });
      if (!res.ok) {
        const errorText = await res.text();
        setFetchError(`Error fetching claims: ${res.status} - ${errorText}`);
        return;
      }
      const data = await res.json();
      const claimsObject = {};
      if (Array.isArray(data)) {
        data.forEach((item) => {
          claimsObject[item.card_key] = {
            status: item.status,
            claimedBy: item.claimed_by,
            claimedAt: item.claimed_at,
          };
        });
      }
      setFetchError(null);
      setClaimedCards(claimsObject);
    } catch (error) {
      setFetchError(`Error fetching claims: ${error.message}`);
    }
  };

  useEffect(() => {
    Animated.timing(fadeInDownValue, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    fetchClaims();
    const interval = setInterval(() => {
      fetchClaims();
    }, 2000);

    return () => clearInterval(interval);
  }, []); // fetchClaims is stabiel genoeg hier

  const animateBackground = (color) => {
    setBackgroundColor(color);
    Animated.timing(backgroundAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start(() => {
      Animated.timing(backgroundAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: false,
      }).start(() => setBackgroundColor('#f0f0f0'));
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

      const resSelect = await fetch(
        `${SUPABASE_URL}/rest/v1/claims?card_key=eq.${encodeURIComponent(cardKey)}`,
        { method: 'GET', headers: supabaseHeaders }
      );
      if (!resSelect.ok) throw new Error(`Select failed: ${resSelect.statusText}`);
      const data = await resSelect.json();

      if (data && data.length > 0) {
        const resUpdate = await fetch(
          `${SUPABASE_URL}/rest/v1/claims?card_key=eq.${encodeURIComponent(cardKey)}`,
          {
            method: 'PATCH',
            headers: supabaseHeaders,
            body: JSON.stringify({
              status: newStatus,
              claimed_by: claimedBy,
              claimed_at: claimedBy ? currentTime : null,
            }),
          }
        );
        if (!resUpdate.ok) throw new Error(`Update failed: ${resUpdate.statusText}`);
        await resUpdate.json();
      } else {
        const resInsert = await fetch(`${SUPABASE_URL}/rest/v1/claims`, {
          method: 'POST',
          headers: supabaseHeaders,
          body: JSON.stringify({
            card_key: cardKey,
            status: newStatus,
            claimed_by: claimedBy,
            claimed_at: claimedBy ? currentTime : null,
          }),
        });
        if (!resInsert.ok) throw new Error(`Insert failed: ${resInsert.statusText}`);
        await resInsert.json();
      }

      const cardName = {
        card1: 'parkeerkaart 1',
        card2: 'parkeerkaart 2',
        card3: 'parkeerkaart 3',
        card4: 'parkeerkaart 4',
      }[cardKey];

      if (claimedBy) {
        await sendNotification(`${cardName} geclaimd!`, `${claimedBy} heeft ${cardName} geclaimd.`);
        animateBackground('#ff6666');
      } else {
        await sendNotification(`${cardName} beschikbaar!`, `${cardName} is nu weer beschikbaar.`);
        animateBackground('#66ff66');
      }

      await fetchClaims();
    } catch (error) {
      console.error('Error in saveClaim:', error.message);
      Alert.alert('Fout', `Kon claim niet opslaan: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleClaim = (cardKey) => {
    const userClaimed = Object.entries(claimedCards).find(
      ([key, value]) => value.claimedBy === userName && key !== cardKey
    );
    if (userClaimed) {
      Alert.alert('Fout', 'Je hebt al een kaart geclaimd.');
      return;
    }
    if (claimedCards[cardKey]?.status === 'geclaimd') {
      Alert.alert('Kaart bezet', `Deze kaart is al in gebruik door ${claimedCards[cardKey]?.claimedBy}.`);
    } else {
      Alert.alert('Bevestiging', 'Weet je zeker dat je deze kaart wilt claimen?', [
        { text: 'Annuleren', style: 'cancel' },
        { text: 'Ja', onPress: () => saveClaim(cardKey, userName) },
      ]);
    }
  };

  const toggleRelease = (cardKey) => {
    if (claimedCards[cardKey]?.claimedBy === userName) {
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

  const availableCards = Object.values(claimedCards).filter(
    (card) => card.status !== 'geclaimd'
  ).length;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: '#f0f0f0' }]}>
        <Animated.Text
          style={[
            styles.loadingText,
            {
              opacity: fadeInDownValue,
              transform: [
                {
                  translateY: fadeInDownValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
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
        <TouchableOpacity
          onPress={fetchClaims}
          style={[styles.retryButton, isWeb && { cursor: 'pointer' }]}
        >
          <Text style={styles.retryButtonText}>Opnieuw proberen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onLogout}
          style={[styles.logoutButton, isWeb && { cursor: 'pointer' }]}
        >
          <Text style={styles.logoutButtonText}>Uitloggen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View
      style={[styles.dashboardContainer, { backgroundColor: backgroundColorInterpolate }]}
    >
      <Modal
        visible={zoomedImage !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setZoomedImage(null)}
      >
        <View style={styles.modalBackground}>
          <ScrollView
            maximumZoomScale={3}
            minimumZoomScale={1}
            contentContainerStyle={styles.scrollZoomContainer}
          >
            <TouchableWithoutFeedback onPress={() => setZoomedImage(null)}>
              <Image
                source={{ uri: zoomedImage || undefined }}
                style={styles.zoomedImage}
                resizeMode="contain"
              />
            </TouchableWithoutFeedback>
          </ScrollView>
        </View>
      </Modal>

      <View style={styles.contentContainer}>
        <Animated.Text
          style={[
            styles.welcomeText,
            {
              opacity: fadeInDownValue,
              transform: [
                {
                  translateY: fadeInDownValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          Goedendag, {userName}!
        </Animated.Text>

        {loginTime && (
          <Animated.Text
            style={[
              styles.loginTime,
              {
                opacity: fadeInDownValue,
                transform: [
                  {
                    translateY: fadeInDownValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            Ingelogd op: {loginTime.toLocaleTimeString()}
          </Animated.Text>
        )}

        <Animated.Text
          style={[
            styles.availableTextCount,
            {
              opacity: fadeInDownValue,
              transform: [
                {
                  translateY: fadeInDownValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          Beschikbare kaarten: {availableCards}/4
        </Animated.Text>

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
              onPress={(action) =>
                action === 'claim' ? toggleClaim('card1') : toggleRelease('card1')
              }
              onZoom={setZoomedImage}
              claimedCards={claimedCards}
            />
            <Card
              cardName="parkeerkaart 2"
              cardKey="card2"
              cardImage={cardImages.card2}
              claimedStatus={claimedCards.card2?.status}
              claimedBy={claimedCards.card2?.claimedBy}
              claimedAt={claimedCards.card2?.claimedAt}
              userName={userName}
              onPress={(action) =>
                action === 'claim' ? toggleClaim('card2') : toggleRelease('card2')
              }
              onZoom={setZoomedImage}
              claimedCards={claimedCards}
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
              onPress={(action) =>
                action === 'claim' ? toggleClaim('card3') : toggleRelease('card3')
              }
              onZoom={setZoomedImage}
              claimedCards={claimedCards}
            />
            <Card
              cardName="parkeerkaart 4"
              cardKey="card4"
              cardImage={cardImages.card4}
              claimedStatus={claimedCards.card4?.status}
              claimedBy={claimedCards.card4?.claimedBy}
              claimedAt={claimedCards.card4?.claimedAt}
              userName={userName}
              onPress={(action) =>
                action === 'claim' ? toggleClaim('card4') : toggleRelease('card4')
              }
              onZoom={setZoomedImage}
              claimedCards={claimedCards}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={onLogout}
          style={[styles.logoutButton, isWeb && { cursor: 'pointer' }]}
        >
          <Text style={styles.logoutButtonText}>Uitloggen</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

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
    width: 120,
    height: 120,
    marginBottom: 15,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#b22222',
  },
  header: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 10, textAlign: 'center' },
  label: { fontSize: 16, marginBottom: 10, color: '#555' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#fefefe',
  },
  loginButton: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 8,
    backgroundColor: '#b22222',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 15,
  },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  faceIDButton: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 8,
    backgroundColor: '#555',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 15,
  },
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
  cardsRowCentered: { flexDirection: 'row', justifyContent: 'center', width: '100%', marginVertical: 10, flexWrap: 'wrap' },
  cardContainer: { alignItems: 'center', marginHorizontal: 10, width: 260, maxWidth: '46%' },
  cardName: { fontSize: 16, marginBottom: 10, color: '#333' },
  cardImageContainer: { width: 150, height: 150, borderRadius: 10, overflow: 'hidden', borderWidth: 4 },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  claimed: { borderColor: 'red' },
  available: { borderColor: 'green' },
  overlayContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center',
  },
  inUseText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  claimedAtText: { fontSize: 10, color: '#999', marginTop: 3, textAlign: 'center' },
  availableText: {
    position: 'absolute', bottom: 10, left: '50%', transform: [{ translateX: -50 }],
    color: 'white', backgroundColor: 'rgba(0, 128, 0, 0.8)', paddingHorizontal: 5, borderRadius: 3,
  },
  cardButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10, gap: 10 },
  claimButton: { backgroundColor: '#b22222', padding: 10, borderRadius: 5, marginTop: 10 },
  releaseButton: { backgroundColor: '#008000', padding: 10, borderRadius: 5, marginTop: 10 },
  disabledButton: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontSize: 14, textAlign: 'center' },
  logoutButton: { marginTop: 20, padding: 10, borderRadius: 5, backgroundColor: '#b22222', alignItems: 'center' },
  logoutButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center' },
  scrollZoomContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  zoomedImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  loadingText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
});

export default ParkingApp;

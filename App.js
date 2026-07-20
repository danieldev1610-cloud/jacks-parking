import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  StatusBar,
  useColorScheme,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';

// ====================== CONFIG ======================
const SUPABASE_URL = 'https://itgwuhvchxcskwelelrm.supabase.co';
const SUPABASE_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0Z3d1aHZjaHhjc2t3ZWxlbHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyMzY0NTAsImV4cCI6MjA2MjgxMjQ1MH0.ZGrXZcNGoFiFX1KzWi_5zAT15OL2fHhENzWJg7k6vEg';

const supabaseHeaders = {
  apikey: SUPABASE_API_KEY,
  Authorization: `Bearer ${SUPABASE_API_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const isWeb = Platform.OS === 'web';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ====================== NEXUM THEME ======================
// Kleuren geinspireerd op nexumdev.nl: warm cream, oranje -> roze -> paars gradient, ink zwart.
const NEXUM = {
  orange: '#ff6b35',
  pink: '#e84393',
  purple: '#a855f7',
  ink: '#0d0d0d',
  cream: '#faf8f5',
};

const lightTheme = {
  bg: NEXUM.cream,
  card: '#ffffff',
  text: NEXUM.ink,
  textSecondary: '#6b7280',
  primary: NEXUM.pink,
  primaryLight: 'rgba(232,67,147,0.10)',
  gradient: [NEXUM.orange, NEXUM.pink, NEXUM.purple],
  success: '#22915a',
  successLight: 'rgba(34,145,90,0.10)',
  warning: NEXUM.orange,
  border: '#ecebe6',
  inputBg: '#ffffff',
  overlay: 'rgba(13,13,13,0.55)',
  headerBg: 'rgba(250,248,245,0.88)',
  navBg: 'rgba(255,255,255,0.94)',
  loginGradient: [NEXUM.orange, NEXUM.pink, NEXUM.purple],
  isDark: false,
};

const darkTheme = {
  bg: '#0d0d12',
  card: '#161620',
  text: '#f5f3ee',
  textSecondary: '#8b8b96',
  primary: NEXUM.pink,
  primaryLight: 'rgba(232,67,147,0.18)',
  gradient: [NEXUM.orange, NEXUM.pink, NEXUM.purple],
  success: '#2ea96a',
  successLight: 'rgba(46,169,106,0.15)',
  warning: NEXUM.orange,
  border: '#23232e',
  inputBg: '#1c1c26',
  overlay: 'rgba(0,0,0,0.7)',
  headerBg: 'rgba(22,22,32,0.88)',
  navBg: 'rgba(22,22,32,0.94)',
  loginGradient: ['#0d0d12', '#2a0a1e', '#0d0d12'],
  isDark: true,
};

// ====================== HELPERS ======================
const Alert = {
  alert: (title, message = '', buttons) => {
    if (!isWeb) return RNAlert.alert(title, message, buttons);
    if (Array.isArray(buttons) && buttons.length) {
      const yes = buttons.find(b => b.text?.toLowerCase() === 'ja' || (b.onPress && b.style !== 'cancel'));
      const cancel = buttons.find(b => b.style === 'cancel');
      const ok = window.confirm(`${title}\n\n${message}`);
      if (ok && yes?.onPress) yes.onPress();
      if (!ok && cancel?.onPress) cancel.onPress();
      return;
    }
    window.alert(`${title}\n\n${message}`);
  },
};

async function setupNotifications() {
  try {
    if (isWeb) {
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
      return true;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Fout', 'Geen toestemming voor notificaties.'); return false; }
    return true;
  } catch { return false; }
}

async function sendNotification(title, body) {
  try {
    if (isWeb) {
      if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body });
      else Alert.alert(title, body);
    } else {
      await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
    }
  } catch {}
}

if (!isWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

const accessCodes = {
  '1610': 'Daniel', '2207': 'Taylor', '1806': 'Roland', '2412': 'Lavi',
  '1111': 'Nunzia', '1804': 'Dennis', '15057': 'Debora', '5991': 'Vincent',
  '8888': 'Jentai', '2404': 'Marcel', '1304': 'Alysia', '2010': 'Aelita',
  '1209': 'Faisca', '1604': 'Isis', '0909': 'Kirby', '1505': 'Anouk',
};

const cardNames = { card1: 'Parkeerkaart 1', card2: 'Parkeerkaart 2', card3: 'Parkeerkaart 3', card4: 'Parkeerkaart 4' };
const cardImages = {
  card1: 'https://i.ibb.co/LSYLK4N/pakeerkaart-STFEFQDW.jpg',
  card2: 'https://i.imgur.com/6fzUY8r.jpeg',
  card3: 'https://i.imgur.com/BdvVdH0.jpeg',
  card4: 'https://i.imgur.com/v2NekZk.jpeg',
};

const LS_KEYS = { USERS: 'jp_known_users', COUNTS: 'jp_claim_counts', HISTORY: 'jp_claim_history', THEME: 'jp_theme' };
const ADMIN_USER = 'Daniel';
const TEN_HOURS_MS = 10 * 60 * 60 * 1000;

const isAdmin = userName => userName === ADMIN_USER;

const pad2 = n => (n < 10 ? `0${n}` : `${n}`);
const fmtDuration = ms => {
  if (ms < 0) ms = 0;
  return `${pad2(Math.floor(ms / 3600000))}:${pad2(Math.floor((ms % 3600000) / 60000))}:${pad2(Math.floor((ms % 60000) / 1000))}`;
};

const loadJSON = async (key, fallback) => {
  try { const v = await AsyncStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const saveJSON = async (key, obj) => {
  try { await AsyncStorage.setItem(key, JSON.stringify(obj)); } catch {}
};

const addKnownUser = async name => {
  const users = await loadJSON(LS_KEYS.USERS, []);
  if (!users.includes(name)) { users.push(name); await saveJSON(LS_KEYS.USERS, users); }
};
const incrementClaimCount = async name => {
  const counts = await loadJSON(LS_KEYS.COUNTS, {});
  counts[name] = (counts[name] || 0) + 1;
  await saveJSON(LS_KEYS.COUNTS, counts);
  return counts[name];
};
const getLeaderboard = async () => {
  const users = await loadJSON(LS_KEYS.USERS, []);
  const counts = await loadJSON(LS_KEYS.COUNTS, {});
  const rows = users.map(u => ({ user: u, count: counts[u] || 0 }));
  rows.sort((a, b) => b.count - a.count || a.user.localeCompare(b.user));
  return rows;
};

const addHistoryEntry = async (user, cardKey, action) => {
  const history = await loadJSON(LS_KEYS.HISTORY, []);
  history.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user, cardKey, cardName: cardNames[cardKey] || cardKey, action,
    timestamp: new Date().toISOString(),
  });
  if (history.length > 200) history.length = 200;
  await saveJSON(LS_KEYS.HISTORY, history);
};
const getHistory = async () => loadJSON(LS_KEYS.HISTORY, []);
const getUserStats = async userName => {
  const history = await loadJSON(LS_KEYS.HISTORY, []);
  const userEntries = history.filter(h => h.user === userName);
  const claims = userEntries.filter(h => h.action === 'claim');
  const totalClaims = claims.length;
  const cardCounts = {};
  claims.forEach(h => { cardCounts[h.cardName] = (cardCounts[h.cardName] || 0) + 1; });
  const favoriteCard = Object.entries(cardCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  let totalDuration = 0, pairCount = 0;
  claims.forEach(claim => {
    const release = userEntries.find(h => h.action === 'release' && h.cardKey === claim.cardKey && h.timestamp > claim.timestamp);
    if (release) { totalDuration += new Date(release.timestamp).getTime() - new Date(claim.timestamp).getTime(); pairCount++; }
  });
  return { totalClaims, favoriteCard, avgDurationMs: pairCount > 0 ? totalDuration / pairCount : 0, recentClaims: claims.slice(0, 10) };
};

// DB helpers
const ensureUserExists = async username => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`, { headers: supabaseHeaders });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.length === 0) { return (await fetch(`${SUPABASE_URL}/rest/v1/users`, { method: 'POST', headers: supabaseHeaders, body: JSON.stringify({ username }) })).ok; }
    return true;
  } catch { return false; }
};
const updateUserLastLogin = async (username, loginTime) => {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`, {
      method: 'PATCH', headers: supabaseHeaders, body: JSON.stringify({ last_login: loginTime.toTimeString().split(' ')[0] }),
    });
  } catch {}
};
const fetchClaimsFromDB = async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/claims?select=*`, { headers: supabaseHeaders });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const obj = {};
  data.forEach(item => { obj[item.card_key] = { status: item.status, claimedBy: item.claimed_by, claimedAt: item.claimed_at }; });
  return obj;
};
const saveClaim = async (cardKey, claimedBy) => {
  const newStatus = claimedBy ? 'geclaimd' : 'beschikbaar';
  const currentTime = new Date().toISOString();
  const selectRes = await fetch(`${SUPABASE_URL}/rest/v1/claims?card_key=eq.${cardKey}`, { headers: supabaseHeaders });
  const data = await selectRes.json();
  const body = JSON.stringify({ status: newStatus, claimed_by: claimedBy, claimed_at: claimedBy ? currentTime : null });
  if (data.length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/claims?card_key=eq.${cardKey}`, { method: 'PATCH', headers: supabaseHeaders, body });
  } else {
    await fetch(`${SUPABASE_URL}/rest/v1/claims`, { method: 'POST', headers: supabaseHeaders, body: JSON.stringify({ card_key: cardKey, status: newStatus, claimed_by: claimedBy, claimed_at: claimedBy ? currentTime : null }) });
  }
};

// ====================== VISUAL HELPERS ======================
// Simuleer gradient met gestapelde View lagen (geen extra dependency).
const GradientButton = ({ onPress, disabled, style, children }) => (
  <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85}
    style={[s.gradBtn, disabled && { opacity: 0.35 }, style]}>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.orange, borderRadius: 999 }]} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.pink, opacity: 0.85, borderRadius: 999 }]} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.purple, opacity: 0.55, borderRadius: 999 }]} />
    {children}
  </TouchableOpacity>
);

const Blobs = ({ dark }) => (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={[s.blob, { top: -80, left: -60, backgroundColor: NEXUM.orange, opacity: dark ? 0.35 : 0.45 }]} />
    <View style={[s.blob, { top: 180, right: -100, backgroundColor: NEXUM.pink, opacity: dark ? 0.30 : 0.40, width: 320, height: 320 }]} />
    <View style={[s.blob, { bottom: -60, left: 40, backgroundColor: NEXUM.purple, opacity: dark ? 0.30 : 0.38 }]} />
  </View>
);

// ====================== CARD COMPONENT ======================
const Card = ({ cardName, cardKey, cardImage, claimedStatus, claimedBy, claimedAt, userName, onPress, onZoom, now, theme }) => {
  const isClaimed = claimedStatus === 'geclaimd';
  const isOwner = claimedBy === userName;
  const adminUser = isAdmin(userName);
  const isImageClickable = adminUser || !isClaimed || isOwner;
  const claimedMs = claimedAt ? now - new Date(claimedAt).getTime() : 0;
  const remainingMs = isClaimed ? Math.max(0, TEN_HOURS_MS - claimedMs) : 0;
  const progressPct = isClaimed ? Math.min(100, (claimedMs / TEN_HOURS_MS) * 100) : 0;

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <TouchableOpacity onPress={() => isImageClickable ? onZoom(cardImage) : null} disabled={!isImageClickable} activeOpacity={0.9}>
        <View style={s.cardImgWrap}>
          <Image source={{ uri: cardImage }} style={s.cardImg} />
          <View style={s.cardOverlayGradient} />
          <View style={[s.badge, { backgroundColor: isClaimed ? NEXUM.ink : 'rgba(255,255,255,0.95)' }]}>
            <View style={[s.badgeDot, { backgroundColor: isClaimed ? NEXUM.orange : '#22c55e' }]} />
            <Text style={[s.badgeText, { color: isClaimed ? '#fff' : NEXUM.ink }]}>{isClaimed ? 'BEZET' : 'VRIJ'}</Text>
          </View>
          {isClaimed && (
            <View style={s.cardOwner}>
              <Text style={s.cardOwnerLabel}>In gebruik door</Text>
              <Text style={s.cardOwnerName}>{claimedBy}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <View style={s.cardContent}>
        <Text style={[s.cardTitle, { color: theme.text }]}>{cardName}</Text>

        {isClaimed ? (
          <>
            <View style={[s.progressBg, { backgroundColor: theme.inputBg, marginTop: 8 }]}>
              <View style={[s.progressFill, { width: `${progressPct}%` }]}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.orange }]} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.pink, opacity: 0.75 }]} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.purple, opacity: 0.5 }]} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={[s.timerLabel, { color: theme.textSecondary }]}>{fmtDuration(claimedMs)}</Text>
              <Text style={[s.timerLabel, { color: theme.textSecondary }]}>{fmtDuration(remainingMs)} over</Text>
            </View>
          </>
        ) : (
          <Text style={[s.timerLabel, { color: theme.textSecondary, marginTop: 8 }]}>Beschikbaar om te claimen</Text>
        )}

        <View style={s.cardBtns}>
          <GradientButton
            onPress={() => onPress('claim')}
            disabled={isClaimed && !adminUser}
            style={{ flex: 1 }}
          >
            <Text style={s.btnText}>{isClaimed && adminUser ? 'Overnemen' : 'Claim'}</Text>
          </GradientButton>
          <TouchableOpacity
            onPress={() => onPress('release')}
            disabled={!isOwner && !adminUser}
            activeOpacity={0.85}
            style={[s.btnRelease, { backgroundColor: NEXUM.ink, opacity: !isOwner && !adminUser ? 0.25 : 1 }]}
          >
            <Text style={s.btnText}>Vrijgeven</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ====================== BOTTOM NAV ======================
const BottomNav = ({ activeTab, onTabChange, theme }) => {
  const tabs = [
    { id: 'dashboard', label: 'Kaarten', iconName: 'grid-outline', iconNameActive: 'grid' },
    { id: 'history', label: 'Geschiedenis', iconName: 'time-outline', iconNameActive: 'time' },
    { id: 'profile', label: 'Profiel', iconName: 'person-outline', iconNameActive: 'person' },
  ];
  return (
    <View style={[s.bottomNav, { backgroundColor: theme.navBg, borderTopColor: theme.border }]}>
      {tabs.map(tab => {
        const active = activeTab === tab.id;
        return (
          <TouchableOpacity key={tab.id} onPress={() => onTabChange(tab.id)} style={s.navItem} activeOpacity={0.7}>
            {active && (
              <View style={s.navIndicatorWrap}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.orange }]} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.pink, opacity: 0.85 }]} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.purple, opacity: 0.55 }]} />
              </View>
            )}
            <Ionicons name={active ? tab.iconNameActive : tab.iconName} size={22} color={active ? NEXUM.pink : theme.textSecondary} />
            <Text style={[s.navLabel, { color: active ? NEXUM.pink : theme.textSecondary }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ====================== HISTORY TAB ======================
const HistoryTab = ({ userName, theme }) => {
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const load = async () => setHistory(await getHistory());
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const filtered = filter === 'mine' ? history.filter(h => h.user === userName) : history;

  const formatTime = iso => {
    const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return 'Zojuist';
    if (diffMin < 60) return `${diffMin} min geleden`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} uur geleden`;
    return `${Math.floor(diffHr / 24)} dagen geleden`;
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={[s.sectionTitle, { color: theme.text }]}>Geschiedenis</Text>
        <View style={[s.filterWrap, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
          {['all', 'mine'].map(f => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[s.filterBtn, filter === f && { backgroundColor: NEXUM.ink }]}>
              <Text style={[s.filterText, { color: filter === f ? '#fff' : theme.textSecondary }]}>{f === 'all' ? 'Alles' : 'Mijn'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {filtered.length === 0 ? (
        <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40 }}>Nog geen geschiedenis</Text>
      ) : (
        filtered.map(entry => (
          <View key={entry.id} style={[s.historyRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[s.historyIcon, { backgroundColor: entry.action === 'claim' ? 'rgba(232,67,147,0.12)' : 'rgba(34,145,90,0.12)' }]}>
              <Ionicons name={entry.action === 'claim' ? 'lock-closed' : 'lock-open'} size={16} color={entry.action === 'claim' ? NEXUM.pink : '#22915a'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
                {entry.user} <Text style={{ fontWeight: '500', color: theme.textSecondary }}>{entry.action === 'claim' ? 'claimde' : 'gaf vrij'}</Text> {entry.cardName}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>{formatTime(entry.timestamp)}</Text>
            </View>
            <View style={[s.historyBadge, { backgroundColor: entry.action === 'claim' ? NEXUM.ink : '#22915a' }]}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>{entry.action === 'claim' ? 'CLAIM' : 'VRIJ'}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

// ====================== PROFILE TAB ======================
const ProfileTab = ({ userName, loginTime, theme }) => {
  const [stats, setStats] = useState({ totalClaims: 0, favoriteCard: '-', avgDurationMs: 0, recentClaims: [] });
  const [rank, setRank] = useState(0);

  useEffect(() => {
    (async () => {
      setStats(await getUserStats(userName));
      const lb = await getLeaderboard();
      const idx = lb.findIndex(r => r.user === userName);
      setRank(idx >= 0 ? idx + 1 : 0);
    })();
  }, [userName]);

  const statCards = [
    { iconName: 'card-outline', label: 'Totaal claims', value: `${stats.totalClaims}`, color: NEXUM.pink },
    { iconName: 'star-outline', label: 'Favoriete kaart', value: stats.favoriteCard, color: NEXUM.orange },
    { iconName: 'time-outline', label: 'Gem. duur', value: stats.avgDurationMs > 0 ? fmtDuration(stats.avgDurationMs) : '-', color: NEXUM.purple },
    { iconName: 'trophy-outline', label: 'Ranking', value: rank > 0 ? `#${rank}` : '-', color: NEXUM.pink },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      <View style={[s.profileHeader, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={s.profileAvatar}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.orange, borderRadius: 18 }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.pink, opacity: 0.85, borderRadius: 18 }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.purple, opacity: 0.55, borderRadius: 18 }]} />
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 22 }}>{userName[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 10, letterSpacing: 2, fontWeight: '700' }}>INGELOGD</Text>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900', marginTop: 2 }}>{userName}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
            Sinds {loginTime?.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>

      <View style={s.statsGrid}>
        {statCards.map(stat => (
          <View key={stat.label} style={[s.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: `${stat.color}22`, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name={stat.iconName} size={18} color={stat.color} />
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 11, letterSpacing: 1, fontWeight: '700', textTransform: 'uppercase' }}>{stat.label}</Text>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900', marginTop: 4 }}>{stat.value}</Text>
          </View>
        ))}
      </View>

      <View style={[s.recentCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '900', marginBottom: 8 }}>Recente claims</Text>
        {stats.recentClaims.length === 0 ? (
          <Text style={{ color: theme.textSecondary, fontSize: 12, paddingVertical: 12 }}>Nog geen claims</Text>
        ) : (
          stats.recentClaims.map((entry, i) => (
            <View key={entry.id || i} style={[s.recentRow, { borderBottomColor: theme.border }]}>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{entry.cardName}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                {new Date(entry.timestamp).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

// ====================== DASHBOARD TAB ======================
const DashboardTab = ({ userName, loginTime, onLogout, theme }) => {
  const [claimedCards, setClaimedCards] = useState({});
  const [loading, setLoading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const fetchClaims = useCallback(async () => {
    try { setClaimedCards(await fetchClaimsFromDB()); setFetchError(null); } catch (err) { setFetchError(`Fout: ${err.message}`); }
  }, []);

  useEffect(() => { fetchClaims(); const t = setInterval(fetchClaims, 2000); return () => clearInterval(t); }, [fetchClaims]);

  useEffect(() => {
    const check = async () => {
      for (const [k, v] of Object.entries(claimedCards)) {
        if (v?.status === 'geclaimd' && v?.claimedAt && Date.now() >= new Date(v.claimedAt).getTime() + TEN_HOURS_MS) await saveClaim(k, null);
      }
    };
    check(); const t = setInterval(check, 30000); return () => clearInterval(t);
  }, [claimedCards]);

  const handleAction = (type, cardKey) => {
    const adminUser = isAdmin(userName);
    if (type === 'claim') {
      if (!adminUser) {
        const already = Object.values(claimedCards).some(c => c?.claimedBy === userName && c?.status === 'geclaimd');
        if (already) return Alert.alert('Fout', 'Je hebt al een kaart.');
        if (claimedCards[cardKey]?.status === 'geclaimd') return Alert.alert('Bezet', `In gebruik door ${claimedCards[cardKey].claimedBy}.`);
      }
    } else {
      if (!adminUser && claimedCards[cardKey]?.claimedBy !== userName) return Alert.alert('Nee', 'Alleen de eigenaar kan vrijgeven.');
    }
    setConfirmAction({ type, cardKey });
  };

  const executeAction = async () => {
    if (!confirmAction) return;
    setLoading(true);
    try {
      const { type, cardKey } = confirmAction;
      const adminUser = isAdmin(userName);
      if (type === 'claim') {
        const wasClaimedBy = claimedCards[cardKey]?.claimedBy;
        await saveClaim(cardKey, userName);
        await addHistoryEntry(userName, cardKey, 'claim');
        if (adminUser && wasClaimedBy && wasClaimedBy !== userName) {
          await sendNotification(`Admin Override: ${cardNames[cardKey]}`, `Admin ${userName} heeft ${cardNames[cardKey]} overgenomen van ${wasClaimedBy}.`);
        } else {
          await sendNotification(`${cardNames[cardKey]} geclaimd`, `${userName} heeft ${cardNames[cardKey]} geclaimd.`);
        }
      } else {
        const wasClaimedBy = claimedCards[cardKey]?.claimedBy;
        await saveClaim(cardKey, null);
        await addHistoryEntry(userName, cardKey, 'release');
        if (adminUser && wasClaimedBy && wasClaimedBy !== userName) {
          await sendNotification(`Admin Release: ${cardNames[cardKey]}`, `Admin ${userName} heeft ${cardNames[cardKey]} vrijgegeven (was van ${wasClaimedBy}).`);
        } else {
          await sendNotification(`${cardNames[cardKey]} beschikbaar`, `${cardNames[cardKey]} is nu weer vrij.`);
        }
      }
      await fetchClaims();
    } catch (err) { Alert.alert('Fout', `Kon niet opslaan: ${err.message}`); }
    finally { setLoading(false); setConfirmAction(null); }
  };

  const availableCards = 4 - Object.values(claimedCards).filter(c => c?.status === 'geclaimd').length;

  if (fetchError) return (
    <View style={s.center}>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 8 }}>Verbindingsfout</Text>
      <Text style={{ color: theme.textSecondary, marginBottom: 20 }}>{fetchError}</Text>
      <GradientButton onPress={fetchClaims} style={{ paddingHorizontal: 24 }}>
        <Text style={s.btnText}>Opnieuw proberen</Text>
      </GradientButton>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Zoomed image modal */}
      <Modal visible={!!zoomedImage} transparent animationType="fade" onRequestClose={() => setZoomedImage(null)}>
        <TouchableWithoutFeedback onPress={() => setZoomedImage(null)}>
          <View style={[s.modalBg, { backgroundColor: theme.overlay }]}>
            <Image source={{ uri: zoomedImage }} style={s.zoomedImg} resizeMode="contain" />
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Confirm modal */}
      <Modal visible={!!confirmAction} transparent animationType="fade" onRequestClose={() => setConfirmAction(null)}>
        <View style={[s.modalBg, { backgroundColor: theme.overlay }]}>
          <View style={[s.confirmCard, { backgroundColor: theme.card }]}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 6 }}>
              {confirmAction?.type === 'claim' ? 'Kaart claimen' : 'Kaart vrijgeven'}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 14, marginBottom: 20 }}>
              Wil je {cardNames[confirmAction?.cardKey]} {confirmAction?.type === 'claim' ? 'claimen' : 'vrijgeven'}?
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setConfirmAction(null)} style={[s.confirmBtn, { backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border }]}>
                <Text style={{ color: theme.text, fontWeight: '800' }}>Annuleren</Text>
              </TouchableOpacity>
              <GradientButton onPress={executeAction} style={{ flex: 1, paddingVertical: 12 }}>
                <Text style={s.btnText}>{loading ? 'Bezig...' : 'Bevestigen'}</Text>
              </GradientButton>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status bar */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={[s.statusBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View>
            <Text style={{ color: theme.textSecondary, fontSize: 10, letterSpacing: 1.5, fontWeight: '700' }}>INGELOGD</Text>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '900', marginTop: 2 }}>
              {loginTime?.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: NEXUM.pink, fontSize: 26, fontWeight: '900', lineHeight: 28 }}>{availableCards}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 9, letterSpacing: 1.5, fontWeight: '700', marginTop: 2 }}>VAN 4 VRIJ</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' }} />
            <Text style={{ color: '#16a34a', fontSize: 10, letterSpacing: 1.5, fontWeight: '800' }}>LIVE</Text>
          </View>
        </View>
      </View>

      {/* Cards */}
      <View style={s.cardsGrid}>
        {['card1', 'card2', 'card3', 'card4'].map(key => (
          <Card
            key={key}
            cardName={cardNames[key]}
            cardKey={key}
            cardImage={cardImages[key]}
            claimedStatus={claimedCards[key]?.status}
            claimedBy={claimedCards[key]?.claimedBy}
            claimedAt={claimedCards[key]?.claimedAt}
            userName={userName}
            onPress={a => handleAction(a, key)}
            onZoom={setZoomedImage}
            now={now}
            theme={theme}
          />
        ))}
      </View>

      <Text style={{ textAlign: 'center', color: theme.textSecondary, fontSize: 11, marginTop: 8 }}>
        Powered by Nexum Development
      </Text>
    </ScrollView>
  );
};

// ====================== MAIN APP ======================
const ParkingApp = () => {
  const systemScheme = useColorScheme();
  const [loggedIn, setLoggedIn] = useState(false);
  const [code, setCode] = useState('');
  const [userName, setUserName] = useState('');
  const [loginTime, setLoginTime] = useState(null);
  const [hasSavedCode, setHasSavedCode] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDark, setIsDark] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const theme = isDark ? darkTheme : lightTheme;

  useEffect(() => {
    (async () => {
      const savedTheme = await AsyncStorage.getItem(LS_KEYS.THEME);
      setIsDark(savedTheme ? savedTheme === 'dark' : systemScheme === 'dark');

      if (!isWeb) {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricSupported(compatible && enrolled);
      }
      const savedCode = await AsyncStorage.getItem('userCode');
      if (savedCode && accessCodes[savedCode]) {
        setCode(savedCode); setHasSavedCode(true);
        const name = accessCodes[savedCode];
        await addKnownUser(name); setUserName(name); await ensureUserExists(name);
        const now = new Date(); setLoginTime(now); await updateUserLastLogin(name, now);
        setLoggedIn(true);
      }
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
      await setupNotifications();
    })();
  }, []);

  const toggleTheme = async () => {
    const newDark = !isDark;
    setIsDark(newDark);
    await AsyncStorage.setItem(LS_KEYS.THEME, newDark ? 'dark' : 'light');
  };

  const handleLogin = async () => {
    if (!accessCodes[code]) return Alert.alert('Oeps', 'Verkeerde code.');
    const name = accessCodes[code];
    await addKnownUser(name); setUserName(name); await ensureUserExists(name);
    const now = new Date(); setLoginTime(now); await updateUserLastLogin(name, now);
    await AsyncStorage.setItem('userCode', code); setHasSavedCode(true); setLoggedIn(true);
  };

  const handleFaceIDLogin = async () => {
    if (isWeb) return Alert.alert('Web', 'Face ID werkt niet op web.');
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Log in met Face ID' });
    if (result.success) {
      const savedCode = await AsyncStorage.getItem('userCode');
      if (savedCode && accessCodes[savedCode]) {
        const name = accessCodes[savedCode];
        await addKnownUser(name); setUserName(name); await ensureUserExists(name);
        const now = new Date(); setLoginTime(now); await updateUserLastLogin(name, now);
        setLoggedIn(true);
      }
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userCode');
    setHasSavedCode(false); setLoggedIn(false); setCode(''); setUserName(''); setLoginTime(null); setActiveTab('dashboard');
  };

  if (!loggedIn) {
    return (
      <View style={[s.appContainer, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Blobs dark={isDark} />
        <Animated.View style={[s.loginContainer, { opacity: fadeAnim }]}>
          <View style={[s.loginCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={s.logoWrap}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.orange, borderRadius: 20 }]} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.pink, opacity: 0.85, borderRadius: 20 }]} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.purple, opacity: 0.55, borderRadius: 20 }]} />
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 30 }}>J</Text>
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 10, letterSpacing: 3, fontWeight: '800', marginBottom: 6 }}>JACK'S CASINO</Text>
            <Text style={[s.loginTitle, { color: theme.text }]}>Jack's Parking</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 24 }}>Voer je toegangscode in</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Code"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              keyboardType="number-pad"
              style={[s.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
            />
            <GradientButton onPress={handleLogin} style={{ width: '100%', paddingVertical: 15 }}>
              <Text style={s.btnText}>Inloggen</Text>
            </GradientButton>
            {biometricSupported && hasSavedCode && (
              <TouchableOpacity onPress={handleFaceIDLogin} style={[s.faceIdBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <Ionicons name="scan-outline" size={16} color={theme.text} style={{ marginRight: 8 }} />
                <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800' }}>Inloggen met Face ID</Text>
              </TouchableOpacity>
            )}
            <View style={{ alignItems: 'center', marginTop: 24 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 10, letterSpacing: 2, fontWeight: '700' }}>JVH GAMING AND ENTERTAINMENT</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 10, marginTop: 6 }}>Powered by Nexum Development</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[s.appContainer, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Blobs dark={isDark} />

      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={s.headerLogo}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.orange, borderRadius: 10 }]} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.pink, opacity: 0.85, borderRadius: 10 }]} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.purple, opacity: 0.55, borderRadius: 10 }]} />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>J</Text>
          </View>
          <View>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '900', letterSpacing: -0.3 }}>Jack's Parking</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 1 }}>{userName}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {isAdmin(userName) && (
            <View style={s.adminBadge}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.orange, borderRadius: 999 }]} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.pink, opacity: 0.85, borderRadius: 999 }]} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: NEXUM.purple, opacity: 0.55, borderRadius: 999 }]} />
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }}>ADMIN</Text>
            </View>
          )}
          <TouchableOpacity onPress={toggleTheme} style={[s.headerBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={16} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={[s.headerBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="log-out-outline" size={16} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'dashboard' && <DashboardTab userName={userName} loginTime={loginTime} onLogout={handleLogout} theme={theme} />}
      {activeTab === 'history' && <HistoryTab userName={userName} theme={theme} />}
      {activeTab === 'profile' && <ProfileTab userName={userName} loginTime={loginTime} theme={theme} />}

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} theme={theme} />
    </View>
  );
};

// ====================== STYLES ======================
const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  appContainer: { flex: 1 },

  // Blobs
  blob: { position: 'absolute', width: 280, height: 280, borderRadius: 999 },

  // Login
  loginContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loginCard: { width: '100%', maxWidth: 400, borderRadius: 28, padding: 32, alignItems: 'center', borderWidth: 1,
    shadowColor: NEXUM.pink, shadowOpacity: 0.15, shadowRadius: 40, shadowOffset: { width: 0, height: 20 }, elevation: 8 },
  logoWrap: { width: 72, height: 72, borderRadius: 20, marginBottom: 20, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  loginTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  input: { width: '100%', borderRadius: 16, padding: 16, fontSize: 16, marginBottom: 12, borderWidth: 1, textAlign: 'center', letterSpacing: 6, fontWeight: '800' },
  faceIdBtn: { width: '100%', paddingVertical: 14, borderRadius: 16, alignItems: 'center', marginTop: 10, borderWidth: 1, flexDirection: 'row', justifyContent: 'center' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 16, paddingBottom: 12, borderBottomWidth: 0.5 },
  headerLogo: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  headerBtn: { padding: 8, borderRadius: 12, borderWidth: 1 },
  adminBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },

  // Bottom nav
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', borderTopWidth: 0.5, paddingBottom: Platform.OS === 'ios' ? 24 : 8 },
  navItem: { flex: 1, alignItems: 'center', paddingTop: 12, gap: 4 },
  navIndicatorWrap: { position: 'absolute', top: 0, width: 48, height: 3, borderRadius: 2, overflow: 'hidden' },
  navLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Status bar
  statusBar: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1 },

  // Cards
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10, justifyContent: 'center' },
  card: { width: (SCREEN_W - 34) / 2, borderRadius: 20, overflow: 'hidden', borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  cardImgWrap: { width: '100%', aspectRatio: 16 / 11, overflow: 'hidden', position: 'relative' },
  cardImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardOverlayGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', backgroundColor: 'rgba(0,0,0,0.35)' },
  badge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  cardOwner: { position: 'absolute', bottom: 8, left: 10, right: 10 },
  cardOwnerLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 9, letterSpacing: 1, fontWeight: '700' },
  cardOwnerName: { color: '#fff', fontSize: 14, fontWeight: '900' },
  cardContent: { padding: 12 },
  cardTitle: { fontSize: 14, fontWeight: '900', letterSpacing: -0.2 },
  progressBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, overflow: 'hidden' },
  timerLabel: { fontSize: 10, fontWeight: '600' },
  cardBtns: { flexDirection: 'row', gap: 6, marginTop: 12 },

  // Buttons
  gradBtn: { paddingVertical: 11, borderRadius: 999, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: NEXUM.pink, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  btnRelease: { flex: 1, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },

  // Modals
  modalBg: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  zoomedImg: { width: SCREEN_W, height: SCREEN_H * 0.8 },
  confirmCard: { width: '100%', maxWidth: 380, borderRadius: 24, padding: 24 },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },

  // History
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, marginBottom: 8, borderWidth: 1 },
  historyIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  historyBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },

  // Profile
  profileHeader: { borderRadius: 22, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14, borderWidth: 1 },
  profileAvatar: { width: 58, height: 58, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: { width: (SCREEN_W - 52) / 2, borderRadius: 18, padding: 16, borderWidth: 1 },
  recentCard: { borderRadius: 20, padding: 18, borderWidth: 1 },
  recentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5 },

  // Misc
  sectionTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  filterWrap: { flexDirection: 'row', borderRadius: 999, padding: 3, borderWidth: 1 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  filterText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
});

export default ParkingApp;

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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

// ====================== THEME ======================
const lightTheme = {
  bg: '#f5f6f8',
  card: '#ffffff',
  text: '#1a1d23',
  textSecondary: '#6b7280',
  primary: '#b22222',
  primaryLight: 'rgba(178,34,34,0.1)',
  success: '#22915a',
  successLight: 'rgba(34,145,90,0.1)',
  warning: '#e89a1c',
  border: '#e5e7eb',
  inputBg: '#f0f1f3',
  overlay: 'rgba(0,0,0,0.5)',
  headerBg: 'rgba(255,255,255,0.85)',
  navBg: 'rgba(255,255,255,0.92)',
  loginGradient: ['#2a0a0a', '#8b1a1a', '#2a0a0a'],
};

const darkTheme = {
  bg: '#0d1017',
  card: '#161b22',
  text: '#e6edf3',
  textSecondary: '#7d8590',
  primary: '#d63031',
  primaryLight: 'rgba(214,48,49,0.15)',
  success: '#2ea96a',
  successLight: 'rgba(46,169,106,0.15)',
  warning: '#f0a830',
  border: '#21262d',
  inputBg: '#1c2128',
  overlay: 'rgba(0,0,0,0.7)',
  headerBg: 'rgba(22,27,34,0.88)',
  navBg: 'rgba(22,27,34,0.92)',
  loginGradient: ['#0d0505', '#5c1111', '#0d0505'],
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
  '8888': 'Jentai', '2404': 'Welan', '1951': 'Alysia', '2010': 'Aelita',
  '1301': 'Daan', '1604': 'Isis', '1505': 'Anouk',
};

const cardNames = { card1: 'Parkeerkaart 1', card2: 'Parkeerkaart 2', card3: 'Parkeerkaart 3', card4: 'Parkeerkaart 4' };
const cardImages = {
  card1: 'https://i.ibb.co/LSYLK4N/pakeerkaart-STFEFQDW.jpg',
  card2: 'https://i.imgur.com/6fzUY8r.jpeg',
  card3: 'https://i.imgur.com/BdvVdH0.jpeg',
  card4: 'https://i.imgur.com/v2NekZk.jpeg',
};

const LS_KEYS = { USERS: 'jp_known_users', COUNTS: 'jp_claim_counts', HISTORY: 'jp_claim_history', THEME: 'jp_theme' };
const TEN_HOURS_MS = 10 * 60 * 60 * 1000;
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

// History helpers
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

// ====================== CARD COMPONENT ======================
const Card = ({ cardName, cardKey, cardImage, claimedStatus, claimedBy, claimedAt, userName, onPress, onZoom, now, theme }) => {
  const isClaimed = claimedStatus === 'geclaimd';
  const isOwner = claimedBy === userName;
  const isImageClickable = !isClaimed || isOwner;
  const claimedMs = claimedAt ? now - new Date(claimedAt).getTime() : 0;
  const remainingMs = isClaimed ? Math.max(0, TEN_HOURS_MS - claimedMs) : 0;
  const progressPct = isClaimed ? Math.min(100, (claimedMs / TEN_HOURS_MS) * 100) : 0;
  const isAlmostDone = remainingMs > 0 && remainingMs < 3600000;

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: isClaimed ? theme.primary + '60' : theme.success + '60' }]}>
      <TouchableOpacity onPress={isImageClickable ? () => onZoom(cardImage) : null} disabled={!isImageClickable} activeOpacity={0.9}>
        <View style={s.cardImgWrap}>
          <Image source={{ uri: cardImage }} style={s.cardImg} />
          {isClaimed ? (
            <View style={[s.cardOverlay, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
              <View style={[s.avatarCircle, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="person" size={16} color="#fff" />
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500' }}>In gebruik door</Text>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{claimedBy}</Text>
            </View>
          ) : (
            <View style={s.cardOverlayGradient} />
          )}
          <View style={[s.badge, { backgroundColor: isClaimed ? theme.primary + 'cc' : theme.success + 'cc' }]}>
            <View style={[s.badgeDot, { backgroundColor: '#fff' }]} />
            <Text style={s.badgeText}>{isClaimed ? 'Bezet' : 'Vrij'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={s.cardContent}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[s.cardTitle, { color: theme.text }]}>{cardName}</Text>
          <Ionicons name="car-outline" size={16} color={theme.textSecondary} />
        </View>

        {isClaimed && (
          <View style={{ marginTop: 8 }}>
            <View style={[s.progressBg, { backgroundColor: theme.inputBg }]}>
              <View style={[s.progressFill, { width: `${progressPct}%`, backgroundColor: isAlmostDone ? theme.warning : theme.primary }]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={[s.timerLabel, { color: theme.textSecondary }]}><Ionicons name="time-outline" size={10} color={theme.textSecondary} /> {fmtDuration(claimedMs)}</Text>
              <Text style={[s.timerLabel, { color: isAlmostDone ? theme.warning : theme.textSecondary, fontWeight: '600' }]}>{fmtDuration(remainingMs)} resterend</Text>
            </View>
          </View>
        )}

        <View style={s.cardBtns}>
          <TouchableOpacity
            onPress={() => onPress('claim')}
            disabled={isClaimed}
            style={[s.btnClaim, { backgroundColor: theme.primary, opacity: isClaimed ? 0.25 : 1 }]}
          >
            <Text style={s.btnText}>Claim</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onPress('release')}
            disabled={!isOwner}
            style={[s.btnRelease, { backgroundColor: theme.success, opacity: !isOwner ? 0.25 : 1 }]}
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
          <TouchableOpacity key={tab.id} onPress={() => onTabChange(tab.id)} style={s.navItem}>
            {active && <View style={[s.navIndicator, { backgroundColor: theme.primary }]} />}
            <Ionicons name={active ? tab.iconNameActive : tab.iconName} size={20} color={active ? theme.primary : theme.textSecondary} />
            <Text style={[s.navLabel, { color: active ? theme.primary : theme.textSecondary }]}>{tab.label}</Text>
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
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={[s.sectionTitle, { color: theme.text }]}>📋 Geschiedenis</Text>
        <View style={[s.filterWrap, { backgroundColor: theme.inputBg }]}>
          {['all', 'mine'].map(f => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[s.filterBtn, filter === f && { backgroundColor: theme.card }]}>
              <Text style={[s.filterText, { color: filter === f ? theme.text : theme.textSecondary }]}>{f === 'all' ? 'Alles' : 'Mijn'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {filtered.length === 0 ? (
        <Text style={{ textAlign: 'center', color: theme.textSecondary, marginTop: 60 }}>Nog geen geschiedenis</Text>
      ) : (
        filtered.map(entry => (
          <View key={entry.id} style={[s.historyRow, { backgroundColor: theme.card }]}>
            <View style={[s.historyIcon, { backgroundColor: entry.action === 'claim' ? theme.primaryLight : theme.successLight }]}>
              <Text style={{ fontSize: 14 }}>{entry.action === 'claim' ? '🔴' : '🟢'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: theme.text }} numberOfLines={1}>
                <Text style={{ fontWeight: '700' }}>{entry.user}</Text> heeft{' '}
                <Text style={{ fontWeight: '700' }}>{entry.cardName}</Text>{' '}
                {entry.action === 'claim' ? 'geclaimd' : 'vrijgegeven'}
              </Text>
              <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>{formatTime(entry.timestamp)}</Text>
            </View>
            <View style={[s.historyBadge, { backgroundColor: entry.action === 'claim' ? theme.primaryLight : theme.successLight }]}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: entry.action === 'claim' ? theme.primary : theme.success, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {entry.action === 'claim' ? 'Claim' : 'Vrij'}
              </Text>
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
    { iconName: 'card-outline', label: 'Totaal claims', value: `${stats.totalClaims}`, color: theme.primary },
    { iconName: 'star-outline', label: 'Favoriete kaart', value: stats.favoriteCard, color: theme.warning || '#f59e0b' },
    { iconName: 'time-outline', label: 'Gem. duur', value: stats.avgDurationMs > 0 ? fmtDuration(stats.avgDurationMs) : '-', color: theme.success },
    { iconName: 'trophy-outline', label: 'Ranking', value: rank > 0 ? `#${rank}` : '-', color: theme.primary },
  ];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      <View style={[s.profileHeader, { backgroundColor: theme.card }]}>
        <View style={[s.profileAvatar, { backgroundColor: theme.primary }]}>
          <Ionicons name="person" size={24} color="#fff" />
        </View>
        <View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{userName}</Text>
          <Text style={{ fontSize: 13, color: theme.textSecondary }}>Ingelogd om {loginTime?.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      </View>

      <View style={s.statsGrid}>
        {statCards.map(stat => (
          <View key={stat.label} style={[s.statCard, { backgroundColor: theme.card }]}>
            <Ionicons name={stat.iconName} size={20} color={stat.color} style={{ marginBottom: 8 }} />
            <Text style={{ fontSize: 11, color: theme.textSecondary }}>{stat.label}</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginTop: 2 }}>{stat.value}</Text>
          </View>
        ))}
      </View>

      <View style={[s.recentCard, { backgroundColor: theme.card }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}><Ionicons name="trending-up-outline" size={16} color={theme.primary} /><Text style={[s.sectionTitle, { color: theme.text }]}>Recente claims</Text></View>
        {stats.recentClaims.length === 0 ? (
          <Text style={{ textAlign: 'center', color: theme.textSecondary, paddingVertical: 20 }}>Nog geen claims</Text>
        ) : (
          stats.recentClaims.map(entry => (
            <View key={entry.id} style={[s.recentRow, { borderBottomColor: theme.border }]}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{entry.cardName}</Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                  {new Date(entry.timestamp).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={{ fontSize: 14 }}>🎫</Text>
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
    if (type === 'claim') {
      const already = Object.values(claimedCards).some(c => c?.claimedBy === userName && c?.status === 'geclaimd');
      if (already) return Alert.alert('Fout', 'Je hebt al een kaart.');
      if (claimedCards[cardKey]?.status === 'geclaimd') return Alert.alert('Bezet', `In gebruik door ${claimedCards[cardKey].claimedBy}.`);
    } else {
      if (claimedCards[cardKey]?.claimedBy !== userName) return Alert.alert('Nee', 'Alleen de eigenaar kan vrijgeven.');
    }
    setConfirmAction({ type, cardKey });
  };

  const executeAction = async () => {
    if (!confirmAction) return;
    setLoading(true);
    try {
      const { type, cardKey } = confirmAction;
      if (type === 'claim') {
        await saveClaim(cardKey, userName);
        await addHistoryEntry(userName, cardKey, 'claim');
        await sendNotification(`${cardNames[cardKey]} geclaimd!`, `${userName} heeft ${cardNames[cardKey]} geclaimd.`);
      } else {
        await saveClaim(cardKey, null);
        await addHistoryEntry(userName, cardKey, 'release');
        await sendNotification(`${cardNames[cardKey]} beschikbaar!`, `${cardNames[cardKey]} is nu weer vrij.`);
      }
      await fetchClaims();
    } catch (err) { Alert.alert('Fout', `Kon niet opslaan: ${err.message}`); }
    finally { setLoading(false); setConfirmAction(null); }
  };

  const availableCards = 4 - Object.values(claimedCards).filter(c => c?.status === 'geclaimd').length;
  

  if (fetchError) return (
    <View style={[s.center, { backgroundColor: theme.bg, flex: 1 }]}>
      <Text style={{ fontSize: 16, color: theme.primary, fontWeight: '700', marginBottom: 8 }}>! Verbindingsfout</Text>
      <Text style={{ color: theme.textSecondary, marginBottom: 16, fontSize: 13 }}>{fetchError}</Text>
      <TouchableOpacity onPress={fetchClaims} style={[s.btnSmall, { backgroundColor: theme.success }]}><Text style={s.btnText}>Opnieuw</Text></TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Zoomed image modal */}
      <Modal visible={!!zoomedImage} transparent animationType="fade" onRequestClose={() => setZoomedImage(null)}>
        <TouchableWithoutFeedback onPress={() => setZoomedImage(null)}>
          <View style={[s.modalBg, { backgroundColor: theme.overlay }]}>
            <ScrollView maximumZoomScale={4} minimumZoomScale={1} contentContainerStyle={s.center}>
              <Image source={{ uri: zoomedImage }} style={s.zoomedImg} resizeMode="contain" />
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Confirm modal */}
      <Modal visible={!!confirmAction} transparent animationType="fade" onRequestClose={() => setConfirmAction(null)}>
        <View style={[s.modalBg, { backgroundColor: theme.overlay }]}>
          <View style={[s.confirmCard, { backgroundColor: theme.card }]}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text, marginBottom: 8 }}>
              {confirmAction?.type === 'claim' ? 'Kaart claimen' : 'Kaart vrijgeven'}
            </Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 20 }}>
              Wil je {cardNames[confirmAction?.cardKey]} {confirmAction?.type === 'claim' ? 'claimen' : 'vrijgeven'}?
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setConfirmAction(null)} style={[s.confirmBtn, { backgroundColor: theme.inputBg }]}>
                <Text style={{ fontWeight: '700', color: theme.text, fontSize: 14 }}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={executeAction} disabled={loading}
                style={[s.confirmBtn, { backgroundColor: confirmAction?.type === 'claim' ? theme.primary : theme.success, opacity: loading ? 0.5 : 1 }]}>
                <Text style={{ fontWeight: '700', color: '#fff', fontSize: 14 }}>{loading ? 'Bezig...' : 'Bevestigen'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Status bar */}
        <View style={{ padding: 12, paddingHorizontal: 16 }}>
          <View style={[s.statusBar, { backgroundColor: theme.card }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="time-outline" size={13} color={theme.textSecondary} /><Text style={{ fontSize: 12, color: theme.textSecondary }}>{loginTime?.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</Text></View>
              <View style={{ width: 1, height: 14, backgroundColor: theme.border }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="card-outline" size={13} color={theme.textSecondary} /><Text style={{ fontSize: 12, color: theme.textSecondary }}><Text style={{ fontWeight: '800', color: theme.text }}>{availableCards}</Text> / 4 vrij</Text></View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.success }} />
              <Text style={{ fontSize: 11, color: theme.success, fontWeight: '700' }}>Live</Text>
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

        <Text style={{ textAlign: 'center', fontSize: 10, color: theme.textSecondary + '60', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 8, fontWeight: '600' }}>
          Powered by Nexum Development
        </Text>
      </ScrollView>

    </View>
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
      <View style={[s.loginContainer, { backgroundColor: theme.primary }]}>
        <StatusBar barStyle="light-content" />
        <Animated.View style={[s.loginCard, { backgroundColor: theme.card, opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
          <Image source={{ uri: 'https://media.glassdoor.com/sqll/1075020/jvh-gaming-en-entertainment-squarelogo-1533909494473.png' }} style={s.logo} />
          <Text style={[s.loginTitle, { color: theme.text }]}>Jack's Parking</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 16 }}>Voer je toegangscode in</Text>
          <TextInput value={code} onChangeText={setCode} placeholder="Toegangscode" placeholderTextColor={theme.textSecondary}
            style={[s.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]} keyboardType="numeric" secureTextEntry />
          <TouchableOpacity onPress={handleLogin} style={[s.loginBtn, { backgroundColor: theme.primary }]}><Text style={s.loginBtnText}>Inloggen →</Text></TouchableOpacity>
          {biometricSupported && hasSavedCode && (
            <TouchableOpacity onPress={handleFaceIDLogin} style={[s.faceIdBtn, { backgroundColor: theme.inputBg }]}><Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>Inloggen met Face ID</Text></TouchableOpacity>
          )}
        </Animated.View>
        <View style={{ alignItems: 'center', marginTop: 30 }}>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>JVH Gaming & Entertainment</Text>
          <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4, fontWeight: '600' }}>Powered by Nexum Development</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.appContainer, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={{ uri: 'https://media.glassdoor.com/sqll/1075020/jvh-gaming-en-entertainment-squarelogo-1533909494473.png' }} style={s.headerLogo} />
          <View>
            <Text style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>Jack's Parking</Text>
            <Text style={{ fontSize: 11, color: theme.textSecondary }}>{userName}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity onPress={toggleTheme} style={s.headerBtn}><Text style={{ fontSize: 18 }}>{isDark ? '☀️' : '🌙'}</Text></TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={s.headerBtn}><Text style={{ fontSize: 16 }}>🚪</Text></TouchableOpacity>
        </View>
      </View>

      {/* Tab content */}
      {activeTab === 'dashboard' && <DashboardTab userName={userName} loginTime={loginTime} onLogout={handleLogout} theme={theme} />}
      {activeTab === 'history' && <HistoryTab userName={userName} theme={theme} />}
      {activeTab === 'profile' && <ProfileTab userName={userName} loginTime={loginTime} theme={theme} />}

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} theme={theme} />
    </View>
  );
};

// ====================== STYLES ======================
const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  appContainer: { flex: 1 },
  // Login
  loginContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loginCard: { width: '100%', maxWidth: 380, borderRadius: 24, padding: 28, alignItems: 'center' },
  logo: { width: 72, height: 72, borderRadius: 18, marginBottom: 16 },
  loginTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4, letterSpacing: -0.3 },
  input: { width: '100%', borderRadius: 16, padding: 14, fontSize: 15, marginBottom: 12, borderWidth: 1 },
  loginBtn: { width: '100%', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  loginBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  faceIdBtn: { width: '100%', paddingVertical: 14, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 12, paddingBottom: 10, borderBottomWidth: 0.5 },
  headerLogo: { width: 32, height: 32, borderRadius: 10 },
  headerBtn: { padding: 8, borderRadius: 12 },
  // Bottom nav
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', borderTopWidth: 0.5, paddingBottom: Platform.OS === 'ios' ? 24 : 8 },
  navItem: { flex: 1, alignItems: 'center', paddingTop: 10, gap: 3 },
  navIndicator: { position: 'absolute', top: -0.5, width: 48, height: 2, borderRadius: 1 },
  navLabel: { fontSize: 10, fontWeight: '700' },
  // Status bar
  statusBar: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // Cards
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 8, justifyContent: 'center' },
  card: { width: (SCREEN_W - 40) / 2, borderRadius: 18, overflow: 'hidden', borderWidth: 1, marginBottom: 4 },
  cardImgWrap: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', position: 'relative' },
  cardImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 14, gap: 2 },
  cardOverlayGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', backgroundColor: 'rgba(0,0,0,0.08)' },
  avatarCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  badge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  cardContent: { padding: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  progressBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  timerLabel: { fontSize: 10 },
  cardBtns: { flexDirection: 'row', gap: 6, marginTop: 10 },
  btnClaim: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  btnRelease: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  btnSmall: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  // Modals
  modalBg: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  zoomedImg: { width: SCREEN_W, height: SCREEN_H * 0.8 },
  confirmCard: { width: '85%', maxWidth: 360, borderRadius: 20, padding: 24 },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  lbRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  // History
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, marginBottom: 6 },
  historyIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  historyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  // Profile
  profileHeader: { borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  profileAvatar: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: { width: (SCREEN_W - 52) / 2, borderRadius: 16, padding: 16 },
  recentCard: { borderRadius: 18, padding: 16 },
  recentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5 },
  // Misc
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  filterWrap: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  filterText: { fontSize: 12, fontWeight: '700' },
});

export default ParkingApp;

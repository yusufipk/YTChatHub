'use client';

import { useSyncExternalStore } from 'react';

/** Dashboard and control page copy. Turkish is the default; the choice is kept per browser in localStorage. */
export type Lang = 'tr' | 'en';

const STORAGE_KEY = 'ytchathub.lang';
const listeners = new Set<() => void>();

const TR = {
  locale: 'tr-TR',
  langToggle: 'EN',
  langToggleTitle: 'Switch to English',
  // Connect
  connectTitle: 'Canlı yayına bağlan',
  connectHint: 'Şu an canlı olan yayının video bağlantısını ya da 11 karakterlik video kimliğini yapıştır.',
  connect: 'Bağlan',
  connecting: 'Bağlanıyor…',
  backendDown: 'Sunucuya ulaşılamıyor. Çalışıyor mu?',
  // Top bar
  backendUnreachable: 'Sunucuya ulaşılamıyor',
  backendConnecting: 'Sunucuya bağlanıyor',
  live: 'Canlı',
  reconnecting: 'Yeniden bağlanıyor',
  disconnected: 'Bağlı değil',
  disconnectedWith: (error: string) => `Bağlı değil: ${error}`,
  noStream: 'Yayın yok',
  giftCookieExpired: 'Hediye çerezi bitti',
  giftPricesFailed: 'Hediye fiyatları alınamadı',
  giftSaved: (count: number, when: string) => `${when} tarihinde kaydedilen ${count} fiyat kullanılıyor.`,
  giftNoneSaved: 'Kayıtlı fiyat yok, hediyeler fiyatsız görünüyor.',
  giftExpiredCause: 'YouTube çerezinin oturumu kapanmış. Çerez dosyasını (YT_COOKIE_FILE) yenileyip yeniden bağlan.',
  giftFailedCause: (error: string) => `Hediye kataloğu alınamadı: ${error}. Bir sonraki bağlantıda yeniden denenir.`,
  poll: 'Anket',
  pollTitle: "YouTube'da bir anket sürüyor",
  search: 'Kişi ya da mesaj ara  ( / )',
  statChat: (n: number) => `${n} mesaj`,
  statChatTitle: 'Tutulan sohbet mesajları',
  statSuper: (n: number) => `${n} süper`,
  statSuperTitle: 'Bu oturumdaki Süper Sohbetler ve hediyeler',
  statMembers: (n: number) => `${n} üye`,
  statMembersTitle: 'Bu oturumdaki üyelikler',
  pause: 'Sohbeti durdur (P)',
  resume: 'Sohbeti sürdür (P)',
  show: 'Yayın',
  showTitle: 'Geri sayım, beğeni hedefi, sponsor kartı ve kapanış',
  overlay: 'Overlay',
  overlayTitle: 'Overlay bağlantısı ve görünümü',
  disconnect: 'Bu yayından ayrıl',
  // Panels
  chat: 'Sohbet',
  filtered: 'filtreli',
  noMatch: 'Eşleşen mesaj yok.',
  waiting: 'Mesaj bekleniyor…',
  supersAndGifts: 'Süper Sohbetler ve hediyeler',
  noSupers: 'Henüz Süper Sohbet ya da hediye yok.',
  memberships: 'Üyelikler',
  noMembers: 'Henüz yeni üye yok.',
  newMessages: (n: number) => `${n} yeni`,
  pausedWaiting: (n: number) => `Durduruldu, ${n} bekliyor`,
  openLink: 'Bu bağlantı açılsın mı?',
  cancel: 'Vazgeç',
  openInTab: 'Yeni sekmede aç',
  toastUpdate: (error: string) => `Overlay güncellenemedi: ${error}`,
  toastClear: (error: string) => `Overlay temizlenemedi: ${error}`,
  toastDisconnect: (error: string) => `Bağlantı kesilemedi: ${error}`,
  // On air
  onAir: 'Yayında',
  clear: 'Temizle',
  clearTitle: 'Overlay’i temizle (Esc)',
  onAirHint: 'Overlay boş. Göstermek için bir mesaja tıkla, gizlemek için yine tıkla.',
  // Cards
  newMember: 'Yeni üye',
  giftedMemberships: (n: number) => `${n} üyelik hediye etti`,
  jewels: (n: number) => `${n.toLocaleString('tr-TR')} mücevher`,
  leaderboard: (rank: number) => `Sohbet sıralamasında #${rank}`,
  // Overlay settings
  overlayHeading: 'OBS için overlay',
  overlayHint: 'Aşağıdaki bağlantıyı Tarayıcı Kaynağı olarak ekle. Ayarlar bağlantının içinde durur, her kaynağın kendi görünümü olabilir.',
  theme: 'Tema',
  position: 'Konum',
  textSize: 'Yazı boyutu',
  animation: 'Animasyon',
  language: 'Dil',
  hideAfter: 'Şu kadar saniye sonra gizle (0 = gizleme)',
  maxWidth: 'En fazla genişlik (1080p tuvalde px, kaynakla ölçeklenir)',
  copy: 'Kopyala',
  copied: 'Kopyalandı',
  open: 'Aç',
  close: 'Kapat',
  overlaySize: 'Önerilen Tarayıcı Kaynağı boyutu 1920 × 1080. Bağlantı sıcak kalsın diye “Görünür değilken kaynağı kapat” kapalı olsun.',
  options: {
    bl: 'Sol alt', bc: 'Orta alt', br: 'Sağ alt', tl: 'Sol üst', tc: 'Orta üst', tr: 'Sağ üst',
    s: 'Küçük', m: 'Orta', l: 'Büyük', xl: 'Çok büyük',
    dark: 'Koyu', light: 'Açık', blueprint: 'Blueprint (açık, marka)', glass: 'Cam', youtube: 'YouTube kırmızısı',
    fade: 'Solma', slide: 'Kayma', none: 'Yok',
    langTr: 'Türkçe', langEn: 'İngilizce'
  } as Record<string, string>,
  // Landing
  landingHint: 'YouTube canlı sohbetini izle, bir mesaj seç, OBS overlay’inde görünsün.',
  openDashboard: 'Paneli aç',
  overlayForObs: 'OBS için overlay',
  // Show control
  showControl: 'Yayın kontrolü',
  chatDashboard: 'Sohbet paneli',
  countdown: 'Geri sayım',
  notRunning: 'Çalışmıyor',
  leftEnds: (left: string, ends: string) => `${left} kaldı, bitiş saati ${ends}`,
  finished: 'Bitti',
  minutes: 'Dakika',
  start: 'Başlat',
  stop: 'Durdur',
  min: (n: string) => `${n} dk`,
  goIn10: '10 sn sonra başla',
  goIn10Title: 'Son 10 saniyeye atla',
  streamInfo: 'Yayın bilgisi',
  showName: 'Yayın adı',
  showNamePlaceholder: 'Geri sayımda büyük görünür',
  topic: 'Konu',
  topicPlaceholder: 'İsteğe bağlı, adın altında bir satır',
  likeStep: 'Beğeni hedefi adımı',
  watchingNoLikes: (viewers: number) => `${viewers} izleyici; YouTube beğeni sayısını paylaşmıyor`,
  likesNotYet: 'Canlı beğeniler bir yayına bağlanınca başlar; aşağıdaki önizleme deneme sayıları sayar',
  likesStatus: (likes: number, next: number, viewers: number | null) => `${likes} beğeni, sıradaki hedef ${next}${viewers !== null ? `, ${viewers} izleyici` : ''}`,
  save: 'Kaydet',
  sponsor: 'Sponsor',
  name: 'Ad',
  qrLink: 'QR kodun bağlantısı',
  captionLine: 'Logonun altındaki satır',
  captionPlaceholder: 'İsteğe bağlı, logonun altında küçük görünür',
  qrEvery: 'QR kodu her',
  qrFor: 'sn’de bir,',
  qrSeconds: 'sn aç',
  qrEveryLabel: 'QR gösterimleri arasındaki saniye',
  qrForLabel: 'QR kodun açık kaldığı saniye',
  noLogo: 'Logo yok, yerine ad gösteriliyor',
  logo: 'Logo',
  sponsorLogo: 'Sponsor logosu',
  qrPreview: 'QR kod önizlemesi',
  removeLogo: 'Logoyu kaldır',
  showQr: 'QR’ı şimdi göster',
  closeQr: 'QR’ı kapat',
  openFor: (left: string) => `${left} daha açık`,
  music: 'Müzik',
  nowPlaying: (track: string) => `Çalan: ${track}`,
  nothingPlaying: 'Bir şey çalmıyor. Parçayı OBS’ten okumak için scripts/now-playing.py bu makinede çalışmalı.',
  endScreen: 'Kapanış ekranı',
  creditsSince: (time: string) => `Jenerik akıyor, başlangıç saati ${time}`,
  endHint: 'Kapanış sahnesine geçince başlat. İstatistikleri dondurur ve jeneriği akıtır.',
  rollCredits: 'Jeneriği başlat',
  restartCredits: 'Jeneriği yeniden başlat',
  reset: 'Sıfırla',
  preview: 'Önizleme',
  previewHint: 'Gerçek overlay’ler, canlı. Geri sayım şu an çalışanı gösterir.',
  obsSources: 'OBS tarayıcı kaynakları',
  obsSourcesHint: 'Her kaynağı bulunduğu tuvalin boyutuna ayarla.',
  copyUrl: 'Bağlantıyı kopyala',
  sources: {
    countdownMain: ['Geri sayım, ana tuval', 'Hemen Başlıyoruz sahnesi. Sıfırda Full Cam’e geçer; sayfa izni olarak "Advanced access to OBS" gerekir.'],
    countdownVertical: ['Geri sayım, dikey tuval', 'Dikey tuvaldeki başlangıç sahnesi, 1440×2560. Sahne geçişi yok, o yalnızca ana tuvalde çalışır.'],
    goalTr: ['Beğeni hedefi, sağ üst', 'Tuval boyutunda olsun: 1920×1080 ya da 3840×2160, dikey tuvalde 1440×2560.'],
    goalTl: ['Beğeni hedefi, sol üst', 'Yukarıdakiyle aynı, öbür köşe.'],
    goalBl: ['Beğeni hedefi, sol alt', 'Kapanış sahnesi için.'],
    goalBr: ['Beğeni hedefi, sağ alt', 'Yukarıdakiyle aynı, öbür köşe.'],
    sponsorTl: ['Sponsor, sol üst', 'Logo hep açık, QR kod yukarıdaki döngüyle sağında açılır.'],
    sponsorTr: ['Sponsor, sağ üst', 'Logonun sağda durduğu sahneler için; QR kod solunda açılır.'],
    musicBl: ['Çalan parça, sol alt', 'VLC kaynağının çaldığı parçanın kapağı, adı ve sanatçısı. scripts/now-playing.py çalışıyor olmalı.'],
    musicBr: ['Çalan parça, sağ alt', 'Yukarıdakiyle aynı, öbür köşe.'],
    musicTl: ['Çalan parça, sol üst', 'Yukarıdakiyle aynı, öbür köşe.'],
    musicTr: ['Çalan parça, sağ üst', 'Yukarıdakiyle aynı, öbür köşe.'],
    outro: ['Kapanış ekranı', 'Teşekkür, Tux ve akan jenerik. Yukarıdaki "Jeneriği başlat" ile başlat.'],
    previewCountdown: ['Geri sayım', ''],
    previewCountdownVertical: ['Geri sayım, dikey', ''],
    previewGoal: ['Beğeni hedefi (deneme sayıları)', ''],
    previewGoalVertical: ['Beğeni hedefi, dikey', ''],
    previewSponsor: ['Sponsor', ''],
    previewSponsorVertical: ['Sponsor, dikey', ''],
    previewMusic: ['Çalan parça', ''],
    previewOutro: ['Kapanış ekranı', '']
  } as Record<string, [string, string]>
};

export type Strings = typeof TR;

const EN: Strings = {
  locale: 'en-US',
  langToggle: 'TR',
  langToggleTitle: 'Türkçeye geç',
  connectTitle: 'Connect to a live stream',
  connectHint: 'Paste the video URL or the 11 character video id of a stream that is live now.',
  connect: 'Connect',
  connecting: 'Connecting…',
  backendDown: 'Backend is not reachable. Is it running?',
  backendUnreachable: 'Backend unreachable',
  backendConnecting: 'Connecting to backend',
  live: 'Live',
  reconnecting: 'Reconnecting',
  disconnected: 'Disconnected',
  disconnectedWith: (error) => `Disconnected: ${error}`,
  noStream: 'No stream',
  giftCookieExpired: 'Gift cookie expired',
  giftPricesFailed: 'Gift prices failed',
  giftSaved: (count, when) => `Using ${count} jewel prices saved ${when}.`,
  giftNoneSaved: 'No saved jewel prices, so gifts show without one.',
  giftExpiredCause: 'The YouTube cookie is signed out. Replace the cookie file (YT_COOKIE_FILE) and reconnect.',
  giftFailedCause: (error) => `Loading the gift catalog failed: ${error}. It retries on the next reconnect.`,
  poll: 'Poll',
  pollTitle: 'A poll is running on YouTube',
  search: 'Search author or text  ( / )',
  statChat: (n) => `${n} chat`,
  statChatTitle: 'Chat messages kept',
  statSuper: (n) => `${n} super`,
  statSuperTitle: 'Super Chats and gifts this session',
  statMembers: (n) => `${n} members`,
  statMembersTitle: 'Memberships this session',
  pause: 'Pause chat (P)',
  resume: 'Resume chat (P)',
  show: 'Show',
  showTitle: 'Countdown, like goal, sponsor card and end screen',
  overlay: 'Overlay',
  overlayTitle: 'Overlay URL and look',
  disconnect: 'Disconnect from this stream',
  chat: 'Chat',
  filtered: 'filtered',
  noMatch: 'No messages match.',
  waiting: 'Waiting for messages…',
  supersAndGifts: 'Super Chats & Gifts',
  noSupers: 'No Super Chats or gifts yet.',
  memberships: 'Memberships',
  noMembers: 'No new members yet.',
  newMessages: (n) => `${n} new`,
  pausedWaiting: (n) => `Paused, ${n} waiting`,
  openLink: 'Open this link?',
  cancel: 'Cancel',
  openInTab: 'Open in new tab',
  toastUpdate: (error) => `Could not update overlay: ${error}`,
  toastClear: (error) => `Could not clear overlay: ${error}`,
  toastDisconnect: (error) => `Could not disconnect: ${error}`,
  onAir: 'On air',
  clear: 'Clear',
  clearTitle: 'Clear the overlay (Esc)',
  onAirHint: 'Nothing on the overlay. Click a message to show it, click again to hide it.',
  newMember: 'New member',
  giftedMemberships: (n) => `Gifted ${n} membership${n > 1 ? 's' : ''}`,
  jewels: (n) => `${n.toLocaleString('en-US')} jewel${n === 1 ? '' : 's'}`,
  leaderboard: (rank) => `#${rank} on the chat leaderboard`,
  overlayHeading: 'Overlay for OBS',
  overlayHint: 'Add the URL below as a Browser Source. Settings are stored in the URL, so one source can have its own look.',
  theme: 'Theme',
  position: 'Position',
  textSize: 'Text size',
  animation: 'Animation',
  language: 'Language',
  hideAfter: 'Hide after (seconds, 0 = never)',
  maxWidth: 'Max width (px on a 1080p canvas, scales with source size)',
  copy: 'Copy',
  copied: 'Copied',
  open: 'Open',
  close: 'Close',
  overlaySize: 'Recommended Browser Source size: 1920 × 1080, with “Shutdown source when not visible” off so the connection stays warm.',
  options: {
    bl: 'Bottom left', bc: 'Bottom center', br: 'Bottom right', tl: 'Top left', tc: 'Top center', tr: 'Top right',
    s: 'Small', m: 'Medium', l: 'Large', xl: 'Extra large',
    dark: 'Dark', light: 'Light', blueprint: 'Blueprint (light, brand)', glass: 'Glass', youtube: 'YouTube red',
    fade: 'Fade', slide: 'Slide', none: 'None',
    langTr: 'Turkish', langEn: 'English'
  },
  landingHint: 'Watch a YouTube Live chat, pick a message, and it appears on your OBS overlay.',
  openDashboard: 'Open dashboard',
  overlayForObs: 'Overlay for OBS',
  showControl: 'Show control',
  chatDashboard: 'Chat dashboard',
  countdown: 'Countdown',
  notRunning: 'Not running',
  leftEnds: (left, ends) => `${left} left, ends ${ends}`,
  finished: 'Finished',
  minutes: 'Minutes',
  start: 'Start',
  stop: 'Stop',
  min: (n) => `${n} min`,
  goIn10: 'Go in 10 s',
  goIn10Title: 'Jump to the last 10 seconds',
  streamInfo: 'Stream info',
  showName: 'Show name',
  showNamePlaceholder: 'Shown big on the countdown',
  topic: 'Topic',
  topicPlaceholder: 'Optional line under the name',
  likeStep: 'Like goal step',
  watchingNoLikes: (viewers) => `${viewers} watching; YouTube is not sharing the like count`,
  likesNotYet: 'Live likes start once a stream is connected; the preview below counts demo numbers',
  likesStatus: (likes, next, viewers) => `${likes} likes, next goal ${next}${viewers !== null ? `, ${viewers} watching` : ''}`,
  save: 'Save',
  sponsor: 'Sponsor',
  name: 'Name',
  qrLink: 'Link for the QR code',
  captionLine: 'Line under the logo',
  captionPlaceholder: 'Optional, shown small under the logo',
  qrEvery: 'Open the QR code every',
  qrFor: 's for',
  qrSeconds: 's',
  qrEveryLabel: 'Seconds between QR showings',
  qrForLabel: 'Seconds the QR code stays open',
  noLogo: 'No logo, the name is shown instead',
  logo: 'Logo',
  sponsorLogo: 'Sponsor logo',
  qrPreview: 'QR code preview',
  removeLogo: 'Remove logo',
  showQr: 'Show QR now',
  closeQr: 'Close QR',
  openFor: (left) => `Open for ${left}`,
  music: 'Music',
  nowPlaying: (track) => `Now playing: ${track}`,
  nothingPlaying: 'Nothing playing. scripts/now-playing.py has to run on this machine to read the track from OBS.',
  endScreen: 'End screen',
  creditsSince: (time) => `Credits rolling since ${time}`,
  endHint: 'Start this when you switch to the end scene. It freezes the stats and rolls the credits.',
  rollCredits: 'Roll credits',
  restartCredits: 'Restart credits',
  reset: 'Reset',
  preview: 'Preview',
  previewHint: 'The real overlays, live. The countdown shows whatever is running now.',
  obsSources: 'OBS browser sources',
  obsSourcesHint: 'Set each source to the size of the canvas it sits on.',
  copyUrl: 'Copy URL',
  sources: {
    countdownMain: ['Countdown, main canvas', 'Starting Soon scene. Switches to Full Cam at zero; needs page permission "Advanced access to OBS".'],
    countdownVertical: ['Countdown, vertical canvas', 'Start Soon scene on the vertical canvas, sized 1440×2560. No scene switch: that only works on the main canvas.'],
    goalTr: ['Like goal, top right', 'Size it like the canvas: 1920×1080 or 3840×2160, or 1440×2560 on the vertical canvas.'],
    goalTl: ['Like goal, top left', 'Same as above, other corner.'],
    goalBl: ['Like goal, bottom left', 'For the end scene.'],
    goalBr: ['Like goal, bottom right', 'Same as above, other corner.'],
    sponsorTl: ['Sponsor, top left', 'Logo always on, the QR code opens to its right on the cycle set above.'],
    sponsorTr: ['Sponsor, top right', 'For scenes where the logo sits on the right; the QR code opens to its left.'],
    musicBl: ['Now playing, bottom left', 'Cover, title and artist of the track the VLC source plays. Needs scripts/now-playing.py running.'],
    musicBr: ['Now playing, bottom right', 'Same as above, other corner.'],
    musicTl: ['Now playing, top left', 'Same as above, other corner.'],
    musicTr: ['Now playing, top right', 'Same as above, other corner.'],
    outro: ['End screen', 'Thanks, Tux and the rolling credits. Start them with "Roll credits" above.'],
    previewCountdown: ['Countdown', ''],
    previewCountdownVertical: ['Countdown, vertical', ''],
    previewGoal: ['Like goal (demo numbers)', ''],
    previewGoalVertical: ['Like goal, vertical', ''],
    previewSponsor: ['Sponsor', ''],
    previewSponsorVertical: ['Sponsor, vertical', ''],
    previewMusic: ['Now playing', ''],
    previewOutro: ['End screen', '']
  }
};

export const STRINGS: Record<Lang, Strings> = { tr: TR, en: EN };

export function parseLang(value: string | null | undefined): Lang {
  return value === 'en' ? 'en' : 'tr';
}

function read(): Lang {
  try {
    return parseLang(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'tr';
  }
}

function subscribe(listener: () => void) {
  // The static export ships <html lang="tr">; correct it once the stored choice is known.
  document.documentElement.lang = read();
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => event.key === STORAGE_KEY && listener();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // storage unavailable; the choice lasts until reload
  }
  document.documentElement.lang = lang;
  for (const listener of listeners) listener();
}

/** The dashboard language, shared by every component and kept in sync across tabs. Static export renders Turkish. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, read, () => 'tr');
}

export function useStrings(): Strings {
  return STRINGS[useLang()];
}

/** "20 mücevher" when the price is known, otherwise the gift's name. */
export function giftLabel(gift: { name: string; jewels?: number }, t: Strings): string {
  return gift.jewels === undefined ? gift.name : t.jewels(gift.jewels);
}

export function membershipLabel(message: { membershipGiftPurchase?: boolean; giftCount?: number; membershipLevel?: string }, t: Strings): string {
  if (message.membershipGiftPurchase && message.giftCount) return t.giftedMemberships(message.giftCount);
  return message.membershipLevel || t.newMember;
}

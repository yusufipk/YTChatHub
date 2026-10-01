/** On-screen copy for the show overlays. Pick with `?lang=`; English is the default. */
const TEXT = {
  en: {
    locale: 'en-US',
    soon: 'Starting soon',
    startsAt: (time: string) => `Starts at ${time}`,
    live: 'We are live',
    likes: 'likes',
    watching: 'watching',
    reached: (n: string) => `${n} likes, thank you!`,
    thanks: 'Thanks for watching',
    see: 'See you next stream. Turn on notifications so you catch it.',
    stats: (messages: string, chatters: string) => `${messages} messages from ${chatters} people`,
    likeStat: (likes: string) => `${likes} likes`,
    superChats: 'Super Chats',
    members: 'Members',
    gifts: 'Gifted memberships',
    gifted: (n: string) => `${n} gifted`
  },
  tr: {
    locale: 'tr-TR',
    soon: 'Birazdan başlıyoruz',
    startsAt: (time: string) => `Başlangıç ${time}`,
    live: 'Yayındayız',
    likes: 'beğeni',
    watching: 'izleyici',
    reached: (n: string) => `${n} beğeni, teşekkürler!`,
    thanks: 'İzlediğin için teşekkürler',
    see: 'Bir sonraki yayında görüşmek üzere. Kaçırmamak için bildirimleri aç.',
    stats: (messages: string, chatters: string) => `${chatters} kişiden ${messages} mesaj`,
    likeStat: (likes: string) => `${likes} beğeni`,
    superChats: 'Süper Sohbet',
    members: 'Üyeler',
    gifts: 'Hediye üyelik',
    gifted: (n: string) => `${n} hediye`
  }
};

export type ShowText = (typeof TEXT)['en'];

export function showText(lang: string | null): ShowText {
  return lang === 'tr' ? TEXT.tr : TEXT.en;
}

export function formatNumber(value: number, text: ShowText): string {
  return value.toLocaleString(text.locale);
}

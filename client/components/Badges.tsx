import { BadgeCheck, Crown, Shield, Star, Tv } from 'lucide-react';
import type { ChatMessage } from '@shared/chat';
import { proxyImageUrl } from '../lib/imageProxy';

const ICONS = {
  moderator: Shield,
  member: Star,
  verified: BadgeCheck,
  owner: Tv,
  custom: null
} as const;

export function Badges({ message }: { message: ChatMessage }) {
  return (
    <>
      {message.leaderboardRank && (
        <span className="badge badge--rank" title={`#${message.leaderboardRank} on the chat leaderboard`}>
          <Crown size={11} strokeWidth={2.5} />
          {message.leaderboardRank}
        </span>
      )}
      {message.badges?.map((badge, i) => {
        if (badge.imageUrl) {
          return <img key={i} src={proxyImageUrl(badge.imageUrl)} alt={badge.label ?? badge.type} title={badge.label} className="badge badge--image" />;
        }
        const Icon = ICONS[badge.type];
        if (!Icon) return null;
        return (
          <span key={i} className={`badge badge--${badge.type}`} title={badge.label}>
            <Icon size={12} strokeWidth={2.5} />
          </span>
        );
      })}
    </>
  );
}

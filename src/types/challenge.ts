export interface Challenge {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  endsAt: string;
  createdAt: string;
  active: boolean;
  participants?: number;
  progress?: number;
  imageUrl?: string;
  gradient?: string;
}

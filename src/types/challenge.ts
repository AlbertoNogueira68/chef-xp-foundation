export interface Challenge {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  imageUrl: string | null;
  endsAt: string;
  createdAt: string;
  active: boolean;
}

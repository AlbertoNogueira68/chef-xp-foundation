export type NotificationKind = "like" | "comment" | "follow";

export interface NotificationActor {
  id: string;
  username: string;
  photoUrl: string | null;
  level: number;
}

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  read: boolean;
  createdAt: string;
  actor: NotificationActor;
  /** `null` num seguidor novo: não há receita envolvida. */
  recipe: { id: string; title: string; imageUrl: string | null } | null;
  /** O texto do comentário, quando é disso que se trata. */
  commentBody: string | null;
}

export interface NotificationPage {
  notifications: AppNotification[];
  unread: number;
}

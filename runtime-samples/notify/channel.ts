export type Channel = 'push' | 'email' | 'sms';

export interface Subscriber {
  pushEnabled: boolean;
  quietHoursUtc: number[];
  preferred?: Channel;
}

export interface CareerEvent {
  topic: string;
  priority: 'high' | 'normal';
  ts: number;
}

/** One delivery channel per subscriber, respecting quiet hours. */
export function pickChannel(user: Subscriber, event: CareerEvent): Channel {
  if (event.priority === 'high' && user.pushEnabled) return 'push';
  if (user.quietHoursUtc.includes(new Date(event.ts).getUTCHours())) return 'email';
  return user.preferred ?? 'email';
}

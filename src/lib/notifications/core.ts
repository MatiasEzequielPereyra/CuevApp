export const NOTIFICATION_TIME_ZONE = "America/Argentina/Buenos_Aires";
export const REMINDER_DAYS = [5, 1] as const;

export type ReminderDays = (typeof REMINDER_DAYS)[number];
export type CentsValue = string | number | bigint;

export type NotificationPeriod = {
  dueOn: string;
  periodMonth: string;
  balanceCents: CentsValue;
  studentActive: boolean;
};

export type ReminderCandidate = {
  reminderDays: ReminderDays;
  scheduledAt: string;
  ready: boolean;
};

function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value);
  if (!match) throw new TypeError("Fecha inválida");
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new TypeError("Fecha inválida");
  }
  return { year, month, day };
}

function parseBalanceCents(value: CentsValue): bigint {
  if (typeof value === "bigint") {
    if (value < 0n) throw new TypeError("Saldo inválido");
    return value;
  }
  if (typeof value === "string") {
    if (!/^\\d+$/.test(value)) throw new TypeError("Saldo inválido");
    return BigInt(value);
  }
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError("Saldo inválido");
  return BigInt(value);
}

function addCalendarDays(value: string, days: number): string {
  const { year, month, day } = parseIsoDate(value);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0")).join("-");
}

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NOTIFICATION_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year: Number(value.year), month: Number(value.month), day: Number(value.day),
    hour: Number(value.hour), minute: Number(value.minute), second: Number(value.second),
  };
}

export function buenosAiresDate(now: Date): string {
  const parts = localParts(now);
  return [parts.year, parts.month, parts.day]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0")).join("-");
}

export function buenosAiresDateTimeToUtc(date: string, time: string): Date {
  const { year, month, day } = parseIsoDate(date);
  const match = /^(\\d{2}):(\\d{2})$/.exec(time);
  if (!match) throw new TypeError("Horario inválido");
  const hour = Number(match[1]), minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new TypeError("Horario inválido");

  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const observed = localParts(new Date(wallClockAsUtc));
  const observedAsUtc = Date.UTC(
    observed.year, observed.month - 1, observed.day,
    observed.hour, observed.minute, observed.second,
  );
  return new Date(wallClockAsUtc - (observedAsUtc - wallClockAsUtc));
}

export function buildReminderPlan(
  period: NotificationPeriod,
  sendTime: string,
  now: Date,
): ReminderCandidate[] {
  parseIsoDate(period.dueOn);
  parseIsoDate(period.periodMonth);
  const balanceCents = parseBalanceCents(period.balanceCents);
  if (!Number.isFinite(now.getTime())) throw new TypeError("Instante inválido");
  if (!period.studentActive || balanceCents === 0n || period.dueOn <= buenosAiresDate(now)) return [];

  return REMINDER_DAYS.map(reminderDays => {
    const scheduledAt = buenosAiresDateTimeToUtc(addCalendarDays(period.dueOn, -reminderDays), sendTime);
    return { reminderDays, scheduledAt: scheduledAt.toISOString(), ready: scheduledAt.getTime() <= now.getTime() };
  });
}

function formatArsCents(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = String(cents % 100n).padStart(2, "0");
  const formattedWhole = new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(whole);
  return `${formattedWhole},${fraction}`;
}

export function formatReminderContent(period: NotificationPeriod) {
  parseIsoDate(period.dueOn);
  parseIsoDate(period.periodMonth);
  const balanceCents = parseBalanceCents(period.balanceCents);
  if (balanceCents <= 0n) throw new TypeError("El saldo debe ser mayor que cero");
  const month = new Intl.DateTimeFormat("es-AR", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${period.periodMonth}T12:00:00.000Z`));
  const dueDate = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long", timeZone: "UTC",
  }).format(new Date(`${period.dueOn}T12:00:00.000Z`));
  const amount = formatArsCents(balanceCents);
  return {
    title: "Recordatorio de cuota",
    subject: `Recordatorio de cuota — ${month}`,
    body: `Tu cuota de ${month} vence el ${dueDate} y tiene un saldo pendiente de ${amount}.`,
  };
}

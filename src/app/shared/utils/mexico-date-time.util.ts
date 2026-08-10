const MEXICO_CITY_TIME_ZONE = 'America/Mexico_City';

type DateValue = string | Date | null | undefined;

function parseDate(value: DateValue): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date
    ? value
    : new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

export function formatMexicoGameDateTime(
  value: DateValue,
): string {
  const date = parseDate(value);

  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('es-MX', {
    timeZone: MEXICO_CITY_TIME_ZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatMexicoTime(
  value: DateValue,
): string {
  const date = parseDate(value);

  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('es-MX', {
    timeZone: MEXICO_CITY_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}
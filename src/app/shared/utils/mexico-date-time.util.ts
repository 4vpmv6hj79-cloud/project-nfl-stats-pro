const MEXICO_CITY_TIME_ZONE =
  'America/Mexico_City';

const DAY_IN_MILLISECONDS =
  24 * 60 * 60 * 1000;

type DateValue =
  | string
  | Date
  | null
  | undefined;

const mexicoDatePartsFormatter =
  new Intl.DateTimeFormat('en-CA', {
    timeZone: MEXICO_CITY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

function parseDate(
  value: DateValue,
): Date | null {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function mexicoCalendarDayNumber(
  value: DateValue,
): number | null {
  const date = parseDate(value);

  if (!date) {
    return null;
  }

  const parts =
    mexicoDatePartsFormatter.formatToParts(
      date,
    );

  const year = Number(
    parts.find(
      (part) => part.type === 'year',
    )?.value,
  );

  const month = Number(
    parts.find(
      (part) => part.type === 'month',
    )?.value,
  );

  const day = Number(
    parts.find(
      (part) => part.type === 'day',
    )?.value,
  );

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  return (
    Date.UTC(year, month - 1, day) /
    DAY_IN_MILLISECONDS
  );
}

export function differenceInMexicoCalendarDays(
  value: DateValue,
  reference: DateValue = new Date(),
): number | null {
  const valueDay =
    mexicoCalendarDayNumber(value);

  const referenceDay =
    mexicoCalendarDayNumber(reference);

  if (
    valueDay === null ||
    referenceDay === null
  ) {
    return null;
  }

  return valueDay - referenceDay;
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

/**
 * Etiqueta de día para agrupar partidos.
 * Ejemplo: "Domingo 8 de septiembre"
 */
export function formatMexicoDayLabel(
  value: DateValue,
): string {
  const date = parseDate(value);

  if (!date) {
    return 'Fecha por confirmar';
  }

  const label = new Intl.DateTimeFormat('es-MX', {
    timeZone: MEXICO_CITY_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);

  // Capitalizar primera letra
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Clave estable de día en zona horaria de México (YYYY-MM-DD)
 * para agrupar partidos por día.
 */
export function mexicoDayKey(
  value: DateValue,
): string {
  const date = parseDate(value);

  if (!date) {
    return 'unknown';
  }

  return mexicoDatePartsFormatter.format(date);
}
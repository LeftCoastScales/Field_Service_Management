import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

/**
 * Check if the provided time range is valid.
 * @param start - the start time in "HH:mm" format.
 * @param end - the end time in "HH:mm" format.
 * @returns true if the end time is after the start time, otherwise an error message.
 */
export function validateTimeRange(start: string, end: string): true | string {
  const startTime = dayjs(start, "HH:mm");
  const endTime = dayjs(end, "HH:mm");
  if (!startTime.isValid() || !endTime.isValid()) {
    return "Invalid start or end time.";
  }
  if (endTime.isAfter(startTime)) {
    return true;
  }
  return "End time must be after start time.";
}

/**
 * Check if the duration between start and end is at least the specified minutes.
 * @param start - the start time in "HH:mm" format.
 * @param end - the end time in "HH:mm" format.
 * @param minimumMinutes - the minimum duration in minutes (default 60).
 * @returns true if the duration is at least minimumMinutes, otherwise an error message.
 */
export function validateMinimumDuration(start: string, end: string, minimumMinutes: number = 60): true | string {
  const startTime = dayjs(start, "HH:mm");
  const endTime = dayjs(end, "HH:mm");
  const duration = endTime.diff(startTime, "minute");
  if (duration >= minimumMinutes) {
    return true;
  }
  return `Event must be at least ${minimumMinutes} minutes long.`;
}

/**
 * Check if the event time range falls within business hours.
 * @param start - the event start time in "HH:mm" format.
 * @param end - the event end time in "HH:mm" format.
 * @param openTime - the business opening time in "HH:mm" format.
 * @param closeTime - the business closing time in "HH:mm" format.
 * @returns true if the event falls within business hours, otherwise an error message.
 */
export function validateBusinessHours(start: string, end: string, openTime: string, closeTime: string): true | string {
  const eventStart = dayjs(start, "HH:mm");
  const eventEnd = dayjs(end, "HH:mm");
  const opening = dayjs(openTime, "HH:mm");
  const closing = dayjs(closeTime, "HH:mm");

  if (eventStart.isBefore(opening)) {
    return `Event cannot start before business hours (${openTime}).`;
  }
  if (eventEnd.isAfter(closing)) {
    return `Event cannot end after business hours (${closeTime}).`;
  }
  return true;
}

/**
 * Check if a field is non-empty.
 * @param field - the field value to check.
 * @param fieldName - the name of the field (for error message).
 * @returns true if non-empty, otherwise an error message.
 */
export function validateNonEmptyField(field: string, fieldName: string): true | string {
  if (field.trim() === "") {
    return `${fieldName} cannot be empty.`;
  }
  return true;
}

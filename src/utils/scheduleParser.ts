/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScheduleItem } from '../types';

export interface ParsedScheduleCandidate {
  title: string;
  time: string; // "HH:MM" 24-hour format
  category: string;
  emoji: string;
  alarmEnabled: boolean;
  alarmSound: string;
  days: number[]; // [0..6] (0 = Sun, 1 = Mon...)
  rawLine?: string;
  selected?: boolean; // For preview selection UI
}

export interface ParseResult {
  items: ParsedScheduleCandidate[];
  detectedFormat: string;
  totalLinesScanned: number;
  warnings: string[];
}

/**
 * Intelligent helper to convert 12h/24h time strings to standard "HH:MM" (24-hour),
 * with contextual AM/PM resolution when meridiem is omitted.
 */
export function normalizeTimeTo24h(rawHour: number, rawMin: number, meridiem?: string, context: string = ''): string {
  let h = rawHour;
  const m = Math.min(Math.max(rawMin || 0, 0), 59);

  if (meridiem) {
    const med = meridiem.toLowerCase().replace(/\./g, '').trim();
    if (med === 'pm' && h < 12) {
      h += 12;
    } else if (med === 'am' && h === 12) {
      h = 0;
    }
  } else {
    // Contextual AM/PM inference when meridiem is omitted
    const ctx = context.toLowerCase();
    const isEveningOrNight =
      ctx.includes('dinner') ||
      ctx.includes('sleep') ||
      ctx.includes('bed') ||
      ctx.includes('night') ||
      ctx.includes('evening') ||
      ctx.includes('dusk') ||
      ctx.includes('sunset') ||
      ctx.includes('unwind');

    const isAfternoon =
      ctx.includes('lunch') ||
      ctx.includes('afternoon') ||
      ctx.includes('snack') ||
      ctx.includes('tea');

    const isMorning =
      ctx.includes('wake') ||
      ctx.includes('morning') ||
      ctx.includes('rise') ||
      ctx.includes('dawn') ||
      ctx.includes('sunrise') ||
      ctx.includes('breakfast');

    if (isEveningOrNight) {
      if (h >= 1 && h <= 11) h += 12; // e.g. dinner 8 -> 20:00, sleep 10 -> 22:00
      else if (h === 12) h = 0; // midnight
    } else if (isAfternoon) {
      if (h >= 1 && h <= 5) h += 12; // lunch 1 -> 13:00, 2 -> 14:00
    } else if (isMorning) {
      if (h === 12) h = 0;
    } else {
      // General heuristic: 1 to 5 without context is usually afternoon (1pm-5pm), 6 to 11 is morning
      if (h >= 1 && h <= 5) h += 12;
    }
  }

  h = Math.min(Math.max(h, 0), 23);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Infer an appropriate emoji based on title keywords.
 */
export function inferEmoji(title: string, category: string): string {
  const lower = `${title} ${category}`.toLowerCase();

  if (lower.includes('water') || lower.includes('hydrat') || lower.includes('drink')) return '💧';
  if (lower.includes('wake') || lower.includes('rise') || lower.includes('morning') || lower.includes('sunrise')) return '🌅';
  if (lower.includes('yoga') || lower.includes('meditat') || lower.includes('breath') || lower.includes('zen') || lower.includes('mindful')) return '🧘';
  if (lower.includes('breakfast') || lower.includes('egg') || lower.includes('toast') || lower.includes('cereal')) return '🍳';
  if (lower.includes('lunch') || lower.includes('salad') || lower.includes('sandwich')) return '🥗';
  if (lower.includes('dinner') || lower.includes('supper') || lower.includes('cook') || lower.includes('meal')) return '🍲';
  if (lower.includes('coffee') || lower.includes('espresso') || lower.includes('latte')) return '☕';
  if (lower.includes('tea') || lower.includes('matcha')) return '🍵';
  if (lower.includes('gym') || lower.includes('workout') || lower.includes('lift') || lower.includes('weight') || lower.includes('pushup') || lower.includes('chest') || lower.includes('leg day')) return '🏋️';
  if (lower.includes('run') || lower.includes('jog') || lower.includes('sprint')) return '🏃';
  if (lower.includes('walk') || lower.includes('step') || lower.includes('stroll')) return '🚶';
  if (lower.includes('bike') || lower.includes('cycl')) return '🚴';
  if (lower.includes('swim')) return '🏊';
  if (lower.includes('stretch') || lower.includes('flexib')) return '🤸';
  if (lower.includes('sleep') || lower.includes('bed') || lower.includes('rest') || lower.includes('night') || lower.includes('lights out')) return '🛌';
  if (lower.includes('book') || lower.includes('read') || lower.includes('study') || lower.includes('learn')) return '📚';
  if (lower.includes('code') || lower.includes('laptop') || lower.includes('programm') || lower.includes('develop')) return '💻';
  if (lower.includes('meet') || lower.includes('sync') || lower.includes('standup') || lower.includes('zoom') || lower.includes('call') || lower.includes('work')) return '💼';
  if (lower.includes('clean') || lower.includes('laundry') || lower.includes('tidy') || lower.includes('chore') || lower.includes('dishes')) return '🧹';
  if (lower.includes('shower') || lower.includes('bath') || lower.includes('brush') || lower.includes('floss') || lower.includes('teeth')) return '🧼';
  if (lower.includes('journal') || lower.includes('diary') || lower.includes('write') || lower.includes('plan')) return '📓';
  if (lower.includes('money') || lower.includes('budget') || lower.includes('bill') || lower.includes('financ')) return '💰';
  if (lower.includes('pill') || lower.includes('vitamin') || lower.includes('medicin') || lower.includes('supplement')) return '💊';
  if (lower.includes('music') || lower.includes('guitar') || lower.includes('piano')) return '🎸';

  // Category fallback
  switch (category.toLowerCase()) {
    case 'health': return '🍏';
    case 'fitness': return '⚡';
    case 'mind': return '🧘';
    case 'work': return '💡';
    case 'personal': return '❤️';
    case 'finance': return '💰';
    default: return '⏰';
  }
}

/**
 * Infer category from title and text keywords.
 */
export function inferCategory(title: string, availableCategories: string[] = []): string {
  const lower = title.toLowerCase();

  // Explicit bracket match: [Category] or (Category)
  const bracketMatch = title.match(/[\[\(\{#]([A-Za-z0-9_\s]{2,20})[\]\)\}]/);
  if (bracketMatch) {
    const rawCat = bracketMatch[1].trim();
    const matched = availableCategories.find(c => c.toLowerCase() === rawCat.toLowerCase());
    if (matched) return matched;
    if (rawCat.length <= 15) return rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
  }

  // Keywords
  if (lower.includes('yoga') || lower.includes('meditat') || lower.includes('breath') || lower.includes('zen') || lower.includes('journal') || lower.includes('gratitude') || lower.includes('prayer') || lower.includes('mindful')) {
    return availableCategories.find(c => c.toLowerCase() === 'mind') || 'Mind';
  }
  if (lower.includes('gym') || lower.includes('workout') || lower.includes('run') || lower.includes('walk') || lower.includes('exercise') || lower.includes('stretch') || lower.includes('fitness') || lower.includes('cardio') || lower.includes('swim') || lower.includes('cycl')) {
    return availableCategories.find(c => c.toLowerCase() === 'fitness') || 'Fitness';
  }
  if (lower.includes('work') || lower.includes('meet') || lower.includes('standup') || lower.includes('client') || lower.includes('code') || lower.includes('project') || lower.includes('email') || lower.includes('office') || lower.includes('focus') || lower.includes('study')) {
    return availableCategories.find(c => c.toLowerCase() === 'work') || 'Work';
  }
  if (lower.includes('water') || lower.includes('breakfast') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('meal') || lower.includes('vitamin') || lower.includes('sleep') || lower.includes('bed') || lower.includes('health') || lower.includes('pill') || lower.includes('tea') || lower.includes('coffee') || lower.includes('shower')) {
    return availableCategories.find(c => c.toLowerCase() === 'health') || 'Health';
  }
  if (lower.includes('budget') || lower.includes('finance') || lower.includes('bill') || lower.includes('money') || lower.includes('bank') || lower.includes('invest')) {
    return availableCategories.find(c => c.toLowerCase() === 'finance') || 'Finance';
  }

  return availableCategories[0] || 'Routine';
}

/**
 * Infer alarm chime based on category and title.
 */
export function inferAlarmSound(category: string, title: string): string {
  const lower = `${title} ${category}`.toLowerCase();
  if (lower.includes('music box') || lower.includes('lullaby') || lower.includes('bed') || lower.includes('sleep') || lower.includes('night') || lower.includes('unwind')) {
    return 'music_box';
  }
  if (lower.includes('siren') || lower.includes('scifi') || lower.includes('urgent') || lower.includes('emergency') || lower.includes('critical')) {
    return 'scifi_siren';
  }
  if (lower.includes('digital') || lower.includes('beep') || lower.includes('clock') || lower.includes('loud alarm')) {
    return 'digital_beep';
  }
  if (lower.includes('wake') || lower.includes('morning') || lower.includes('rise')) {
    return 'morning_breeze';
  }
  if (lower.includes('meditat') || lower.includes('yoga') || lower.includes('zen')) {
    return 'zen_bell';
  }
  if (lower.includes('workout') || lower.includes('gym') || lower.includes('run') || lower.includes('fitness')) {
    return 'energetic_beep';
  }
  if (lower.includes('work') || lower.includes('focus') || lower.includes('meet') || lower.includes('standup')) {
    return 'digital_pulse';
  }
  return 'soft_chime';
}

/**
 * Detect repeat days from string (e.g. "Mon-Fri", "Weekdays", "Weekends", "Mon, Wed, Fri").
 */
export function parseRepeatDays(text: string, defaultDays: number[] = [0, 1, 2, 3, 4, 5, 6]): number[] {
  const lower = text.toLowerCase();

  if (lower.includes('weekday') || lower.includes('workday') || lower.includes('mon-fri') || lower.includes('mon - fri') || lower.includes('monday to friday')) {
    return [1, 2, 3, 4, 5];
  }
  if (lower.includes('weekend') || lower.includes('sat-sun') || lower.includes('sat, sun') || lower.includes('saturday and sunday')) {
    return [0, 6];
  }
  if (lower.includes('daily') || lower.includes('everyday') || lower.includes('every day') || lower.includes('all days')) {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  const daysFound = new Set<number>();
  const dayPatterns: [RegExp, number][] = [
    [/\b(sun|sunday)\b/i, 0],
    [/\b(mon|monday)\b/i, 1],
    [/\b(tue|tues|tuesday)\b/i, 2],
    [/\b(wed|wednesday)\b/i, 3],
    [/\b(thu|thur|thurs|thursday)\b/i, 4],
    [/\b(fri|friday)\b/i, 5],
    [/\b(sat|saturday)\b/i, 6],
  ];

  for (const [regex, idx] of dayPatterns) {
    if (regex.test(lower)) {
      daysFound.add(idx);
    }
  }

  if (daysFound.size > 0) {
    return Array.from(daysFound).sort();
  }

  return defaultDays;
}

/**
 * Clean task title from markdown, numbering prefixes, brackets, and extra punctuation.
 */
function cleanTitle(title: string): string {
  return title
    // Strip leading list numbering like "1.", "1)", "01.", "A.", "[1]" (only when followed by space to preserve "7.30")
    .replace(/^(?:\[\d+\]|\d+[\.\)](?=\s)|[a-zA-Z][\.\)](?=\s)|\-|\*|•|→|–|—)\s*/g, '')
    // Strip markdown brackets/checkboxes like "- [ ]", "- [x]"
    .replace(/^\[[ xX]\]\s*/g, '')
    // Strip conversational intros like "I usually", "I will", "Then I", "Around"
    .replace(/^(?:i\s+(?:usually|will|always|have to|plan to)?\s*|(?:then|and|around|about)\s+)/gi, '')
    // Strip trailing/leading punctuation
    .replace(/^[\s\-–—:|~@,]+|[\s\-–—:|~@,]+$/g, '')
    // Clean up double spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a single line or segment into a ParsedScheduleCandidate if time is found.
 */
function parseSingleSegment(
  segment: string,
  availableCategories: string[],
  activeSectionDays: number[]
): ParsedScheduleCandidate | null {
  let text = segment.replace(/^\|\s*/, '').replace(/\s*\|$/, '');

  // 1. Check for special words: "noon" / "midnight"
  if (/\b(?:12\s*)?noon\b/i.test(text)) {
    const title = cleanTitle(text.replace(/\b(?:at\s+)?(?:12\s*)?noon\b/gi, ''));
    if (title) {
      const category = inferCategory(title, availableCategories);
      return {
        title,
        time: '12:00',
        category,
        emoji: inferEmoji(title, category),
        alarmEnabled: true,
        alarmSound: inferAlarmSound(category, title),
        days: parseRepeatDays(segment, activeSectionDays),
        rawLine: segment,
        selected: true,
      };
    }
  }
  if (/\b(?:12\s*)?midnight\b/i.test(text)) {
    const title = cleanTitle(text.replace(/\b(?:at\s+)?(?:12\s*)?midnight\b/gi, ''));
    if (title) {
      const category = inferCategory(title, availableCategories);
      return {
        title,
        time: '00:00',
        category,
        emoji: inferEmoji(title, category),
        alarmEnabled: true,
        alarmSound: inferAlarmSound(category, title),
        days: parseRepeatDays(segment, activeSectionDays),
        rawLine: segment,
        selected: true,
      };
    }
  }

  // Strip list prefixes safely (requiring space after dot or paren so "7.30" is preserved)
  const textWithoutListPrefix = text.replace(
    /^(?:\[\d+\]|\d+[\.\)](?=\s)|[a-zA-Z][\.\)](?=\s)|\-|\*|•|→|–|—)\s*/,
    ''
  );

  let hour = -1;
  let min = 0;
  let meridiem: string | undefined;
  let title = '';

  // Pattern A: Time at the beginning with colon or dot:
  // "07:00 AM - Yoga", "7.30am Breakfast", "7:00-8:00 AM Gym", "10:00 Standup", "6am Workout", "6 am: Run", "19.30 Dinner"
  const startRegex = /^(?:at\s+)?(\d{1,2})[:.](\d{2})\s*(am|pm|a\.m\.|p\.m\.)?(?:\s*(?:[-–—~]|to)\s*\d{1,2}[:.]\d{2}\s*(?:am|pm|a\.m\.|p\.m\.)?)?\s*(?:[-–—:|~@]\s*)?(.*)$/i;
  let match = textWithoutListPrefix.match(startRegex);
  if (match) {
    hour = parseInt(match[1], 10);
    min = parseInt(match[2], 10);
    meridiem = match[3];
    title = cleanTitle(match[4]);
  }

  // Pattern B: Simple hour with am/pm at beginning: "7am - Morning stretch", "7 am Breakfast", "6am-7am Gym", "8 PM: Dinner"
  if (hour === -1) {
    const startHourOnlyRegex = /^(?:at\s+)?(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)(?:\s*(?:[-–—~]|to)\s*\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)?\s*(?:[-–—:|~@]\s*)?(.*)$/i;
    match = textWithoutListPrefix.match(startHourOnlyRegex);
    if (match) {
      hour = parseInt(match[1], 10);
      min = 0;
      meridiem = match[2];
      title = cleanTitle(match[3]);
    }
  }

  // Pattern C: Military 4-digit time at start: "0700 Wake up", "1930 Dinner", "0700hrs Breakfast"
  if (hour === -1) {
    const militaryRegex = /^(\d{2})(\d{2})\s*(?:hrs|hours)?\s*(?:[-–—:|~@]\s*)?(.*)$/i;
    match = textWithoutListPrefix.match(militaryRegex);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        hour = h;
        min = m;
        title = cleanTitle(match[3]);
      }
    }
  }

  // Pattern D: Time range at start with hours only: "6 - 7 gym", "6 to 7am running"
  if (hour === -1) {
    const rangeHoursRegex = /^(\d{1,2})\s*(?:am|pm)?\s*(?:[-–—~]|to)\s*(\d{1,2})\s*(am|pm)?\s*(?:[-–—:|~@]\s*)?(.*)$/i;
    match = textWithoutListPrefix.match(rangeHoursRegex);
    if (match) {
      hour = parseInt(match[1], 10);
      min = 0;
      meridiem = match[3];
      title = cleanTitle(match[4]);
    }
  }

  // Pattern E: Time embedded with "at", "@", "around":
  // "Wake up at 6:30am and drink water", "I do yoga at 7:00 AM every morning", "Breakfast at 8:30"
  if (hour === -1) {
    const embeddedRegex = /(.*?)\b(?:at|around|@)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\b(.*)/i;
    match = textWithoutListPrefix.match(embeddedRegex);
    if (match) {
      hour = parseInt(match[2], 10);
      min = match[3] ? parseInt(match[3], 10) : 0;
      meridiem = match[4];
      title = cleanTitle(`${match[1]} ${match[5]}`);
    }
  }

  // Pattern F: Time at the end of the text:
  // "Wake up - 6:00 AM", "Morning Yoga 7:30 AM", "Breakfast at 8:00 AM", "Dinner 8:00", "Bed 10:30pm"
  if (hour === -1) {
    const endRegex = /^(.*?)(?:[ \t]+(?:at|@|around|by|from)?\s*[-–—:]?\s*)(\d{1,2})[:.](\d{2})\s*(am|pm|a\.m\.|p\.m\.)?$/i;
    match = textWithoutListPrefix.match(endRegex);
    if (match) {
      title = cleanTitle(match[1]);
      hour = parseInt(match[2], 10);
      min = parseInt(match[3], 10);
      meridiem = match[4];
    }
  }

  // Pattern G: Simple hour at the end: "Wake up 6am", "Gym 6pm", "Dinner 8"
  if (hour === -1) {
    const endHourOnlyRegex = /^(.*?)(?:[ \t]+(?:at|@|around|by)?\s*[-–—:]?\s*)(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)?$/i;
    match = textWithoutListPrefix.match(endHourOnlyRegex);
    if (match) {
      const candidateTitle = cleanTitle(match[1]);
      const candidateHour = parseInt(match[2], 10);
      const candidateMeridiem = match[3];
      if (
        candidateTitle &&
        candidateHour >= 1 &&
        candidateHour <= 24 &&
        (candidateMeridiem || /wake|sleep|bed|lunch|dinner|breakfast|night|gym/i.test(candidateTitle))
      ) {
        title = candidateTitle;
        hour = candidateHour;
        min = 0;
        meridiem = candidateMeridiem;
      }
    }
  }

  // Pattern H: Markdown table row: "| 07:00 | Morning Yoga | Health |"
  if (hour === -1) {
    const mdTableRegex = /^\|\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?\s*\|\s*([^|]+)\s*(?:\|\s*([^|]*))?/i;
    match = textWithoutListPrefix.match(mdTableRegex);
    if (match) {
      hour = parseInt(match[1], 10);
      min = parseInt(match[2], 10);
      meridiem = match[3];
      title = cleanTitle(match[4]);
    }
  }

  // Verify and construct candidate
  if (hour >= 0 && hour <= 24 && title.length > 0) {
    const time24 = normalizeTimeTo24h(hour, min, meridiem, title);
    const category = inferCategory(title, availableCategories);
    const emoji = inferEmoji(title, category);
    const alarmSound = inferAlarmSound(category, title);
    const days = parseRepeatDays(segment, activeSectionDays);

    // Clean inline category or day tags from display title
    const displayTitle = title
      .replace(/[\[\(\{][A-Za-z0-9_\s]{2,15}[\]\)\}]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      title: displayTitle || title,
      time: time24,
      category,
      emoji,
      alarmEnabled: true,
      alarmSound,
      days,
      rawLine: segment,
      selected: true,
    };
  }

  return null;
}

/**
 * Split a multi-item line or paragraph into individual task clauses.
 */
function splitMultiItemLine(line: string): string[] {
  // Check if line contains sentence boundaries followed by time, or clauses
  const sentences = line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/g);
  const result: string[] = [];

  for (const sent of sentences) {
    const parts = sent.split(
      /(?:[;\n|]|\band\s+then\b|\bthen\b|(?<=[a-zA-Z\)])\s*,\s*(?=(?:at\s+)?(?:\d{1,2}[:.]\d{2}|\d{1,2}\s*(?:am|pm))))/gi
    );
    for (const p of parts) {
      if (p.trim()) result.push(p.trim());
    }
  }

  return result.length > 0 ? result : [line];
}

/**
 * Universal text parser: Handles natural language notes, markdown, bullet lists, timetables, paragraphs.
 */
function parseNaturalTextLines(content: string, availableCategories: string[]): ParsedScheduleCandidate[] {
  const lines = content.split(/\r?\n/);
  const results: ParsedScheduleCandidate[] = [];

  let activeSectionDays = [0, 1, 2, 3, 4, 5, 6];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      // Check if header specifies repeat days (e.g. "## Weekday Routine" or "Monday - Friday:")
      if (trimmed) {
        activeSectionDays = parseRepeatDays(trimmed, activeSectionDays);
      }
      continue;
    }

    // Skip markdown table separators
    if (/^\|\s*-+\s*\|\s*-+/i.test(trimmed) || /^\|\s*time\s*\|/i.test(trimmed)) continue;

    // Check if line is a section label (e.g. "Weekdays:", "Mon-Fri:", "Weekend:")
    if (/^(?:weekdays|weekends|mon-fri|monday to friday|daily):?$/i.test(trimmed)) {
      activeSectionDays = parseRepeatDays(trimmed, activeSectionDays);
      continue;
    }

    // Split line into sub-segments if it contains multiple tasks
    const subSegments = splitMultiItemLine(trimmed);
    for (const sub of subSegments) {
      const candidate = parseSingleSegment(sub, availableCategories, activeSectionDays);
      if (candidate) {
        results.push(candidate);
      }
    }
  }

  return results;
}

/**
 * Parse JSON format schedules.
 */
function tryParseJson(content: string, availableCategories: string[]): ParsedScheduleCandidate[] | null {
  try {
    const trimmed = content.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return null;

    const data = JSON.parse(trimmed);
    const list = Array.isArray(data)
      ? data
      : (data.schedule || data.items || data.tasks || data.routines || data.events);

    if (!Array.isArray(list) || list.length === 0) return null;

    const results: ParsedScheduleCandidate[] = [];

    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const rawTime = item.time || item.hour || item.alarmTime || item.startTime || item.at;
      const rawTitle = item.title || item.name || item.task || item.event || item.description;

      if (!rawTime || !rawTitle) continue;

      const timeMatch = String(rawTime).match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
      if (!timeMatch) continue;

      const hour = parseInt(timeMatch[1], 10);
      const min = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3];
      const time24 = normalizeTimeTo24h(hour, min, meridiem, String(rawTitle));

      const category = item.category || inferCategory(String(rawTitle), availableCategories);
      const emoji = item.emoji || inferEmoji(String(rawTitle), category);
      const alarmSound = item.alarmSound || inferAlarmSound(category, String(rawTitle));
      const days = Array.isArray(item.days) && item.days.length > 0 ? item.days : [0, 1, 2, 3, 4, 5, 6];

      results.push({
        title: String(rawTitle).trim(),
        time: time24,
        category,
        emoji,
        alarmEnabled: item.alarmEnabled !== false,
        alarmSound,
        days,
        selected: true,
      });
    }

    return results.length > 0 ? results : null;
  } catch {
    return null;
  }
}

/**
 * Parse iCalendar (.ics) format files.
 */
function tryParseIcs(content: string, availableCategories: string[]): ParsedScheduleCandidate[] | null {
  if (!content.includes('BEGIN:VCALENDAR') && !content.includes('BEGIN:VEVENT')) {
    return null;
  }

  const events = content.split('BEGIN:VEVENT');
  if (events.length <= 1) return null;

  const results: ParsedScheduleCandidate[] = [];

  for (let i = 1; i < events.length; i++) {
    const block = events[i].split('END:VEVENT')[0];
    const summaryMatch = block.match(/SUMMARY(?::|;[^:]*:)(.*)/i);
    const title = summaryMatch ? summaryMatch[1].replace(/\\,/g, ',').trim() : 'Scheduled Event';

    const dtMatch = block.match(/DTSTART(?::|;[^:]*:)(?:[0-9]{8}T)?([0-9]{2})([0-9]{2})/i);
    if (!dtMatch) continue;

    const hour = parseInt(dtMatch[1], 10);
    const min = parseInt(dtMatch[2], 10);
    const time24 = normalizeTimeTo24h(hour, min, undefined, title);

    const rruleMatch = block.match(/RRULE:.*BYDAY=([A-Z,]+)/i);
    let days = [0, 1, 2, 3, 4, 5, 6];
    if (rruleMatch) {
      days = parseRepeatDays(rruleMatch[1]);
    }

    const category = inferCategory(title, availableCategories);
    const emoji = inferEmoji(title, category);
    const alarmSound = inferAlarmSound(category, title);

    results.push({
      title,
      time: time24,
      category,
      emoji,
      alarmEnabled: true,
      alarmSound,
      days,
      selected: true,
    });
  }

  return results.length > 0 ? results : null;
}

/**
 * Parse CSV or TSV format lines.
 */
function tryParseCsv(content: string, availableCategories: string[]): ParsedScheduleCandidate[] | null {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return null;

  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
  else if (firstLine.includes('|')) delimiter = '|';

  const headerCells = firstLine.split(delimiter).map(c => c.replace(/["']/g, '').trim().toLowerCase());

  let timeCol = headerCells.findIndex(c => c.includes('time') || c.includes('hour') || c.includes('start') || c.includes('clock'));
  let titleCol = headerCells.findIndex(c => c.includes('title') || c.includes('task') || c.includes('event') || c.includes('name') || c.includes('activity') || c.includes('routine'));
  let categoryCol = headerCells.findIndex(c => c.includes('cat') || c.includes('tag'));
  let daysCol = headerCells.findIndex(c => c.includes('day') || c.includes('repeat') || c.includes('freq'));
  let soundCol = headerCells.findIndex(c => c.includes('sound') || c.includes('chime') || c.includes('alarm'));
  let emojiCol = headerCells.findIndex(c => c.includes('emoji') || c.includes('icon'));

  const hasHeader = timeCol !== -1 || titleCol !== -1;
  const startRow = hasHeader ? 1 : 0;

  const results: ParsedScheduleCandidate[] = [];

  for (let i = startRow; i < lines.length; i++) {
    const rawCells = lines[i].split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
    if (rawCells.length < 2) continue;

    let tCol = timeCol;
    let nCol = titleCol;

    if (!hasHeader) {
      tCol = rawCells.findIndex(c => /(\d{1,2})[:.](\d{2})|(\d{1,2})\s*(am|pm)/i.test(c));
      if (tCol === -1) continue;
      nCol = tCol === 0 ? 1 : 0;
    }

    if (tCol === -1 || nCol === -1 || !rawCells[tCol] || !rawCells[nCol]) continue;

    const timeMatch = rawCells[tCol].match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
    if (!timeMatch) continue;

    const hour = parseInt(timeMatch[1], 10);
    const min = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3];
    const title = rawCells[nCol];
    const time24 = normalizeTimeTo24h(hour, min, meridiem, title);

    const category = (categoryCol !== -1 && rawCells[categoryCol])
      ? rawCells[categoryCol]
      : inferCategory(title, availableCategories);

    const emoji = (emojiCol !== -1 && rawCells[emojiCol])
      ? rawCells[emojiCol]
      : inferEmoji(title, category);

    const alarmSound = (soundCol !== -1 && rawCells[soundCol])
      ? rawCells[soundCol]
      : inferAlarmSound(category, title);

    const days = (daysCol !== -1 && rawCells[daysCol])
      ? parseRepeatDays(rawCells[daysCol])
      : parseRepeatDays(title);

    results.push({
      title,
      time: time24,
      category,
      emoji,
      alarmEnabled: true,
      alarmSound,
      days,
      selected: true,
    });
  }

  return results.length > 0 ? results : null;
}

/**
 * Master file reader and parser.
 * Handles:
 * - JSON (.json)
 * - iCalendar (.ics)
 * - CSV / TSV (.csv, .tsv)
 * - Plain Text, Natural Language & Markdown (.txt, .md, text lists, chat messages, paragraphs)
 */
export function parseScheduleFile(
  content: string,
  fileName: string = 'schedule.txt',
  availableCategories: string[] = ['Health', 'Mind', 'Work', 'Personal', 'Fitness', 'Finance']
): ParseResult {
  const warnings: string[] = [];
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  let detectedFormat = 'Plain Text Schedule';
  let items: ParsedScheduleCandidate[] = [];

  // 1. JSON check
  if (ext === 'json' || content.trim().startsWith('[') || content.trim().startsWith('{')) {
    const jsonItems = tryParseJson(content, availableCategories);
    if (jsonItems && jsonItems.length > 0) {
      detectedFormat = 'JSON Schedule Data';
      items = jsonItems;
    }
  }

  // 2. ICS check
  if (items.length === 0 && (ext === 'ics' || content.includes('BEGIN:VCALENDAR') || content.includes('BEGIN:VEVENT'))) {
    const icsItems = tryParseIcs(content, availableCategories);
    if (icsItems && icsItems.length > 0) {
      detectedFormat = 'iCalendar (.ics) Routine';
      items = icsItems;
    }
  }

  // 3. CSV / TSV check
  if (items.length === 0 && (ext === 'csv' || ext === 'tsv' || content.includes(','))) {
    const csvItems = tryParseCsv(content, availableCategories);
    if (csvItems && csvItems.length >= 2) {
      detectedFormat = 'CSV / Delimited Table';
      items = csvItems;
    }
  }

  // 4. Universal natural text / Markdown / freeform parser
  if (items.length === 0) {
    items = parseNaturalTextLines(content, availableCategories);
    if (ext === 'md' || content.includes('##') || content.includes('- [ ]')) {
      detectedFormat = 'Markdown Task Routine';
    } else {
      detectedFormat = 'Plain Text Timetable';
    }
  }

  // Sort chronologically by time (00:00 to 23:59)
  items.sort((a, b) => a.time.localeCompare(b.time));

  if (items.length === 0) {
    warnings.push(
      'Could not detect any time-stamped schedule routines. You can paste times in any format (e.g. "07:00 AM - Yoga", "7.30am Breakfast", "Wake up at 6am", or a conversational paragraph).'
    );
  }

  return {
    items,
    detectedFormat,
    totalLinesScanned: lines.length,
    warnings,
  };
}

/**
 * AI-assisted schedule parser connecting to Gemini backend.
 * Falls back gracefully to local parser if offline or unavailable.
 */
export async function parseScheduleWithAI(
  content: string,
  availableCategories: string[] = ['Health', 'Mind', 'Work', 'Personal', 'Fitness', 'Finance']
): Promise<ParseResult> {
  // First, always compute local parsing as baseline
  const localResult = parseScheduleFile(content, 'schedule.txt', availableCategories);

  try {
    const res = await fetch('/api/parse-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: content,
        availableCategories,
      }),
    });

    if (!res.ok) {
      return localResult;
    }

    const data = await res.json();
    if (data && Array.isArray(data.items) && data.items.length > 0) {
      const candidates: ParsedScheduleCandidate[] = data.items.map((item: any) => {
        const timeMatch = String(item.time || '').match(/(\d{1,2}):(\d{2})/);
        const hour = timeMatch ? parseInt(timeMatch[1], 10) : 8;
        const min = timeMatch ? parseInt(timeMatch[2], 10) : 0;
        const time24 = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

        const category = item.category || inferCategory(item.title || '', availableCategories);
        const emoji = item.emoji || inferEmoji(item.title || '', category);
        const alarmSound = item.alarmSound || inferAlarmSound(category, item.title || '');
        const days = Array.isArray(item.days) && item.days.length > 0 ? item.days : [0, 1, 2, 3, 4, 5, 6];

        return {
          title: String(item.title || 'Routine Task').trim(),
          time: time24,
          category,
          emoji,
          alarmEnabled: true,
          alarmSound,
          days,
          selected: true,
        };
      });

      candidates.sort((a, b) => a.time.localeCompare(b.time));

      return {
        items: candidates,
        detectedFormat: data.detectedFormat || 'Gemini AI Semantic Understanding ✨',
        totalLinesScanned: content.split(/\r?\n/).length,
        warnings: [],
      };
    }
  } catch (err) {
    console.warn('AI schedule parsing failed, using enhanced local result:', err);
  }

  return localResult;
}

export interface AIRoutineGenerationResult {
  summary: string;
  items: ParsedScheduleCandidate[];
  modelUsed?: string;
}

/**
 * Generate a complete custom daily routine from a high-level goal using Gemini AI.
 */
export async function generateRoutineWithAI(
  goal: string,
  availableCategories: string[] = ['Health', 'Mind', 'Work', 'Personal', 'Fitness', 'Finance'],
  wakeTime?: string,
  sleepTime?: string
): Promise<AIRoutineGenerationResult> {
  const res = await fetch('/api/generate-routine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal,
      availableCategories,
      wakeTime,
      sleepTime,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to generate routine: ${res.statusText}`);
  }

  const data = await res.json();
  const items: ParsedScheduleCandidate[] = (data.items || []).map((item: any) => {
    const timeMatch = String(item.time || '').match(/(\d{1,2}):(\d{2})/);
    const hour = timeMatch ? parseInt(timeMatch[1], 10) : 8;
    const min = timeMatch ? parseInt(timeMatch[2], 10) : 0;
    const time24 = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

    const category = item.category || inferCategory(item.title || '', availableCategories);
    const emoji = item.emoji || inferEmoji(item.title || '', category);
    const alarmSound = item.alarmSound || inferAlarmSound(category, item.title || '');
    const days = Array.isArray(item.days) && item.days.length > 0 ? item.days : [0, 1, 2, 3, 4, 5, 6];

    return {
      title: String(item.title || 'Routine Task').trim(),
      time: time24,
      category,
      emoji,
      alarmEnabled: true,
      alarmSound,
      days,
      selected: true,
    };
  });

  items.sort((a, b) => a.time.localeCompare(b.time));

  return {
    summary: data.summary || 'Custom routine generated by Gemini AI',
    items,
    modelUsed: data.modelUsed,
  };
}

export interface AICoachResult {
  score: number;
  strength: string;
  suggestion: string;
  microHabit: string;
}

/**
 * Ask Gemini AI coach to analyze and optimize the user's current schedule & habits.
 */
export async function getCoachAdviceWithAI(
  scheduleItems: ScheduleItem[],
  habits: any[]
): Promise<AICoachResult> {
  const res = await fetch('/api/coach-schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduleItems, habits }),
  });

  if (!res.ok) {
    throw new Error('Failed to retrieve AI coach advice');
  }

  return res.json();
}

/**
 * Sample schedule templates that users can test or copy.
 */
export const SAMPLE_SCHEDULE_TEMPLATES = [
  {
    name: 'Daily Productive Routine (Plain Text)',
    description: 'Clean standard natural list with emojis and time stamps',
    text: `06:30 AM - Morning Wakeup & Glass of Water
07:00 AM - 15 min Yoga & Mindfulness (Mind)
08:00 AM - Healthy High-Protein Breakfast (Health)
09:00 AM - Daily Standup & Priority Planning (Work) [Weekdays]
12:30 PM - Nutritious Lunch & 15m Walk (Health)
03:00 PM - Afternoon Hydration & Tea Break
06:00 PM - Gym Workout & Cardio (Fitness) [Mon, Wed, Fri]
08:00 PM - Dinner with Family (Personal)
09:30 PM - 20 Pages Reading Book (Mind)
10:30 PM - Sleep & Lights Out (Health)`,
  },
  {
    name: 'Casual / Dotted Times & Freeform',
    description: 'Uses dot time notation, natural language, and ranges',
    text: `Wake up at 6.30am and drink water
7.00 AM Morning stretch & yoga
8.15 AM - Breakfast
9.00 - 12.30 Deep work session
Lunch at 1pm
Gym at 6.00 PM (Fitness)
Dinner at 8.30
Sleep by 10.45pm`,
  },
  {
    name: 'Work & Focus (24-Hour Military Format)',
    description: 'Strict military/24-hour format with categories',
    text: `06:00 Sunrise Meditation
07:30 Breakfast and Coffee
09:00 Deep Focus Session 1 (Work) [Mon-Fri]
11:30 Standup Sync (Work) [Mon-Fri]
13:00 Lunch and Stretches
14:30 Code Review and Planning (Work)
17:00 Evening Run (Fitness)
19:30 Dinner
22:00 Bedtime Routine`,
  },
  {
    name: 'Conversational Paragraph',
    description: 'Unstructured natural story or diary entry',
    text: `I wake up at 6am every day, do yoga at 6:30am, eat breakfast at 8am, start work at 9:00am until 5pm. Go to gym at 6pm, have dinner at 8:30pm, and sleep at 10:30pm.`,
  },
];

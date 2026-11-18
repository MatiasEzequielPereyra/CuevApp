const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mention offsets are zero-based Unicode code-point offsets, end-exclusive.
 * This matches PostgreSQL char_length/substr semantics. DOM selection offsets
 * are UTF-16 code units, so callers must convert at the textarea boundary.
 */
export type RoutineMention = {
  exercise_id: string;
  start: number;
  end: number;
  text: string;
};

export function utf16OffsetToCodePoint(text: string, offset: number): number {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > text.length) {
    throw new RangeError("Offset UTF-16 fuera del texto.");
  }
  const previous = text.charCodeAt(offset - 1);
  const next = text.charCodeAt(offset);
  if (previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
    throw new RangeError("El cursor no puede dividir un carácter Unicode.");
  }
  return Array.from(text.slice(0, offset)).length;
}

export function codePointOffsetToUtf16(text: string, offset: number): number {
  const points = Array.from(text);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > points.length) {
    throw new RangeError("Offset Unicode fuera del texto.");
  }
  return points.slice(0, offset).join("").length;
}

export function codePointSlice(text: string, start: number, end: number): string {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
    throw new RangeError("Rango Unicode inválido.");
  }
  return Array.from(text).slice(start, end).join("");
}

/** Validates canonical, non-overlapping references without changing their order. */
export function validateRoutineMentions(
  content: string,
  value: unknown,
  maximum = 300,
): RoutineMention[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new TypeError("La lista de menciones no es válida.");
  }
  const length = Array.from(content).length;
  let previousEnd = 0;
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new TypeError("Mención inválida.");
    const mention = entry as Record<string, unknown>;
    if (
      typeof mention.exercise_id !== "string" ||
      !uuid.test(mention.exercise_id) ||
      !Number.isSafeInteger(mention.start) ||
      !Number.isSafeInteger(mention.end) ||
      (mention.start as number) < previousEnd ||
      (mention.end as number) <= (mention.start as number) ||
      (mention.end as number) > length ||
      typeof mention.text !== "string" ||
      mention.text.length === 0 ||
      codePointSlice(content, mention.start as number, mention.end as number) !== mention.text
    ) {
      throw new TypeError("Las referencias deben coincidir con el texto y no superponerse.");
    }
    previousEnd = mention.end as number;
    return {
      exercise_id: mention.exercise_id,
      start: mention.start as number,
      end: mention.end as number,
      text: mention.text,
    };
  });
}

/** Keeps references outside the edited span and shifts references after it. */
export function rebaseRoutineMentions(
  previous: string,
  next: string,
  mentions: RoutineMention[],
): RoutineMention[] {
  const oldPoints = Array.from(previous), newPoints = Array.from(next);
  let prefix = 0;
  while (prefix < oldPoints.length && prefix < newPoints.length && oldPoints[prefix] === newPoints[prefix]) prefix++;
  let suffix = 0;
  while (suffix < oldPoints.length - prefix && suffix < newPoints.length - prefix &&
    oldPoints[oldPoints.length - 1 - suffix] === newPoints[newPoints.length - 1 - suffix]) suffix++;
  const oldEnd = oldPoints.length - suffix, delta = newPoints.length - oldPoints.length;
  return mentions.flatMap(mention => {
    if (mention.end <= prefix) return [mention];
    if (mention.start >= oldEnd) return [{ ...mention, start: mention.start + delta, end: mention.end + delta }];
    return [];
  });
}

/** PostgreSQL jsonb may reorder object keys; occurrence order remains meaningful. */
export function routineMentionsKey(mentions: RoutineMention[] = []): string {
  return JSON.stringify(mentions.map(({exercise_id,start,end,text}) => [exercise_id,start,end,text]));
}

const SPOKEN_PUNCTUATION = [
  [/\b(opening|open) parenthesis\b/gi, "("],
  [/\b(closing|close) parenthesis\b/gi, ")"],
  [/\b(opening|open) bracket\b/gi, "["],
  [/\b(closing|close) bracket\b/gi, "]"],
  [/\b(new paragraph|paragraph break)\b/gi, "\n\n"],
  [/\b(full stop|period)\b/gi, "."],
  [/\b(question mark)\b/gi, "?"],
  [/\b(exclamation mark|exclamation point)\b/gi, "!"],
  [/\b(comma)\b/gi, ","],
  [/\b(colon)\b/gi, ":"],
  [/\b(semicolon)\b/gi, ";"],
  [/\b(ellipsis|dot dot dot)\b/gi, "..."],
  [/\b(hyphen)\b/gi, "-"],
  [/\b(dash)\b/gi, "-"],
  [/\b(slash)\b/gi, "/"],
  [/\b(ampersand)\b/gi, "&"],
  [/\b(at sign)\b/gi, "@"],
  [/\b(plus sign)\b/gi, "+"],
  [/\b(equal sign)\b/gi, "="],
  [/\b(open quote|opening quote)\b/gi, '"'],
  [/\b(close quote|closing quote)\b/gi, '"'],
  [/\b(apostrophe)\b/gi, "'"],
];
const VOICE_COMMAND_PATTERN =
  /(?:[\s{(\x5B]*\b(?:stop|next|delete)\b[\s{}().,!?:;"'\x5B\x5D]*)+$/i;

export function normalizeTranscript(text) {
  if (!text) {
    return text;
  }

  let normalized = text;

  for (const [pattern, replacement] of SPOKEN_PUNCTUATION) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized
    .replace(/\{\s*([^\w\s]+?)\s*\}/g, "$1")
    .replace(/[ \t]+([.,!?;:])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1")
    .replace(/[ \t]+\/[ \t]+/g, "/")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

export function extractVoiceCommand(text) {
  const commandSuffix = text?.match(VOICE_COMMAND_PATTERN)?.[0];
  const commands = commandSuffix?.match(/\b(stop|next|delete)\b/gi);
  return commands?.at(-1)?.toLowerCase() || null;
}

export function removeVoiceCommand(text) {
  return text?.replace(VOICE_COMMAND_PATTERN, "").trim() || "";
}

export function removeDeleteCommandWords(text) {
  return (
    text
      ?.replace(/(?:\s*\{\s*)?\bdelete\b(?:\s*\})?/gi, " ")
      .replace(/[ \t]{2,}/g, " ")
      .trim() || ""
  );
}

export function removeNextCommandWords(text) {
  return (
    text
      ?.replace(/(?:\s*\{\s*)?\bnext\b(?:\s*\})?/gi, " ")
      .replace(/[ \t]{2,}/g, " ")
      .trim() || ""
  );
}

export function removeLastSentence(text) {
  const trimmedText = text?.trim() || "";
  if (!trimmedText) {
    return "";
  }

  const boundaries = [...trimmedText.matchAll(/[.!?](?:["')\]}]|\s|$)/g)];
  if (boundaries.length === 0) {
    return "";
  }

  const previousBoundary = boundaries.at(-2);
  if (!previousBoundary) {
    const onlyBoundary = boundaries[0];
    if (onlyBoundary.index + onlyBoundary[0].length < trimmedText.length) {
      return trimmedText
        .slice(0, onlyBoundary.index + onlyBoundary[0].trimEnd().length)
        .trim();
    }
    return "";
  }

  return trimmedText
    .slice(0, previousBoundary.index + previousBoundary[0].trimEnd().length)
    .trim();
}

export function applyTranscriptDeletions(text, deletions) {
  const edit = [...deletions]
    .reverse()
    .find((candidate) => text.startsWith(candidate.source));

  if (!edit) {
    return text;
  }

  return `${edit.replacement}${text.slice(edit.source.length)}`;
}

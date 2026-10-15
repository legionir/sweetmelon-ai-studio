/**
 * Splits a streaming answer into sentences, so each can be spoken as soon as it
 * is complete instead of after the whole answer.
 */

/** End of a sentence: . ! ? … and their Persian/Arabic forms, or a new line. */
const TERMINATORS = /[.!?؟…۔]+["')\]»”]*(\s+|$)|\n+/;

/** Longest stretch without a stop that is still sent as one piece. */
const MAX_LENGTH = 180;

export class SentenceSplitter {
  private buffer = "";

  /** Adds text and returns the sentences that are complete now. */
  push(text: string): string[] {
    this.buffer += text;
    const out: string[] = [];

    for (;;) {
      const match = TERMINATORS.exec(this.buffer);
      if (match) {
        const end = match.index + match[0].length;
        // A stop at the very end of the buffer may be followed by more
        // ("3.5", "..."): wait for the next piece. A new line or a space after
        // it settles it.
        if (end >= this.buffer.length && !/[\s]$/.test(match[0])) break;
        // "3.5" is not a sentence end.
        const next = this.buffer.charAt(end);
        if (match[0] === "." && /\d/.test(next) && /\d$/.test(this.buffer.slice(0, match.index))) {
          break;
        }
        const sentence = this.buffer.slice(0, end).trim();
        this.buffer = this.buffer.slice(end);
        if (sentence) out.push(sentence);
        continue;
      }
      if (this.buffer.length > MAX_LENGTH) {
        const cut = this.cutPoint();
        const piece = this.buffer.slice(0, cut).trim();
        this.buffer = this.buffer.slice(cut);
        if (piece) out.push(piece);
        continue;
      }
      break;
    }
    return out;
  }

  /** What is left when the answer is over. */
  flush(): string[] {
    const rest = this.buffer.trim();
    this.buffer = "";
    return rest ? [rest] : [];
  }

  reset(): void {
    this.buffer = "";
  }

  private cutPoint(): number {
    const head = this.buffer.slice(0, MAX_LENGTH);
    for (const separator of ["،", ",", ";", "؛", ":", " "]) {
      const at = head.lastIndexOf(separator);
      if (at > 40) return at + 1;
    }
    return MAX_LENGTH;
  }
}

/**
 * Takes out what should not be read aloud: markdown marks, code fences, links,
 * emoji. Returns "" when nothing speakable is left.
 */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_#>~|]+/g, " ")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

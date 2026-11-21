// A fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader): run(input) returns
// exactly the answer readCsv returns for the same {text, header} — {columns, rows, errors} —
// only faster. The reference walks the text one character at a time, building every field
// a character at a time; this one jumps between delimiters with indexOf (native code) and
// cuts each field out with slice, so the hot path is a few native scans per field instead
// of a JavaScript step per character.
//
// The broken-row policy is csv-reader's own, followed exactly:
//   - a U+FEFF at the very start is dropped;
//   - a record ends at LF or CRLF; a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (error stray_cr);
//   - a field opening with a quote runs to the next quote that is not doubled ("" inside
//     it is one quote, each CRLF or lone CR inside it reads as LF); what follows its closing
//     quote, up to the next comma or line break, is appended as it stands (quote_junk, when
//     the field ends); a quote that never closes is a literal character and the text after
//     it is read again as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay strings, never
//     trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds the records
//     after it (every record when header is false), each padded with "" (short_row, with
//     fields: its field count) or cut (long_row, with extra: the cut fields) to the first
//     record's width;
//   - each error is {code, line, row}, in the order met, a field's quote_junk when the
//     field ends and a record's short_row or long_row when the record ends: line the 1-based
//     line its record starts on, counting every LF, CRLF and lone CR inside quotes, and row
//     its record's index in rows, null for the header.
//
// Pure: no clock, no randomness, no locale, nothing kept from one call to the next.

/** How a field ended: 0 at a comma (the record goes on), 1 at a line break or 2 at the end of the text (the record ends). */
const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input, {text, header}. */
export function run(input) {
  const t = String(input.text);
  const header = input.header === true;
  const n = t.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (t.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // What the last field read came to: its value, how it ended, and how many characters
  // the last unquoted scan kept (the initial value a scan starts from is not counted).
  let fValue = '';
  let fEnded = END;
  let fAdded = 0;

  // Reads unquoted characters onto `start` up to the next comma or line break: a CR not
  // followed by LF is dropped (stray_cr). Sets fValue, fEnded and fAdded.
  function readUnquoted(start) {
    let value = start;
    let added = 0;
    for (;;) {
      const iC = t.indexOf(',', pos);
      const iL = t.indexOf('\n', pos);
      let m = -1;
      let isLF = false;
      if (iC !== -1 && (iL === -1 || iC < iL)) {
        m = iC;
      } else if (iL !== -1) {
        m = iL;
        isLF = true;
      }
      if (m === -1) {
        // No comma or LF left: the rest of the text is the field, except any lone CR in it.
        const rest = t.slice(pos);
        const iR = rest.indexOf('\r');
        if (iR === -1) {
          value += rest;
          added += rest.length;
          pos = n;
          fValue = value;
          fAdded = added;
          fEnded = END;
          return;
        }
        value += rest.slice(0, iR);
        added += iR;
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        pos = pos + iR + 1;
        continue;
      }
      // A CR inside [pos, m) is a lone one, except a CR at the very end of the segment
      // when m is an LF: that is the CRLF pair whose LF is m.
      const seg = t.slice(pos, m);
      const iR = seg.indexOf('\r');
      if (iR !== -1) {
        if (isLF && iR === seg.length - 1) {
          value += seg.slice(0, iR);
          added += iR;
          pos = m + 1;
          line += 1;
          fValue = value;
          fAdded = added;
          fEnded = LINE_BREAK;
          return;
        }
        value += seg.slice(0, iR);
        added += iR;
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        pos = pos + iR + 1;
        continue;
      }
      value += seg;
      added += seg.length;
      pos = m + 1;
      if (isLF) {
        line += 1;
        fValue = value;
        fAdded = added;
        fEnded = LINE_BREAK;
      } else {
        fValue = value;
        fAdded = added;
        fEnded = COMMA;
      }
      return;
    }
  }

  // Reads a quoted field whose opening quote is at pos. Sets fValue and fEnded.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let start = pos + 1;
    let value = '';
    for (;;) {
      const q = t.indexOf('"', start);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text after it is
        // read again as unquoted. Line is put back: the scan above counted nothing.
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        pos = open + 1;
        line = openLine;
        readUnquoted('"');
        return;
      }
      if (t.charCodeAt(q + 1) === 34) {
        // A doubled quote inside: one quote, and the field goes on.
        value += t.slice(start, q) + '"';
        start = q + 2;
        continue;
      }
      // The closing quote is at q.
      value += t.slice(start, q);
      if (value.indexOf('\n') !== -1 || value.indexOf('\r') !== -1) {
        // Each CRLF or lone CR inside the quotes reads as one LF; count every line
        // break the span held (the collapsed "" pairs hold none).
        const conv = value.replace(/\r\n?/g, '\n');
        let breaks = 0;
        let at = conv.indexOf('\n');
        while (at !== -1) {
          breaks += 1;
          at = conv.indexOf('\n', at + 1);
        }
        line += breaks;
        value = conv;
      }
      pos = q + 1;
      if (pos >= n) {
        fValue = value;
        fEnded = END;
        return;
      }
      const c = t.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        fValue = value;
        fEnded = COMMA;
        return;
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        fValue = value;
        fEnded = LINE_BREAK;
        return;
      }
      if (c === 13 && t.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        fValue = value;
        fEnded = LINE_BREAK;
        return;
      }
      // What follows the closing quote is appended as it stands, up to the next comma
      // or line break.
      readUnquoted(value);
      if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      return;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = t.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && t.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    let ended;
    do {
      if (t.charCodeAt(pos) === 34) {
        quoted = true;
        readQuoted();
      } else {
        quoted = false;
        readUnquoted('');
      }
      fields.push(fValue);
      ended = fEnded;
    } while (ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}

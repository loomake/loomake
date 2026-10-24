// PEMのヘッダだけを有限に保留し、秘密鍵の本文は保持せずに捨てる。
const BEGIN = '-----BEGIN ';
const END = '-----END ';
const KEY = 'PRIVATE KEY';

function prefixTail(text: string, prefix: string): string {
  let size = Math.min(text.length, prefix.length);
  while (size && !prefix.startsWith(text.slice(-size))) size--;
  return size ? text.slice(-size) : '';
}

export function createPrivateKeyFilter(sink: (text: string) => void) {
  let mode: 'normal' | 'header' | 'private' = 'normal';
  let normalTail = ''; let header = ''; let headerTail = ''; let headerDashes = 0; let omitted = false;
  let endPrefix = ''; let endSeen = false; let endTail = ''; let endDashes = 0;
  const emit = (text: string) => { if (text) sink(text); };
  const resetEnd = () => { endPrefix = ''; endSeen = false; endTail = ''; endDashes = 0; };
  const privateChar = (char: string) => {
    if (endSeen) {
      if (/[A-Z ]/.test(char) && !endDashes) { endTail = (endTail + char).slice(-KEY.length); return false; }
      if (char === '-' && endTail === KEY) {
        endDashes++;
        if (endDashes === 5) { resetEnd(); return true; }
        return false;
      }
      resetEnd();
    }
    endPrefix = prefixTail(endPrefix + char, END);
    if (endPrefix === END) { endSeen = true; endPrefix = ''; }
    return false;
  };
  return {
    write: (input: string) => {
      let text = input; let at = 0;
      while (at < text.length) {
        if (mode === 'normal') {
          const combined = normalTail + text.slice(at);
          const begin = combined.indexOf(BEGIN);
          if (begin < 0) {
            normalTail = prefixTail(combined, BEGIN);
            emit(combined.slice(0, combined.length - normalTail.length));
            return;
          }
          emit(combined.slice(0, begin)); normalTail = '';
          header = ''; headerTail = ''; headerDashes = 0; omitted = false; mode = 'header';
          text = combined.slice(begin + BEGIN.length); at = 0;
          continue;
        }
        const char = text[at++];
        if (mode === 'private') { if (privateChar(char)) mode = 'normal'; continue; }
        if (/[A-Z ]/.test(char) && !headerDashes) {
          headerTail = (headerTail + char).slice(-KEY.length);
          if (!omitted) {
            header += char;
            if (header.length > 4096) { emit('***'); header = ''; omitted = true; }
          }
        } else if (char === '-') {
          headerDashes++;
          if (headerDashes === 5) {
            const secret = headerTail === KEY;
            if (!omitted) emit(secret ? '***' : BEGIN + header + '-----');
            mode = secret ? 'private' : 'normal'; resetEnd();
          }
        } else {
          emit(omitted ? char : BEGIN + header + '-'.repeat(headerDashes) + char);
          mode = 'normal';
        }
      }
    },
    end: () => {
      if (mode === 'normal') emit(normalTail);
      else if (mode === 'header' && !omitted) emit(BEGIN + header + '-'.repeat(headerDashes));
      normalTail = ''; header = ''; headerTail = ''; mode = 'normal'; resetEnd();
    },
  };
}

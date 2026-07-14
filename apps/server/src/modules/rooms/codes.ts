// Letters only (no digits), and avoids visually ambiguous I/O.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomCode(length = 4): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export async function generateUniqueRoomCode(exists: (code: string) => Promise<boolean>): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    if (!(await exists(code))) return code;
  }
  throw new Error('Could not generate a unique room code after 10 attempts.');
}

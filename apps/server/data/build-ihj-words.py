import re, sys, gzip
src, out, th = sys.argv[1], sys.argv[2], int(sys.argv[3])
DIAC = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')
ONLY = re.compile('^[ء-غف-ي]+$')
def norm(w):
    w = DIAC.sub('', w)
    w = re.sub('[آأإٱ]', 'ا', w).replace('ى', 'ي').replace('ة', 'ه')
    return w
words = set()
for line in open(src, encoding='utf-8'):
    w, c = line.rstrip('\n').rsplit(' ', 1)
    if int(c) < th: continue
    w = norm(w)
    if not ONLY.match(w) or not (2 <= len(w) <= 20): continue
    if re.search(r'(.)\1\1', w): continue
    words.add(w)
data = '\n'.join(sorted(words)).encode('utf-8')
open(out, 'wb').write(gzip.compress(data, 9))
print(len(words), 'words', len(data), 'bytes raw')

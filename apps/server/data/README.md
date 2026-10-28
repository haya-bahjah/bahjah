# Word lists

## `ihj-words-ar.txt.gz`

The Arabic words إنسان حيوان جماد uses to tell a real answer from gibberish
(`src/modules/games/ihj/lexicon.ts`). One word per line, sorted, gzipped, in
the same folded form the game compares answers in: no diacritics or tatweel,
أ/إ/آ/ٱ as ا, ى as ي, ة as ه.

Built from `content/2018/ar/ar_full.txt` of
[FrequencyWords](https://github.com/hermitdave/FrequencyWords) by Hermit Dave,
itself derived from the [OpenSubtitles2018](http://opus.nlpl.eu/OpenSubtitles2018.php)
corpus, keeping words seen at least twice that are made only of Arabic
letters, 2–20 letters long, with no letter three times in a row:

    python3 build-ihj-words.py ar_full.txt ihj-words-ar.txt.gz 2

FrequencyWords' word lists are licensed
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), and so is this
adapted list. The licence covers this file only, not the code that reads it.

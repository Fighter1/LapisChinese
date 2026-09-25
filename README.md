# Lapis Chinese

Lapis Chinese is a Mandarin adaptation of the
[Lapis](https://github.com/donkuri/lapis) Anki note type. It brings the familiar
Lapis card design and features to Chinese vocabulary and sentence cards, with
support for Pinyin, Zhuyin, and Simplified and Traditional characters.

## Install the APKG

Download `LapisChinese.apkg` from the
[latest GitHub release](https://github.com/caocaochan/LapisChinese/releases/latest),
then import it with **File → Import** in Anki. The package creates a new
`Lapis Chinese` note type with a single `Mining` card template, a `Lapis Chinese`
deck holding one example note (中国, tagged `lapis-chinese::example`), and the
`_lapis_opencc.js` media file used for Simplified/Traditional conversion. It does
not overwrite Japanese Lapis notes.

After importing, select `Lapis Chinese` as the model in Yomitan's **Configure Anki
card format** screen.

## Yomitan field mapping

This is the complete model schema and recommended mapping:

| Field | Yomitan value |
| --- | --- |
| `Expression` | `{expression}` |
| `ExpressionReading` | `{reading}` |
| `ExpressionAudio` | `{audio}` |
| `SelectionText` | `{popup-selection-text}` |
| `MainDefinition` | Your preferred `{single-glossary-...}` dictionary marker |
| `DefinitionPicture` | Optional definition image |
| `Sentence` | `{cloze-prefix}<b>{cloze-body}</b>{cloze-suffix}` |
| `SentenceAudio` | Optional sentence audio |
| `Picture` | Optional sentence or source image |
| `Glossary` | `{glossary}` |
| `Hint` | Optional hint |
| `IsWordAndSentenceCard` | Blank, or `x` for this card mode |
| `IsClickCard` | Blank, or `x` for this card mode |
| `IsSentenceCard` | Blank, or `x` for this card mode |
| `IsAudioCard` | Blank, or `x` for this card mode |
| `Frequency` | `{frequencies}` |
| `FreqSort` | `{frequency-harmonic-rank}` |
| `MiscInfo` | `{document-title}` or other source metadata |

Set at most one `Is…Card` field. With all four blank, the note produces the normal
vocabulary card.

To order new cards by frequency, see
[`docs/manual_reordering.md`](docs/manual_reordering.md), which walks through
sorting on `FreqSort` with the Advanced Browser add-on.

## Build

Requirements: Python 3.10 or newer. The packaging dependency is pinned in
`requirements.txt`.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --requirement requirements.txt
python scripts\build_apkg.py
```

The generated package is written to the ignored `dist/LapisChinese.apkg` path
(pass another path as the first argument to change it). The build verifies the
SHA-256 hash of the vendored OpenCC bundle before packaging it.

Every commit pushed to `main` runs the complete test suite and publishes a
GitHub patch release with this APKG attached. Releases increment from `v1.0.0`
as `v1.0.1`, `v1.0.2`, and so on; a commit that already carries a release tag is
reused, a commit older than an existing tag is refused, and only the current head
of `main` is marked as the latest release. The policy lives in
`scripts/release_policy.py` and is exercised by `tests/test_release_policy.py`.

## Tests

Parser tests use Node's built-in test runner. The browser-rendering tests use the
pinned Playwright development dependency and need a browser: run
`npx playwright install chromium` once, or have Chrome or Edge installed, which
the tests fall back to. The Python tests build a temporary package themselves,
so no prior build step is needed.

```powershell
npm install
npx playwright install chromium
npm run test:all-js
python -m unittest discover -s tests -p "test_*.py"
```

`npm test` runs only the parser tests, and `npm run test:render` only the
browser tests.

The JavaScript suite covers diacritic and numbered Pinyin, compact segmentation,
umlaut spellings, neutral-tone dots and bullets, spaced and compact Zhuyin,
parenthesized and separable-verb annotations, erhua syllables and detached `r`,
pause punctuation in sayings, mismatch and ambiguity handling, reading offsets
across markup, Simplified/Traditional conversion, sentence matching that tolerates
OpenCC variant choices, persistent-page rendering, OpenCC loading and graceful
converter failure, safe template data handling, and Click-card listener cleanup.
The Python suite covers stable Anki model metadata, the field schema, template and
media packaging, the absence of Japanese pitch-accent artifacts, the sample note,
and release ordering.

## Customization

Font sizes, fonts, images, and layout options are CSS variables at the top of
`src/styling.css`. The five Mandarin tone colors are the `--light-mode-tone-*` and
`--dark-mode-tone-*` variables, which default to the Pleco palette. The behavioral
layout variables are documented in
[`docs/user_settings.md`](docs/user_settings.md), which also has the full tone
coloring reference.

## Tone coloring

Tone coloring automatically recognizes Pinyin or Mandarin Zhuyin in
`ExpressionReading`; no setting or extra field is needed. Colors are applied to:

- the vocabulary heading;
- the pronunciation syllables, including tone marks or numbers;
- bold vocabulary in the sentence that matches the expression. The match works
  across scripts, so a Traditional `<b>舉家</b>` in the sentence of a Simplified
  举家 note is colored, and it tolerates a Traditional variant that differs from
  the one OpenCC would produce (`煉金術` where OpenCC gives `鍊金術`).

The smaller Simplified/Traditional variant rows keep their subdued styling.

### Accepted reading formats

- Spaced Pinyin with tone marks or numbers (`zhōng guó`, `zhong1 guo2`), and
  compact Pinyin when it segments uniquely (`zhōngguó`).
- A middle dot or bullet before a syllable marks neutral tone (`jù·zi`,
  `jù ‧ zi`, `zhèng •er`) unless the syllable carries its own tone mark or
  number.
- Separable-verb markers (`shēng ∥ huǒ`, `sheng1//huo3`) and anything in
  parentheses, such as erhua annotations (`pào（～儿）`, `huā (~r)`) or regional
  variants (`xuē (Tw: xiāo) jià`), are ignored.
- An erhua syllable written with its `r` (`jīnr gè` for 今儿个, `huār` for 花儿)
  also covers the following 儿 or 兒, which takes the same tone color.
  Spellings of the erhua sound change (`piàr`, `wèr`) and a detached `r`
  (`dian1 r5`) are accepted.
- Pause punctuation in a saying's reading (`shì bù guān jǐ, gāo gāo guà qǐ`) is
  treated as a space.
- Zhuyin: an unmarked syllable is first tone; a neutral tone uses `˙` before
  the syllable, or after it when attachment is unambiguous. Use spaces if a dot
  could belong to either neighboring syllable, such as `ㄇㄚ ˙ㄇㄚ` for 媽媽.

### What is not colored, and why

The parser fails closed: when it cannot be certain which tone belongs to each
character, it colors nothing and the reading is shown exactly as written. There
is no alternative-reading feature; the card never picks one reading over
another. A card stays uncolored when:

- **The reading lists alternatives.** A slash (`cháng / zhǎng`) stops parsing
  immediately. A comma-separated list (`guān qiǎ, guān kǎ`) is rejected because
  it has more syllables than the expression has characters.
- **The syllable count does not match.** Every Han character in the expression
  needs exactly one syllable, apart from an erhua 儿 covered by its syllable.
  Digits or Latin words in the reading count as unparseable, so full sentences
  with numbers (`34 gè`) are not colored.
- **The reading is ambiguous.** Compact Pinyin that can be split more than one
  way, or a Zhuyin neutral dot that could attach to either neighbor, is
  rejected rather than guessed.
- **The reading is invalid or mixed.** Unknown syllables, mixed Pinyin and
  Zhuyin, Han characters inside the reading, numeric Zhuyin tone notation, and
  non-Mandarin Bopomofo extensions are not supported.

## License and attribution

This project is a derivative of Donkuri's Lapis v1.7.0, created by Ruri, kuri,
itokatsu, and contributors. Lapis Chinese retains the upstream GPL-3.0 license;
see [`LICENSE`](LICENSE). The Pleco tone-to-color mapping is documented in
[Pleco's official manual](https://android.pleco.com/manual/240/dict.html#tone-colors).
Simplified/Traditional conversion uses
[`opencc-js` 1.4.1](https://github.com/nk2028/opencc-js), distributed under its
MIT and third-party licenses in `vendor/opencc-js-1.4.1/`.

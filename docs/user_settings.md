# User settings

Edit these variables near the top of `src/styling.css`, then rebuild the APKG.
Quoted values are required because the template reads them through JavaScript.

## `main-picture-position`

Controls the desktop position of `Picture` relative to the vocabulary header.

- `"right"` (default)
- `"left"`
- `"alt"` — moves it next to the sentence

Use `mobile-main-picture-position` for mobile.

## `sentence-position`

Controls whether the sentence appears above or below the definition box.

- `"above"` (desktop default)
- `"below"`

Use `mobile-sentence-position` for mobile.

## `audio-buttons`

Controls the placement of the replay buttons.

- `"header"` (desktop default)
- `"fixed"`
- `"alt"` — places them with the sentence

Use `mobile-audio-buttons` for mobile.

## `nsfw-blur-contained`

- `"off"` (default) — blur may extend outside the image box
- `"on"` — clips the blur to the image box

Images are blurred when the note has an `NSFW`, `nsfw`, or `Nsfw` tag.

## `open-misc-info`

- `"off"` (default)
- `"on"` — opens the `MiscInfo` details block automatically

## `glossary-separator`

- `"off"` (default)
- `"on"` — draws separators between dictionary entries

## `jitendex-format`

Retained from upstream Lapis for compatible structured glossary data. Use `"full"`
or `"minimal"`; the latter can be combined with space-separated flags:
`no-tags`, `no-sentence`, `no-forms`, `no-xref`, and `no-img`.

## Tone colors

The ten `--light-mode-tone-*` and `--dark-mode-tone-*` variables control the five
Mandarin tones. Changing them does not affect parsing or field data.

The same palette colors the vocabulary heading, Pinyin or Zhuyin pronunciation
syllables, and matching bold vocabulary in both sentence layouts. Pronunciation
tone marks and Pinyin tone numbers take the syllable's color; separators, middle
dots, pause punctuation, and ignored annotations retain their normal color.
Character variant rows keep their existing subdued color.

### Sentence matching

A bold word is matched in either script, so a Traditional `<b>舉家</b>` in the
sentence of a Simplified 举家 note is colored too. The bold word and the
expression are each normalized to Simplified and to Traditional before
comparing, so a sentence spelling that differs from OpenCC's preferred variant
(`煉金術` where OpenCC produces `鍊金術`, `南回歸線` for `南迴歸線`) still
matches. The cross-script match is applied once the OpenCC conversion data has
loaded; before that, only an identical bold word is colored.

### Reading formats

Pinyin and Mandarin Zhuyin are detected automatically from `ExpressionReading`;
no setting or extra field is needed.

- **Below-letter annotations.** Pinyin dot-below annotations (`U+0323`), as in
  `yị̄dìng` and `bụ̀dàn`, and minus-sign-below annotations (`U+0320`), as in
  `yī̠qǐ`, are accepted and preserved in the displayed reading. Colors follow
  the written tone marks (tone 1 for `yị̄` and `yī̠`, tone 4 for `bụ̀`); no tone
  sandhi is calculated. Combining marks must stay attached to the preceding
  letter, not begin a syllable.

- **Neutral tone.** In Pinyin, a middle dot or bullet (`·`, `‧`, `・`, `•`, or
  `∙`) before a syllable marks it as neutral tone, as in `jù·zi`, `jù · zi`,
  `dōng·xi`, or `zhèng •er`. The dot is colored with its syllable, and a tone
  mark or number on that syllable still takes precedence. In otherwise
  tone-marked Pinyin, an unmarked syllable is neutral (`péngyou`).
- **Zhuyin tones.** Zhuyin accepts `ˉ ˊ ˇ ˋ ˙`, with an omitted mark meaning
  first tone. Neutral `˙` can precede a syllable or follow it when unambiguous.
  Separate syllables with spaces when necessary (for example, `ㄇㄚ ˙ㄇㄚ`).
- **Ignored annotations.** Separable-verb markers such as `∥`, `‖`, `|`, or `//`
  and anything in parentheses, such as erhua annotations (`（～儿）`, `(~兒)`,
  `(~r)`) or regional variants (`xuē (Tw: xiāo) jià`), are ignored in either
  script; the annotation never counts as a syllable.
- **Erhua.** An erhua syllable written with its `r`, such as `jīnr gè` for
  今儿个 or `yíhuìr` for 一会儿, also covers the 儿 or 兒 that follows it, and
  that character takes the syllable's tone color. Spellings that write the
  erhua sound change rather than the full syllable are accepted too: a dropped
  final `n` or `i` (`piàr` for 片儿, `wèr` for 味儿, `wár` for 玩儿), `i` or
  `ü` plus `e` (`jiēr`, `yúer`), and `ui` or `un` written as `uer` (`zhuēr`,
  `gǔer`). A detached `r` syllable (`dian1 r5`, `diān r`) takes the previous
  syllable's tone. A separately written `ér` still counts as its own syllable,
  as in `nǚ ér` for 女儿.
- **Pause punctuation.** Commas, semicolons, periods, and similar marks in a
  saying's reading (`ruò yào rén bù zhī，chú fēi jǐ mò wéi`) are treated as
  spaces and are not colored.

### What is not colored, and why

The parser fails closed. When it cannot be certain which tone belongs to each
character, it applies no colors at all and the reading is displayed exactly as
the field contains it. There is no alternative-reading feature: the card never
chooses one reading over another, and there is no way to ask it to color the
first alternative. A card stays uncolored when:

- **The reading lists alternatives.** A slash anywhere in the reading
  (`cháng / zhǎng`, `zhǎng yǎn/cháng yǎn`) stops parsing immediately. A
  comma-separated list (`guān qiǎ, guān kǎ (Tw)`) is not special-cased; it is
  rejected because it has more syllables than the expression has characters.
  A list whose syllable total happened to equal the character count would be
  colored as if it were one reading, which is why the slash remains a hard
  stop.
- **The syllable count does not match.** A reading must resolve to exactly
  one syllable per Han character, apart from an erhua 儿 covered by its
  syllable. Digits, Latin words, and Han characters inside the reading are
  unparseable, so a full sentence with numbers (`34 gè`) or a note such as
  `Taiwan pr. [bì]` outside parentheses is not colored.
- **The reading is ambiguous.** Compact Pinyin that can be segmented more than
  one way, or a Zhuyin neutral dot that could attach to either neighboring
  syllable, is rejected rather than guessed.
- **The reading is invalid or mixed.** Unknown syllables, a syllable with two
  tone marks or a conflicting mark and number, mixed Pinyin and Zhuyin, numeric
  Zhuyin tone notation, and non-Mandarin Bopomofo extensions are unsupported.

## Character variants

`--pc-back-variant-font-size` and `--mobile-back-variant-font-size` control the
smaller Simplified/Traditional counterpart shown below the expression.

`--font-serif` is the Simplified Chinese serif stack. `--font-serif-hant` is the
Traditional Chinese serif stack used when the primary expression or counterpart
has `lang="zh-Hant"`.

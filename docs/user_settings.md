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
syllables, and matching bold vocabulary in both sentence layouts. A bold word is
matched in either script, so a Traditional `<b>舉家</b>` in the sentence of a
Simplified 举家 note is colored too; that cross-script match is applied once the
OpenCC conversion data has loaded. Pronunciation tone marks and Pinyin tone
numbers take the syllable's color; separators, middle dots, and ignored
annotations retain their normal color. Character variant rows keep their
existing subdued color.

Pinyin and Mandarin Zhuyin are detected automatically from `ExpressionReading`;
no setting or extra field is needed. In Pinyin, a middle dot (`·`, `‧`, or
`・`) before a syllable marks it as neutral tone, as in `jù·zi`, `jù · zi`, or
`dōng·xi`. The dot is colored with its syllable, and a tone mark or number on
that syllable still takes precedence. Zhuyin accepts
`ˉ ˊ ˇ ˋ ˙`, with an omitted mark meaning first tone. Neutral `˙` can precede a
syllable or follow it when unambiguous. Separate syllables with spaces when
necessary (for example, `ㄇㄚ ˙ㄇㄚ`). Separable-verb markers such as `∥`, `‖`,
`|`, or `//` and parenthesized erhua annotations such as `（～儿）`, `(~兒)`, or
`(~r)` are ignored in either script; the annotation never counts as a syllable.
A reading must resolve uniquely to one syllable per Han character; otherwise
coloring is skipped. Numeric Zhuyin tones and non-Mandarin Bopomofo extensions
are unsupported.

## Character variants

`--pc-back-variant-font-size` and `--mobile-back-variant-font-size` control the
smaller Simplified/Traditional counterpart shown below the expression.

`--font-serif` is the Simplified Chinese serif stack. `--font-serif-hant` is the
Traditional Chinese serif stack used when the primary expression or counterpart
has `lang="zh-Hant"`.

import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";


const backTemplate = readFileSync(new URL("../src/back.html", import.meta.url), "utf8");
const startMarker = "// <tone-coloring>";
const endMarker = "// </tone-coloring>";
const start = backTemplate.indexOf(startMarker);
const end = backTemplate.indexOf(endMarker);
assert.notEqual(start, -1, "tone-coloring start marker is missing");
assert.notEqual(end, -1, "tone-coloring end marker is missing");

const source = `${backTemplate.slice(start + startMarker.length, end)}
globalThis.__toneApi = {parsePinyinTones, segmentCompactPinyin, toneSequenceForExpression, parseReading};`;
const context = vm.createContext({});
new vm.Script(source, {filename: "tone-coloring.js"}).runInContext(context);
const {parsePinyinTones, segmentCompactPinyin, toneSequenceForExpression, parseReading} = context.__toneApi;
const plain = value => value === null ? null : Array.from(value);


test("parses diacritic Pinyin", () => {
    assert.deepEqual(plain(parsePinyinTones("zhōng guó")), [1, 2]);
    assert.deepEqual(plain(parsePinyinTones("nǚ ér")), [3, 2]);
    assert.deepEqual(plain(parsePinyinTones("xī'ān")), [1, 1]);
});

test("segments compact diacritic Pinyin from the expression length", () => {
    assert.deepEqual(plain(toneSequenceForExpression("华发", "huáfà")), [2, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("中国", "zhōngguó")), [1, 2]);
    assert.deepEqual(plain(toneSequenceForExpression("朋友", "péngyou")), [2, 5]);
});

test("requires separators before non-initial a, o, and e syllables", () => {
    assert.deepEqual(
        plain(segmentCompactPinyin("pángēncuòjié", 4)),
        ["pán", "gēn", "cuò", "jié"],
    );
    assert.deepEqual(
        plain(segmentCompactPinyin("páng’ēncuòjié", 4)),
        ["páng", "ēn", "cuò", "jié"],
    );
    assert.deepEqual(
        plain(segmentCompactPinyin("páng-ēncuòjié", 4)),
        ["páng", "ēn", "cuò", "jié"],
    );
    assert.deepEqual(
        plain(segmentCompactPinyin("páng ēncuòjié", 4)),
        ["páng", "ēn", "cuò", "jié"],
    );
    assert.deepEqual(plain(segmentCompactPinyin("chángān", 2)), ["chán", "gān"]);
    assert.deepEqual(plain(segmentCompactPinyin("cháng'ān", 2)), ["cháng", "ān"]);
    assert.deepEqual(plain(toneSequenceForExpression("长安", "chángān")), [2, 1]);
    assert.equal(segmentCompactPinyin("xīān", 2), null);
    assert.deepEqual(plain(segmentCompactPinyin("xī'ān", 2)), ["xī", "ān"]);
    assert.deepEqual(plain(toneSequenceForExpression("盘根错节", "pángēncuòjié")), [2, 1, 4, 2]);
});

test("parses spaced and compact numbered Pinyin", () => {
    assert.deepEqual(plain(parsePinyinTones("ni3 hao3")), [3, 3]);
    assert.deepEqual(plain(parsePinyinTones("ni3hao3")), [3, 3]);
    assert.deepEqual(plain(parsePinyinTones("zhong1guo2")), [1, 2]);
});

test("accepts common u-diaeresis spellings", () => {
    assert.deepEqual(plain(parsePinyinTones("lǜ sè")), [4, 4]);
    assert.deepEqual(plain(parsePinyinTones("lv4 se4")), [4, 4]);
    assert.deepEqual(plain(parsePinyinTones("lu:4 se4")), [4, 4]);
});

test("handles explicit and implicit neutral tones", () => {
    assert.deepEqual(plain(parsePinyinTones("peng2 you5")), [2, 5]);
    assert.deepEqual(plain(parsePinyinTones("peng2 you0")), [2, 5]);
    assert.deepEqual(plain(parsePinyinTones("mā ma")), [1, 5]);
    assert.deepEqual(plain(parsePinyinTones("peng2 you")), [2, 5]);
});

test("maps only Han characters and ignores punctuation or Latin content", () => {
    assert.deepEqual(plain(toneSequenceForExpression("你好！", "nǐ hǎo")), [3, 3]);
    assert.deepEqual(plain(toneSequenceForExpression("第1个", "di4 ge4")), [4, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("𠮷野家", "jí yě jiā")), [2, 3, 1]);
});

test("fails closed for ambiguous or unsafe input", () => {
    assert.equal(parsePinyinTones("zhong guo"), null);
    assert.equal(parsePinyinTones("cháng / zhǎng"), null);
    assert.equal(parsePinyinTones("mā2"), null);
    assert.equal(toneSequenceForExpression("花儿", "huār"), null);
    assert.equal(toneSequenceForExpression("中国人", "zhōng guó"), null);
    assert.equal(toneSequenceForExpression("hello", "he2 llo5"), null);
});

test("colors the screenshot's spaced and compact Zhuyin readings", () => {
    for (const reading of ["ㄕㄨㄟˇ ㄇㄨˇ ㄧㄚˋ ㄇㄣˊ", "ㄕㄨㄟˇㄇㄨˇㄧㄚˋㄇㄣˊ"]) {
        assert.deepEqual(plain(toneSequenceForExpression("水母亞門", reading)), [3, 3, 4, 2]);
    }
});

test("parses all Zhuyin tones and omitted first-tone marks", () => {
    assert.deepEqual(plain(toneSequenceForExpression("媽麻馬罵嗎", "ㄇㄚˉ ㄇㄚˊ ㄇㄚˇ ㄇㄚˋ ˙ㄇㄚ")), [1, 2, 3, 4, 5]);
    assert.deepEqual(plain(toneSequenceForExpression("天空", "ㄊㄧㄢㄎㄨㄥ")), [1, 1]);
    assert.deepEqual(plain(toneSequenceForExpression("中國", "ㄓㄨㄥㄍㄨㄛˊ")), [1, 2]);
    assert.deepEqual(plain(toneSequenceForExpression("知吃詩日字次四", "ㄓ ㄔ ㄕ ㄖˋ ㄗˋ ㄘˋ ㄙˋ")), [1, 1, 1, 4, 4, 4, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("女兒", "ㄋㄩˇ ㄦˊ")), [3, 2]);
});

test("accepts neutral dots only with unambiguous attachment", () => {
    for (const reading of ["ㄇㄚ ˙ㄇㄚ", "ㄇㄚ ㄇㄚ˙", "ㄇㄚˉ˙ㄇㄚ", "ㄇㄚˉㄇㄚ˙"]) {
        assert.deepEqual(plain(toneSequenceForExpression("媽媽", reading)), [1, 5], reading);
    }
    assert.deepEqual(plain(toneSequenceForExpression("朋友", "ㄆㄥˊ˙ㄧㄡ")), [2, 5]);
    assert.deepEqual(plain(toneSequenceForExpression("嗎", "˙ㄇㄚ")), [5]);
    assert.deepEqual(plain(toneSequenceForExpression("嗎", "ㄇㄚ˙")), [5]);
    assert.equal(toneSequenceForExpression("媽媽", "ㄇㄚ˙ㄇㄚ"), null);
});

test("preserves source offsets and separators in both reading scripts", () => {
    const cases = [
        ["  ㄕㄨㄟˇ\u00a0ㄇㄨˇ—ㄧㄚˋ’ㄇㄣˊ  ", ["ㄕㄨㄟˇ", "ㄇㄨˇ", "ㄧㄚˋ", "ㄇㄣˊ"], [3, 3, 4, 2]],
        ["  shuǐ\tmǔ-yà’mén  ", ["shuǐ", "mǔ", "yà", "mén"], [3, 3, 4, 2]],
        ["nǚ'ér".normalize("NFD"), ["nǚ".normalize("NFD"), "ér".normalize("NFD")], [3, 2]],
        ["huáfà".normalize("NFD"), ["huá".normalize("NFD"), "fà".normalize("NFD")], [2, 4]],
        ["ni3hao3", ["ni3", "hao3"], [3, 3]],
        ["lu:4 se4", ["lu:4", "se4"], [4, 4]],
    ];
    for (const [reading, texts, tones] of cases) {
        const parsed = parseReading(reading, texts.length);
        assert.ok(parsed, reading);
        assert.deepEqual(Array.from(parsed, value => value.text), texts);
        assert.deepEqual(Array.from(parsed, value => value.tone), tones);
        let previousEnd = 0;
        for (const value of parsed) {
            assert.ok(value.start >= previousEnd);
            assert.equal(reading.slice(value.start, value.end), value.text);
            previousEnd = value.end;
        }
    }
    assert.deepEqual(JSON.parse(JSON.stringify(parseReading(" nu\u0308\u030c e\u0301r ", 2))), [
        {text: "nu\u0308\u030c", tone: 3, start: 1, end: 5},
        {text: "e\u0301r", tone: 2, start: 6, end: 9},
    ]);
});

test("reads a middle dot before a Pinyin syllable as neutral tone", () => {
    const readings = [
        "jù·zi", "jù ·zi", "jù· zi", "jù · zi", "jù‧zi", "jù・zi", "jù ‧ zi",
        "jù··zi", "ju4·zi", "jù·zi5", "ju4·zi0",
    ];
    for (const reading of readings) {
        assert.deepEqual(plain(toneSequenceForExpression("句子", reading)), [4, 5], reading);
        const parsed = parseReading(reading, 2);
        assert.ok(parsed, reading);
        assert.deepEqual(Array.from(parsed, value => value.tone), [4, 5], reading);
        // Offsets index the untouched field text, and the dot (with any
        // spacing after it) belongs to the neutral syllable it precedes.
        for (const value of parsed) assert.equal(reading.slice(value.start, value.end), value.text, reading);
        assert.match(parsed[0].text, /^(jù|ju4)$/u, reading);
        assert.match(parsed[1].text, /^[·‧・]+\s*zi[05]?$/u, reading);
        assert.ok(parsed[0].end <= parsed[1].start, reading);
    }

    // An explicit tone on the dotted syllable wins over the dot.
    assert.deepEqual(plain(toneSequenceForExpression("东西", "dōng·xi")), [1, 5]);
    assert.deepEqual(plain(toneSequenceForExpression("东西", "dōng·xī")), [1, 1]);
    assert.deepEqual(plain(toneSequenceForExpression("东西", "dong1・xi1")), [1, 1]);
    assert.deepEqual(plain(toneSequenceForExpression("儿子", "ér‧zi")), [2, 5]);
    assert.deepEqual(plain(toneSequenceForExpression("椅子", "yǐ·zi (~r)")), [3, 5]);
    assert.deepEqual(plain(toneSequenceForExpression("孩子们", "hái·zi·men")), [2, 5, 5]);

    // A dot needs a syllable after it, and dots are not Zhuyin neutral marks.
    assert.equal(toneSequenceForExpression("花", "huā·"), null);
    assert.equal(toneSequenceForExpression("句子", "jù·"), null);
    assert.equal(toneSequenceForExpression("句子", "jù ·"), null);
    assert.equal(toneSequenceForExpression("句子", "jù·zǐ·"), null);
    assert.equal(toneSequenceForExpression("媽媽", "ㄇㄚ·ㄇㄚ"), null);
});

test("ignores erhua and separable-verb annotations in both reading scripts", () => {
    assert.deepEqual(plain(toneSequenceForExpression("肥皂泡", "féi zào pào（～儿）")), [2, 4, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("肥皂泡", "féizàopào(~儿)")), [2, 4, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("花", "huā (~r)")), [1]);
    assert.deepEqual(plain(toneSequenceForExpression("花", "huār")), [1]);
    assert.deepEqual(plain(toneSequenceForExpression("花", "ㄏㄨㄚ（～兒）")), [1]);
    assert.deepEqual(plain(toneSequenceForExpression("生火", "shēng ∥ huǒ")), [1, 3]);
    assert.deepEqual(plain(toneSequenceForExpression("生火", "sheng1//huo3")), [1, 3]);
    assert.deepEqual(plain(toneSequenceForExpression("生火", "ㄕㄥ｜ㄏㄨㄛˇ")), [1, 3]);

    const cases = [
        ["féi zào pào（～儿）", ["féi", "zào", "pào"], [2, 4, 4]],
        ["ㄏㄨㄚ（～儿）", ["ㄏㄨㄚ"], [1]],
        ["shēng ∥ huǒ", ["shēng", "huǒ"], [1, 3]],
        ["sheng1//huo3", ["sheng1", "huo3"], [1, 3]],
    ];
    for (const [reading, texts, tones] of cases) {
        const parsed = parseReading(reading, texts.length);
        assert.ok(parsed, reading);
        assert.deepEqual(Array.from(parsed, value => value.text), texts);
        assert.deepEqual(Array.from(parsed, value => value.tone), tones);
        for (const value of parsed) assert.equal(reading.slice(value.start, value.end), value.text);
    }

    // The annotation never counts as a syllable, and unrelated parentheses stay unsupported.
    assert.equal(toneSequenceForExpression("肥皂泡儿", "féi zào pào（～儿）"), null);
    assert.equal(toneSequenceForExpression("花", "huā（儿子）"), null);
});

test("rejects malformed, ambiguous, mixed, and unsupported Zhuyin readings", () => {
    for (const reading of ["ㄅ", "ㄐㄚ", "ㄅㄩ", "ㄇㄇㄚ", "ㄚㄧ", "ㄇㄚˊˇ", "˙ㄇㄚ˙", "˙˙ㄇㄚ", "ㄇㄚ1", "ㄇㄚ5", "ㆠ", "ㄪ", "ㄇㄚ/ㄇㄚˊ", "ㄇㄚ，ㄇㄚˊ", "ˇ", ""]) {
        assert.equal(parseReading(reading, 1), null, reading);
    }
    assert.equal(parseReading("ㄇㄚ mā", 2), null);
    assert.equal(parseReading("ㄇㄚˊ", 2), null);
    assert.equal(parseReading("ㄇㄚˊ ㄇㄚˊ", 1), null);
    assert.equal(parseReading("ㄓㄨㄢ", 2), null); // ㄓ + ㄨㄢ or ㄓㄨ + ㄢ.
});

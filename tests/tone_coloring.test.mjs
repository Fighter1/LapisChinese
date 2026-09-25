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

test("parses below-vowel Pinyin annotations using written tones and preserves source ranges", () => {
    const cases = [
        ["一定", "yị̄dìng", ["yị̄", "dìng"], [1, 4]],
        ["一样", "yị̄yàng", ["yị̄", "yàng"], [1, 4]],
        ["一共", "yị̄gòng", ["yị̄", "gòng"], [1, 4]],
        ["不但", "bụ̀dàn", ["bụ̀", "dàn"], [4, 4]],
        ["不像话", "bụ̀ xiànghuà", ["bụ̀", "xiàng", "huà"], [4, 4, 4]],
        ["妈妈", "mạ̄ ma", ["mạ̄", "ma"], [1, 5]],
        ["一起", "yī̠qǐ", ["yī̠", "qǐ"], [1, 3]],
        ["一起", "yī̠ qǐ", ["yī̠", "qǐ"], [1, 3]],
    ];
    for (const [expression, reading, texts, tones] of cases) {
        for (const form of [null, "NFC", "NFD"]) {
            const normalize = text => form ? text.normalize(form) : text;
            const input = `  ${normalize(reading)}  `;
            const parsed = parseReading(input, tones.length);
            assert.ok(parsed, input);
            assert.deepEqual(plain(toneSequenceForExpression(expression, input)), tones, input);
            assert.deepEqual(Array.from(parsed, value => value.tone), tones, input);
            assert.deepEqual(Array.from(parsed, value => value.text), texts.map(normalize), input);
            let previousEnd = 0;
            for (const value of parsed) {
                const expectedStart = input.indexOf(value.text, previousEnd);
                assert.equal(value.start, expectedStart, input);
                assert.equal(value.end, expectedStart + value.text.length, input);
                assert.equal(input.slice(value.start, value.end), value.text, input);
                previousEnd = value.end;
            }
        }
    }
});

test("rejects detached leading combining marks in Pinyin", () => {
    for (const mark of ["\u0320", "\u0323", "\u0304", "\u0308"]) {
        assert.equal(parseReading(`${mark}yi`, 1), null);
        assert.equal(parseReading(`yī ${mark}qǐ`, 2), null);
        assert.equal(parseReading(`${mark}yi1`, 1), null);
    }
    assert.equal(parsePinyinTones("yi\u0320"), null);
    assert.equal(parsePinyinTones("yī̠2"), null);
    assert.equal(parsePinyinTones("yī\u0331"), null);
});

test("dot-below tolerance retains Pinyin validation", () => {
    assert.equal(parsePinyinTones("yị"), null);
    assert.deepEqual(plain(parsePinyinTones("mā yị")), [1, 5]);
    assert.equal(parsePinyinTones("yị̄2"), null);
    assert.equal(parsePinyinTones("bụ̀2"), null);
    assert.equal(parsePinyinTones("yị̄\u0301"), null);
    assert.equal(parsePinyinTones("yị̄\u0307"), null);
    assert.equal(toneSequenceForExpression("一定啊", "yị̄ dìng"), null);
    assert.equal(toneSequenceForExpression("西安", "xị̄ān"), null);
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
    assert.deepEqual(plain(toneSequenceForExpression("正儿八经", "zhèng •er bā jīng（口语中也读zhèng •er bā jǐng）（～的）")), [4, 5, 1, 1]);
    assert.deepEqual(plain(toneSequenceForExpression("儿媳妇", "ér xí •fu（～儿）")), [2, 2, 5]);
    assert.deepEqual(plain(toneSequenceForExpression("句子", "jù ∙ zi")), [4, 5]);
    assert.deepEqual(plain(toneSequenceForExpression("椅子", "yǐ·zi (~r)")), [3, 5]);
    assert.deepEqual(plain(toneSequenceForExpression("孩子们", "hái·zi·men")), [2, 5, 5]);

    // A dot needs a syllable after it, and dots are not Zhuyin neutral marks.
    assert.equal(toneSequenceForExpression("花", "huā·"), null);
    assert.equal(toneSequenceForExpression("句子", "jù·"), null);
    assert.equal(toneSequenceForExpression("句子", "jù ·"), null);
    assert.equal(toneSequenceForExpression("句子", "jù·zǐ·"), null);
    assert.equal(toneSequenceForExpression("媽媽", "ㄇㄚ·ㄇㄚ"), null);
});

test("ignores parenthesized and separable-verb annotations in both reading scripts", () => {
    assert.deepEqual(plain(toneSequenceForExpression("肥皂泡", "féi zào pào（～儿）")), [2, 4, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("肥皂泡", "féizàopào(~儿)")), [2, 4, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("花", "huā (~r)")), [1]);
    assert.deepEqual(plain(toneSequenceForExpression("花", "huār")), [1]);
    assert.deepEqual(plain(toneSequenceForExpression("花", "ㄏㄨㄚ（～兒）")), [1]);
    assert.deepEqual(plain(toneSequenceForExpression("生火", "shēng ∥ huǒ")), [1, 3]);
    assert.deepEqual(plain(toneSequenceForExpression("生火", "sheng1//huo3")), [1, 3]);
    assert.deepEqual(plain(toneSequenceForExpression("生火", "ㄕㄥ｜ㄏㄨㄛˇ")), [1, 3]);

    // Regional variants and other notes in parentheses are not syllables either.
    assert.deepEqual(plain(toneSequenceForExpression("削价", "xuē (Tw: xiāo) jià")), [1, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("削价", "xuē（台：xiāo）jià")), [1, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("削价", "xuējià (also xiāojià)")), [1, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("削價", "ㄒㄩㄝ (Tw: ㄒㄧㄠ) ㄐㄧㄚˋ")), [1, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("花", "huā（儿子）")), [1]);

    const cases = [
        ["féi zào pào（～儿）", ["féi", "zào", "pào"], [2, 4, 4]],
        ["xuē (Tw: xiāo) jià", ["xuē", "jià"], [1, 4]],
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

    // The annotation never counts as a syllable, and an unclosed parenthesis is still invalid.
    assert.equal(toneSequenceForExpression("肥皂泡儿", "féi zào pào（～儿）"), null);
    assert.equal(toneSequenceForExpression("削价", "xuē (Tw: xiāo jià"), null);
    assert.equal(toneSequenceForExpression("削价", "xuē Tw: xiāo) jià"), null);
});

test("treats pause punctuation in sayings as whitespace", () => {
    assert.deepEqual(
        plain(toneSequenceForExpression("若要人不知，除非己莫为", "ruò yào rén bù zhī，chú fēi jǐ mò wéi")),
        [4, 4, 2, 4, 1, 2, 1, 3, 4, 2],
    );
    assert.deepEqual(
        plain(toneSequenceForExpression("事不关己，高高挂起", "shì bù guān jǐ, gāo gāo guà qǐ")),
        [4, 4, 1, 3, 1, 1, 4, 3],
    );
    assert.deepEqual(
        plain(toneSequenceForExpression("惟其艰难，方显勇毅；惟其磨砺，始得玉成", "Wéiqí jiānnán, fāng xiǎn yǒngyì; wéiqí mólì, shǐ dé yùchéng")),
        [2, 2, 1, 2, 1, 3, 3, 4, 2, 2, 2, 4, 3, 2, 4, 2],
    );
    assert.deepEqual(plain(toneSequenceForExpression("苦海无边，回头是岸", "kǔ hǎi wú biān ，huí tóu shì àn")), [3, 3, 2, 1, 2, 2, 4, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("一分钱一分货", "yī fēn qián, yī fēn huò")), [1, 1, 2, 1, 1, 4]);
    assert.deepEqual(
        plain(toneSequenceForExpression("又要马儿好，又要马儿不吃草", "yòu yào mǎr hǎo ， yòu yào mǎr bù chī cǎo")),
        [4, 4, 3, 3, 3, 4, 4, 3, 3, 4, 1, 3],
    );
    assert.deepEqual(plain(toneSequenceForExpression("事不關己，高高掛起", "ㄕˋ ㄅㄨˋ ㄍㄨㄢ ㄐㄧˇ，ㄍㄠ ㄍㄠ ㄍㄨㄚˋ ㄑㄧˇ")), [4, 4, 1, 3, 1, 1, 4, 3]);
    assert.deepEqual(
        plain(toneSequenceForExpression("惊悉噩耗，不胜悲痛。逝者安息，请节哀顺变。", "Jīng xī è hào, bù shèng bēi tòng. Shì zhě ān xī, qǐng jié āi shùn biàn.")),
        [1, 1, 4, 4, 4, 4, 1, 4, 4, 3, 1, 1, 3, 2, 1, 4, 4],
    );
    assert.deepEqual(plain(toneSequenceForExpression("美国：中国", "Měi guó：Zhōng guó")), [3, 2, 1, 2]);

    // The punctuation is not part of any syllable range.
    const parsed = parseReading("shì bù guān jǐ, gāo gāo guà qǐ", 8);
    assert.deepEqual(Array.from(parsed, value => value.text), ["shì", "bù", "guān", "jǐ", "gāo", "gāo", "guà", "qǐ"]);
    assert.equal(parsed[3].end, "shì bù guān jǐ".length);

    // Alternative readings still fail: a slash is never a pause, and a
    // comma-separated list has more syllables than the expression.
    assert.equal(toneSequenceForExpression("长", "cháng / zhǎng"), null);
    assert.equal(toneSequenceForExpression("长", "cháng, zhǎng"), null);
    assert.equal(toneSequenceForExpression("关卡", "guān qiǎ, guān kǎ (Tw)"), null);
    assert.equal(toneSequenceForExpression("长眼", "zhǎng yǎn/cháng yǎn"), null);
    assert.equal(toneSequenceForExpression("圕", "tuān, tú shū guǎn"), null);
});

test("colors a following 儿 with the tone of its erhua syllable", () => {
    assert.deepEqual(plain(toneSequenceForExpression("今儿个", "jīnr gè")), [1, 1, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("今兒個", "jīnr gè")), [1, 1, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("花儿", "huār")), [1, 1]);
    assert.deepEqual(plain(toneSequenceForExpression("玩儿", "wanr2")), [2, 2]);
    assert.deepEqual(plain(toneSequenceForExpression("一会儿", "yíhuìr")), [2, 4, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("一会儿", "yí huìr")), [2, 4, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("小孩儿", "xiǎo háir")), [3, 2, 2]);

    // Spellings that write the erhua sound change instead of appending r to
    // the full syllable: dropped -n or -i, i/ü plus e, and ui/un as uer.
    assert.deepEqual(plain(toneSequenceForExpression("片儿", "piàr")), [4, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("喝断片儿", "hē duàn piàr")), [1, 4, 4, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("片儿汤话", "piàr tāng huà")), [4, 4, 1, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("味儿", "wèr")), [4, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("玩儿", "wár")), [2, 2]);
    assert.deepEqual(plain(toneSequenceForExpression("今儿", "jiēr")), [1, 1]);
    assert.deepEqual(plain(toneSequenceForExpression("鱼儿", "yúer")), [2, 2]);
    assert.deepEqual(plain(toneSequenceForExpression("追儿", "zhuēr")), [1, 1]);
    assert.deepEqual(plain(toneSequenceForExpression("滚儿", "gǔer")), [3, 3]);
    assert.deepEqual(plain(toneSequenceForExpression("一会儿", "yíhuèr")), [2, 4, 4]);
    assert.equal(toneSequenceForExpression("儿", "xr"), null);
    assert.equal(toneSequenceForExpression("片", "pia"), null);

    // CC-CEDICT style detached r: its own range in the reading, and it takes
    // the previous syllable's tone rather than absorbing a character.
    assert.deepEqual(plain(toneSequenceForExpression("颠儿", "diān r")), [1, 1]);
    assert.deepEqual(plain(toneSequenceForExpression("颠儿", "dian1 r5")), [1, 1]);
    assert.deepEqual(plain(toneSequenceForExpression("玩儿", "wan2r")), [2, 2]);
    assert.deepEqual(plain(toneSequenceForExpression("一会儿", "yi2 hui4 r5")), [2, 4, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("哪儿跟哪儿", "nǎr gēn nǎr")), [3, 3, 1, 3, 3]);
    const detached = parseReading("dian1 r5", 2);
    assert.deepEqual(Array.from(detached, value => value.text), ["dian1", "r5"]);
    assert.deepEqual(Array.from(detached, value => value.tone), [1, 1]);
    assert.equal(toneSequenceForExpression("儿", "r"), null);
    assert.equal(toneSequenceForExpression("儿颠", "r diān"), null);
    assert.equal(toneSequenceForExpression("颠儿", "diān r2"), null);

    // A separately read 儿 is still its own syllable, and 儿 never absorbs
    // when the syllable count already matches.
    assert.deepEqual(plain(toneSequenceForExpression("今儿个", "jīn ér gè")), [1, 2, 4]);
    assert.deepEqual(plain(toneSequenceForExpression("女儿", "nǚ ér")), [3, 2]);
    assert.deepEqual(plain(toneSequenceForExpression("儿子", "ér zi")), [2, 5]);
    assert.deepEqual(plain(toneSequenceForExpression("花", "huār")), [1]);

    // Only 儿/兒 can be absorbed, only after an erhua syllable, and the
    // reading still has to account for every other character.
    assert.equal(toneSequenceForExpression("花朵", "huār"), null);
    assert.equal(toneSequenceForExpression("儿花", "huār"), null);
    assert.equal(toneSequenceForExpression("今儿个", "jīn gè"), null);
    assert.equal(toneSequenceForExpression("今儿个儿", "jīnr gè"), null);

    // The reading's own syllable ranges are unchanged: jīnr is one syllable.
    const parsed = parseReading("jīnr gè", 2);
    assert.deepEqual(Array.from(parsed, value => value.text), ["jīnr", "gè"]);
    assert.deepEqual(Array.from(parsed, value => value.tone), [1, 4]);
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

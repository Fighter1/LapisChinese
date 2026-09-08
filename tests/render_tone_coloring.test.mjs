import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {chromium} from "playwright";


const css = readFileSync(new URL("../src/styling.css", import.meta.url), "utf8");
const backTemplate = readFileSync(new URL("../src/back.html", import.meta.url), "utf8");
const startMarker = "// <tone-coloring>";
const endMarker = "// </tone-coloring>";
const toneSource = backTemplate.slice(
    backTemplate.indexOf(startMarker) + startMarker.length,
    backTemplate.indexOf(endMarker),
);


async function renderCard(page, nightMode) {
    const mode = nightMode ? "card nightMode" : "card";
    await page.setContent(`
        <style>${css}</style>
            <div class="${mode}">
            <div id="lapis" lang="zh-Hans">
                <div class="vocab"><em>华</em>发！</div>
                <div class="reading">huáfà</div>
                <div class="sentence">鬓角出现了几分<b>华发</b>，这是<b class="unrelated">重点</b>。</div>
                <div class="sentence-alt">四周则全是<b>华发</b>。</div>
            </div>
        </div>
    `);
    const applied = await page.evaluate(source => eval(`${source}\napplyToneColors();`), toneSource);
    return page.evaluate(appliedResult => ({
        applied: appliedResult,
        colors: Array.from(document.querySelectorAll(".vocab [class^='tone-']"))
            .map(element => getComputedStyle(element).color),
        classes: Array.from(document.querySelectorAll(".vocab [class^='tone-']"))
            .map(element => element.className),
        readingToneSpans: document.querySelectorAll(".reading [class^='tone-']").length,
        readingColors: Array.from(document.querySelectorAll(".reading [class^='tone-']"))
            .map(element => getComputedStyle(element).color),
        sentenceToneSpans: document.querySelectorAll(".sentence [class^='tone-']").length,
        sentenceColors: Array.from(document.querySelectorAll(".sentence b:not(.unrelated) [class^='tone-']"))
            .map(element => getComputedStyle(element).color),
        alternateSentenceToneSpans: document.querySelectorAll(".sentence-alt [class^='tone-']").length,
        alternateSentenceColors: Array.from(document.querySelectorAll(".sentence-alt [class^='tone-']"))
            .map(element => getComputedStyle(element).color),
        unrelatedBoldToneSpans: document.querySelectorAll(".sentence b.unrelated [class^='tone-']").length,
        emphasizedText: document.querySelector(".vocab em")?.textContent,
        punctuationPreserved: document.querySelector(".vocab")?.textContent.endsWith("！"),
    }), applied);
}


async function renderPersistentCard(page, expression, reading) {
    await page.evaluate(({expression, reading, source}) => {
        const qa = document.getElementById("qa");
        const lapis = document.createElement("div");
        lapis.id = "lapis";
        lapis.lang = "zh-Hans";

        const vocab = document.createElement("div");
        vocab.className = "vocab";
        vocab.textContent = expression;

        const readingElement = document.createElement("div");
        readingElement.className = "reading";
        readingElement.textContent = reading;

        const sentence = document.createElement("div");
        sentence.className = "sentence";
        sentence.append("Example ");
        const target = document.createElement("b");
        target.textContent = expression;
        sentence.appendChild(target);

        lapis.append(vocab, readingElement, sentence);
        qa.replaceChildren(lapis);

        // Anki's reviewer replaces script elements after updating #qa, which
        // evaluates the same card-template source in the persistent page again.
        const script = document.createElement("script");
        script.textContent = `${source}\napplyToneColors();`;
        qa.appendChild(script);
    }, {expression, reading, source: toneSource});

    return page.evaluate(() => ({
        vocabText: document.querySelector(".vocab")?.textContent,
        vocabClasses: Array.from(document.querySelectorAll(".vocab [class^='tone-']"))
            .map(element => element.className),
        vocabColors: Array.from(document.querySelectorAll(".vocab [class^='tone-']"))
            .map(element => getComputedStyle(element).color),
        sentenceClasses: Array.from(document.querySelectorAll(".sentence b [class^='tone-']"))
            .map(element => element.className),
        readingClasses: Array.from(document.querySelectorAll(".reading [class^='tone-']"))
            .map(element => element.className),
    }));
}


async function launchBrowser() {
    let lastError;
    for (const options of [
        {headless: true},
        {channel: "chrome", headless: true},
        {channel: "msedge", headless: true},
    ]) {
        try {
            return await chromium.launch(options);
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}


test("renders compact-diacritic header and matching sentence tones in light and night modes", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        const light = await renderCard(page, false);
        assert.equal(light.applied, true);
        assert.deepEqual(light.classes, ["tone-2", "tone-4"]);
        assert.deepEqual(light.colors, ["rgb(2, 179, 28)", "rgb(137, 0, 191)"]);
        assert.equal(light.readingToneSpans, 2);
        assert.deepEqual(light.readingColors, light.colors);
        assert.equal(light.sentenceToneSpans, 2);
        assert.deepEqual(light.sentenceColors, ["rgb(2, 179, 28)", "rgb(137, 0, 191)"]);
        assert.equal(light.alternateSentenceToneSpans, 2);
        assert.deepEqual(light.alternateSentenceColors, ["rgb(2, 179, 28)", "rgb(137, 0, 191)"]);
        assert.equal(light.unrelatedBoldToneSpans, 0);
        assert.equal(light.emphasizedText, "华");
        assert.equal(light.punctuationPreserved, true);

        const dark = await renderCard(page, true);
        assert.equal(dark.applied, true);
        assert.deepEqual(dark.classes, ["tone-2", "tone-4"]);
        assert.deepEqual(dark.colors, ["rgb(74, 222, 128)", "rgb(192, 132, 252)"]);
        assert.equal(dark.readingToneSpans, 2);
        assert.deepEqual(dark.readingColors, dark.colors);
        assert.equal(dark.sentenceToneSpans, 2);
        assert.deepEqual(dark.sentenceColors, ["rgb(74, 222, 128)", "rgb(192, 132, 252)"]);
        assert.equal(dark.alternateSentenceToneSpans, 2);
        assert.deepEqual(dark.alternateSentenceColors, ["rgb(74, 222, 128)", "rgb(192, 132, 252)"]);
        assert.equal(dark.unrelatedBoldToneSpans, 0);
    } finally {
        await browser.close();
    }
});


test("renders compact Pinyin resolved by the apostrophe boundary rule", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        await page.setContent(`
            <style>${css}</style>
            <div class="card nightMode"><div id="qa"></div></div>
        `);

        const card = await renderPersistentCard(page, "盘根错节", "pángēncuòjié");
        assert.deepEqual(card.vocabClasses, ["tone-2", "tone-1", "tone-4", "tone-2"]);
        assert.deepEqual(card.sentenceClasses, ["tone-2", "tone-1", "tone-4", "tone-2"]);
    } finally {
        await browser.close();
    }
});


test("recolors cards after forward and backward navigation in a persistent preview page", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        const pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        await page.setContent(`
            <style>${css}</style>
            <div class="card nightMode"><div id="qa"></div></div>
        `);

        const first = await renderPersistentCard(page, "华发", "huáfà");
        assert.deepEqual(first.vocabClasses, ["tone-2", "tone-4"]);
        assert.deepEqual(first.vocabColors, ["rgb(74, 222, 128)", "rgb(192, 132, 252)"]);
        assert.deepEqual(first.sentenceClasses, ["tone-2", "tone-4"]);
        assert.deepEqual(first.readingClasses, ["tone-2", "tone-4"]);

        const zhuyin = await renderPersistentCard(page, "水母亞門", "ㄕㄨㄟˇㄇㄨˇㄧㄚˋㄇㄣˊ");
        assert.deepEqual(zhuyin.vocabClasses, ["tone-3", "tone-3", "tone-4", "tone-2"]);
        assert.deepEqual(zhuyin.readingClasses, zhuyin.vocabClasses);
        assert.deepEqual(zhuyin.sentenceClasses, zhuyin.vocabClasses);

        const invalid = await renderPersistentCard(page, "媽媽", "ㄇㄚ˙ㄇㄚ");
        assert.deepEqual(invalid.vocabClasses, []);
        assert.deepEqual(invalid.readingClasses, []);
        assert.deepEqual(invalid.sentenceClasses, []);

        const backToZhuyin = await renderPersistentCard(page, "水母亞門", "ㄕㄨㄟˇㄇㄨˇㄧㄚˋㄇㄣˊ");
        assert.deepEqual(backToZhuyin, zhuyin);

        const next = await renderPersistentCard(page, "牢牢", "láoláo");
        assert.deepEqual(next.vocabClasses, ["tone-2", "tone-2"]);
        assert.deepEqual(next.vocabColors, ["rgb(74, 222, 128)", "rgb(74, 222, 128)"]);
        assert.deepEqual(next.sentenceClasses, ["tone-2", "tone-2"]);

        const supplementary = await renderPersistentCard(page, "𠮷野家", "jí yě jiā");
        assert.equal(supplementary.vocabText, "𠮷野家");
        assert.deepEqual(supplementary.vocabClasses, ["tone-2", "tone-3", "tone-1"]);
        assert.deepEqual(supplementary.sentenceClasses, ["tone-2", "tone-3", "tone-1"]);

        const previous = await renderPersistentCard(page, "华发", "huáfà");
        assert.deepEqual(previous.vocabClasses, ["tone-2", "tone-4"]);
        assert.deepEqual(previous.vocabColors, ["rgb(74, 222, 128)", "rgb(192, 132, 252)"]);
        assert.deepEqual(previous.sentenceClasses, ["tone-2", "tone-4"]);
        assert.deepEqual(pageErrors, []);
    } finally {
        await browser.close();
    }
});

test("colors pronunciation text across markup without changing characters, separators, or repeated renders", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        const cases = [
            {
                expression: "水母亞門",
                html: "ㄕㄨㄟˇㄇㄨˇㄧㄚˋㄇㄣˊ",
                tones: [3, 3, 4, 2],
                spans: [["ㄕㄨㄟˇ", 3], ["ㄇㄨˇ", 3], ["ㄧㄚˋ", 4], ["ㄇㄣˊ", 2]],
            },
            {
                expression: "水母亞門",
                html: "  <em>ㄕㄨ</em>ㄟˇ&nbsp;ㄇㄨˇ—ㄧㄚˋ’ㄇㄣˊ  ",
                tones: [3, 3, 4, 2],
                spans: [["ㄕㄨ", 3], ["ㄟˇ", 3], ["ㄇㄨˇ", 3], ["ㄧㄚˋ", 4], ["ㄇㄣˊ", 2]],
            },
            {
                expression: "媽麻馬罵嗎",
                html: "ㄇㄚˉ ㄇㄚˊ ㄇㄚˇ ㄇㄚˋ ˙<em>ㄇㄚ</em>",
                tones: [1, 2, 3, 4, 5],
                spans: [["ㄇㄚˉ", 1], ["ㄇㄚˊ", 2], ["ㄇㄚˇ", 3], ["ㄇㄚˋ", 4], ["˙", 5], ["ㄇㄚ", 5]],
            },
            {
                expression: "天空",
                html: "ㄊㄧㄢㄎㄨㄥ",
                tones: [1, 1],
                spans: [["ㄊㄧㄢ", 1], ["ㄎㄨㄥ", 1]],
            },
            {
                expression: "女兒",
                html: "  <em>nu</em>\u0308\u030c’e\u0301r  ",
                tones: [3, 2],
                spans: [["nu", 3], ["\u0308\u030c", 3], ["e\u0301r", 2]],
            },
            {
                expression: "朋友",
                html: "peng2<em>you</em>5",
                tones: [2, 5],
                spans: [["peng2", 2], ["you", 5], ["5", 5]],
            },
            {
                expression: "媽媽",
                html: "ㄇㄚ˙ㄇㄚ",
                tones: [],
                spans: [],
            },
        ];
        for (const nightMode of [false, true]) {
            for (const fixture of cases) {
                await page.setContent(`<style>${css}</style>
                    <div class="card ${nightMode ? "nightMode" : ""}"><div id="lapis">
                        <div class="vocab"><em>${fixture.expression}</em>！</div>
                        <div class="reading">${fixture.html}</div>
                        <div class="sentence"><b>${fixture.expression}</b><b class="unrelated">其他</b></div>
                        <div class="sentence-alt"><b>${fixture.expression}</b></div>
                    </div></div>`);
                const result = await page.evaluate(source => {
                    const reading = document.querySelector(".reading");
                    const original = reading.textContent;
                    const em = reading.querySelector("em");
                    const emText = em?.textContent;
                    const applied = eval(`${source}\napplyToneColors();`);
                    const htmlAfterFirst = document.getElementById("lapis").innerHTML;
                    const repeated = eval(`${source}\napplyToneColors();`);
                    const spans = selector => Array.from(document.querySelectorAll(`${selector} [class^='tone-']`));
                    return {
                        applied,
                        repeated,
                        originalPreserved: original === reading.textContent,
                        markupPreserved: em === reading.querySelector("em") && emText === em?.textContent,
                        idempotent: htmlAfterFirst === document.getElementById("lapis").innerHTML,
                        reading: spans(".reading").map(span => [span.textContent, Number(span.className.slice(5))]),
                        vocab: spans(".vocab").map(span => Number(span.className.slice(5))),
                        sentence: spans(".sentence b:not(.unrelated)").map(span => span.className),
                        alternate: spans(".sentence-alt b").map(span => span.className),
                        unrelated: spans(".unrelated").length,
                        sameColors: spans(".reading").every(span => {
                            const han = document.querySelector(`.vocab .${span.className}`);
                            return han && getComputedStyle(han).color === getComputedStyle(span).color;
                        }),
                        nestedToneSpans: document.querySelectorAll("[class^='tone-'] [class^='tone-']").length,
                    };
                }, toneSource);
                const label = `${fixture.expression}: ${fixture.html}, night=${nightMode}`;
                assert.equal(result.applied, fixture.tones.length > 0, label);
                assert.equal(result.repeated, false, label);
                assert.equal(result.originalPreserved, true, label);
                assert.equal(result.markupPreserved, true, label);
                assert.equal(result.idempotent, true, label);
                assert.deepEqual(result.reading, fixture.spans, label);
                assert.deepEqual(result.vocab, fixture.tones, label);
                assert.deepEqual(result.sentence, fixture.tones.map(tone => `tone-${tone}`), label);
                assert.deepEqual(result.alternate, result.sentence, label);
                assert.equal(result.unrelated, 0, label);
                assert.equal(result.sameColors, true, label);
                assert.equal(result.nestedToneSpans, 0, label);
            }
        }
    } finally {
        await browser.close();
    }
});

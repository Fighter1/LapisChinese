import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {readFileSync} from "node:fs";
import test from "node:test";
import {chromium} from "playwright";


const css = readFileSync(new URL("../src/styling.css", import.meta.url), "utf8");
const backTemplate = readFileSync(new URL("../src/back.html", import.meta.url), "utf8");
const openCCPath = fileURLToPath(
    new URL("../vendor/opencc-js-1.4.1/_lapis_opencc.js", import.meta.url),
);
const openCCSource = readFileSync(openCCPath, "utf8");
const instrumentedOpenCCSource = `
globalThis.__openCCBundleEvaluations = (globalThis.__openCCBundleEvaluations || 0) + 1;
${openCCSource}
{
    const originalConverter = globalThis.OpenCC.Converter;
    globalThis.OpenCC.Converter = function (...args) {
        globalThis.__openCCConverterConstructions =
            (globalThis.__openCCConverterConstructions || 0) + 1;
        return Reflect.apply(originalConverter, this, args);
    };
}
`;

function markedSource(startMarker, endMarker) {
    const start = backTemplate.indexOf(startMarker);
    const end = backTemplate.indexOf(endMarker);
    assert.notEqual(start, -1, `${startMarker} is missing`);
    assert.notEqual(end, -1, `${endMarker} is missing`);
    return backTemplate.slice(start + startMarker.length, end);
}

const variantSource = markedSource("// <script-variants>", "// </script-variants>");
const toneSource = markedSource("// <tone-coloring>", "// </tone-coloring>");


async function setPersistentPageContent(page) {
    await page.setContent(`
        <base href="https://lapis.test/">
        <style>${css}</style>
        <div class="card"><div id="qa"></div></div>
    `);
}


async function renderPersistentVariantCard(page, expression) {
    await page.evaluate(({expression, source}) => {
        const qa = document.getElementById("qa");
        const lapis = document.createElement("div");
        lapis.id = "lapis";
        lapis.lang = "zh-Hans";

        const vocab = document.createElement("div");
        vocab.className = "vocab";
        vocab.textContent = expression;

        const variants = document.createElement("div");
        variants.className = "script-variants";
        variants.hidden = true;

        lapis.append(vocab, variants);
        qa.replaceChildren(lapis);
        (globalThis.__variantRoots ||= []).push(lapis);
        eval(`${source}\nrenderExpressionVariantsWhenReady(lapis);`);
    }, {expression, source: variantSource});
}


async function renderCard(page, {
    expression,
    reading,
    nightMode = false,
    mobile = false,
    loadOpenCC = true,
}) {
    const mode = nightMode ? "card nightMode" : "card";
    const htmlClass = mobile ? "mobile" : "";
    await page.setContent(`
        <style>${css}</style>
        <div class="${mode}">
            <div id="lapis" lang="zh-Hans">
                <div class="vocab">${expression}</div>
                <div class="script-variants" aria-label="Chinese character variants" hidden></div>
                <div class="reading">${reading}</div>
                <div class="sentence">这是<b>${expression}</b>。</div>
                <div class="sentence-alt">这是<b>${expression}</b>。</div>
            </div>
        </div>
    `);
    await page.evaluate(value => document.documentElement.className = value, htmlClass);
    if (loadOpenCC) {
        await page.addScriptTag({path: openCCPath});
    } else {
        await page.evaluate(() => globalThis.OpenCC = undefined);
    }

    const applied = await page.evaluate(
        source => eval(`${source.variants}\n${source.tones}\n({
            variantApplied: renderExpressionVariants(
                document.getElementById("lapis"),
                source.loadOpenCC ? globalThis.OpenCC : {},
            ),
            toneApplied: applyToneColors(),
        });`),
        {variants: variantSource, tones: toneSource, loadOpenCC},
    );
    return page.evaluate(appliedResult => {
        const container = document.querySelector(".script-variants");
        const firstVariant = document.querySelector(".script-variant");
        const firstLabel = document.querySelector(".script-variant-label");
        const firstVariantText = document.querySelector(".script-variant-text");
        const vocab = document.querySelector(".vocab");
        const labelBox = firstLabel?.getBoundingClientRect();
        const variantTextBox = firstVariantText?.getBoundingClientRect();
        const labelFontSize = firstLabel
            ? Number.parseFloat(getComputedStyle(firstLabel).fontSize)
            : null;
        return {
            ...appliedResult,
            lapisLanguage: document.getElementById("lapis")?.lang,
            primaryLanguage: vocab?.lang,
            primaryFont: getComputedStyle(vocab).fontFamily,
            containerHidden: container?.hidden,
            labels: Array.from(document.querySelectorAll(".script-variant-label"))
                .map(element => element.textContent),
            variants: Array.from(document.querySelectorAll(".script-variant-text"))
                .map(element => element.textContent),
            variantLanguages: Array.from(document.querySelectorAll(".script-variant"))
                .map(element => element.lang),
            variantFont: firstVariant ? getComputedStyle(firstVariant).fontFamily : null,
            variantSize: container ? getComputedStyle(container).fontSize : null,
            variantColor: container ? getComputedStyle(container).color : null,
            variantOpticalOffsetRatio: labelBox && variantTextBox && labelFontSize
                ? (
                    (labelBox.top + labelBox.height / 2) -
                    (variantTextBox.top + variantTextBox.height / 2)
                ) / labelFontSize
                : null,
            primaryToneSpans: document.querySelectorAll(".vocab [class^='tone-']").length,
            variantToneSpans: document.querySelectorAll(".script-variants [class^='tone-']").length,
        };
    }, applied);
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


test("renders labeled variants, language-aware fonts, and graceful fallback", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();

        const simplified = await renderCard(page, {
            expression: "中国",
            reading: "zhōng guó",
        });
        assert.equal(simplified.variantApplied, true);
        assert.equal(simplified.toneApplied, true);
        assert.equal(simplified.lapisLanguage, "zh-Hans");
        assert.equal(simplified.primaryLanguage, "zh-Hans");
        assert.equal(simplified.containerHidden, false);
        assert.deepEqual(simplified.labels, ["繁"]);
        assert.deepEqual(simplified.variants, ["中國"]);
        assert.deepEqual(simplified.variantLanguages, ["zh-Hant"]);
        assert.match(simplified.variantFont, /Noto Serif CJK TC/);
        assert.equal(simplified.variantSize, "26px");
        assert.equal(simplified.variantColor, "rgba(0, 0, 0, 0.6)");
        assert.ok(Math.abs(simplified.variantOpticalOffsetRatio - 0.1) < 0.02);
        assert.equal(simplified.primaryToneSpans, 2);
        assert.equal(simplified.variantToneSpans, 0);

        const traditional = await renderCard(page, {
            expression: "中國",
            reading: "ㄓㄨㄥㄍㄨㄛˊ",
            nightMode: true,
            mobile: true,
        });
        assert.equal(traditional.variantApplied, true);
        assert.equal(traditional.lapisLanguage, "zh-Hant");
        assert.equal(traditional.primaryLanguage, "zh-Hant");
        assert.deepEqual(traditional.labels, ["简"]);
        assert.deepEqual(traditional.variants, ["中国"]);
        assert.deepEqual(traditional.variantLanguages, ["zh-Hans"]);
        assert.match(traditional.primaryFont, /Noto Serif CJK TC/);
        assert.equal(traditional.variantSize, "18px");
        assert.equal(traditional.variantColor, "rgba(255, 255, 255, 0.3)");
        assert.ok(Math.abs(traditional.variantOpticalOffsetRatio - 0.1) < 0.02);
        assert.equal(traditional.primaryToneSpans, 2);
        assert.equal(traditional.variantToneSpans, 0);

        const unavailable = await renderCard(page, {
            expression: "中国",
            reading: "zhōng guó",
            loadOpenCC: false,
        });
        assert.equal(unavailable.variantApplied, false);
        assert.equal(unavailable.toneApplied, true);
        assert.equal(unavailable.containerHidden, true);
        assert.deepEqual(unavailable.variants, []);
        assert.equal(unavailable.primaryToneSpans, 2);
    } finally {
        await browser.close();
    }
});


async function renderCrossScriptCard(page, {
    loadOpenCC,
    vocab = "举家",
    reading = "jǔ jiā",
    sentence = "他<b>舉家</b>搬走了，<b class=\"unrelated\">舉行</b>。",
    sentenceAlt = "他<b>举家</b>搬走了。",
}) {
    await page.setContent(`
        <style>${css}</style>
        <div class="card">
            <div id="lapis" lang="zh-Hans">
                <div class="vocab">${vocab}</div>
                <div class="script-variants" aria-label="Chinese character variants" hidden></div>
                <div class="reading">${reading}</div>
                <div class="sentence">${sentence}</div>
                <div class="sentence-alt">${sentenceAlt}</div>
            </div>
        </div>
    `);
    if (loadOpenCC) {
        await page.addScriptTag({path: openCCPath});
    } else {
        // setContent keeps the window, so drop the cached converter state too.
        await page.evaluate(() => {
            globalThis.OpenCC = undefined;
            delete globalThis.__lapisChineseState;
        });
    }
    return page.evaluate(source => {
        const applied = eval(`${source.variants}\n${source.tones}\napplyToneColors();`);
        const classes = selector => Array.from(document.querySelectorAll(`${selector} [class^='tone-']`))
            .map(element => element.className);
        return {
            applied,
            vocab: classes(".vocab"),
            sentence: classes(".sentence b:not(.unrelated)"),
            alternate: classes(".sentence-alt b"),
            unrelated: classes(".unrelated").length,
            variantToneSpans: classes(".script-variants").length,
            sentenceText: document.querySelector(".sentence").textContent,
        };
    }, {variants: variantSource, tones: toneSource});
}


test("colors bold sentence vocabulary written in the other script", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        const pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));

        const converted = await renderCrossScriptCard(page, {loadOpenCC: true});
        assert.equal(converted.applied, true);
        assert.deepEqual(converted.vocab, ["tone-3", "tone-1"]);
        assert.deepEqual(converted.sentence, ["tone-3", "tone-1"]);
        assert.deepEqual(converted.alternate, ["tone-3", "tone-1"]);
        assert.equal(converted.unrelated, 0);
        assert.equal(converted.variantToneSpans, 0);
        assert.equal(converted.sentenceText, "他舉家搬走了，舉行。");

        // Without OpenCC only the same-script bold word can be matched.
        const unavailable = await renderCrossScriptCard(page, {loadOpenCC: false});
        assert.equal(unavailable.applied, true);
        assert.deepEqual(unavailable.vocab, ["tone-3", "tone-1"]);
        assert.deepEqual(unavailable.sentence, []);
        assert.deepEqual(unavailable.alternate, ["tone-3", "tone-1"]);
        assert.deepEqual(pageErrors, []);
    } finally {
        await browser.close();
    }
});


test("colors a bold word whose Traditional variant differs from OpenCC's choice", async () => {
    // OpenCC converts 炼金术 to 鍊金術 and 南回归线 to 南迴歸線, but sentence
    // sources commonly write 煉金術 and 南回歸線. Both spellings simplify back
    // to the expression, so they must still be matched.
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        const pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));

        const alchemy = await renderCrossScriptCard(page, {
            loadOpenCC: true,
            vocab: "炼金术",
            reading: "liàn jīn shù",
            sentence: "中國媒體已掌握「<b>煉金術</b>」，將「<b class=\"unrelated\">危機</b>」形容成「機遇」，",
            sentenceAlt: "中国媒体已掌握「<b>炼金术</b>」。",
        });
        assert.equal(alchemy.applied, true);
        assert.deepEqual(alchemy.vocab, ["tone-4", "tone-1", "tone-4"]);
        assert.deepEqual(alchemy.sentence, ["tone-4", "tone-1", "tone-4"]);
        assert.deepEqual(alchemy.alternate, ["tone-4", "tone-1", "tone-4"]);
        assert.equal(alchemy.unrelated, 0);
        assert.equal(alchemy.sentenceText, "中國媒體已掌握「煉金術」，將「危機」形容成「機遇」，");

        const tropic = await renderCrossScriptCard(page, {
            loadOpenCC: true,
            vocab: "南回归线",
            reading: "nán huí guī xiàn",
            sentence: "地球上<b>南回歸線</b>的緯度是多少？",
            sentenceAlt: "地球上<b>南迴歸線</b>的緯度是多少？",
        });
        assert.deepEqual(tropic.sentence, ["tone-2", "tone-2", "tone-1", "tone-4"]);
        assert.deepEqual(tropic.alternate, ["tone-2", "tone-2", "tone-1", "tone-4"]);

        // A genuinely different character is still not the expression.
        const recoil = await renderCrossScriptCard(page, {
            loadOpenCC: true,
            vocab: "后座力",
            reading: "hòu zuò lì",
            sentence: "<b>后坐力</b>很大。",
            sentenceAlt: "<b>後座力</b>很大。",
        });
        assert.deepEqual(recoil.vocab, ["tone-4", "tone-4", "tone-4"]);
        assert.deepEqual(recoil.sentence, []);
        assert.deepEqual(recoil.alternate, ["tone-4", "tone-4", "tone-4"]);

        // Without OpenCC the differently spelled word cannot be matched.
        const unavailable = await renderCrossScriptCard(page, {
            loadOpenCC: false,
            vocab: "炼金术",
            reading: "liàn jīn shù",
            sentence: "「<b>煉金術</b>」",
            sentenceAlt: "「<b>炼金术</b>」",
        });
        assert.deepEqual(unavailable.sentence, []);
        assert.deepEqual(unavailable.alternate, ["tone-4", "tone-1", "tone-4"]);
        assert.deepEqual(pageErrors, []);
    } finally {
        await browser.close();
    }
});


test("recolors the other-script bold word after OpenCC finishes loading", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        const pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        let releaseScript;
        const scriptReleased = new Promise(resolve => releaseScript = resolve);
        await page.route("https://lapis.test/_lapis_opencc.js", async route => {
            await scriptReleased;
            await route.fulfill({
                body: openCCSource,
                contentType: "text/javascript; charset=utf-8",
            });
        });
        await setPersistentPageContent(page);

        const before = await page.evaluate(source => {
            const qa = document.getElementById("qa");
            qa.innerHTML = `
                <div id="lapis" lang="zh-Hans">
                    <div class="vocab">举家</div>
                    <div class="script-variants" hidden></div>
                    <div class="reading">jǔ jiā</div>
                    <div class="sentence">他<b>舉家</b>搬走了。</div>
                    <div class="sentence-alt">他<b>举家</b>搬走了。</div>
                </div>`;
            // Same order as the template's initialize(): variants start loading
            // before the first tone pass runs without OpenCC.
            const script = document.createElement("script");
            script.textContent = `${source.variants}\n${source.tones}\n`
                + "renderExpressionVariantsWhenReady(document.getElementById('lapis'));\n"
                + "applyToneColors();";
            qa.appendChild(script);
            const classes = selector => Array.from(document.querySelectorAll(`${selector} [class^='tone-']`))
                .map(element => element.className);
            return {
                vocab: classes(".vocab"),
                sentence: classes(".sentence b"),
                alternate: classes(".sentence-alt b"),
                variants: document.querySelectorAll(".script-variant").length,
            };
        }, {variants: variantSource, tones: toneSource});
        assert.deepEqual(before.vocab, ["tone-3", "tone-1"]);
        assert.deepEqual(before.sentence, []);
        assert.deepEqual(before.alternate, ["tone-3", "tone-1"]);
        assert.equal(before.variants, 0);

        releaseScript();
        await page.waitForFunction(() => (
            document.querySelector(".sentence b [class^='tone-']") !== null
        ));
        const after = await page.evaluate(() => {
            const classes = selector => Array.from(document.querySelectorAll(`${selector} [class^='tone-']`))
                .map(element => element.className);
            return {
                vocab: classes(".vocab"),
                sentence: classes(".sentence b"),
                alternate: classes(".sentence-alt b"),
                variantTexts: Array.from(document.querySelectorAll(".script-variant-text"))
                    .map(element => element.textContent),
                variantToneSpans: classes(".script-variants").length,
                nestedToneSpans: document.querySelectorAll("[class^='tone-'] [class^='tone-']").length,
                sentenceText: document.querySelector(".sentence").textContent,
            };
        });
        assert.deepEqual(after.vocab, ["tone-3", "tone-1"]);
        assert.deepEqual(after.sentence, ["tone-3", "tone-1"]);
        assert.deepEqual(after.alternate, ["tone-3", "tone-1"]);
        assert.deepEqual(after.variantTexts, ["舉家"]);
        assert.equal(after.variantToneSpans, 0);
        assert.equal(after.nestedToneSpans, 0);
        assert.equal(after.sentenceText, "他舉家搬走了。");
        assert.deepEqual(pageErrors, []);
    } finally {
        await browser.close();
    }
});


test("loads OpenCC and constructs converters once across persistent card renders", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        let scriptRequests = 0;
        await page.route("https://lapis.test/_lapis_opencc.js", async route => {
            scriptRequests += 1;
            await new Promise(resolve => setTimeout(resolve, 100));
            await route.fulfill({
                body: instrumentedOpenCCSource,
                contentType: "text/javascript; charset=utf-8",
            });
        });
        await setPersistentPageContent(page);

        await renderPersistentVariantCard(page, "中国");
        await renderPersistentVariantCard(page, "软件");
        await page.waitForFunction(() => (
            document.querySelector(".script-variant-text")?.textContent === "軟件"
        ));

        await renderPersistentVariantCard(page, "中國");
        await page.waitForFunction(() => (
            document.querySelector(".script-variant-text")?.textContent === "中国"
        ));

        const result = await page.evaluate(() => ({
            bundleEvaluations: globalThis.__openCCBundleEvaluations,
            converterConstructions: globalThis.__openCCConverterConstructions,
            detachedFirstRootWasUntouched:
                globalThis.__variantRoots[0].querySelectorAll(".script-variant").length === 0,
            currentVariant: document.querySelector(".script-variant-text")?.textContent,
        }));
        assert.equal(scriptRequests, 1);
        assert.equal(result.bundleEvaluations, 1);
        assert.equal(result.converterConstructions, 2);
        assert.equal(result.detachedFirstRootWasUntouched, true);
        assert.equal(result.currentVariant, "中国");
    } finally {
        await browser.close();
    }
});


test("retries OpenCC after a load failure and leaves the failed card usable", async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        const warnings = [];
        page.on("console", message => {
            if (message.type() === "warning") warnings.push(message.text());
        });
        let scriptRequests = 0;
        await page.route("https://lapis.test/_lapis_opencc.js", async route => {
            scriptRequests += 1;
            if (scriptRequests === 1) {
                await route.abort("failed");
                return;
            }
            await route.fulfill({
                body: instrumentedOpenCCSource,
                contentType: "text/javascript; charset=utf-8",
            });
        });
        await setPersistentPageContent(page);

        await renderPersistentVariantCard(page, "中国");
        await page.waitForFunction(() => (
            globalThis.__lapisChineseState?.openCCPromise === null
        ));
        const failedCard = await page.evaluate(() => ({
            hidden: document.querySelector(".script-variants")?.hidden,
            variantCount: document.querySelectorAll(".script-variant").length,
        }));
        assert.equal(failedCard.hidden, true);
        assert.equal(failedCard.variantCount, 0);

        await renderPersistentVariantCard(page, "中国");
        await page.waitForFunction(() => (
            document.querySelector(".script-variant-text")?.textContent === "中國"
        ));
        assert.equal(scriptRequests, 2);
        assert.equal(await page.evaluate(() => globalThis.__openCCBundleEvaluations), 1);
        assert.equal(await page.evaluate(() => globalThis.__openCCConverterConstructions), 2);
        assert.equal(
            warnings.filter(message => message.includes("could not load character conversion data")).length,
            1,
        );
    } finally {
        await browser.close();
    }
});

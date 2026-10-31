// tests/e2e/smoke.cjs — UI smoke tests for the built renderer, run inside Electron.
//
//   npm run test:e2e
//
// Loads dist/*.html with a stubbed bridge (tests/e2e/stub-preload.cjs), drives the real UI —
// including the Milkdown editor — and checks what would be sent to Notion by running the saved
// Markdown through the real converter (dist-main). Exits non-zero on any failure.
const { app, BrowserWindow, nativeTheme } = require('electron');
const path = require('path');
const assert = require('assert/strict');

const ROOT = path.resolve(__dirname, '../..');
const { markdownToBlocks } = require(path.join(ROOT, 'dist-main/shared/markdownToBlocks.js'));

// GitHub's Ubuntu runners don't allow Chromium's sandbox for unprivileged users
if (process.platform === 'linux' && process.env.CI) app.commandLine.appendSwitch('no-sandbox');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openPage(page, scenario) {
    const win = new BrowserWindow({
        width: 600,
        height: 600,
        show: false,
        webPreferences: {
            offscreen: true,
            sandbox: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'stub-preload.cjs'),
        },
    });
    const events = [];
    const problems = [];
    win.webContents.on('console-message', (event) => {
        const message = event.message;
        if (message.startsWith('E2E:')) events.push(JSON.parse(message.slice(4)));
        else if (event.level === 'error' || event.level === 'warning') problems.push(message);
    });
    await win.loadFile(path.join(ROOT, 'dist', page), { query: { s: scenario } });
    await sleep(1200);
    const run = (code) => win.webContents.executeJavaScript(`(async () => { ${code} })()`);
    return { win, events, problems, run };
}

const PASTE = (markdown) => `{
    const pm = document.querySelector('.ProseMirror');
    pm.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', ${JSON.stringify(markdown)});
    pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}`;

const SET_TITLE = (title) => `{
    const t = document.querySelector('.title-input');
    t.value = ${JSON.stringify(title)};
    t.dispatchEvent(new Event('input'));
}`;

const tests = {
    async 'capture: pasted Markdown is formatted and saved as Notion blocks'() {
        const { win, events, problems, run } = await openPage('index.html', 'page');
        const rendered = await run(
            PASTE('# Plan\n\n- one\n  - nested\n- [ ] task\n\n```ts\nconst a = 1;\n```') +
                SET_TITLE('My note') +
                `await new Promise((r) => setTimeout(r, 300));
                 const pm = document.querySelector('.ProseMirror');
                 return { h1: pm.querySelectorAll('h1').length, li: pm.querySelectorAll('li').length };`,
        );
        assert.equal(rendered.h1, 1, 'heading rendered in the editor');
        assert.ok(rendered.li >= 3, 'list items rendered in the editor');

        await run(`document.querySelector('.save-btn').click();`);
        await sleep(400);
        const capture = events.find((e) => e.kind === 'capture');
        assert.ok(capture, 'capture was sent');
        assert.equal(capture.data.title, 'My note');
        assert.equal(capture.data.destinationId, 'p1');

        const blocks = markdownToBlocks(capture.data.body);
        assert.deepEqual(
            blocks.map((b) => b.type),
            ['heading_1', 'bulleted_list_item', 'to_do', 'code'],
        );
        assert.equal(blocks[1].bulleted_list_item.children[0].type, 'bulleted_list_item');
        assert.equal(blocks[3].code.language, 'typescript');

        const notice = await run(
            `return document.querySelector('.status-success')?.textContent ?? '';`,
        );
        assert.match(notice, /Saved to Inbox/);
        assert.match(notice, /Open in Notion/);
        assert.deepEqual(problems, []);
        win.destroy();
    },

    async 'unsaved note survives hiding the panel and a restart'() {
        const first = await openPage('index.html', 'page');
        await first.run(SET_TITLE('Half-written idea') + PASTE('Some thoughts'));
        await sleep(500); // persistence is debounced
        await first.run(`window.e2e.showPanel();`);
        await sleep(300);
        assert.equal(
            await first.run(`return document.querySelector('.title-input').value;`),
            'Half-written idea',
            'kept after the panel is shown again',
        );
        first.win.destroy();

        // Same session partition => same localStorage, like an app restart
        const second = await openPage('index.html', 'page');
        const restored = await second.run(`
            await new Promise((r) => setTimeout(r, 500));
            return {
              title: document.querySelector('.title-input').value,
              body: document.querySelector('.ProseMirror').textContent,
            };`);
        assert.equal(restored.title, 'Half-written idea');
        assert.match(restored.body, /Some thoughts/);

        // Discard clears it, Undo brings it back
        await second.run(
            `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Discard').click();`,
        );
        await sleep(300);
        assert.equal(await second.run(`return document.querySelector('.title-input').value;`), '');
        await second.run(
            `[...document.querySelectorAll('.link-btn')].find((b) => b.textContent.trim() === 'Undo').click();`,
        );
        await sleep(500);
        assert.equal(
            await second.run(`return document.querySelector('.title-input').value;`),
            'Half-written idea',
        );

        // Clean up for other tests
        await second.run(`localStorage.clear();`);
        assert.deepEqual(second.problems, []);
        second.win.destroy();
    },

    async 'database: properties are collapsed to the most useful ones'() {
        const { win, problems, run } = await openPage('index.html', 'db');
        const state = await run(`
            return {
              rows: document.querySelectorAll('.form-fields .control-group').length,
              toggle: document.querySelector('.more-toggle')?.textContent.trim() ?? '',
            };`);
        assert.equal(state.rows, 3);
        assert.equal(state.toggle, '+ 2 more properties');
        await run(`document.querySelector('.more-toggle').click();`);
        await sleep(200);
        assert.equal(
            await run(`return document.querySelectorAll('.form-fields .control-group').length;`),
            5,
        );
        await run(`localStorage.clear();`);
        assert.deepEqual(problems, []);
        win.destroy();
    },

    async 'destination picker opens with Ctrl+K and lists recent destinations first'() {
        const { win, problems, run } = await openPage('index.html', 'page');
        const state = await run(`
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
            await new Promise((r) => setTimeout(r, 400));
            return {
              labels: [...document.querySelectorAll('.dest-popover .section-label')].map((l) => l.textContent.trim()),
              first: document.querySelector('.dest-popover .result-title')?.textContent.trim(),
            };`);
        assert.deepEqual(state.labels, ['Recent', 'All pages']);
        assert.equal(state.first, 'Reading list');
        assert.deepEqual(problems, []);
        win.destroy();
    },

    async 'settings changes apply immediately, without a restart'() {
        const { win, problems, run } = await openPage('index.html', 'page');
        const read = `return {
            dark: document.documentElement.getAttribute('data-theme') === 'dark',
            font: document.documentElement.style.getPropertyValue('--body-font-size'),
        };`;
        assert.deepEqual(await run(read), { dark: false, font: '14px' });
        await run(
            `window.e2e.changeConfig('theme', 'dark'); window.e2e.changeConfig('bodyFontSize', 17);`,
        );
        assert.deepEqual(await run(read), { dark: true, font: '17px' });
        assert.deepEqual(problems, []);
        win.destroy();
    },

    async '"System" theme follows the OS while running; About uses the theme'() {
        nativeTheme.themeSource = 'light';
        const { win, run } = await openPage('index.html', 'system');
        const isDark = `return document.documentElement.getAttribute('data-theme') === 'dark';`;
        assert.equal(await run(isDark), false);
        nativeTheme.themeSource = 'dark'; // like switching Windows/macOS to dark mode
        await sleep(300);
        assert.equal(await run(isDark), true);
        nativeTheme.themeSource = 'system';
        win.destroy();

        const about = await openPage('about.html', 'dark');
        assert.equal(await about.run(isDark), true, 'about window applies the dark theme');
        about.win.destroy();
    },

    async 'sign-in screen is shown when not connected'() {
        const { win, problems, run } = await openPage('index.html', 'auth');
        assert.match(await run(`return document.body.textContent;`), /Connect to Notion/);
        assert.deepEqual(problems, []);
        win.destroy();
    },

    async 'settings and about pages load without errors'() {
        for (const page of ['settings.html', 'about.html']) {
            const { win, problems, run } = await openPage(page, 'page');
            assert.ok(
                (await run(`return document.querySelector('#app').children.length;`)) > 0,
                page,
            );
            assert.deepEqual(problems, [], page);
            win.destroy();
        }
    },

    async 'settings: Updates page shows the update status'() {
        const { win, problems, run } = await openPage('settings.html', 'page');
        const text = await run(
            `location.hash = 'updates';
             await new Promise((r) => setTimeout(r, 300));
             return document.querySelector('.update-card')?.textContent ?? '';`,
        );
        assert.match(text, /up to date/i);
        assert.match(text, /Check for updates/);
        assert.deepEqual(problems, []);
        win.destroy();
    },
};

app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
    let failed = 0;
    for (const [name, test] of Object.entries(tests)) {
        try {
            await test();
            console.log(`  ✓ ${name}`);
        } catch (error) {
            failed++;
            console.log(`  ✗ ${name}\n    ${error.stack ?? error}`);
        }
    }
    console.log(failed ? `\n${failed} UI test(s) failed` : '\nAll UI tests passed');
    app.exit(failed ? 1 : 0);
});

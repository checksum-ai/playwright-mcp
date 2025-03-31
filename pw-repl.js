// node --experimental-repl-await ./repl.js <port>
// v1.18 API
// To connect to a test run, in the test itself add test.use({
//     storageState: 'tests/auth.json',
//     launchOptions: {
//         args: ['--remote-debugging-port=9222']
//     }
// });

const repl = require("repl");
const playwright = require("playwright");
const config = {
  headless: false,
  storageState: "tests/auth.json",
  actionTimeout: 1000,
  args: [
    // https://tink.uk/playing-with-the-accessibility-object-model-aom/
    "--enable-blink-features=AccessibilityObjectModel",
  ],
};
const completions = [".help", ".exit", ".load", ".save", "playwright"];

// https://nodejs.org/api/readline.html#readline_use_of_the_completer_function
function completer(line) {
  const hits = completions.filter((c) => c.startsWith(line));
  return [hits.length ? hits : completions, line];
}

(async () => {
  if (process.argv[2]) {
    const port = process.argv[2];
    const browser = await playwright.chromium.connectOverCDP(
      "http://127.0.0.1:" + port
    );
    const context = browser.contexts()[0];
    context.setDefaultTimeout(1000);
    context.setDefaultNavigationTimeout(5000);
    const page = context.pages()[0];
    debugger;
    return { browser, context, page };
  }

  const browser = await playwright.chromium.launch(config);
  const context = await browser.newContext({
    viewport: null,
  });
  const page = await context.newPage();
  const client = await page.context().newCDPSession(page);
  await client.send("Accessibility.enable");
  await client.send("Runtime.enable");
  await client.send("DOM.enable");
  return { browser, context, page, client };
})().then((props) => {
  completions.push(...Object.keys(props));
  const r = repl.start({
    prompt: "> ",
    useColors: true,
    preview: true,
    completer,
  });
  Object.assign(r.context, props);
});

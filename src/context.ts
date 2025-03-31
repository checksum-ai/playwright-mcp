/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as playwright from "playwright";

export class Context {
  private _launchOptions: playwright.LaunchOptions | undefined;
  private _browser: playwright.Browser | undefined;
  private _page: playwright.Page | undefined;
  private _console: playwright.ConsoleMessage[] = [];
  private _initializePromise: Promise<void> | undefined;
  private _logger: (data: unknown) => Promise<void>;
  constructor(
    launchOptions?: playwright.LaunchOptions,
    logger?: (data: unknown) => Promise<void>
  ) {
    this._launchOptions = launchOptions;
    this._logger = logger ?? (async () => {});
  }

  async ensurePage(): Promise<playwright.Page> {
    await this._initialize();
    return this._page!;
  }

  async ensureConsole(): Promise<playwright.ConsoleMessage[]> {
    await this._initialize();
    return this._console;
  }

  async log(data: unknown) {
    await this._logger(data);
  }

  async close() {
    const page = await this.ensurePage();
    await page.close();
  }

  private async _initialize() {
    if (this._initializePromise) return this._initializePromise;
    this._initializePromise = (async () => {
      // Check if we should use CDP mode
      // TODO: Remove this once we have a better way to handle the connection
      const useCDP = true;
      this._browser = await createBrowser(
        this._launchOptions,
        useCDP,
        this._logger
      );

      // When connecting over CDP, get the first context and page instead of creating new ones
      if (useCDP) {
        const contexts = this._browser.contexts();
        const context = contexts[0];
        const pages = await context.pages();
        await this._logger(pages);

        this._page = pages[0];
      } else {
        this._page = await this._browser.newPage();
      }

      this._page.on("console", (event) => this._console.push(event));
      this._page.on("framenavigated", (frame) => {
        if (!frame.parentFrame()) this._console.length = 0;
      });
      this._page.on("close", () => this._reset());
    })();
    return this._initializePromise;
  }

  private _reset() {
    const browser = this._browser;
    this._initializePromise = undefined;
    this._browser = undefined;
    this._page = undefined;
    this._console.length = 0;
    void browser?.close();
  }
}

async function createBrowser(
  launchOptions?: playwright.LaunchOptions,
  useCDP: boolean = false,
  logger: (data: unknown) => Promise<void> = async () => {}
): Promise<playwright.Browser> {
  await logger("createBrowser");
  if (process.env.PLAYWRIGHT_WS_ENDPOINT) {
    const url = new URL(process.env.PLAYWRIGHT_WS_ENDPOINT);
    url.searchParams.set("launch-options", JSON.stringify(launchOptions));
    return await playwright.chromium.connect(String(url));
  }
  // Support connecting to Chrome debugging port
  if (useCDP) {
    await logger("createBrowser useCDP");
    const port = process.env.CHROME_DEBUGGING_PORT || 9222;
    return await playwright.chromium.connectOverCDP("http://127.0.0.1:" + port);
  }
  return await playwright.chromium.launch({
    channel: "chrome",
    ...launchOptions,
  });
}

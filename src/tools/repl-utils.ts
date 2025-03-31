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
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Define constants and variables
const TEMP_DIR = os.tmpdir();
// TODO env variable
const INTERNAL_UTILS_PATH = path.join(
    '/Users/galvered/Dev/checksum-customer-engineering/tools'
);
const REPL_UTILS_PATH = path.join(INTERNAL_UTILS_PATH, 'repl.js');

export interface ReplMessage {
  timestamp: number; // Unix timestamp
  code?: string; // The code to be executed
  result?: string; // The result/output of the execution
  type?: 'success' | 'error'; // The type of result (only used in internal-utils.ts)
}

export function readReplMessage(): ReplMessage {
  const message = JSON.parse(
      fs.readFileSync(path.join(INTERNAL_UTILS_PATH, 'message.json'), 'utf-8')
  );
  return message;
}

export function executePlaywrightCode(
  code: string,
  timeout: number = 60000
): ReplMessage {
  let codeToExecute = code + '\n;';
  codeToExecute = codeToExecute.replace(/"/g, '\\"');

  try {
    execSync(`node ${REPL_UTILS_PATH} "${codeToExecute}"`, {
      stdio: 'inherit',
      timeout,
    });
    // Read and return the message if execSync completes successfully.
    const message = readReplMessage();
    return message;
  } catch (error: any) {
    // In case of any error (including timeouts), return a message with error details.
    return {
      timestamp: Date.now(),
      code,
      result: error?.message || error?.toString() || 'Unknown error',
      type: 'error',
    };
  }
}

export function replHealhCheck(): boolean {
  const execution = executePlaywrightCode(
      `console.log("Repl Health Check");`,
      3000
  );
  if (execution.type === 'success') {
    return true;
  } else {
    throw new Error(
        'REPL is not working. Make sure the browser is in repl mode with CLI mode turned on'
    );
  }
}

export function getVariableStore() {
  const execution = executePlaywrightCode(
      `console.log(Object.fromEntries(Object.values(variablesStore.store).map(v => [v.name, v.value])));`,
      3000
  );
  const match = execution.result?.match(/{.*}/s);
  if (!match)
    throw new Error('Could not parse variable store');

  return JSON.parse(match[0]);
}

export function getScreenshot() {
  // TODO handle errors
  const screenshotPath = path.join(
      TEMP_DIR,
      'screenshots',
      `${Date.now()}.png`
  );
  executePlaywrightCode(
      `await page.screenshot({ path: '${screenshotPath}' });;;`
  );
  const screenshotBuffer = fs.readFileSync(screenshotPath);
  return screenshotBuffer.toString('base64');
}

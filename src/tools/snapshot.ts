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

import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

import { captureAriaSnapshot, runAndWait } from './utils';

import type * as playwright from 'playwright';
import type { Tool } from './tool';

import * as prettier from 'prettier';

export const snapshot: Tool = {
  schema: {
    name: 'browser_snapshot',
    description:
      'Capture accessibility snapshot of the current page, this is better than screenshot',
    inputSchema: zodToJsonSchema(z.object({})),
  },

  handle: async context => {
    return await captureAriaSnapshot(await context.ensurePage());
  },
};

const elementSchema = z.object({
  element: z
      .string()
      .describe(
          'Human-readable element description used to obtain permission to interact with the element'
      ),
  ref: z
      .string()
      .describe('Exact target element reference from the page snapshot'),
});

export const click: Tool = {
  schema: {
    name: 'browser_click',
    description: 'Perform click on a web page',
    inputSchema: zodToJsonSchema(elementSchema),
  },

  handle: async (context, params) => {
    const validatedParams = elementSchema.parse(params);
    return runAndWait(
        context,
        `"${validatedParams.element}" clicked`,
        page => refLocator(page, validatedParams.ref).click(),
        true
    );
  },
};

const dragSchema = z.object({
  startElement: z
      .string()
      .describe(
          'Human-readable source element description used to obtain the permission to interact with the element'
      ),
  startRef: z
      .string()
      .describe('Exact source element reference from the page snapshot'),
  endElement: z
      .string()
      .describe(
          'Human-readable target element description used to obtain the permission to interact with the element'
      ),
  endRef: z
      .string()
      .describe('Exact target element reference from the page snapshot'),
});

export const drag: Tool = {
  schema: {
    name: 'browser_drag',
    description: 'Perform drag and drop between two elements',
    inputSchema: zodToJsonSchema(dragSchema),
  },

  handle: async (context, params) => {
    const validatedParams = dragSchema.parse(params);
    return runAndWait(
        context,
        `Dragged "${validatedParams.startElement}" to "${validatedParams.endElement}"`,
        async page => {
          const startLocator = refLocator(page, validatedParams.startRef);
          const endLocator = refLocator(page, validatedParams.endRef);
          await startLocator.dragTo(endLocator);
        },
        true
    );
  },
};

export const hover: Tool = {
  schema: {
    name: 'browser_hover',
    description: 'Hover over element on page',
    inputSchema: zodToJsonSchema(elementSchema),
  },

  handle: async (context, params) => {
    const validatedParams = elementSchema.parse(params);
    return runAndWait(
        context,
        `Hovered over "${validatedParams.element}"`,
        page => refLocator(page, validatedParams.ref).hover(),
        true
    );
  },
};

const typeSchema = elementSchema.extend({
  text: z.string().describe('Text to type into the element'),
  submit: z
      .boolean()
      .describe('Whether to submit entered text (press Enter after)'),
});

export const type: Tool = {
  schema: {
    name: 'browser_type',
    description: 'Type text into editable element',
    inputSchema: zodToJsonSchema(typeSchema),
  },

  handle: async (context, params) => {
    const validatedParams = typeSchema.parse(params);
    return await runAndWait(
        context,
        `Typed "${validatedParams.text}" into "${validatedParams.element}"`,
        async page => {
          const locator = refLocator(page, validatedParams.ref);
          await locator.fill(validatedParams.text);
          if (validatedParams.submit)
            await locator.press('Enter');
        },
        true
    );
  },
};

export const getElementOuterHTML: Tool = {
  schema: {
    name: 'browser_get_element_outer_html',
    description: 'Get the outer HTML of a specified element',
    inputSchema: zodToJsonSchema(elementSchema),
  },

  handle: async (context, params) => {
    const validatedParams = elementSchema.parse(params);
    return runAndWait(
        context,
        `"extracted ${validatedParams.element}" outerHTML`,
        async page => {
          const html = await refLocator(page, validatedParams.ref).evaluate(
              el => el.outerHTML
          );
          return await formatHTML(html);
        },
        false,
        true
    );
  },
};

export const getElementAncestorHTML: Tool = {
  schema: {
    name: 'browser_get_ancestor_html',
    description:
      "Traverses up the DOM tree from the specified element, returning the largest ancestor's HTML that doesn't exceed 8000 characters",
    inputSchema: zodToJsonSchema(elementSchema),
  },

  handle: async (context, params) => {
    const validatedParams = elementSchema.parse(params);
    return runAndWait(
        context,
        `"extracted ${validatedParams.element}" ancestor HTML`,
        async page => {
          const locator = refLocator(page, validatedParams.ref);
          let currentHTML = await locator.evaluate(el => el.outerHTML);
          let currentElement = locator;

          while (true) {
          // Try to get parent element
            const parentElement = currentElement.locator('..');
            const parentHTML = await parentElement.evaluate(el => el.outerHTML);

            // If parent HTML exceeds 8000 chars, return current HTML
            if (parentHTML.length > 8000)
              return await formatHTML(currentHTML);

            // Update current element and HTML for next iteration
            currentElement = parentElement;
            currentHTML = parentHTML;

            // Check if we've reached the top (body or html element)
            const tagName = await currentElement.evaluate(el =>
              el.tagName.toLowerCase()
            );
            if (tagName === 'body' || tagName === 'html')
              return await formatHTML(currentHTML);
          }
        },
        false,
        true
    );
  },
};

function refLocator(page: playwright.Page, ref: string): playwright.Locator {
  return page.locator(`aria-ref=${ref}`);
}

async function formatHTML(html: string): Promise<string> {
  return await prettier.format(html, { parser: 'html' });
}

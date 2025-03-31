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

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Context } from './context';

import type { Tool } from './tools/tool';
import type { Resource } from './resources/resource';
import type { LaunchOptions } from 'playwright';

export function createServerWithTools(
  name: string,
  version: string,
  tools: Tool[],
  resources: Resource[],
  launchOption?: LaunchOptions
): Server {
  const server = new Server(
      { name, version },
      {
        capabilities: {
          tools: {},
          resources: {},
          logging: {},
        },
      }
  );

  // TODO pass more robust logging solution
  async function log(data: unknown) {
    await server.sendLoggingMessage({
      level: 'info',
      data,
    });
  }
  const context = new Context(launchOption, log);

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: tools.map(tool => tool.schema) };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: resources.map(resource => resource.schema) };
  });

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const tool = tools.find(tool => tool.schema.name === request.params.name);
    if (!tool) {
      return {
        content: [
          { type: 'text', text: `Tool "${request.params.name}" not found` },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.handle(context, request.params.arguments);
      return result;
    } catch (error) {
      return {
        content: [{ type: 'text', text: String(error) }],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async request => {
    const resource = resources.find(
        resource => resource.schema.uri === request.params.uri
    );
    if (!resource)
      return { contents: [] };

    const contents = await resource.read(context, request.params.uri);
    return { contents };
  });

  server.close = async () => {
    await server.close();
    await context.close();
  };

  return server;
}

/**
 * Fastify Instance Mock
 *
 * Mock para FastifyInstance usado em testes unitários de routes
 */

import { vi } from 'vitest';

export interface MockReply {
  status: (code: number) => MockReply;
  type: (type: string) => MockReply;
  send: (payload: any) => any;
}

export class MockFastifyInstance {
  private routes: Map<string, any> = new Map();

  // Mock the get method to register routes
  get = vi.fn().mockImplementation((path: string, options: any, handler?: any) => {
    // If called with 3 arguments, the third is the handler
    if (handler) {
      this.routes.set(path, { method: 'get', path, handler, options });
      return this;
    }
    // If called with 2 arguments and second is the handler
    if (typeof options === 'function') {
      this.routes.set(path, { method: 'get', path, handler: options });
      return this;
    }
    return this;
  });

  post = vi.fn().mockImplementation((path: string, options: any, handler?: any) => {
    if (handler) {
      this.routes.set(path, { method: 'post', path, handler, options });
      return this;
    }
    if (typeof options === 'function') {
      this.routes.set(path, { method: 'post', path, handler: options });
      return this;
    }
    return this;
  });

  put = vi.fn().mockImplementation((path: string, options: any, handler?: any) => {
    if (handler) {
      this.routes.set(path, { method: 'put', path, handler, options });
      return this;
    }
    if (typeof options === 'function') {
      this.routes.set(path, { method: 'put', path, handler: options });
      return this;
    }
    return this;
  });

  patch = vi.fn().mockImplementation((path: string, options: any, handler?: any) => {
    if (handler) {
      this.routes.set(path, { method: 'patch', path, handler, options });
      return this;
    }
    if (typeof options === 'function') {
      this.routes.set(path, { method: 'patch', path, handler: options });
      return this;
    }
    return this;
  });

  delete = vi.fn().mockImplementation((path: string, options: any, handler?: any) => {
    if (handler) {
      this.routes.set(path, { method: 'delete', path, handler, options });
      return this;
    }
    if (typeof options === 'function') {
      this.routes.set(path, { method: 'delete', path, handler: options });
      return this;
    }
    return this;
  });

  // Mock the inject method for testing
  inject = vi.fn().mockImplementation(async (options: any) => {
    const route = this.routes.get(options.url);

    if (!route) {
      return {
        statusCode: 404,
        body: null,
      };
    }

    try {
      const request = { headers: {}, query: {} };
      const mockReply: MockReply = {
        status: vi.fn().mockReturnThis(),
        type: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };

      const result = await route.handler(request, mockReply as any);

      // If the handler returned something directly
      if (result !== undefined) {
        return {
          statusCode: 200,
          body: result,
        };
      }

      // If send was called
      if (mockReply.send.mock.calls.length > 0) {
        const statusCall = mockReply.status.mock.calls.find((call: any[]) => call[0]);
        const sendCall = mockReply.send.mock.calls[0];
        return {
          statusCode: statusCall ? statusCall[0] : 200,
          body: sendCall ? sendCall[0] : null,
        };
      }

      return {
        statusCode: 200,
        body: null,
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: { error: error instanceof Error ? error.message : 'Internal server error' },
      };
    }
  });

  // Clear all registered routes and mocks
  reset(): void {
    this.routes.clear();
    this.get.mockClear();
    this.post.mockClear();
    this.put.mockClear();
    this.patch.mockClear();
    this.delete.mockClear();
    this.inject.mockClear();
  }

  // Get registered routes for testing
  getRoutes(): Map<string, any> {
    return this.routes;
  }
}

/**
 * Create a mock Fastify instance
 */
export function createMockFastify(): MockFastifyInstance & {
  inject: any;
  get: any;
  post: any;
  put: any;
  patch: any;
  delete: any;
} {
  return new MockFastifyInstance() as any;
}

/**
 * Vitest mock for fastify module
 */
vi.mock('fastify', () => ({
  default: vi.fn().mockImplementation(() => createMockFastify()),
  fastify: vi.fn().mockImplementation(() => createMockFastify()),
}));

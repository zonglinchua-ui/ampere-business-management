import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NextRequest } from 'next/server';

import { GET, POST } from './route';

const createDeps = () => {
  const calls: Record<string, unknown[]> = {};

  const record = (key: string, value: unknown) => {
    calls[key] = calls[key] ? [...calls[key], value] : [value];
  };

  return {
    calls,
    deps: {
      getSession: async () => ({ user: { id: 'user-1' } }),
      client: {
        tableView: {
          findMany: async (args: unknown) => {
            record('findMany', args);
            return [
              {
                id: 'view-1',
                name: 'Finance view',
                columnVisibility: { amount: true },
                tableId: 'finance',
                userId: 'user-1',
                isDefault: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ];
          },
          updateMany: async (args: unknown) => {
            record('updateMany', args);
            return { count: 1 };
          },
          findUnique: async () => null,
          update: async () => null,
          create: async (args: any) => {
            record('create', args);
            return {
              id: 'view-2',
              ...args.data,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          },
        },
      },
    },
  };
};

describe('Table view API', () => {
  it('returns saved views for the requesting user', async () => {
    const { deps, calls } = createDeps();
    const response = await GET(
      new NextRequest('http://localhost/api/table-views?tableId=finance'),
      deps as any
    );

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.views.length, 1);
    assert.deepEqual(calls.findMany?.[0], {
      where: { userId: 'user-1', tableId: 'finance' },
      orderBy: [
        { isDefault: 'desc' },
        { updatedAt: 'desc' },
      ],
    });
  });

  it('saves a new default view and resets existing defaults', async () => {
    const { deps, calls } = createDeps();
    deps.getSession = async () => ({ user: { id: 'user-2' } });

    const response = await POST(
      new NextRequest('http://localhost/api/table-views', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Custom view',
          tableId: 'projects',
          columnVisibility: { status: false },
          isDefault: true,
        }),
      }),
      deps as any
    );

    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.view.name, 'Custom view');
    assert.deepEqual(calls.updateMany?.[0], {
      where: { userId: 'user-2', tableId: 'projects' },
      data: { isDefault: false },
    });
    assert.equal(calls.create?.length, 1);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';

import { GET, POST } from './route';

const createDeps = () => {
  const calls: Record<string, unknown[]> = {};
  const responses: {
    findMany?: Prisma.TableViewUncheckedCreateInput[];
    findUnique?: Prisma.TableViewUncheckedCreateInput | null;
    update?: Prisma.TableViewUncheckedCreateInput | null;
    create?: Prisma.TableViewUncheckedCreateInput | null;
  } = {};

  const record = (key: string, value: unknown) => {
    calls[key] = calls[key] ? [...calls[key], value] : [value];
  };

  return {
    calls,
    responses,
    deps: {
      getSession: async () => ({ user: { id: 'user-1' } }),
      client: {
        tableView: {
          findMany: async (args: Prisma.TableViewFindManyArgs) => {
            record('findMany', args);
            return (
              responses.findMany ?? [
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
              ]
            ).map((view) => ({
              ...view,
              createdAt: new Date(),
              updatedAt: new Date(),
            }));
          },
          updateMany: async (args: Prisma.TableViewUpdateManyArgs) => {
            record('updateMany', args);
            return { count: 1 };
          },
          findUnique: async (args: Prisma.TableViewFindUniqueArgs) => {
            record('findUnique', args);
            return responses.findUnique ?? null;
          },
          update: async (args: Prisma.TableViewUpdateArgs) => {
            record('update', args);
            return {
              id: 'view-2',
              ...responses.update,
              ...args.data,
              updatedAt: new Date(),
              createdAt: new Date(),
            };
          },
          create: async (args: Prisma.TableViewCreateArgs) => {
            record('create', args);
            return {
              id: 'view-2',
              ...responses.create,
              ...args.data,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          },
        },
        $transaction: async <T>(operations: Promise<T>[]) => {
          record('$transaction', operations);
          return Promise.all(operations);
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

  it('returns 401 for unauthenticated requests', async () => {
    const { deps } = createDeps();
    deps.getSession = async () => null as any;

    const getResponse = await GET(
      new NextRequest('http://localhost/api/table-views?tableId=finance'),
      deps as any
    );
    const postResponse = await POST(
      new NextRequest('http://localhost/api/table-views', {
        method: 'POST',
        body: JSON.stringify({ tableId: 'finance', name: 'Test', columnVisibility: {} }),
      }),
      deps as any
    );

    assert.equal(getResponse.status, 401);
    assert.equal(postResponse.status, 401);
  });

  it('validates payload shape', async () => {
    const { deps } = createDeps();

    const response = await POST(
      new NextRequest('http://localhost/api/table-views', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Invalid',
          tableId: 'finance',
          columnVisibility: 'not-an-object',
        }),
      }),
      deps as any
    );

    assert.equal(response.status, 400);
  });

  it('does not clear defaults when updating a missing view', async () => {
    const { deps, calls } = createDeps();

    const response = await POST(
      new NextRequest('http://localhost/api/table-views', {
        method: 'POST',
        body: JSON.stringify({
          id: 'missing-id',
          name: 'Update attempt',
          tableId: 'finance',
          columnVisibility: {},
          isDefault: true,
        }),
      }),
      deps as any
    );

    assert.equal(response.status, 404);
    assert.equal(calls.updateMany?.length ?? 0, 0);
    assert.equal(calls.$transaction?.length ?? 0, 0);
  });

  it('prevents cross-user updates', async () => {
    const { deps, calls, responses } = createDeps();
    deps.getSession = async () => ({ user: { id: 'user-2' } });
    responses.findUnique = {
      id: 'view-1',
      userId: 'user-1',
      tableId: 'finance',
      name: 'Other user',
      columnVisibility: {},
      isDefault: false,
    } as Prisma.TableViewUncheckedCreateInput;

    const response = await POST(
      new NextRequest('http://localhost/api/table-views', {
        method: 'POST',
        body: JSON.stringify({
          id: 'view-1',
          name: 'Update attempt',
          tableId: 'finance',
          columnVisibility: {},
          isDefault: true,
        }),
      }),
      deps as any
    );

    assert.equal(response.status, 404);
    assert.equal(calls.updateMany?.length ?? 0, 0);
    assert.equal(calls.$transaction?.length ?? 0, 0);
  });
});

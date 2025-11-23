import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

const tableViewSchema = z.object({
  id: z.string().optional(),
  tableId: z.string().min(1),
  name: z.string().min(1),
  columnVisibility: z.record(z.boolean()),
  isDefault: z.boolean().optional(),
});

type TableViewDeps = {
  getSession: typeof getServerSession;
  client: typeof prisma;
};

const defaultDeps: TableViewDeps = {
  getSession: (options) => getServerSession(options),
  client: prisma,
};

export async function GET(
  request: NextRequest,
  deps: TableViewDeps = defaultDeps
) {
  try {
    const session = await deps.getSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get('tableId');

    if (!tableId) {
      return NextResponse.json({ error: 'Missing tableId' }, { status: 400 });
    }

    const views = await deps.client.tableView.findMany({
      where: { userId: session.user.id, tableId },
      orderBy: [
        { isDefault: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    return NextResponse.json({ views }, { status: 200 });
  } catch (error) {
    console.error('[TABLE_VIEWS_GET]', error);
    return NextResponse.json(
      { error: 'Unable to load table views' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  deps: TableViewDeps = defaultDeps
) {
  try {
    const session = await deps.getSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await request.json();
    const parsed = tableViewSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    if (payload.id) {
      const existing = await deps.client.tableView.findUnique({
        where: { id: payload.id },
      });

      if (!existing || existing.userId !== session.user.id) {
        return NextResponse.json({ error: 'View not found' }, { status: 404 });
      }

      const update = deps.client.tableView.update({
        where: { id: payload.id },
        data: {
          name: payload.name,
          tableId: payload.tableId,
          columnVisibility: payload.columnVisibility,
          isDefault: payload.isDefault ?? existing.isDefault,
        },
      });

      const view = payload.isDefault
        ? (
            await deps.client.$transaction([
              deps.client.tableView.updateMany({
                where: { userId: session.user.id, tableId: payload.tableId },
                data: { isDefault: false },
              }),
              update,
            ])
          )[1]
        : await update;

      return NextResponse.json({ view }, { status: 200 });
    }

    const create = deps.client.tableView.create({
      data: {
        name: payload.name,
        tableId: payload.tableId,
        columnVisibility: payload.columnVisibility,
        isDefault: payload.isDefault ?? false,
        userId: session.user.id,
      },
    });

    const view = payload.isDefault
      ? (
          await deps.client.$transaction([
            deps.client.tableView.updateMany({
              where: { userId: session.user.id, tableId: payload.tableId },
              data: { isDefault: false },
            }),
            create,
          ])
        )[1]
      : await create;

    return NextResponse.json({ view }, { status: 201 });
  } catch (error) {
    console.error('[TABLE_VIEWS_POST]', error);
    return NextResponse.json(
      { error: 'Unable to persist table view' },
      { status: 500 }
    );
  }
}

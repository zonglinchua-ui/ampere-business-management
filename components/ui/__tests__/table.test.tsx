import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  Table,
  TableBody,
  TableCell,
  TableColumnVisibilityToggle,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

describe('Table column visibility', () => {
  const renderTable = (visibility: Record<string, boolean>) =>
    renderToStaticMarkup(
      <Table columnVisibility={visibility} onColumnVisibilityChange={() => {}}>
        <TableHeader>
          <TableRow>
            <TableHead columnKey="name">Name</TableHead>
            <TableHead columnKey="status">Status</TableHead>
            <TableHead columnKey="amount">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell columnKey="name">Alpha</TableCell>
            <TableCell columnKey="status">Active</TableCell>
            <TableCell columnKey="amount">$100</TableCell>
          </TableRow>
        </TableBody>
        <TableColumnVisibilityToggle
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'status', label: 'Status' },
            { key: 'amount', label: 'Amount' },
          ]}
        />
      </Table>
    );

  it('marks columns as hidden when visibility is false', () => {
    const visibleMarkup = renderTable({ name: true, status: true, amount: true });
    const hiddenMarkup = renderTable({ name: true, status: false, amount: true });

    assert.ok(!visibleMarkup.includes('data-column-key="status" hidden'));
    assert.ok(hiddenMarkup.includes('data-column-key="status" hidden'));

    const statusHeaderHidden = /<th[^>]*data-column-key="status"[^>]*hidden/;
    assert.ok(statusHeaderHidden.test(hiddenMarkup));
    assert.ok(!statusHeaderHidden.test(visibleMarkup));
  });

  it('reflects column visibility in toggle state', () => {
    const visibleToggleMarkup = renderTable({ name: true, status: true, amount: true });
    const hiddenToggleMarkup = renderTable({ name: true, status: false, amount: true });

    assert.ok(visibleToggleMarkup.includes('aria-label="Status"'));
    assert.ok(visibleToggleMarkup.includes('data-state="checked"'));
    assert.ok(
      hiddenToggleMarkup.includes('aria-label="Status"') &&
        hiddenToggleMarkup.includes('data-state="unchecked"')
    );

    const statusHeader = /<th[^>]*data-column-key="status"/;
    const statusHeaderHidden = /<th[^>]*data-column-key="status"[^>]*hidden/;
    assert.ok(statusHeader.test(visibleToggleMarkup));
    assert.ok(statusHeaderHidden.test(hiddenToggleMarkup));
  });
});

import * as React from 'react';

import { cn } from '@/lib/utils';

type TableColumnVisibility = Record<string, boolean>;

type TableViewConfig = {
  id?: string;
  name: string;
  columnVisibility: TableColumnVisibility;
  isDefault?: boolean;
};

type TableContextValue = {
  columnVisibility?: TableColumnVisibility;
  onColumnVisibilityChange?: (visibility: TableColumnVisibility) => void;
  savedViews?: TableViewConfig[];
  onSelectView?: (viewId: string) => void;
  onSaveView?: (view: TableViewConfig) => void;
  activeViewId?: string;
  stickyHeader?: boolean;
};

const TableContext = React.createContext<TableContextValue>({});

const useTableContext = () => React.useContext(TableContext);

const isColumnHidden = (
  columnKey?: string,
  columnVisibility?: TableColumnVisibility
) => {
  if (!columnKey || !columnVisibility) return false;
  return columnVisibility[columnKey] === false;
};

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  stickyHeader?: boolean;
  columnVisibility?: TableColumnVisibility;
  onColumnVisibilityChange?: (visibility: TableColumnVisibility) => void;
  savedViews?: TableViewConfig[];
  onSelectView?: (viewId: string) => void;
  onSaveView?: (view: TableViewConfig) => void;
  activeViewId?: string;
};

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  (
    {
      className,
      stickyHeader = true,
      columnVisibility,
      onColumnVisibilityChange,
      savedViews,
      onSelectView,
      onSaveView,
      activeViewId,
      ...props
    },
    ref
  ) => (
    <TableContext.Provider
      value={{
        columnVisibility,
        onColumnVisibilityChange,
        savedViews,
        onSelectView,
        onSaveView,
        activeViewId,
        stickyHeader,
      }}
    >
      <div className="relative w-full overflow-x-auto rounded-lg border bg-card">
        <table
          ref={ref}
          className={cn(
            'w-full min-w-[640px] caption-bottom text-sm align-middle',
            className
          )}
          {...props}
        />
      </div>
    </TableContext.Provider>
  )
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => {
  const { stickyHeader } = useTableContext();

  return (
    <thead
      ref={ref}
      className={cn(
        '[&_tr]:border-b',
        stickyHeader && 'sticky top-0 z-20 bg-card shadow-sm',
        className
      )}
      {...props}
    />
  );
});
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
      className
    )}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

type TableHeadProps = React.ThHTMLAttributes<HTMLTableCellElement> & {
  columnKey?: string;
};

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, columnKey, ...props }, ref) => {
    const { columnVisibility } = useTableContext();
    const hidden = isColumnHidden(columnKey, columnVisibility);

    return (
      <th
        ref={ref}
        className={cn(
          'h-12 px-4 text-left align-middle font-medium text-muted-foreground backdrop-blur [&:has([role=checkbox])]:pr-0',
          hidden && 'hidden',
          className
        )}
        aria-hidden={hidden}
        data-column-key={columnKey}
        hidden={hidden}
        {...props}
      />
    );
  }
);
TableHead.displayName = 'TableHead';

type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  columnKey?: string;
};

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, columnKey, ...props }, ref) => {
    const { columnVisibility } = useTableContext();
    const hidden = isColumnHidden(columnKey, columnVisibility);

    return (
      <td
        ref={ref}
        className={cn(
          'p-4 align-middle [&:has([role=checkbox])]:pr-0',
          hidden && 'hidden',
          className
        )}
        aria-hidden={hidden}
        data-column-key={columnKey}
        hidden={hidden}
        {...props}
      />
    );
  }
);
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-muted-foreground', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
export type { TableColumnVisibility, TableViewConfig };

type TableColumnToggleProps = {
  columns: { key: string; label: string }[];
  className?: string;
};

const TableColumnVisibilityToggle: React.FC<TableColumnToggleProps> = ({
  columns,
  className,
}) => {
  const { columnVisibility, onColumnVisibilityChange } = useTableContext();
  const effectiveVisibility = columnVisibility ?? {};

  if (!onColumnVisibilityChange) return null;

  const handleToggle = (key: string) => {
    const current = effectiveVisibility[key] ?? true;
    onColumnVisibilityChange({
      ...effectiveVisibility,
      [key]: !current,
    });
  };

  return (
    <div
      className={cn('flex flex-wrap gap-3 text-sm text-muted-foreground', className)}
      aria-label="Column visibility controls"
    >
      {columns.map((column) => {
        const isVisible = effectiveVisibility[column.key] ?? true;

        return (
          <label key={column.key} className="flex items-center gap-2">
            <input
              aria-label={column.label}
              type="checkbox"
              className="h-4 w-4 rounded border-muted-foreground/50 accent-primary"
              checked={isVisible}
              aria-checked={isVisible}
              data-state={isVisible ? 'checked' : 'unchecked'}
              onChange={() => handleToggle(column.key)}
            />
            <span>{column.label}</span>
          </label>
        );
      })}
    </div>
  );
};

type TableViewSwitcherProps = {
  className?: string;
};

const TableViewSwitcher: React.FC<TableViewSwitcherProps> = ({ className }) => {
  const { savedViews, activeViewId, onSelectView } = useTableContext();

  if (!savedViews?.length || !onSelectView) return null;

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <label className="text-muted-foreground" htmlFor="table-view-select">
        Saved view
      </label>
      <select
        id="table-view-select"
        className="rounded-md border bg-card px-3 py-2"
        value={activeViewId ?? ''}
        onChange={(event) => onSelectView(event.target.value)}
      >
        <option value="">Default</option>
        {savedViews.map((view) => (
          <option key={view.id ?? view.name} value={view.id ?? view.name}>
            {view.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export { TableColumnVisibilityToggle, TableViewSwitcher };

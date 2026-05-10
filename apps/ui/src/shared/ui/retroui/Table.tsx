import {
  createElement,
  forwardRef,
  type ElementType,
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";

import { cn } from "#shared/lib/utils.ts";

const tablePart = <Element extends HTMLElement, Props extends HTMLAttributes<Element>>(
  displayName: string,
  element: ElementType,
  defaultClassName: string,
) => {
  const Component = forwardRef<Element, Props>(({ className, ...props }, ref) =>
    createElement(element, {
      ...props,
      ref,
      className: cn(defaultClassName, className),
    }),
  );
  Component.displayName = displayName;
  return Component;
};

const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative h-full w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm border-2 shadow-lg", className)}
        {...props}
      />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = tablePart<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  "TableHeader",
  "thead",
  "[&_tr]:border-b bg-primary text-primary-foreground font-head",
);

const TableBody = tablePart<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  "TableBody",
  "tbody",
  "[&_tr:last-child]:border-0",
);

const TableFooter = tablePart<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  "TableFooter",
  "tfoot",
  "border-t bg-accent font-medium [&>tr]:last:border-b-0",
);

const TableRow = tablePart<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  "TableRow",
  "tr",
  "border-b transition-colors hover:bg-primary/50 hover:text-primary-foreground data-[state=selected]:bg-muted",
);

const TableHead = tablePart<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  "TableHead",
  "th",
  "h-10 md:h-12 px-4 text-left align-middle font-medium text-primary-foreground [&:has([role=checkbox])]:pr-0",
);

const TableCell = tablePart<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  "TableCell",
  "td",
  "p-2 md:p-3 align-middle [&:has([role=checkbox])]:pr-0",
);

const TableCaption = tablePart<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
  "TableCaption",
  "caption",
  "my-2 text-sm text-muted-foreground",
);

const TableObj = Object.assign(Table, {
  Header: TableHeader,
  Body: TableBody,
  Footer: TableFooter,
  Row: TableRow,
  Head: TableHead,
  Cell: TableCell,
  Caption: TableCaption,
});

export { TableObj as Table };

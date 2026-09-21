/**
 * Cirvee OS design system.
 *
 * Every component here references the ROLE tokens declared in src/styles.css
 * (`surface`, `canvas`, `border`, `text`, `accent`…) rather than a ramp step,
 * so the dark theme is one re-declaration rather than a sweep of `dark:`
 * classes. Ramp steps appear only for semantic accents that have no role
 * token — a success badge's `success-fill` / `success-ink`, for instance.
 */

/* -- Primitives ----------------------------------------------------------- */
export { Button } from './Button'
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button'

export { IconButton } from './IconButton'
export type { IconButtonProps } from './IconButton'

export { Input, INPUT_HEIGHTS, INPUT_FIELD, INPUT_SHELL } from './Input'
export type { InputProps, InputSize } from './Input'

export { Textarea } from './Textarea'
export type { TextareaProps } from './Textarea'

export { Select } from './Select'
export type { SelectProps, SelectOption } from './Select'

export { Checkbox } from './Checkbox'
export type { CheckboxProps } from './Checkbox'

export { Radio, RadioGroup } from './Radio'
export type { RadioProps, RadioGroupProps } from './Radio'

export { Switch } from './Switch'
export type { SwitchProps } from './Switch'

export { Label } from './Label'
export type { LabelProps } from './Label'

export { FieldError } from './FieldError'
export type { FieldErrorProps } from './FieldError'

export { Field } from './Field'
export type { FieldProps } from './Field'

export { SearchInput } from './SearchInput'
export type { SearchInputProps } from './SearchInput'

export { CurrencyInput } from './CurrencyInput'
export type { CurrencyInputProps } from './CurrencyInput'

/* -- Display -------------------------------------------------------------- */
export { Card, CardHeader, CardBody, CardFooter } from './Card'
export type { CardProps, CardHeaderProps, CardBodyProps, CardFooterProps, CardPadding } from './Card'

export { StatCard } from './StatCard'
export type { StatCardProps, StatCardDelta, StatCardVariant, DeltaTone } from './StatCard'

export { Badge } from './Badge'
export type { BadgeProps, BadgeTone, BadgeVariant, BadgeSize } from './Badge'

export { StatusBadge, statusTone, normaliseStatus } from './StatusBadge'
export type { StatusBadgeProps } from './StatusBadge'

export { Avatar, AvatarGroup } from './Avatar'
export type { AvatarProps, AvatarGroupProps, AvatarSize } from './Avatar'

export { PersonChip } from './PersonChip'
export type { PersonChipProps } from './PersonChip'

export { MoneyCell } from './MoneyCell'
export type { MoneyCellProps, MoneyTone } from './MoneyCell'

export { UnitTag, UNIT_META, BUSINESS_UNITS } from './UnitTag'
export type { UnitTagProps } from './UnitTag'

export { ProgressBar } from './ProgressBar'
export type { ProgressBarProps, ProgressTone } from './ProgressBar'

export { Separator } from './Separator'
export type { SeparatorProps } from './Separator'

export { KeyValue, KeyValueList } from './KeyValue'
export type { KeyValueProps, KeyValueListProps } from './KeyValue'

export { Timeline } from './Timeline'
export type { TimelineProps, TimelineItem, TimelineTone } from './Timeline'

export { Skeleton, SkeletonText, SkeletonCard, SkeletonTable } from './Skeleton'
export type {
  SkeletonProps,
  SkeletonTextProps,
  SkeletonCardProps,
  SkeletonTableProps,
} from './Skeleton'

/* -- Layout & feedback ---------------------------------------------------- */
export { PageHeader } from './PageHeader'
export type { PageHeaderProps, Breadcrumb } from './PageHeader'

export { SectionHeader } from './SectionHeader'
export type { SectionHeaderProps } from './SectionHeader'

export { EmptyState } from './EmptyState'
export type { EmptyStateProps, EmptyStateVariant } from './EmptyState'

export { Spinner, LoadingPanel } from './Spinner'
export type { SpinnerProps, SpinnerSize, LoadingPanelProps } from './Spinner'

export { Modal } from './Modal'
export type { ModalProps, ModalSize } from './Modal'

export { Drawer } from './Drawer'
export type { DrawerProps, DrawerSize } from './Drawer'

export { ConfirmDialog } from './ConfirmDialog'
export type { ConfirmDialogProps } from './ConfirmDialog'

export { Popover, PopoverItem, PopoverLabel, PopoverSeparator } from './Popover'
export type { PopoverProps, PopoverItemProps } from './Popover'

export { Tooltip } from './Tooltip'
export type { TooltipProps } from './Tooltip'

export { Tabs, TabPanel } from './Tabs'
export type { TabsProps, TabItem, TabPanelProps } from './Tabs'

export { Alert } from './Alert'
export type { AlertProps, AlertTone } from './Alert'

/* -- Data-dense ----------------------------------------------------------- */
export { DataTable } from './DataTable'
export type {
  DataTableProps,
  Column,
  ColumnAlign,
  SortState,
  SortDirection,
  TableDensity,
} from './DataTable'

export { FilterBar } from './FilterBar'
export type { FilterBarProps, FilterDef, FilterValues } from './FilterBar'

export { Pagination } from './Pagination'
export type { PaginationProps } from './Pagination'

export { BulkActionBar } from './BulkActionBar'
export type { BulkActionBarProps } from './BulkActionBar'

export { TableToolbar } from './TableToolbar'
export type { TableToolbarProps } from './TableToolbar'

export { ColumnPicker, useColumnVisibility } from './ColumnPicker'
export type { ColumnCatalogueEntry, ColumnPickerProps } from './ColumnPicker'

/* -- Overlay internals (for building new overlays on the same discipline) -- */
export {
  useFocusTrap,
  useBodyScrollLock,
  useOnClickOutside,
  useAnchoredPosition,
  getFocusable,
  FOCUSABLE_SELECTOR,
} from './internal/overlay'
export type { Side, Align, AnchorOptions, AnchoredPosition, FocusTrapOptions } from './internal/overlay'

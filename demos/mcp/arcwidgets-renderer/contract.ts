import { z } from 'zod';

const field = z.string().min(1).max(80).refine(
  value => !['__proto__', 'prototype', 'constructor'].includes(value),
  'Reserved field name',
);
const scalar = z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.null()]);
export const columnSchema = z.object({
  field: field.describe('Exact key in each row; never invent missing data.'),
  title: z.string().min(1).max(100),
  width: z.enum(['auto', '100px', '160px', '240px']).default('auto'),
  format: z.enum(['text', 'number', 'currency', 'date']).default('text'),
  currency: z.enum(['EUR', 'USD', 'GBP']).optional(),
}).strict();

/** A serializable subset mapped to the published widget's header/row API. */
export const renderSchema = z.object({
  title: z.string().min(1).max(160),
  source: z.string().min(1).max(160).describe('Human-readable provenance, not a URL to fetch.'),
  rows: z.array(z.record(field, scalar)).max(200).describe('Actual records returned by the data tool. Maximum 200.'),
  config: z.object({
    idField: field.describe('Unique nonempty string or finite numeric record ID.'),
    columns: z.array(columnSchema).min(1).max(12),
    groupBy: field.optional(),
    sort: z.object({ field, direction: z.enum(['asc', 'desc']) }).strict().optional(),
  }).strict(),
}).strict();
export type RenderInput = z.infer<typeof renderSchema>;

export function validateRender(value: unknown): RenderInput {
  const parsed = renderSchema.parse(value);
  const { config, rows } = parsed;
  const required = new Set([config.idField, ...config.columns.map(c => c.field),
    ...(config.groupBy ? [config.groupBy] : []), ...(config.sort ? [config.sort.field] : [])]);
  if (new Set(config.columns.map(c => c.field)).size !== config.columns.length)
    throw new Error('config.columns: each field may appear only once.');
  for (const col of config.columns) {
    if (col.format === 'currency' && !col.currency)
      throw new Error(`config.columns.${col.field}: currency format requires currency.`);
  }
  const ids = new Set<string>();
  rows.forEach((row, index) => {
    for (const key of required) {
      if (!Object.hasOwn(row, key)) throw new Error(`rows[${index}].${key}: field missing; retrieve it from the data source or remove it from the view.`);
    }
    const id = row[config.idField];
    if (!((typeof id === 'string' && id.trim()) || typeof id === 'number'))
      throw new Error(`rows[${index}].${config.idField}: expected a nonempty string or numeric ID.`);
    if (ids.has(String(id))) throw new Error(`rows[${index}].${config.idField}: duplicate ID ${id}.`);
    ids.add(String(id));
    for (const col of config.columns) {
      const cell = row[col.field];
      if (cell === null) continue;
      if (['number', 'currency'].includes(col.format) && typeof cell !== 'number')
        throw new Error(`rows[${index}].${col.field}: ${col.format} requires a number or null.`);
      if (col.format === 'date' && !(typeof cell === 'string' && isDate(cell)))
        throw new Error(`rows[${index}].${col.field}: date requires a real YYYY-MM-DD date or null.`);
    }
  });
  return parsed;
}

export function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function sortedRows(input: RenderInput) {
  const sort = input.config.sort;
  if (!sort) return [...input.rows];
  return [...input.rows].sort((a, b) => {
    const left = a[sort.field], right = b[sort.field];
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    const compare = typeof left === 'number' && typeof right === 'number'
      ? left - right : String(left).localeCompare(String(right), 'en', { numeric: true });
    return sort.direction === 'asc' ? compare : -compare;
  });
}

export function formatCell(value: RenderInput['rows'][number][string], col: RenderInput['config']['columns'][number]) {
  if (value === null) return '—';
  if (col.format === 'number') return new Intl.NumberFormat('en-GB').format(value as number);
  if (col.format === 'currency') return new Intl.NumberFormat('en-GB', { style: 'currency', currency: col.currency }).format(value as number);
  if (col.format === 'date') return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value as string));
  return String(value);
}

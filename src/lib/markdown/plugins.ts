import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { sanitizeConfig } from './sanitizeConfig';
import type { PluggableList } from 'unified';

export const remarkPlugins: PluggableList = [
  remarkGfm,
];

export const rehypePlugins: PluggableList = [
  [rehypeSanitize, sanitizeConfig],
];

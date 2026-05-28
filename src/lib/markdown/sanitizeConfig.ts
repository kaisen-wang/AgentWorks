import type { Options } from 'rehype-sanitize';

export const sanitizeConfig: Options = {
  tagNames: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'div', 'span',
    'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
    'code', 'pre',
    'blockquote',
    'ul', 'ol', 'li',
    'a', 'img',
    'br', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'input',
  ],
  attributes: {
    '*': ['className', 'id'],
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    input: ['type', 'checked', 'disabled'],
    code: ['className'],
    pre: ['className'],
  },
  protocols: {
    href: ['https', 'mailto'],
    src: ['https', 'data'],
  },
};

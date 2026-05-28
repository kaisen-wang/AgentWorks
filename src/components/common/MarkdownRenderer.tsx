import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { remarkPlugins, rehypePlugins } from '@/lib/markdown/plugins';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
  enableSyntaxHighlighting?: boolean;
  enableGFM?: boolean;
  className?: string;
  maxLength?: number;
  onError?: (error: Error) => void;
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({
  content,
  enableSyntaxHighlighting = true,
  enableGFM = true,
  className,
  maxLength = 10000,
  onError,
}: MarkdownRendererProps) {
  // 内容截断
  const truncatedContent = useMemo(() => {
    return content.length > maxLength
      ? content.slice(0, maxLength) + '\n\n... (内容过长已截断)'
      : content;
  }, [content, maxLength]);

  // 自定义组件映射
  const components = enableSyntaxHighlighting
    ? { code: CodeBlock }
    : {};

  try {
    return (
      <div className={`markdown-body ${className || ''}`}>
        <ReactMarkdown
          remarkPlugins={enableGFM ? remarkPlugins : []}
          rehypePlugins={rehypePlugins}
          components={components}
        >
          {truncatedContent}
        </ReactMarkdown>
      </div>
    );
  } catch (error) {
    onError?.(error as Error);
    return (
      <div className="markdown-error">
        <p className="text-red-500">渲染失败，显示原始内容：</p>
        <pre>{content}</pre>
      </div>
    );
  }
});

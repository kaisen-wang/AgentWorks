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

/**
 * 自定义 pre 组件：处理代码块
 *
 * react-markdown 将 fenced code block 渲染为 <pre><code className="language-xxx">
 * 通过替换 pre 组件，避免代码块被 <p> 包裹导致 DOM 嵌套错误
 */
function PreBlock({ children }: { children?: React.ReactNode }) {
  // children 是 <code> 元素，由 CodeBlock 组件处理
  return <>{children}</>;
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
  // - pre: 代码块外层，替换为 fragment 避免 <p> 嵌套 <pre>
  // - code: 代码内容，由 CodeBlock 处理语法高亮
  const components = enableSyntaxHighlighting
    ? { pre: PreBlock, code: CodeBlock }
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

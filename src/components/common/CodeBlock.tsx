import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { ReactNode } from 'react';

interface CodeBlockProps {
  children?: ReactNode;
  className?: string;
  showLineNumbers?: boolean;
  showCopyButton?: boolean;
  node?: unknown;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
    >
      {copied ? '已复制' : '复制'}
    </button>
  );
}

export const CodeBlock = React.memo(function CodeBlock({
  children,
  className,
  showLineNumbers = false,
  showCopyButton = true,
  node,
}: CodeBlockProps) {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'text';

  // TODO: 从主题上下文获取当前主题
  const theme = 'dark'; // 临时硬编码
  const style = theme === 'dark' ? vscDarkPlus : vs;

  // 将children转换为字符串
  const codeString = typeof children === 'string' ? children : String(children || '');

  // 判断是否为代码块（有 className/language-xxx）vs 行内代码
  // 代码块：react-markdown 会将 <pre><code className="language-xxx"> 传递
  // 行内代码：react-markdown 会将 <code> 传递（无 className）
  const isCodeBlock = !!className;

  if (!isCodeBlock) {
    // 行内代码：返回简单的 <code> 元素
    return <code className="px-1 py-0.5 rounded bg-gray-700/50 text-sm font-mono">{codeString}</code>;
  }

  return (
    <div className="relative">
      <SyntaxHighlighter
        language={language}
        style={style}
        showLineNumbers={showLineNumbers}
        customStyle={{ margin: 0, borderRadius: '0.5rem' }}
      >
        {codeString}
      </SyntaxHighlighter>
      {showCopyButton && <CopyButton text={codeString} />}
    </div>
  );
});

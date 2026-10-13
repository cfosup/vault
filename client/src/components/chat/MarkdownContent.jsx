import React, { useMemo } from 'react';
import { marked } from 'marked';

// Configure marked options for clean GitHub-flavored markdown
marked.setOptions({
  gfm: true,
  breaks: true,
});

export const MarkdownContent = ({ content }) => {
  const html = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content);
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownContent;

import React, { useEffect } from 'react';

export default function Head({ children }: { children?: React.ReactNode }) {
  useEffect(() => {
    React.Children.forEach(children, (child: any) => {
      if (child && child.type === 'title' && typeof child.props?.children === 'string') {
        document.title = child.props.children;
      }
    });
  }, [children]);

  return null;
}

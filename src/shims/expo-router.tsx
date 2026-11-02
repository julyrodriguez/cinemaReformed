import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

export function Redirect({ href }: { href: string }) {
  return <Navigate to={href} replace />;
}

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, { replace: true }),
    back: () => navigate(-1),
  };
}

export function useSegments(): string[] {
  const location = useLocation();
  return location.pathname.split('/').filter(Boolean);
}

export function Stack({ children }: { children?: React.ReactNode; screenOptions?: any }) {
  return <>{children}</>;
}

export function Link({
  href,
  children,
  style,
}: {
  href: string;
  children: React.ReactNode;
  style?: any;
}) {
  const navigate = useNavigate();
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        navigate(href);
      }}
      style={style}
    >
      {children}
    </a>
  );
}

export default {
  Redirect,
  useRouter,
  useSegments,
  Stack,
  Link,
};

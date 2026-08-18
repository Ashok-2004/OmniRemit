import React, { type ReactNode } from 'react';
import { MainLayout } from './layout/MainLayout';

interface LayoutProps {
  children?: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return <MainLayout />;
}

import React, { type ReactNode } from 'react';

interface SectionContainerProps {
  title?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export default function SectionContainer({ title, icon, children, className = '' }: SectionContainerProps) {
  return (
    <div className={`section-container ${className}`}>
      {title && (
        <h4 className="info-section-title">
          {icon}
          <span>{title}</span>
        </h4>
      )}
      {children}
    </div>
  );
}

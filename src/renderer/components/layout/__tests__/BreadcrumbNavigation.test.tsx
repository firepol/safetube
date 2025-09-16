import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { BreadcrumbNavigation, BreadcrumbItem } from '../BreadcrumbNavigation';

// Import vi type for proper TypeScript support
import type { MockedFunction } from 'vitest';

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

const MockedUseNavigate = useNavigate as MockedFunction<typeof useNavigate>;

const renderBreadcrumbNavigation = (items: BreadcrumbItem[]) => {
  const mockNavigate = vi.fn();
  MockedUseNavigate.mockReturnValue(mockNavigate);

  const utils = render(
    <MemoryRouter>
      <BreadcrumbNavigation items={items} />
    </MemoryRouter>
  );

  return { ...utils, mockNavigate };
};

describe('BreadcrumbNavigation', () => {
  it('should render a single item without separator', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', path: '/' }
    ];

    renderBreadcrumbNavigation(items);

    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByText('›')).not.toBeInTheDocument();
  });

  it('should render multiple items with separators', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', path: '/' },
      { label: 'Videos', path: '/videos' },
      { label: 'Current Video', isActive: true }
    ];

    renderBreadcrumbNavigation(items);

    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Videos' })).toBeInTheDocument();
    expect(screen.getByText('Current Video')).toBeInTheDocument();
    expect(screen.getAllByText('›')).toHaveLength(2);
  });

  it('should navigate when clicking clickable items', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', path: '/' },
      { label: 'Videos', path: '/videos' }
    ];

    const { mockNavigate } = renderBreadcrumbNavigation(items);

    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(mockNavigate).toHaveBeenCalledWith('/');

    fireEvent.click(screen.getByRole('button', { name: 'Videos' }));
    expect(mockNavigate).toHaveBeenCalledWith('/videos');
  });

  it('should not navigate when clicking active items', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', path: '/' },
      { label: 'Current', path: '/current', isActive: true }
    ];

    const { mockNavigate } = renderBreadcrumbNavigation(items);

    // Active item should not be a button
    expect(screen.queryByRole('button', { name: 'Current' })).not.toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not navigate when clicking items without path', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', path: '/' },
      { label: 'Non-clickable' }
    ];

    const { mockNavigate } = renderBreadcrumbNavigation(items);

    // Non-clickable item should not be a button
    expect(screen.queryByRole('button', { name: 'Non-clickable' })).not.toBeInTheDocument();
    expect(screen.getByText('Non-clickable')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('should apply custom className', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', path: '/' }
    ];

    const { container } = renderBreadcrumbNavigation(items);
    const nav = container.querySelector('nav');

    expect(nav).toHaveClass('flex', 'items-center', 'space-x-2', 'text-sm');
  });

  it('should style active items differently', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', path: '/' },
      { label: 'Active Item', isActive: true }
    ];

    renderBreadcrumbNavigation(items);

    const activeItem = screen.getByText('Active Item');
    expect(activeItem).toHaveClass('text-gray-900', 'font-semibold');
  });

  it('should style clickable items with hover effects', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Clickable', path: '/clickable' }
    ];

    renderBreadcrumbNavigation(items);

    const clickableItem = screen.getByRole('button', { name: 'Clickable' });
    expect(clickableItem).toHaveClass('text-blue-600', 'hover:text-blue-800', 'hover:underline');
  });
});
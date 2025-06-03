import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KidScreen } from './KidScreen';

describe('KidScreen', () => {
  it('renders the page title', () => {
    render(<KidScreen />);
    expect(screen.getByText('My Videos')).toBeInTheDocument();
  });

  it('renders all sample videos', () => {
    render(<KidScreen />);
    
    // Check for video titles
    expect(screen.getByText('Never Gonna Give You Up')).toBeInTheDocument();
    expect(screen.getByText('Me at the zoo')).toBeInTheDocument();
    expect(screen.getByText('Family Vacation 2023')).toBeInTheDocument();
    expect(screen.getByText('Birthday Party')).toBeInTheDocument();
    expect(screen.getByText('School Project')).toBeInTheDocument();
    expect(screen.getByText('Dance Recital')).toBeInTheDocument();
    
    // Check for video type headers
    const headers = screen.getAllByRole('heading', { level: 2 });
    expect(headers).toHaveLength(3);
    expect(headers[0]).toHaveTextContent('youtube');
    expect(headers[1]).toHaveTextContent('dlna');
    expect(headers[2]).toHaveTextContent('local');
  });
}); 
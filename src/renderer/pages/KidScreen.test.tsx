import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KidScreen } from './KidScreen';
import { MemoryRouter } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';

const renderWithProvider = (component: React.ReactNode) => {
  return render(
    <MemoryRouter>
      <Tooltip.Provider>
        {component}
      </Tooltip.Provider>
    </MemoryRouter>
  );
};

describe('KidScreen', () => {
  it('renders the page title', () => {
    renderWithProvider(<KidScreen />);
    expect(screen.getByText('Kid-Friendly Videos')).toBeInTheDocument();
  });

  it('renders all sample videos', () => {
    renderWithProvider(<KidScreen />);
    // Check for a few sample videos
    expect(screen.getByText('The Top 10 Goals of May | Top Goals | Serie A 2024/25')).toBeInTheDocument();
    expect(screen.getByText('Venturino scores')).toBeInTheDocument();
  });
}); 
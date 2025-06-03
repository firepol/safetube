import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KidScreen } from './KidScreen';
import * as Tooltip from '@radix-ui/react-tooltip';
import { MemoryRouter } from 'react-router-dom';
import videos from '../data/videos.json';

describe('KidScreen', () => {
  const renderWithProvider = (ui: React.ReactElement) =>
    render(
      <MemoryRouter>
        <Tooltip.Provider>{ui}</Tooltip.Provider>
      </MemoryRouter>
    );

  it('renders the page title', () => {
    renderWithProvider(<KidScreen />);
    expect(screen.getByText('My Videos')).toBeInTheDocument();
  });

  it('renders all sample videos', () => {
    renderWithProvider(<KidScreen />);
    // Check for video titles
    videos.forEach((v) => {
      expect(screen.getByText(v.title)).toBeInTheDocument();
    });
    // Check the number of video cards
    const allTitles = videos.map((v) => v.title);
    const renderedTitles = screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent);
    expect(renderedTitles.filter((t) => allTitles.includes(t!)).length).toBe(videos.length);
  });
}); 
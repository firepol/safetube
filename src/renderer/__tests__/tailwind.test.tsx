import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Test component to verify Tailwind CSS is working
const TailwindTestComponent = () => {
  return (
    <div data-testid="tailwind-test">
      <div className="bg-red-500 text-white p-4 m-2 rounded" data-testid="red-box">
        Red Box with Tailwind
      </div>
      <div className="bg-blue-500 text-white p-4 m-2 rounded" data-testid="blue-box">
        Blue Box with Tailwind
      </div>
      <div className="font-bold text-lg" data-testid="bold-text">
        Bold Large Text
      </div>
    </div>
  );
};

describe('Tailwind CSS Integration', () => {
  it('should render components with Tailwind classes', () => {
    render(<TailwindTestComponent />);
    
    // Check that elements are rendered
    expect(screen.getByTestId('tailwind-test')).toBeInTheDocument();
    expect(screen.getByTestId('red-box')).toBeInTheDocument();
    expect(screen.getByTestId('blue-box')).toBeInTheDocument();
    expect(screen.getByTestId('bold-text')).toBeInTheDocument();
  });

  it('should apply Tailwind CSS styles to elements', () => {
    render(<TailwindTestComponent />);
    
    const redBox = screen.getByTestId('red-box');
    const blueBox = screen.getByTestId('blue-box');
    const boldText = screen.getByTestId('bold-text');
    
    // Check computed styles to verify Tailwind is applied
    const redBoxStyles = window.getComputedStyle(redBox);
    const blueBoxStyles = window.getComputedStyle(blueBox);
    const boldTextStyles = window.getComputedStyle(boldText);
    
    // Verify background colors are applied
    const validRedBg = [
      'rgb(239, 68, 68)',
      'rgb(239 68 68 / var(--tw-bg-opacity, 1))',
      'rgb(239 68 68 / 1)'
    ];
    const validBlueBg = [
      'rgb(59, 130, 246)',
      'rgb(59 130 246 / var(--tw-bg-opacity, 1))',
      'rgb(59 130 246 / 1)'
    ];
    expect(validRedBg).toContain(redBoxStyles.backgroundColor); // bg-red-500
    expect(validBlueBg).toContain(blueBoxStyles.backgroundColor); // bg-blue-500
    
    // Verify text colors are applied
    const validWhiteText = [
      'rgb(255, 255, 255)',
      'rgb(255 255 255 / var(--tw-text-opacity, 1))',
      'rgb(255 255 255 / 1)'
    ];
    expect(validWhiteText).toContain(redBoxStyles.color); // text-white
    expect(validWhiteText).toContain(blueBoxStyles.color); // text-white
    
    // Verify padding is applied
    const validPadding = ['16px', '1rem'];
    expect(validPadding).toContain(redBoxStyles.padding); // p-4
    expect(validPadding).toContain(blueBoxStyles.padding); // p-4
    
    // Verify margin is applied
    const validMargin = ['8px', '0.5rem'];
    expect(validMargin).toContain(redBoxStyles.margin); // m-2
    
    // Verify font weight is applied
    expect(boldTextStyles.fontWeight).toBe('700'); // font-bold
  });

  it('should have Tailwind CSS loaded in the document', () => {
    // Check if Tailwind CSS is loaded by looking for specific utility classes
    const styleSheets = Array.from(document.styleSheets);
    let tailwindFound = false;
    
    for (const sheet of styleSheets) {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules || []);
        for (const rule of rules) {
          if (rule instanceof CSSStyleRule) {
            // Look for Tailwind utility classes
            if (rule.selectorText.includes('.bg-red-500') || 
                rule.selectorText.includes('.text-white') ||
                rule.selectorText.includes('.p-4')) {
              tailwindFound = true;
              break;
            }
          }
        }
      } catch (e) {
        // CORS errors can occur when accessing external stylesheets
        continue;
      }
    }
    
    expect(tailwindFound).toBe(true);
  });
}); 
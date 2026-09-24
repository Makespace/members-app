/**
 * @jest-environment jsdom
 */

import {render} from '../../../src/queries/roadmap/render';

const renderPage = () => {
  const rendered = render();
  const body = document.createElement('body');
  body.innerHTML = rendered;
  return body;
};

describe('/roadmap render', () => {
  it('renders a single timeline with a heading node per theme', () => {
    const page = renderPage();
    expect(page.querySelectorAll('ul.timeline').length).toBe(1);
    const headings = page.querySelectorAll('li.timeline__item--heading');
    expect(headings.length).toBe(12);
    headings.forEach(item => {
      expect(item.querySelector('h2')).not.toBeNull();
    });
  });

  it('marks a fully shipped theme with a ticked heading node', () => {
    const page = renderPage();
    const doneHeadings = page.querySelectorAll(
      'li.timeline__item--heading.timeline__item--complete'
    );
    expect(doneHeadings.length).toBe(3);
    const texts = [...doneHeadings].map(node => node.textContent ?? '');
    expect(texts.join(' ')).toContain('Trouble ticket management');
    expect(texts.join(' ')).toContain('Notifications');
    // Equipment management has shipped work but is no longer fully done: PAT
    // testing details are still to come.
    expect(texts.join(' ')).not.toContain('Equipment management');
  });

  it('shows the planned themes of work', () => {
    const page = renderPage();
    expect(page.textContent).toContain("Owner's agreement");
    expect(page.textContent).toContain('Trouble ticket management in the app');
    expect(page.textContent).toContain(
      'Making it easier for members to get trained'
    );
  });

  it('shows planned items as subtasks of their theme', () => {
    const page = renderPage();
    expect(page.textContent).toContain('Training scheduling in the app');
    expect(page.textContent).toContain(
      'Bring trouble tickets into the event timeline'
    );
    const subtasks = page.querySelectorAll(
      'li.timeline__item:not(.timeline__item--heading)'
    );
    expect(subtasks.length).toBeGreaterThan(20);
  });

  it('marks completed items with a filled, ticked circle', () => {
    const page = renderPage();
    const completed = page.querySelectorAll('li.timeline__item--complete');
    expect(completed.length).toBeGreaterThan(0);
    completed.forEach(item => {
      expect(item.querySelector('.timeline__marker')?.textContent).toContain(
        '✓'
      );
    });
  });

  it('marks in-progress items with a half-filled circle and no tick', () => {
    const page = renderPage();
    const inProgress = page.querySelectorAll('li.timeline__item--in-progress');
    expect(inProgress.length).toBe(2);
    inProgress.forEach(item => {
      expect(
        item.querySelector('.timeline__marker')?.textContent?.trim()
      ).toBe('');
    });
  });

  it('leaves planned items with an empty circle', () => {
    const page = renderPage();
    const planned = page.querySelectorAll(
      'li.timeline__item:not(.timeline__item--complete)'
    );
    expect(planned.length).toBeGreaterThan(0);
    planned.forEach(item => {
      expect(
        item.querySelector('.timeline__marker')?.textContent?.trim()
      ).toBe('');
    });
  });
});

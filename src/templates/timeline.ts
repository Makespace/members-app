import {Html, html, joinHtml, safe} from '../types/html';

type TimelineStatus = 'todo' | 'inProgress' | 'done';

type TimelineItem = {
  content: Html;
  status: TimelineStatus;
  heading: boolean;
};

export const heading = (
  title: Html,
  opts: {done?: boolean} = {}
): TimelineItem => ({
  content: html`<h2>${title}</h2>`,
  status: opts.done ? 'done' : 'todo',
  heading: true,
});

export const done = (content: Html): TimelineItem => ({
  content,
  status: 'done',
  heading: false,
});

export const inProgress = (content: Html): TimelineItem => ({
  content,
  status: 'inProgress',
  heading: false,
});

export const todo = (content: Html): TimelineItem => ({
  content,
  status: 'todo',
  heading: false,
});

const statusClass: Record<TimelineStatus, string> = {
  todo: '',
  inProgress: 'timeline__item--in-progress',
  done: 'timeline__item--complete',
};

const itemClasses = (item: TimelineItem) =>
  safe(
    [
      'timeline__item',
      item.heading ? 'timeline__item--heading' : '',
      statusClass[item.status],
    ]
      .filter(c => c !== '')
      .join(' ')
  );

const renderItem = (item: TimelineItem) => html`
  <li class="${itemClasses(item)}">
    <span class="timeline__marker">${item.status === 'done'
      ? safe('✓')
      : ''}</span>
    <div class="timeline__content">${item.content}</div>
  </li>
`;

export const timeline = (items: ReadonlyArray<TimelineItem>): Html => html`
  <ul class="timeline">
    ${joinHtml(items.map(renderItem))}
  </ul>
`;

// What a summary email says. Kept apart from the job that sends it so the
// wording can be read, and tested, without a database or a mail server.

export type DigestLine = {
  title: string;
  place: string;
  happening: 'reported' | 'picked-up' | 'needs-help' | 'parked' | 'resolved';
  at: Date;
};

const happeningWords = (happening: DigestLine['happening']): string => {
  switch (happening) {
    case 'reported':
      return 'reported';
    case 'picked-up':
      return 'picked up';
    case 'needs-help':
      return 'needs help';
    case 'parked':
      return 'parked';
    case 'resolved':
      return 'resolved';
  }
};

const countWords = (n: number): string =>
  n === 1 ? '1 change' : `${n} changes`;

// Grouped by machine, because somebody reading this is deciding where to go
// rather than reading a list of events in order.
const byPlace = (
  lines: ReadonlyArray<DigestLine>
): ReadonlyArray<[string, ReadonlyArray<DigestLine>]> => {
  const grouped = new Map<string, DigestLine[]>();
  for (const line of lines) {
    grouped.set(line.place, [...(grouped.get(line.place) ?? []), line]);
  }
  return [...grouped.entries()].sort(([a], [b]) =>
    a.localeCompare(b, ['en-GB'])
  );
};

export const digestEmail = (
  publicUrl: string,
  cadence: 'daily' | 'weekly',
  lines: ReadonlyArray<DigestLine>
): {subject: string; text: string; html: string} => {
  const period = cadence === 'daily' ? 'today' : 'this week';
  const subject = `Trouble tickets ${period}: ${countWords(lines.length)}`;

  const groups = byPlace(lines);

  const text = [
    `Here is what happened to trouble tickets ${period}.`,
    '',
    ...groups.flatMap(([place, theirs]) => [
      place,
      ...theirs.map(line => `  - ${line.title} - ${happeningWords(line.happening)}`),
      '',
    ]),
    `See them all: ${publicUrl}/trouble-tickets`,
    '',
    `You are getting this because you asked for a ${cadence} summary. Change that: ${publicUrl}/notification-settings`,
  ].join('\n');

  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const html = `
    <mjml>
      <mj-body width="600px">
        <mj-section background-color="#fa990e">
          <mj-column>
            <mj-text align="center" color="#111" font-size="28px">MakeSpace</mj-text>
          </mj-column>
        </mj-section>
        <mj-section>
          <mj-column>
            <mj-text font-size="16px" color="#111">
              <p>Here is what happened to trouble tickets ${period}.</p>
              ${groups
                .map(
                  ([place, theirs]) => `
                    <p><strong>${escape(place)}</strong></p>
                    <ul>
                      ${theirs
                        .map(
                          line =>
                            `<li>${escape(line.title)} &mdash; ${escape(
                              happeningWords(line.happening)
                            )}</li>`
                        )
                        .join('')}
                    </ul>`
                )
                .join('')}
            </mj-text>
            <mj-button background-color="#00703c" href="${publicUrl}/trouble-tickets">See them all</mj-button>
            <mj-text font-size="13px" color="#555">
              <p>
                You are getting this because you asked for a ${cadence}
                summary.
                <a href="${publicUrl}/notification-settings">Change what you hear about</a>.
              </p>
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `;

  return {subject, text, html};
};

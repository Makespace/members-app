import mjml2html from 'mjml';

const agreementUrl = (publicUrl: string) =>
  `${publicUrl}/members/sign-owner-agreement`;

export const textEmailTemplate = (publicUrl: string) =>
  `You've been invited to sign the MakeSpace Owner Agreement. Please log in to the Members App (${publicUrl}) and visit ${agreementUrl(
    publicUrl
  )} to sign the agreement.`;

export const htmlEmailTemplate = (publicUrl: string) =>
  mjml2html(`
    <mjml>
  <mj-body width="800px">
    <mj-section background-color="#fa990e">
      <mj-column>
        <mj-text align="center" color="#111" font-size="40px">MakeSpace</mj-text>
        <mj-text font-style="italic" align="center" color="#111" font-size="30px">Member App</mj-text>
      </mj-column>
    </mj-section>
    <mj-section>
      <mj-column width="400px">
        <mj-text font-size="20px" line-height="1.3" color="#111" align="left">
					<p>You've been invited to sign the MakeSpace Owner Agreement.</p>
					<ol>
						<li>Please log in to the <a href="${publicUrl}">Members App</a>.</li>
						<li>Then view and sign the agreement.</li>
					</ol>
        </mj-text>
        <mj-text color="#111"></mj-text>
        <mj-button color="#111" background-color="#7FC436" href="${agreementUrl(
          publicUrl
        )}" font-weight="800">View Agreement</mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
    `).html;

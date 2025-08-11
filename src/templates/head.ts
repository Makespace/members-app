import {html, HtmlSubstitution} from '../types/html';

export const head = (title: HtmlSubstitution) => html`
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <title>${title} | Cambridge Makespace</title>
    <link rel="stylesheet" href="/static/styles.css" />
    <noscript
      ><style>
        .jsonly {
          display: none;
        }
      </style></noscript
    >

    <!-- Generated using https://realfavicongenerator.net -->
    <link
      rel="apple-touch-icon"
      sizes="180x180"
      href="/static/favicons/apple-touch-icon.png"
    />
    <link
      rel="icon"
      type="image/png"
      sizes="32x32"
      href="/static/favicons/favicon-32x32.png"
    />
    <link
      rel="icon"
      type="image/png"
      sizes="16x16"
      href="/static/favicons/favicon-16x16.png"
    />
    <link rel="manifest" href="/static/favicons/site.webmanifest" />
    <link
      rel="mask-icon"
      href="/static/favicons/safari-pinned-tab.svg"
      color="#5bbad5"
    />
    <link rel="shortcut icon" href="/static/favicons/favicon.ico" />
    <meta name="msapplication-TileColor" content="#2b5797" />
    <meta
      name="msapplication-config"
      content="/static/favicons/browserconfig.xml"
    />
    <meta name="theme-color" content="#ffffff" />
    <script src="https://cdn.jsdelivr.net/npm/gridjs/dist/gridjs.umd.js"></script>
    <link
      href="https://cdn.jsdelivr.net/npm/gridjs/dist/theme/mermaid.min.css"
      rel="stylesheet"
    />
    <script
      src="https://code.jquery.com/jquery-3.7.1.slim.min.js"
      integrity="sha256-kmHvs0B+OpCW5GVHUNjv9rOmY0IvSIRcf7zGUDTDQM8="
      crossorigin="anonymous"
    ></script>
    <link
      rel="preload"
      href="/static/vendor/font-awesome/webfonts/fa-regular-400.woff2"
      as="font"
      type="font/woff2"
      crossorigin="anonymous"
    />
    <link
      href="/static/vendor/font-awesome/css/fontawesome.min.css"
      rel="stylesheet"
    />
    <link
      href="/static/vendor/font-awesome/css/regular.min.css"
      rel="stylesheet"
    />
  </head>
`;

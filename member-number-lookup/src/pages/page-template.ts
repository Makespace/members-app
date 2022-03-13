export const pageTemplate = (body: string) => `
	<!DOCTYPE html>
	<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<meta http-equiv="X-UA-Compatible" content="ie=edge">
			<title>MS Member Number Lookup</title>
			<link rel="stylesheet" href="static/vanilla.css">

			<!-- Generated using https://realfavicongenerator.net -->
			<link rel="apple-touch-icon" sizes="180x180" href="/static/favicons/apple-touch-icon.png">
			<link rel="icon" type="image/png" sizes="32x32" href="/static/favicons/favicon-32x32.png">
			<link rel="icon" type="image/png" sizes="16x16" href="/static/favicons/favicon-16x16.png">
			<link rel="manifest" href="/static/favicons/site.webmanifest">
			<link rel="mask-icon" href="/static/favicons/safari-pinned-tab.svg" color="#5bbad5">
			<link rel="shortcut icon" href="/static/favicons/favicon.ico">
			<meta name="msapplication-TileColor" content="#2b5797">
			<meta name="msapplication-config" content="/static/favicons/browserconfig.xml">
			<meta name="theme-color" content="#ffffff">

		</head>
		<body>
			${body}
		</body>
	</html>
`;

import {readFileSync} from 'node:fs';

import {sheets_v4} from 'googleapis/build/src/apis/sheets/v4';

type ManualParsedEntry = {
  emailProvided: string;
  memberNumberProvided: number;
  score: number;
  maxScore: number;
  percentage: number;
  fullMarks: boolean;
  timestampEpochS: number;
  quizAnswers: Record<string, string>;
};

type ManualParsed = {
  data: sheets_v4.Schema$Spreadsheet;
  entries: ManualParsedEntry[];
};

export const EMPTY: ManualParsed = {
  data: JSON.parse(
    readFileSync('./tests/data/google_spreadsheets_empty.json', 'utf8')
  ) as sheets_v4.Schema$Spreadsheet,
  entries: [],
};
export const METAL_LATHE: ManualParsed = {
  data: JSON.parse(
    readFileSync('./tests/data/google_spreadsheets_metal_lathe.json', 'utf8')
  ) as sheets_v4.Schema$Spreadsheet,
  // Manually parsed data for testing:
  entries: [
    {
      emailProvided: 'test@makespace.com',
      memberNumberProvided: 1234,
      score: 13,
      maxScore: 14,
      percentage: 93,
      fullMarks: false,
      timestampEpochS: 1705770960,
      quizAnswers: {
        Email: 'test@makespace.com',
        'How many oil level check glasses are there on the Makespace metal lathe?':
          '3',
        'Membership number': '1234',
        Name: 'Test User',
        Score: '13 / 14',
        'The emergency brake is used:':
          'to stop the lathe if a potential or serious situation develops',
        'The end of the lathe that holds the gearboxes and chuck is called':
          'Head stock',
        'The lower gearbox is used to drive':
          'the thread drive, the power drive',
        'The part of the lathe that moves along the bed is called': 'Carriage',
        'The tail stock is mainly used for:':
          'Drilling and stabilising your work',
        Timestamp: '20/01/2024 17:16:00',
        'What are the 3 positions that the power-drive lever can be set to?':
          'Safe, carriage drive, cross-slide drive',
        'What are the 6 absolute No Nos whilst using the lathe?':
          'your job coming loose, reversing the tail-stock shaft out past the zero mark, hitting the dead stop under power drive, leaving the key in the chuck, your chuck coming loose, allowing your tool to hit the chuck',
        'What are the TWO main cuts you can do on a lathe?':
          'Long cut or end cut, Turn or cross cut',
        'What do you need to check to ensure that the chuck is on correctly and safe to use?':
          "All three of the cam-lock arrows are between their 'V' marks",
        'What is the most common accident on lathes?':
          'The cutting tool colliding with the chuck',
        'When do you need to use the buddy system when using the lathe?':
          'When you are alone in the secure workshop',
        'When is the lathe completely safe to put your hands into whilst powered?':
          'When the yellow safety cover is fully up',
        'Why should you never drive the tail stock beyond the zero position whilst the lathe is running?':
          'It will eject the tool it is holding',
      },
    },
  ],
};

export const BAMBU: ManualParsed = {
  data: JSON.parse(
    readFileSync('./tests/data/google_spreadsheets_bambu.json', 'utf8')
  ) as sheets_v4.Schema$Spreadsheet,
  entries: [
    // Manually parsed data for testing:
    {
      emailProvided: 'flonn@example.com',
      memberNumberProvided: 2222,
      score: 4,
      maxScore: 5,
      percentage: 80,
      fullMarks: false,
      timestampEpochS: 1700768963,
      quizAnswers: {
        Timestamp: '23/11/2023 19:49:23',
        'Email address': 'flonn@example.com',
        Score: '4 / 5',
        Name: 'Flonn Flatcoat',
        'Membership number': '2222',
        'This training allows you to do which of the following?':
          'Use the textured print bed, Print using ABS, Print using PLA',
        'What do you need to do prior to the practical?':
          'Pass the general safety quiz, Pass this quiz',
        'Which of the following health and safety risks apply when using the Bambu Lab printer':
          'The motion of the printer can pinch parts of your body, Some filaments emit toxic fumes when printed, The bed is a burn hazard, The Nozzles are a burn hazard',
        'Which of the following behaviours do you need to follow to avoid health and safety risks to you and other users?':
          "Close the printer door when leaving it unattended, Check the bed/nozzle temperature using the display before touching them, Check the display to confirm that the printer won't move before reaching inside the printer",
        'We want to avoid you damaging the printer. Which of the following behaviours should you be following?':
          'Remove the bed for print removal, Close AMS cover when you are not loading/unloading',
        'How do you determine what to pay for your prints (including failed ones)?':
          'Use the values calculated by Bambu Studio',
        'In an emergency how can you stop the printer from moving?':
          'Turn it off (switch on back right)',
        'What do you need to do before starting a print?':
          'Empty the poop shute, Check that the magnetic bed is clean on both sides, Check that the filaments loaded match what the printer thinks they are',
        'How may you get your print files onto the printer':
          'Send from Bambu Studio on the 3D printing PC in the classroom, Send from your own computer with Bambu Studio while in the Makespace network',
        'How many prints may you run at the same time at MakeSpace?':
          'One per process type (FDM, Resin)',
        'Which of the following are rules you need to follow?':
          'Keep prints "Safe for work", Report any issues using the trouble ticket system, Request a practical by mailing the owners only after passing all quizzes and checking for existing practicals on Meetup, Leave you name and contact details in front of the printer when printing, Cut a sharp tip on the filament before inserting it into the AMS',
        "If you see someone else's print paused as the printer suspects it has failed, what should you do?":
          'Use my best judgement on whether to abort or continue, Notify them',
      },
    },
    {
      emailProvided: 'flonn@example.com',
      memberNumberProvided: 2222,
      score: 5,
      maxScore: 5,
      percentage: 100,
      fullMarks: true,
      timestampEpochS: 1700769348,
      quizAnswers: {
        Timestamp: '23/11/2023 19:55:48',
        'Email address': 'flonn@example.com',
        Score: '5 / 5',
        Name: 'Flonn Flatcoat',
        'Membership number': '2222',
        'This training allows you to do which of the following?':
          'Print using PLA, Use the textured print bed, Print using ABS, Print using your own filaments',
        'What do you need to do prior to the practical?':
          'Pass this quiz, Pass the general safety quiz',
        'Which of the following health and safety risks apply when using the Bambu Lab printer':
          'The bed is a burn hazard, The motion of the printer can pinch parts of your body, The Nozzles are a burn hazard, Some filaments emit toxic fumes when printed',
        'Which of the following behaviours do you need to follow to avoid health and safety risks to you and other users?':
          "Close the printer door when leaving it unattended, Check the bed/nozzle temperature using the display before touching them, Check the display to confirm that the printer won't move before reaching inside the printer",
        'We want to avoid you damaging the printer. Which of the following behaviours should you be following?':
          'Close AMS cover when you are not loading/unloading, Remove the bed for print removal',
        'How do you determine what to pay for your prints (including failed ones)?':
          'Use the values calculated by Bambu Studio',
        'In an emergency how can you stop the printer from moving?':
          'Turn it off (switch on back right)',
        'What do you need to do before starting a print?':
          'Empty the poop shute, Check that the magnetic bed is clean on both sides, Check that the filaments loaded match what the printer thinks they are',
        'How may you get your print files onto the printer':
          'Send from Bambu Studio on the 3D printing PC in the classroom, Send from your own computer with Bambu Studio while in the Makespace network',
        'How many prints may you run at the same time at MakeSpace?':
          'One on Bambu or Ultimaker, one on Makrforged, one on Form3',
        'Which of the following are rules you need to follow?':
          'Keep prints "Safe for work", Report any issues using the trouble ticket system, Request a practical by mailing the owners only after passing all quizzes and checking for existing practicals on Meetup, Leave you name and contact details in front of the printer when printing, Cut a sharp tip on the filament before inserting it into the AMS',
        "If you see someone else's print paused as the printer suspects it has failed, what should you do?":
          'Use my best judgement on whether to abort or continue, Notify them',
      },
    },
    {
      emailProvided: 'flonn@example.com',
      memberNumberProvided: 2222,
      score: 12,
      maxScore: 12,
      percentage: 100,
      fullMarks: true,
      timestampEpochS: 1710249052,
      quizAnswers: {
        Timestamp: '12/03/2024 13:10:52',
        'Email address': 'flonn@example.com',
        Score: '12 / 12',
        Name: 'Flonn Flatcoat',
        'Membership number': '2222',
        'This training allows you to do which of the following?':
          'Print using your own filaments, Use the textured print bed, Print using PLA, PETG, ABS, ASA, PC, Nylon and Support Material for PLA from the AMS, Print using filament from the side load rather than the AMS, Use the smooth print bed, Print using TPU or filaments containing carbon fibre that have been side loaded',
        'What do you need to do prior to the practical?':
          'Pass this quiz, Pass the general safety quiz',
        'Which of the following health and safety risks apply when using the Bambu Lab printer':
          'The bed is a burn hazard, Some filaments emit toxic fumes when printed, The motion of the printer can pinch parts of your body, The Nozzles are a burn hazard',
        'Which of the following behaviours do you need to follow to avoid health and safety risks to you and other users?':
          "Close the printer door when leaving it unattended, Check the bed/nozzle temperature using the display before touching them, Check the display to confirm that the printer won't move before reaching inside the printer",
        'We want to avoid you damaging the printer. Which of the following behaviours should you be following?':
          'Remove the bed for print removal, Close AMS cover when you are not loading/unloading',
        'How do you determine what to pay for your prints (including failed ones)?':
          'Use the values calculated by Bambu Studio',
        'What is your fav flavour of ice-cream?':
          'Turn it off (switch on back right)',
        'What do you need to do before starting a print?':
          'Empty the poop shute, Check that the magnetic bed is clean on both sides, Check that the filaments loaded match what the printer thinks they are, Unload any side-loaded filament and put it away if not required, Check that the bed installed in the printer matches the one you want to use',
        'Which plates can you attempt to print PLA on?':
          'Engineering, Cool, Hight Temperature, Textured PEI, Smooth PEI',
        'Which plates must be kept glue free?': 'Textured PEI',
        'How should you clean the build plates?':
          'Water and soap, By scraping with a plastic tool',
        'How many pigeons does it take to transfer your files to the computer':
          'Send from Bambu Studio on the 3D printing PC in the classroom, Send from your own computer with Bambu Studio while in the Makespace network',
        'How many prints may you run at the same time at MakeSpace?':
          'One on Bambu or Ultimaker, one on Markforged, one on Form3',
        'Which of the following are rules you need to follow?':
          'Keep prints "Safe for work", Report any issues using the trouble ticket system, Request a practical by mailing the owners only after passing all quizzes and checking for existing practicals on Meetup, Leave your name and contact details in front of the printer when printing',
        "If you see someone else's print paused as the printer suspects it has failed, what should you do?":
          'Use my best judgement on whether to abort or continue, Notify them',
      },
    },
    {
      emailProvided: 'flonn@example.com',
      memberNumberProvided: 2222,
      score: 12,
      maxScore: 12,
      percentage: 100,
      fullMarks: true,
      timestampEpochS: 1710249842,
      quizAnswers: {
        Timestamp: '12/03/2024 13:24:02',
        'Email address': 'flonn@example.com',
        Score: '12 / 12',
        Name: 'Flonn Flatcoat',
        'Membership number': '2222',
        'This training allows you to do which of the following?':
          'Print using filament from the side load rather than the AMS, Print using PLA, PETG, ABS, ASA, PC, Nylon and Support Material for PLA from the AMS, Use the smooth print bed, Print using TPU or filaments containing carbon fibre that have been side loaded, Print using your own filaments, Use the textured print bed',
        'What do you need to do prior to the practical?':
          'Pass the general safety quiz, Pass this quiz',
        'Which of the following health and safety risks apply when using the Bambu Lab printer':
          'The Nozzles are a burn hazard, The bed is a burn hazard, The motion of the printer can pinch parts of your body, Some filaments emit toxic fumes when printed',
        'Which of the following behaviours do you need to follow to avoid health and safety risks to you and other users?':
          "Close the printer door when leaving it unattended, Check the bed/nozzle temperature using the display before touching them, Check the display to confirm that the printer won't move before reaching inside the printer",
        'We want to avoid you damaging the printer. Which of the following behaviours should you be following?':
          'Close AMS cover when you are not loading/unloading, Remove the bed for print removal',
        'How do you determine what to pay for your prints (including failed ones)?':
          'Use the values calculated by Bambu Studio',
        'What is your fav flavour of ice-cream?':
          'Turn it off (switch on back right)',
        'What do you need to do before starting a print?':
          'Empty the poop shute, Check that the magnetic bed is clean on both sides, Check that the filaments loaded match what the printer thinks they are, Unload any side-loaded filament and put it away if not required, Check that the bed installed in the printer matches the one you want to use',
        'Which plates can you attempt to print PLA on?':
          "Engineering (it's a bad idea, but not actually forbidden!), Cool, High Temperature, Textured PEI, Smooth PEI",
        'Which plates must be kept glue free?':
          'Hight Temperature, High Temperature and Smooth PEI when printing PLA',
        'How should you clean the build plates?':
          'Water and soap, By scraping with a plastic tool',
        'How many pigeons does it take to transfer your files to the computer':
          'Send from Bambu Studio on the 3D printing PC in the classroom, Send from your own computer with Bambu Studio while in the Makespace network',
        'How many prints may you run at the same time at MakeSpace?':
          'One on Bambu or Ultimaker, one on Markforged, one on Form3',
        'Which of the following are rules you need to follow?':
          'Keep prints "Safe for work", Report any issues using the trouble ticket system, Request a practical by mailing the owners only after passing all quizzes and checking for existing practicals on Meetup, Leave your name and contact details in front of the printer when printing',
        "If you see someone else's print paused as the printer suspects it has failed, what should you do?":
          'Use my best judgement on whether to abort or continue, Notify them',
      },
    },
  ],
};
export const LASER_CUTTER: ManualParsed = {
  data: JSON.parse(
    readFileSync('./tests/data/google_spreadsheets_laser_cutter.json', 'utf8')
  ) as sheets_v4.Schema$Spreadsheet,
  entries: [
    // Manually parsed data for testing
    // Note some entries were missing in the source spreadsheet so are treated as '' to match the spreadsheet behaviour.
    {
      emailProvided: 'sparky@example.com',
      memberNumberProvided: 1111,
      score: 24,
      maxScore: 24,
      percentage: 100,
      fullMarks: true,
      timestampEpochS: 1601214546,
      quizAnswers: {
        Timestamp: '27/09/2020 14:49:06',
        'Email address': 'sparky@example.com',
        Score: '24 / 24',
        Name: 'Sparky Border Collie',
        'Membership number': '1111',
        'What things should you do while cutting/engraving?':
          "Sit near the laser, watching it, while it's working",
        'What materials may you cut on the laser?':
          'Materials from the permitted materials list',
        'When should you clean up the laser bed?': 'Whenever you have used it',
        'Something catches fire in the laser while cutting! What should  you do?':
          'Use the CO2 extinguisher next to the laser if the fire is growing (if you are comfortable doing so)',
        'Before using the laser cutter these things should be switched on: ':
          'All of the above',
        "The material you are cutting isn't cutting all the way through. What could you do?":
          'Any of the above',
        'Where is the fire extinguisher for the laser cutter?':
          'Under the PC table betwen the laser cutters',
        'If there is an accident: ':
          'Stop the equipment, use the first aid kit above the sink in the mainspace next to the big Makespace logo, use the phone to call 999 if needed, inform management in an email to management@makespace.org',
        'Which of these materials are NOT permitted in the Makespace laser cutters?':
          '',
        'Which of these materials ARE permitted in the Makespace laser cutters?':
          '',
        'The laser beam is invisible.': '',
        'How is the laser tube cooled?': '',
        'How is the laser focus adjusted?': '',
        'Which cutting mode would be used to make a partial-depth single line?':
          '',
        'Which cutting mode would be used to "fill in" a shape?': '',
        'Which button would you press if you need to answer the door while your laser cutter job is running?':
          '',
        "It's OK to have a guest watch the laser cutter while you run to the toilet.":
          '',
        'It is always safe to open the lid of the laser cutter': '',
        'Pick the correct sequence of actions in response to fire/flames in the laser cutter [First, if there is a continuous flame]':
          '',
        'Pick the correct sequence of actions in response to fire/flames in the laser cutter [Second, if it has not gone out]':
          '',
        'Pick the correct sequence of actions in response to fire/flames in the laser cutter [Third, if it still has not gone out]':
          '',
        'Pick the correct sequence of actions in response to fire/flames in the laser cutter [Fourth, if it still has not gone out]':
          '',
        'Select all indicators on the air extractor which would prevent you from using the laser cutter':
          '',
        'Which is the main document required to certify a new material for the laser cutters?':
          '',
      },
    },
    {
      emailProvided: 'flonn@example.com',
      memberNumberProvided: 1111,
      score: 24,
      maxScore: 24,
      percentage: 100,
      fullMarks: true,
      timestampEpochS: 1601298462,
      quizAnswers: {
        Timestamp: '28/09/2020 14:07:42',
        'Email address': 'flonn@example.com',
        Score: '24 / 24',
        Name: 'Flonn Flatcoat',
        'Membership number': '1111',
        'What things should you do while cutting/engraving?':
          "Sit near the laser, watching it, while it's working",
        'What materials may you cut on the laser?':
          'Materials from the permitted materials list',
        'When should you clean up the laser bed?': 'Whenever you have used it',
        'Something catches fire in the laser while cutting! What should  you do?':
          'Use the CO2 extinguisher next to the laser if the fire is growing (if you are comfortable doing so)',
        'Before using the laser cutter these things should be switched on: ':
          'All of the above',
        "The material you are cutting isn't cutting all the way through. What could you do?":
          'Any of the above',
        'Where is the fire extinguisher for the laser cutter?':
          'Under the PC table betwen the laser cutters',
        'If there is an accident: ':
          'Stop the equipment, use the first aid kit above the sink in the mainspace next to the big Makespace logo, use the phone to call 999 if needed, inform management in an email to management@makespace.org',
        'Which of these materials are NOT permitted in the Makespace laser cutters?':
          '',
        'Which of these materials ARE permitted in the Makespace laser cutters?':
          '',
        'The laser beam is invisible.': '',
        'How is the laser tube cooled?': '',
        'How is the laser focus adjusted?': '',
        'Which cutting mode would be used to make a partial-depth single line?':
          '',
        'Which cutting mode would be used to "fill in" a shape?': '',
        'Which button would you press if you need to answer the door while your laser cutter job is running?':
          '',
        "It's OK to have a guest watch the laser cutter while you run to the toilet.":
          '',
        'It is always safe to open the lid of the laser cutter': '',
        'Pick the correct sequence of actions in response to fire/flames in the laser cutter [First, if there is a continuous flame]':
          '',
        'Pick the correct sequence of actions in response to fire/flames in the laser cutter [Second, if it has not gone out]':
          '',
        'Pick the correct sequence of actions in response to fire/flames in the laser cutter [Third, if it still has not gone out]':
          '',
        'Pick the correct sequence of actions in response to fire/flames in the laser cutter [Fourth, if it still has not gone out]':
          '',
        'Select all indicators on the air extractor which would prevent you from using the laser cutter':
          '',
        'Which is the main document required to certify a new material for the laser cutters?':
          '',
      },
    },
  ],
};

export const NOT_FOUND_ERROR = {
  errors: [
    {
      message: 'Requested entity was not found.',
      domain: 'global',
      reason: 'notFound',
    },
  ],
  code: '404',
};
export const TRAINING_SHEETS = {
  [EMPTY.data.spreadsheetId!]: EMPTY,
  [METAL_LATHE.data.spreadsheetId!]: METAL_LATHE,
  [LASER_CUTTER.data.spreadsheetId!]: LASER_CUTTER,
  [BAMBU.data.spreadsheetId!]: BAMBU,
};

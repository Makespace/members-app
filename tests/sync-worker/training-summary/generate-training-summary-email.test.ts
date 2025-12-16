import {EmailContent} from '../../../src/sync-worker/training-summary/gather-email-content';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import {EmailAddress} from '../../../src/types/email-address';
import {Email} from '../../../src/types';
import puppeteer from 'puppeteer';
import express from 'express';
import { generateTrainingSummaryEmail } from '../../../src/sync-worker/training-summary/training_summary_email';

const renderEmail = async (email: Email) => {
  const outputPath = './email_screenshot.png';
  const browser = await puppeteer.launch();
  const app = express();
  app.get('/', (req, res) => res.send(email.html));
  const server = app.listen(40000, 'localhost');
  const page = await browser.newPage();
  await page.goto('http://localhost:40000');
  await page.setViewport({width: 1080, height: 1024});
  await page.screenshot({
    path: outputPath,
  });
  await browser.close();
  await new Promise(res => server.close(res));
  return outputPath;
};

describe('Training summary email', () => {
  const emailAddress: EmailAddress = 'test@localhost' as EmailAddress;
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });
  describe('render email', () => {
    let email: Email;
    let rendered: string;
    beforeEach(async () => {
      const content: EmailContent = {
        trainingStatsPerEquipment: [],
        totalActiveMembers: 0,
        membersJoinedWithin30Days: 0,
      };
      email = generateTrainingSummaryEmail(emailAddress, content);
      rendered = await renderEmail(email);
    });

    it('Is successfully rendered', () => {
      expect(rendered).toBeDefined();
    });
  });
});

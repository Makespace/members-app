import express from 'express';
import {AddressInfo} from 'node:net';
import {Server} from 'node:http';
import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {Actor} from '../../src/types';
import {EmailAddress} from '../../src/types/email-address';
import {receiptRoutes} from '../../src/purchasing/receipt-routes';
import {receiptFilePath} from '../../src/purchasing/receipt-files';
import {initTestFramework, TestFramework} from '../read-models/test-framework';

// Uploading a receipt over real HTTP: the multipart parsing, the check that
// it's really an image or PDF, who may upload and download, and how it's
// served back.
describe('purchase receipt upload and download', () => {
  let framework: TestFramework;
  let server: Server;
  let base: string;
  let requestId: UUID;

  const PURCHASER = 201;
  const STRANGER = 202;
  const emailOf = (memberNumber: number) =>
    `m${memberNumber}@test.com` as EmailAddress;
  const asMember = (memberNumber: number): Actor => ({
    tag: 'user',
    user: {memberNumber, emailAddress: emailOf(memberNumber)},
  });
  const PDF = Buffer.from('%PDF-1.4\nthe receipt');

  const upload = (
    as: number | undefined,
    files: ReadonlyArray<{name: string; content: Buffer; type: string}>
  ) => {
    const form = new FormData();
    form.append('id', requestId);
    files.forEach(file =>
      form.append('files', new Blob([new Uint8Array(file.content)], {type: file.type}), file.name)
    );
    return fetch(
      `${base}/purchase-requests/upload-receipt?next=${encodeURIComponent(`/purchase-requests/view/${requestId}`)}`,
      {
        method: 'POST',
        body: form,
        redirect: 'manual',
        headers: as === undefined ? {} : {'x-test-member': String(as)},
      }
    );
  };
  const download = (as: number | undefined, path: string) =>
    fetch(`${base}${path}`, {
      redirect: 'manual',
      headers: as === undefined ? {} : {'x-test-member': String(as)},
    });
  const receipts = () =>
    O.match(
      () => [],
      (request: {receipts: ReadonlyArray<{fileId: UUID; filename: string}>}) =>
        request.receipts
    )(framework.sharedReadModel.purchasing.getRequest(requestId));

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const memberNumber of [PURCHASER, STRANGER]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber,
        email: emailOf(memberNumber),
        name: undefined,
        formOfAddress: undefined,
      });
    }
    const areaId = faker.string.uuid() as UUID;
    const purchasingAreaId = faker.string.uuid() as UUID;
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.area.addOwner({areaId, memberNumber: PURCHASER});
    await framework.commands.purchasingArea.create({
      id: purchasingAreaId,
      name: 'Wood Shop' as NonEmptyString,
      yearlyBudget: 500_000,
    } as never);
    await framework.commands.purchasingArea.activate({
      purchasingAreaId,
    } as never);
    await framework.commands.purchasingArea.assignArea({
      purchasingAreaId,
      areaId,
    } as never);
    await framework.commands.purchasingArea.addPurchaser({
      purchasingAreaId,
      memberNumber: PURCHASER,
    } as never);
    requestId = faker.string.uuid() as UUID;
    await framework.commands.purchaseRequest.submit({
      id: requestId,
      purchasingAreaId,
      purchaseType: 'improvements',
      affectsOtherAreas: false,
      affectedAreaIds: undefined,
      healthAndSafetyRisk: false,
      proposal: {need: '', options: [], preferred: '', risks: []},
      summary: 'Bandsaw blades' as never,
      purchases: undefined,
      justification: 'Worn out' as never,
      submittedByMemberNumber: undefined,
      buyingDirectly: true,
      amount: '50',
      outsideBudget: undefined,
      actor: asMember(PURCHASER),
    } as never);

    const app = express();
    // Stands in for the login session.
    app.use((req, _res, next) => {
      const member = req.header('x-test-member');
      (req as unknown as {session: unknown}).session =
        member === undefined
          ? {}
          : {
              passport: {
                user: {
                  memberNumber: Number(member),
                  emailAddress: emailOf(Number(member)),
                },
              },
            };
      next();
    });
    for (const route of receiptRoutes(framework.depsForCommands)) {
      app[route.method](route.path, route.handler);
    }
    server = app.listen(0);
    await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    framework.close();
  });

  it('stores an uploaded PDF, links it to the request, and serves it back', async () => {
    const response = await upload(PURCHASER, [
      {name: 'Receipt.pdf', content: PDF, type: 'application/pdf'},
    ]);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      `/purchase-requests/view/${requestId}`
    );
    const [receipt] = receipts();
    expect(receipt).toMatchObject({filename: 'Receipt.pdf'});

    const file = await download(PURCHASER, receiptFilePath(requestId, receipt.fileId));
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('application/pdf');
    expect(file.headers.get('x-content-type-options')).toBe('nosniff');
    expect(file.headers.get('content-disposition')).toBe(
      "inline; filename*=UTF-8''Receipt.pdf"
    );
    expect(Buffer.from(await file.arrayBuffer())).toStrictEqual(PDF);
  });

  it("refuses a file that isn't really an image or PDF, whatever it's called", async () => {
    const response = await upload(PURCHASER, [
      {
        name: 'receipt.pdf',
        content: Buffer.from('<html><script>alert(1)</script>'),
        type: 'application/pdf',
      },
    ]);
    expect(response.status).toBe(400);
    expect(receipts()).toStrictEqual([]);
  });

  it("won't take uploads from, or show files to, members with nothing to do with it", async () => {
    expect(
      (
        await upload(STRANGER, [
          {name: 'r.pdf', content: PDF, type: 'application/pdf'},
        ])
      ).status
    ).toBe(403);
    await upload(PURCHASER, [{name: 'r.pdf', content: PDF, type: 'application/pdf'}]);
    const path = receiptFilePath(requestId, receipts()[0].fileId);
    expect((await download(STRANGER, path)).status).toBe(403);
    const anonymous = await download(undefined, path);
    expect(anonymous.status).toBe(302);
    expect(anonymous.headers.get('location')).toContain('/log-in');
  });
});

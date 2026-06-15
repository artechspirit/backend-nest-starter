import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { Response } from 'express';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should call res.sendFile with the index.html path', () => {
      const sendFileMock = jest.fn();
      const mockRes = {
        sendFile: sendFileMock,
      } as unknown as Response;

      appController.getDocs(mockRes);

      expect(sendFileMock).toHaveBeenCalled();
      expect((sendFileMock.mock.calls[0] as string[])[0]).toContain(
        'index.html',
      );
    });
  });
});

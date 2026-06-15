import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../../database/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let mockPrismaService: {
    auditLog: {
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockPrismaService = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-id' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully write an audit log entry to database', async () => {
      const dto = {
        actorId: 'user-id',
        action: 'TEST_ACTION',
        entityType: 'TestEntity',
        entityId: 'entity-id',
        metadata: { key: 'value' },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const result = await service.create(dto);

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'user-id',
          action: 'TEST_ACTION',
          entityType: 'TestEntity',
          entityId: 'entity-id',
          metadata: { key: 'value' },
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        },
      });
      expect(result).toEqual({ id: 'audit-log-id' });
    });
  });
});

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all configured accounts (without passwords)' })
  @ApiResponse({
    status: 200,
    description: 'List of configured accounts',
    schema: {
      example: {
        count: 2,
        accounts: [
          { username: 'account1' },
          { username: 'account2' },
        ],
      },
    },
  })
  getAllAccounts() {
    return {
      count: this.accountsService.getAccountCount(),
      accounts: this.accountsService.getAllAccounts(),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get account rotation statistics' })
  @ApiResponse({
    status: 200,
    description: 'Account usage statistics',
  })
  getStats() {
    return this.accountsService.getRotationStats();
  }

  @Get('status')
  @ApiOperation({ 
    summary: 'Get account activity status',
    description: 'Returns the status of all configured accounts including whether they are active, last success/failure timestamps, and failure reasons.',
  })
  @ApiResponse({
    status: 200,
    description: 'Account activity status',
    schema: {
      example: {
        totalAccounts: 2,
        activeAccounts: 2,
        inactiveAccounts: 0,
        accounts: [
          {
            username: 'account1',
            isActive: true,
            lastSuccess: '2025-12-07T00:00:00.000Z',
            lastFailure: null,
            failureReason: null,
            consecutiveFailures: 0,
          },
        ],
      },
    },
  })
  getAccountsStatus() {
    return this.accountsService.getAccountsStatus();
  }
}
